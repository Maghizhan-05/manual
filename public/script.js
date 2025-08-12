const docFiles = [
  '/docs/operations/creation.docx',
  '/docs/operations/income_distribution.docx',
  '/docs/reports/admin.docx',
  '/docs/settlement/eod.docx',
  '/docs/settelement/UTT- MFundPlus Implementation- FSD02- User Admin Masters (1) (1).docx',
  '/docs/operations/excel_word.docx'
];

/**
 * Finds hyperlinks to .xlsx files within a specific HTML section, fetches them, 
 * converts them to HTML tables, and replaces the original links.
 * @param {HTMLElement} sectionElement - The HTML element of the section to process.
 * @param {string} docxPath - The path of the source .docx file for resolving relative links.
 */
async function renderExcelLinksInSection(sectionElement, docxPath) {
    const links = Array.from(sectionElement.querySelectorAll('a'));
    const docDirectory = docxPath.substring(0, docxPath.lastIndexOf('/') + 1);

    for (const link of links) {
        const linkText = link.textContent || '';
        if (linkText.toLowerCase().endsWith('.xlsx')) {
            const excelUrl = new URL(docDirectory + linkText, window.location.href).href;

            try {
                const response = await fetch(excelUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const tableHtml = XLSX.utils.sheet_to_html(worksheet);
                
                const tableContainer = document.createElement('div');
                tableContainer.className = 'rendered-excel-table';
                tableContainer.innerHTML = `
                    <h4>Rendered Excel File: ${linkText}</h4>
                    ${tableHtml}`;
                
                const elementToReplace = link.closest('p') || link;
                elementToReplace.replaceWith(tableContainer);

            } catch (error) {
                console.error(`Failed to fetch and render Excel file: ${excelUrl}`, error);
                link.style.color = 'red';
                link.textContent += ' (Error: File not found or failed to parse)';
            }
        }
    }
}


async function loadTopicSections(el) {
  if (event) {
    event.preventDefault();
  }
  
  const topic = el.textContent.replace(/▶/g, '').replace(/\s+/g, ' ').trim();
  const viewer = document.getElementById('viewer');
  document.getElementById('searchBox').value = '';
  viewer.innerHTML = `<p>⏳ Searching documents for "<b>${topic}</b>"...</p>`;

  // Quick Links Logic
  const quickLinksContainer = document.getElementById('quickLinksContainer');
  const quickLinksList = document.getElementById('quickLinksList');
  quickLinksList.innerHTML = '';
  const parentList = el.closest('ul');
  if (parentList) {
    const siblingLinks = parentList.querySelectorAll('a');
    if (siblingLinks.length > 1) {
      siblingLinks.forEach(link => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = link.firstChild.textContent.trim();
        a.onclick = (e) => {
            e.preventDefault();
            loadTopicSections(link);
        };
        if (link.firstChild.textContent.trim() === el.firstChild.textContent.trim()) {
            a.classList.add('active-quick-link');
        }
        li.appendChild(a);
        quickLinksList.appendChild(li);
      });
      quickLinksContainer.style.display = 'block';
    } else {
      quickLinksContainer.style.display = 'none';
    }
  } else {
    quickLinksContainer.style.display = 'none';
  }

  // First, load all documents into memory
  const allDocData = await Promise.all(
    docFiles.map(file => 
      mammoth.convertToHtml({ path: file })
        .then(result => ({ file, html: result.value }))
        .catch(() => ({ file, html: '' }))
    )
  );

  let allMatchesHtml = '';
  // Find the relevant sections from all loaded documents
  for (const { file, html } of allDocData) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const nodes = Array.from(temp.children);
    
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const text = node.innerText?.replace(/\s+/g, ' ').trim().toLowerCase();
        
        if (text && text === topic.toLowerCase()) {
            let sectionHtml = `<h2>${node.innerHTML}</h2>`;
            for (let j = i + 1; j < nodes.length; j++) {
                if (nodes[j].tagName.startsWith('H') && nodes[j].innerText.trim() !== '') break;
                sectionHtml += nodes[j].outerHTML;
            }
            
            allMatchesHtml += `<div class="section-block" data-doc-path="${file}" style="margin-bottom:40px;">
                <h3 style="color:#444;">📄 From: ${file}</h3>
                ${sectionHtml}
            </div>`;
        }
    }
  }

  viewer.innerHTML = allMatchesHtml || `<p style='color:red;'>❌ No matches found for "<b>${topic}</b>".</p>`;
  
  // Now, process the links only in the displayed sections
  const displayedSections = viewer.querySelectorAll('.section-block');
  for(const section of displayedSections) {
      const docPath = section.getAttribute('data-doc-path');
      await renderExcelLinksInSection(section, docPath);
  }
}

function filterSections() {
    const term = document.getElementById('searchBox').value;
    const viewer = document.getElementById('viewer');

    const existingHighlights = viewer.querySelectorAll('span.highlight');
    existingHighlights.forEach(span => {
        span.replaceWith(document.createTextNode(span.textContent));
    });
    viewer.normalize();

    const safeTerm = term.trim();
    if (!safeTerm) {
        viewer.querySelectorAll('.section-block').forEach(el => el.style.display = '');
        return;
    }

    const regex = new RegExp(safeTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    function highlightInNode(node) {
        let foundMatch = false;
        if (node.nodeType === 3) {
            const text = node.textContent;
            const frag = document.createDocumentFragment();
            let lastIndex = 0;
            let match;
            regex.lastIndex = 0;
            while ((match = regex.exec(text)) !== null) {
                foundMatch = true;
                frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                const span = document.createElement('span');
                span.className = 'highlight';
                span.textContent = match[0];
                frag.appendChild(span);
                lastIndex = regex.lastIndex;
            }
            if (foundMatch) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex)));
                node.replaceWith(frag);
            }
        } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName)) {
            Array.from(node.childNodes).forEach(child => {
                if (highlightInNode(child)) {
                    foundMatch = true;
                }
            });
        }
        return foundMatch;
    }

    viewer.querySelectorAll('.section-block').forEach(section => {
        const hasMatch = highlightInNode(section);
        section.style.display = hasMatch ? '' : 'none';
    });
}