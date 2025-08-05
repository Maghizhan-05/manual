const docFiles = [
  '/docs/operations/creation.docx',
  '/docs/operations/income_distribution.docx',
  '/docs/reports/admin.docx',
  '/docs/settlement/eod.docx'
];

function loadTopicSections(el) {
  const topic = el.textContent.trim().replace(/▶/g, '').trim(); // Get topic from clicked element
  document.getElementById('searchBox').value = '';
  document.getElementById('viewer').innerHTML = `<p>⏳ Searching documents for "<b>${topic}</b>"...</p>`;

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
        const text = node.innerText?.trim().toLowerCase();
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

  // First, remove all existing highlights to handle backspace/deletions
  const existingHighlights = viewer.querySelectorAll('span.highlight');
  existingHighlights.forEach(span => {
    span.replaceWith(document.createTextNode(span.textContent));
  });
  // Normalize text nodes that might have been split
  viewer.normalize();

  const safeTerm = term.trim();
  if (!safeTerm) {
    return; // Do nothing if search term is empty
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
      // Recurse into child nodes
      Array.from(node.childNodes).forEach(highlightText);
    }
  }

  highlightText(viewer);
}