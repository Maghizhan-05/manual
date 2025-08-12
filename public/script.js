const docFiles = [
  '/docs/operations/creation.docx',
  '/docs/operations/income_distribution.docx',
  '/docs/reports/admin.docx',
  '/docs/settlement/eod.docx',
  '/docs/settelement/UTT- MFundPlus Implementation- FSD02- User Admin Masters (1) (1).docx',
  '/docs/operations/excel_word.docx'
];

/**
 * Finds and renders Excel links within a given HTML element.
 * @param {HTMLElement} sectionElement The element to search for links.
 * @param {string} docxPath The base path of the document for resolving relative URLs.
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
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const arrayBuffer = await response.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const tableHtml = XLSX.utils.sheet_to_html(worksheet);

                const tableContainer = document.createElement('div');
                tableContainer.className = 'rendered-excel-table';
                tableContainer.innerHTML = `<h4>Rendered Excel File: ${linkText}</h4>${tableHtml}`;
                
                const elementToReplace = link.closest('p') || link;
                elementToReplace.replaceWith(tableContainer);

            } catch (error) {
                console.error(`Failed to process Excel link: ${excelUrl}`, error);
                link.style.color = 'red';
                link.textContent += ' (Error: File not found or failed to parse)';
            }
        }
    }
}

/**
 * Loads the content for a specific topic into the viewer.
 * @param {string} topic The topic to load.
 * @param {boolean} [updateUrl=true] Whether to push a new state to the browser history.
 */
async function loadTopic(topic, updateUrl = true) {
    const viewer = document.getElementById('viewer');
    viewer.innerHTML = `<p>⏳ Searching documents for "<b>${topic}</b>"...</p>`;

    if (updateUrl) {
        const newUrl = `${window.location.pathname}?topic=${encodeURIComponent(topic)}`;
        history.pushState({ topic: topic }, '', newUrl);
    }
    
    let allMatchesHtml = '';
    for (const file of docFiles) {
        try {
            const response = await fetch(file);
            if (!response.ok) continue; // Skip if document not found
            
            const arrayBuffer = await response.arrayBuffer();
            const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

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
                    
                    // Found a section, now process it for Excel links
                    const sectionContainer = document.createElement('div');
                    sectionContainer.innerHTML = sectionHtml;
                    await renderExcelLinksInSection(sectionContainer, file);
                    
                    allMatchesHtml += `<div class="section-block" style="margin-bottom:40px;">
                        <h3 style="color:#444;">📄 From: ${file}</h3>
                        ${sectionContainer.innerHTML}
                    </div>`;
                }
            }
        } catch (error) {
            console.error(`Error loading or processing document ${file}:`, error);
        }
    }
    
    viewer.innerHTML = allMatchesHtml || `<p style='color:red;'>❌ No matches found for "<b>${topic}</b>".</p>`;
}

function loadTopicSections(el) {
    if (event) event.preventDefault();
    const topic = el.textContent.replace(/▶/g, '').replace(/\s+/g, ' ').trim();
    loadTopic(topic);
    updateQuickLinks(el, topic);
}

function updateQuickLinks(el, topic) {
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
                const linkTopic = link.firstChild.textContent.trim();
                a.textContent = linkTopic;
                a.onclick = (e) => {
                    e.preventDefault();
                    loadTopicSections(link);
                };
                if (linkTopic === topic) {
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
}

// Handle browser back/forward and initial load
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.topic) {
        loadTopic(event.state.topic, false);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const topic = params.get('topic');
    if (topic) {
        loadTopic(topic, false);
    }
});

function filterSections() {
    const term = document.getElementById('searchBox').value.trim();
    const viewer = document.getElementById('viewer');

    const highlights = viewer.querySelectorAll('span.highlight');
    highlights.forEach(span => span.replaceWith(document.createTextNode(span.textContent)));
    viewer.normalize();

    if (!term) {
        viewer.querySelectorAll('.section-block').forEach(el => el.style.display = '');
        return;
    }

    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    
    viewer.querySelectorAll('.section-block').forEach(section => {
        const hasMatch = highlightInNode(section, regex);
        section.style.display = hasMatch ? '' : 'none';
    });
}

function highlightInNode(node, regex) {
    let foundMatch = false;
    if (node.nodeType === 3) {
        const text = node.textContent;
        if (text.match(regex)) {
            foundMatch = true;
            const frag = document.createDocumentFragment();
            let lastIndex = 0;
            text.replace(regex, (match, offset) => {
                frag.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
                const span = document.createElement('span');
                span.className = 'highlight';
                span.textContent = match;
                frag.appendChild(span);
                lastIndex = offset + match.length;
            });
            frag.appendChild(document.createTextNode(text.slice(lastIndex)));
            node.replaceWith(frag);
        }
    } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName)) {
        Array.from(node.childNodes).forEach(child => {
            if (highlightInNode(child, regex)) foundMatch = true;
        });
    }
    return foundMatch;
}