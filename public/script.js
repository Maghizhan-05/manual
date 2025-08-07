const docFiles = [
  '/docs/operations/creation.docx',
  '/docs/operations/income_distribution.docx',
  '/docs/reports/admin.docx',
  '/docs/settlement/eod.docx'
];

function loadTopicSections(el) {
  // Prevent default link behavior
  if (event) {
    event.preventDefault();
  }
  
  const topic = el.textContent.replace(/▶/g, '').replace(/\s+/g, ' ').trim();
  document.getElementById('searchBox').value = '';
  document.getElementById('viewer').innerHTML = `<p>⏳ Searching documents for "<b>${topic}</b>"...</p>`;

  // --- NEW: QUICK LINKS LOGIC ---
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
    return;
  }
  
  const regex = new RegExp(safeTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

  function highlightText(node) {
    if (node.nodeType === 3) { // Text node
      const match = node.data.match(regex);
      if (match) {
        const parts = node.data.split(regex);
        const frag = document.createDocumentFragment();

        for (let i = 0; i < parts.length; i++) {
            frag.appendChild(document.createTextNode(parts[i]));
            if (i < parts.length - 1) {
                const highlighted = document.createElement('span');
                highlighted.className = 'highlight';
                highlighted.textContent = match[i];
                frag.appendChild(highlighted);
            }
        }
        node.parentNode.replaceChild(frag, node);
      }
    } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName) && node.className !== 'highlight') {
      Array.from(node.childNodes).forEach(highlightText);
    }
  }

  highlightText(viewer);
}