const docFiles = [
  '/docs/operations/creation.docx',
  '/docs/operations/income_distribution.docx',
  '/docs/reports/admin.docx',
  '/docs/settlement/eod.docx',
  '/docs/settelement/UTT- MFundPlus Implementation- FSD02- User Admin Masters (1) (1).docx'
];

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
        // Use .firstChild.textContent to avoid including the '▶' from the span
        a.textContent = link.firstChild.textContent.trim();

        // Re-attach the onclick event to the new quick link
        a.onclick = (e) => {
            e.preventDefault();
            loadTopicSections(link); // Call with the ORIGINAL link element from the main nav
        };

        // Highlight the currently active topic in the quick links
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
      .then(buffer => mammoth.convertToHtml({ arrayBuffer: buffer }))
      .then(result => ({ file, html: result.value }))
      .catch(() => ({ file, html: '' }))
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

    // First, remove all existing highlights to handle backspace/deletions.
    const existingHighlights = viewer.querySelectorAll('span.highlight');
    existingHighlights.forEach(span => {
        // Replace the span with its own text content
        span.replaceWith(document.createTextNode(span.textContent));
    });
    // Normalize the viewer to merge adjacent text nodes. This is crucial.
    viewer.normalize();

    const safeTerm = term.trim();
    if (!safeTerm) {
        // If the search term is empty, show all sections
        viewer.querySelectorAll('.section-block').forEach(el => el.style.display = '');
        return;
    }

    const regex = new RegExp(safeTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    // Recursive function to apply highlighting to all text nodes within an element
    function highlightInNode(node) {
        let foundMatch = false;
        if (node.nodeType === 3) { // It's a text node
            const text = node.textContent;
            const frag = document.createDocumentFragment();
            let lastIndex = 0;
            let match;

            regex.lastIndex = 0; // Reset regex state

            while ((match = regex.exec(text)) !== null) {
                foundMatch = true;
                // Add the text before the match
                frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));

                // Create and add the highlighted span
                const span = document.createElement('span');
                span.className = 'highlight';
                span.textContent = match[0];
                frag.appendChild(span);

                lastIndex = regex.lastIndex;
            }

            if (foundMatch) {
                // Add the remaining text after the last match
                frag.appendChild(document.createTextNode(text.slice(lastIndex)));
                // Replace the original text node with the new fragment
                node.replaceWith(frag);
            }
        } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName)) {
            // It's an element node, so recurse into its children.
            // We use Array.from to create a static copy as the list will be modified.
            Array.from(node.childNodes).forEach(child => {
                if (highlightInNode(child)) {
                    foundMatch = true;
                }
            });
        }
        return foundMatch;
    }

    // Apply highlighting and hide/show the main section blocks
    viewer.querySelectorAll('.section-block').forEach(section => {
        const hasMatch = highlightInNode(section);
        section.style.display = hasMatch ? '' : 'none';
    });
}