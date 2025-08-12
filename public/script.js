const docFiles = [
  '/docs/operations/creation.docx',
  '/docs/operations/income_distribution.docx',
  '/docs/reports/admin.docx',
  '/docs/settlement/eod.docx',
  '/docs/settelement/UTT- MFundPlus Implementation- FSD02- User Admin Masters (1) (1).docx',
  '/docs/operations/excel_word.docx'
];

/**
 * Finds hyperlinks to .xlsx files in an HTML string, fetches them, converts
 * them to HTML tables, and replaces the original link.
 * @param {string} htmlString - The initial HTML content from mammoth.
 * @param {string} docxPath - The path of the source .docx file.
 * @returns {Promise<string>} A promise that resolves to the modified HTML string.
 */
async function processAndRenderExcelLinks(htmlString, docxPath) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const links = Array.from(doc.querySelectorAll('a'));
    
    const docDirectory = docxPath.substring(0, docxPath.lastIndexOf('/') + 1);

    for (const link of links) {
        const linkText = link.textContent || '';
        // Check if the link's text content is a filename ending in .xlsx
        if (linkText.toLowerCase().endsWith('.xlsx')) {
            // Construct a simple relative path
            const excelUrl = docDirectory + linkText;

            try {
                const response = await fetch(excelUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${excelUrl}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const tableHtml = XLSX.utils.sheet_to_html(worksheet);
                
                const tableContainer = doc.createElement('div');
                tableContainer.className = 'rendered-excel-table';
                tableContainer.innerHTML = `
                    <h4>Rendered Excel File: ${linkText}</h4>
                    ${tableHtml}`;
                
                // Replace the link's parent paragraph (or the link itself if no parent) with the table
                const elementToReplace = link.closest('p') || link;
                elementToReplace.replaceWith(tableContainer);

            } catch (error) {
                console.error(`Failed to fetch and render Excel file: ${excelUrl}`, error);
                link.style.color = 'blue';
                link.style.textDecoration = 'none';
                link.textContent += ' <- Click to view ';
            }
        }
    }
    
    return doc.body.innerHTML;
}


function loadTopicSections(el) {
  if (event) {
    event.preventDefault();
  }
  
  const topic = el.textContent.replace(/▶/g, '').replace(/\s+/g, ' ').trim();
  document.getElementById('searchBox').value = '';
  document.getElementById('viewer').innerHTML = `<p>⏳ Searching documents for "<b>${topic}</b>"...</p>`;

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

  const loadPromises = docFiles.map(file =>
    fetch(file)
      .then(res => res.arrayBuffer())
      .then(async (buffer) => {
        const mammothResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
        // Post-process the generated HTML to find and render excel links
        const finalHtml = await processAndRenderExcelLinks(mammothResult.value, file);
        return { file, html: finalHtml };
      })
      .catch((err) => ({ file, html: `<p style="color:red">Error loading ${file}: ${err.message}</p>` }))
  );

  Promise.all(loadPromises).then(results => {
    let allMatches = '';
    results.forEach(({ file, html }) => {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const nodes = Array.from(temp.children);
      let found = false;
      let section = '';
      let title = '';

      nodes.forEach((node, i) => {
        // Use innerText which is more render-aware than textContent
        const text = node.innerText?.replace(/\s+/g, ' ').trim().toLowerCase();
        if (text && text === topic.toLowerCase()) {
          found = true;
          title = node.innerHTML; // Keep original formatting for the title
          section = `<h2>${title}</h2>`;
          for (let j = i + 1; j < nodes.length; j++) {
            if (nodes[j].tagName.startsWith('H') && nodes[j].innerText.trim() !== '') break;
            section += nodes[j].outerHTML;
          }
        }
      });

      if (found) {
        allMatches += `<div class="section-block" style="margin-bottom:40px;">
          <h3 style="color:#444;">📄 From: ${file}</h3>
          ${section}
        </div>`;
      }
    });

    document.getElementById('viewer').innerHTML =
      allMatches || `<p style='color:red;'>❌ No matches found for "<b>${topic}</b>".</p>`;
  });
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
        if (node.nodeType === 3) { // It's a text node
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