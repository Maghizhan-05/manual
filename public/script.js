const docFiles = [
  '/docs/operations/creation.docx',
  '/docs/operations/income_distribution.docx',
  '/docs/reports/admin.docx',
  '/docs/settlement/eod.docx',
  '/docs/settelement/UTT- MFundPlus Implementation- FSD02- User Admin Masters (1) (1).docx',
  '/docs/operations/excel_word.docx'
];

/**
 * Creates links for embedded Excel files from a .docx file buffer.
 * @param {ArrayBuffer} arrayBuffer - The buffer of the .docx file.
 * @returns {Promise<string>} A promise that resolves to an HTML string of links.
 */
async function createExcelLinks(arrayBuffer) {
    let linksHtml = '';
    try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const excelLinkPromises = [];

        zip.forEach((relativePath, file) => {
            if (relativePath.startsWith('word/embeddings/') && relativePath.endsWith('.xlsx')) {
                excelLinkPromises.push(
                    file.async('blob').then(blob => {
                        const url = URL.createObjectURL(blob);
                        const fileName = relativePath.split('/').pop();
                        // Create an anchor tag that opens in a new tab
                        return `
                            <p>
                                <strong>📄 Embedded Excel File:</strong> 
                                <a href="${url}" target="_blank" rel="noopener noreferrer">${fileName}</a>
                            </p>`;
                    })
                );
            }
        });

        const allLinks = await Promise.all(excelLinkPromises);
        linksHtml = allLinks.join('');

    } catch (e) {
        console.error("Error processing docx for embedded file links:", e);
    }
    return linksHtml;
}


function loadTopicSections(el) {
  // Prevent default link behavior
  if (event) {
    event.preventDefault();
  }
  
  const topic = el.textContent.replace(/▶/g, '').replace(/\s+/g, ' ').trim();
  document.getElementById('searchBox').value = '';
  document.getElementById('viewer').innerHTML = `<p>⏳ Searching documents for "<b>${topic}</b>"...</p>`;

  // --- QUICK LINKS LOGIC ---
  const quickLinksContainer = document.getElementById('quickLinksContainer');
  const quickLinksList = document.getElementById('quickLinksList');
  quickLinksList.innerHTML = ''; // Clear previous links

  const parentList = el.closest('ul'); // Find the submenu the clicked item belongs to

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
  // --- END OF QUICK LINKS LOGIC ---

  const loadPromises = docFiles.map(file =>
    fetch(file)
      .then(res => res.arrayBuffer())
      .then(async (buffer) => {
        const mammothResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
        // Create links that open in a new tab
        const excelLinks = await createExcelLinks(buffer);

        return {
          file,
          html: mammothResult.value,
          excelLinks: excelLinks
        };
      })
      .catch(() => ({ file, html: '', excelLinks: '' }))
  );

  Promise.all(loadPromises).then(results => {
    let allMatches = '';

    results.forEach(({ file, html, excelLinks }) => {
      const temp = document.createElement('div');
      temp.innerHTML = html;

      const nodes = Array.from(temp.children);
      let found = false;
      let section = '';
      let title = '';

      nodes.forEach((node, i) => {
        const text = node.innerText?.replace(/\s+/g, ' ').trim().toLowerCase();
        if (text && text === topic.toLowerCase()) {
          found = true;
          title = node.innerText;
          section = `<h2>${title}</h2>`;
          for (let j = i + 1; j < nodes.length; j++) {
            if (nodes[j].tagName.startsWith('H') && nodes[j].innerText.trim() !== '') break;
            section += nodes[j].outerHTML;
          }
        }
      });

      if (found) {
        // Append the links to the end of the section
        if (excelLinks) {
          section += `<div class="embedded-excel-container">${excelLinks}</div>`;
        }
        
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


// --- DEBUGGED & REWRITTEN FUNCTION ---
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