const state = {
  trees: [],
  activeTree: 0,
  collapsed: new Set(),
  highlighted: null,
  cmdHistory: [],
  cmdHistoryIdx: -1,
  helpOpen: false,
  clipboard: '',
  readExpanded: null,
  trimmedAddrs: new Set(),
  hiddenColumns: new Set(),
  hiddenRows: new Set(),
};

const Column = {
  rowno:     { index: 1, label: 'ROW NO' },
  commentno: { index: 2, label: 'COMMENT NO' },
  author:    { index: 3, label: 'USERNAME' },
  comments:  { index: 4, label: 'COMMENTS' },
};

const Column_index = { 1: 'rowno', 2: 'commentno', 3: 'author', 4: 'comments' };

function resolveColumnKey(raw) {
  const a = String(raw).toLowerCase().replace(/\s+/g, '');
  const numMatch = a.match(/^column(\d+)$/);
  if (numMatch) {
    return Column_index[parseInt(numMatch[1], 10)] || null;
  }
  return null;
}

function applyColumnVisibility() {
  let styleEl = document.getElementById('colVisibilityStyle');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'colVisibilityStyle';
    document.head.appendChild(styleEl);
  }
  let css = '';
  state.hiddenColumns.forEach(key => {
    const col = Column[key];
    if (!col) return;
    css += `table th:nth-child(${col.index}), table td:nth-child(${col.index}) { display: none; }\n`;
  });
  styleEl.textContent = css;
}

function parseFile(content, filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'html') {
    if (content.includes('commentarea') || content.includes('data-fullname') || content.includes('nestedlisting')) {
      return parseRedditHTML(content, filename);
    } else {
      return parseGenericHTML(content, filename);
    }
  }
  if (ext === 'c') {
    const result = parseBraceCode(content, filename);
    result.isCode = true;
    return result;
  }
  return {
    title: filename,
    filename: filename,
    root: { id: 'root', author: 'system', text: 'Unsupported format', children: [], depth: 0, address: null }
  };
}

function parseRedditHTML(html, filename) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const titleEL =
    doc.querySelector('a.title') ||
    doc.querySelector('[data-event-action="title"]') ||
    doc.querySelector('.top-matter .title a') ||
    doc.querySelector('h1') ||
    doc.querySelector('title');
  const title = titleEL ? titleEL.textContent.trim() : filename;

  const postThing =
    doc.querySelector('.thing[data-type="link"]') ||
    doc.querySelector('.thing.link') ||
    doc.querySelector('[data-fullname^="t3_"]');
  const postId = postThing ? (postThing.getAttribute('data-fullname') || 't3_unknown') : 't3_unknown';
  const postAuthor = postThing ? (postThing.getAttribute('data-author') || 'thread') : 'thread';

  const root = {
    id: postId,
    author: postAuthor,
    text: title,
    children: [],
    depth: 0,
    address: null,
  };

  const commentArea =
    doc.querySelector('.commentarea > .sitetable') ||
    doc.querySelector('.commentarea .nestedlisting') ||
    doc.querySelector('.commentarea') ||
    doc.querySelector('.nestedlisting') ||
    doc.querySelector('#siteTable') ||
    doc.querySelector('.comments');

  if (!commentArea) {
    return { title, root, filename };
  }

  function parseThings(container, parentNode, depth) {
    const allThings = Array.from(container.querySelectorAll(':scope > .thing.comment'));
    allThings.forEach(thing => {
      const id = thing.getAttribute('data-fullname') || `gen_${Math.random().toString(36).slice(2)}`;
      const author = thing.getAttribute('data-author') || '[deleted]';
      let text = '';
      const mdDiv =
        thing.querySelector(':scope > .entry .usertext-body .md') ||
        thing.querySelector('.usertext-body .md') ||
        thing.querySelector('.md') ||
        thing.querySelector('.usertext-body');

      if (mdDiv) {
        text = mdDiv.textContent.trim().replace(/\s+/g, ' ');
      }
      if (!text) {
        const bodyEl = thing.querySelector('.usertext-body');
        if (bodyEl && bodyEl.textContent.includes('[deleted]')) text = '[deleted]';
        else if (bodyEl && bodyEl.textContent.includes('[removed]')) text = '[removed]';
      }

      const permEl = thing.querySelector('a[data-event-action="permalink"]') ||
                     thing.querySelector('.entry .flat-list a[href*="/comments/"]');
      const permalink = permEl ? permEl.href || permEl.getAttribute('href') : null;

      const node = { id, author, text, permalink, children: [], depth, address: null };
      parentNode.children.push(node);
      const childListing = thing.querySelector(':scope > .child > .sitetable');
      if (childListing) {
        parseThings(childListing, node, depth + 1);
      }
    });
  }
  parseThings(commentArea, root, 1);
  return { title, root, filename };
}

function parseGenericHTML(html, filename) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rootElement = doc.body || doc.documentElement;
  const root = {
    id: 'html_root',
    author: 'system',
    text: doc.title ? `HTML: ${doc.title.trim()}` : filename,
    children: [],
    depth: 0,
    address: null
  };

  function traverseHTML(element, parentNode, depth) {
    const children = Array.from(element.children);
    children.forEach((child, index) => {
      const clone = child.cloneNode(true);
      while (clone.children.length > 0) {
        clone.removeChild(clone.children[0]);
      }
      const directText = clone.textContent.trim().replace(/\s+/g, ' ');

      const ignoredTags = ['script', 'style', 'noscript', 'head', 'iframe'];
      if (directText && !ignoredTags.includes(child.tagName.toLowerCase())) {
        let nodeText = "";
        if (child.classList.length) {
          nodeText += `.${Array.from(child.classList).join('.')} : `;
        }
        nodeText += `"${directText.substring(0, 80)}${directText.length > 80 ? '...' : ''}"`;

        const node = {
          id: `html_${depth}_${index}_${Math.random().toString(36).slice(2)}`,
          author: child.tagName.toLowerCase(),
          text: nodeText,
          children: [],
          depth: depth,
          address: null
        };
        parentNode.children.push(node);
        traverseHTML(child, node, depth + 1);
      } else {
        traverseHTML(child, parentNode, depth);
      }
    });
  }

  traverseHTML(rootElement, root, 1);
  return { title: root.text, root, filename };
}

function parseBraceCode(content, filename) {
  const lines = content.split(/\r?\n/);
  const root = {
    id: 'code_root',
    author: '-',
    text: filename,
    children: [],
    depth: 0,
    address: null
  };

  const stack = [root];

  function makeNode(text) {
    return {
      id: `code_${Math.random().toString(36).slice(2)}`,
      author: '-',
      text,
      children: [],
      depth: stack.length,
      address: null
    };
  }

  let prevLineTextNode = null;
  let pendingCloseParent = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const tokens = [];
    let buf = '';
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '{' || ch === '}') {
        if (buf.trim()) tokens.push({ type: 'text', val: buf.trim() });
        tokens.push({ type: ch === '{' ? 'open' : 'close', val: ch });
        buf = '';
      } else {
        buf += ch;
      }
    }
    if (buf.trim()) tokens.push({ type: 'text', val: buf.trim() });

    let lastTextNode = null;

    tokens.forEach(tok => {
      if (tok.type === 'text') {
        if (tok.val === ';' && pendingCloseParent) {
          const node = makeNode(';');
          pendingCloseParent.children.push(node);
          lastTextNode = node;
          prevLineTextNode = node;
        } else {
          const node = makeNode(tok.val);
          stack[stack.length - 1].children.push(node);
          lastTextNode = node;
          prevLineTextNode = node;
        }
        pendingCloseParent = null;
      } else if (tok.type === 'open') {
        const braceNode = makeNode('{');

        const attachTo = lastTextNode || prevLineTextNode;
        const trueParent = attachTo || stack[stack.length - 1];
        trueParent.children.push(braceNode);
        braceNode.closeParent = trueParent;
        stack.push(braceNode);
        lastTextNode = null;
        prevLineTextNode = null;
        pendingCloseParent = null;
      } else if (tok.type === 'close') {
        if (stack.length > 1) {
          const openedBrace = stack.pop();
          const closeNode = makeNode('}');
          const trueParent = openedBrace.closeParent || root;
          trueParent.children.push(closeNode);
          pendingCloseParent = trueParent;
        } else {
          const closeNode = makeNode('}');
          stack[stack.length - 1].children.push(closeNode);
          pendingCloseParent = stack[stack.length - 1];
        }
        lastTextNode = null;
        prevLineTextNode = null;
      }
    });
  });
  return { title: filename, root, filename };
}

function loadFiles(files) {
  state.trees = [];
  state.collapsed.clear();
  state.highlighted = null;

  const total = files.length;
  const results = new Array(total).fill(null);
  let loaded = 0;

  Array.from(files).forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const tree = parseFile(e.target.result, file.name);
        results[idx] = tree;
      } catch (err) {
        console.error(err);
      }
      loaded++;
      if (loaded === total) {
        state.trees = results.filter(Boolean);
        state.trees.forEach((tree, tIdx) => {
          assignAddresses(tree.root, tIdx + 1, `${tIdx + 1}`);
        });
        state.activeTree = 0;
        state.highlighted = "1";
        renderAll();
        setOutput('ok', `${state.trees.length} trees loaded.`);
      }
    };
    reader.readAsText(file);
  });
}

function assignAddresses(node, treeIdx, prefix) {
  node.address = prefix;
  node.children.forEach((child, i) => {
    assignAddresses(child, treeIdx, `${prefix}.${i + 1}`);
  });
}

function countNodes(node) {
  return 1 + node.children.reduce((s, c) => s + countNodes(c), 0);
}

function renderAll() {
  renderSidebar();
  renderTreeTable();
  renderStats();
  applyColumnVisibility();
}

function renderStats() {
  const statsBar = document.getElementById('statsBar');
  if (!statsBar) return;
  let totalComments = 0;
  state.trees.forEach(t => totalComments += countNodes(t.root) - 1);
  statsBar.textContent = `${state.trees.length} trees · ${totalComments} elements`;
}

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  if (state.trees.length === 0) {
    sidebar.innerHTML = '';
    return;
  }
  sidebar.innerHTML = state.trees.map((tree, i) => `
    <div class="tree-root-btn ${i === state.activeTree ? 'active' : ''}" onclick="switchTree(${i})">
      <div class="tree-num">${i + 1}</div>
      <div class="tree-title">${escHtml(tree.title)}</div>
      <div class="comment-count">${countNodes(tree.root) - 1}</div>
    </div>
  `).join('');
}

function switchTree(idx) {
  state.activeTree = idx;
  state.collapsed.clear();
  state.highlighted = `${idx + 1}`;
  renderAll();
}

function flattenVisibleNodes(treeIdx) {
  const tree = state.trees[treeIdx];
  if (!tree) return [];
  const flatNodes = [];

  function flatten(node, isHidden) {
    flatNodes.push({ node, isHidden });
    const currentCollapsed = state.collapsed.has(node.address);
    node.children.forEach(child => {
      flatten(child, isHidden || currentCollapsed);
    });
  }

  flatten(tree.root, false);
  return flatNodes;
}

function renderTreeTable() {
  const tbody = document.getElementById('tbody');
  const emptyState = document.getElementById('emptyState') || document.getElementById('empty');
  const tableWrap = document.getElementById('tableWrap');

  if (state.trees.length === 0) {
    tableWrap.style.display = 'none';
    if(emptyState) emptyState.style.display = 'flex';
    return;
  }

  tableWrap.style.display = 'block';
  if(emptyState) emptyState.style.display = 'none';

  const flatNodes = flattenVisibleNodes(state.activeTree);

  let visibleRowCounter = 1;
  let html = '';

  flatNodes.forEach(({ node, isHidden }) => {
    if (isHidden || state.hiddenRows.has(node.address)) {
      html += `<tr class="collapsed-child" data-addr="${node.address}" data-row=""></tr>`;
      return;
    }

    const isHighlighted = node.address === state.highlighted;
    const isTitle = node.depth === 0;
    const indentPadding = (node.depth * 20) + 'px';
    const isCollapsed = state.collapsed.has(node.address) && node.children && node.children.length > 0;
    const collapsedMarker = isCollapsed ? ' <span class="collapsed-marker" style="color:#888;letter-spacing:2px;">++</span>' : '';

    const displayText = isTitle || node.address === state.readExpanded
      ? node.text
      : state.trimmedAddrs.has(node.address)
        ? truncateWords(node.text, 5)
        : isCollapsed
          ? node.text.trim().split(/\s+/).filter(Boolean).slice(0, 5).join(' ')
          : node.text;

    html += `
      <tr class="${isHighlighted ? 'highlighted' : ''} ${isTitle ? 'title-row' : ''}" data-addr="${node.address}" data-row="${visibleRowCounter}">
        <td>${visibleRowCounter}</td>
        <td>${node.address}</td>
        <td>${escHtml(node.author || '')}</td>
        <td style="padding-left: ${indentPadding}">
          <span class="node-text" data-fulltext="${escHtml(node.text)}">${linkify(displayText)}</span>${collapsedMarker}
        </td>
      </tr>
    `;

    visibleRowCounter++;
  });

  tbody.innerHTML = html;
}

function collapseAll(startNode) {
  const queue = [startNode];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.address) state.collapsed.add(current.address);
    if (current.children) queue.push(...current.children);
  }
}

function expandAll(startNode) {
  const queue = [startNode];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.address) state.collapsed.delete(current.address);
    if (current.children) queue.push(...current.children);
  }
}

function setLevelView(level) {
  const tree = state.trees[state.activeTree];
  if (!tree) return false;

  function addrDepth(node) {
    return node.address ? node.address.split('.').length - 1 : node.depth;
  }

  function walk(node) {
    const depth = addrDepth(node);
    if (depth === level) {
      collapseAll(node);
      return;
    }
    if (depth > 0 && depth < level) {
      state.collapsed.delete(node.address);
    }
    node.children.forEach(walk);
  }

  walk(tree.root);
  return true;
}

function findNode(addr) {
  const parts = addr.trim().split('.').map(Number);
  if (parts.some(isNaN)) return null;
  const treeIdx = parts[0] - 1;
  if (treeIdx < 0 || treeIdx >= state.trees.length) return null;

  let node = state.trees[treeIdx].root;
  let parent = null;
  for (let i = 1; i < parts.length; i++) {
    const childIdx = parts[i] - 1;
    if (!node.children || !node.children[childIdx]) return null;
    parent = node;
    node = node.children[childIdx];
  }
  return { node, treeIdx, parent };
}

function expandPathTo(addr) {
  const parts = addr.split('.');
  for (let i = 1; i <= parts.length; i++) {
    state.collapsed.delete(parts.slice(0, i).join('.'));
  }
}

function setOutput(type, msg) {
  const el = document.getElementById('cmdOutput');
  if (el) { el.className = type; el.textContent = msg; }
}

function scrollRowToTop(rowEl) {
  if (!rowEl) return;
  const wrap = document.getElementById('tableWrap');
  if (!wrap) return;
  const thead = wrap.querySelector('thead');
  const theadHeight = thead ? thead.getBoundingClientRect().height : 0;
  const wrapTop = wrap.getBoundingClientRect().top;
  const rowTop = rowEl.getBoundingClientRect().top;
  wrap.scrollTop += (rowTop - wrapTop) - theadHeight - 4;
}

function moveCursor(delta) {
  const visibleRows = Array.from(document.querySelectorAll('#tbody tr:not(.collapsed-child)'));
  if (!visibleRows.length) return;

  let currentIdx = visibleRows.findIndex(tr => tr.getAttribute('data-addr') === state.highlighted);
  if (currentIdx < 0) currentIdx = 0;

  let nextIdx = Math.max(0, Math.min(visibleRows.length - 1, currentIdx + delta));
  state.highlighted = visibleRows[nextIdx].getAttribute('data-addr');

  visibleRows.forEach(tr => tr.classList.remove('highlighted'));
  visibleRows[nextIdx].classList.add('highlighted');
  scrollRowToTop(visibleRows[nextIdx]);
}

function buildPasteNodes(lines, baseDepth) {
  const topNodes = [];
  let currentParent = null;
  let braceDepth = 0;

  function makeNode(text, depth) {
    return {
      id: `paste_${Math.random().toString(36).slice(2)}`,
      author: 'pasted',
      text,
      children: [],
      depth,
      address: null
    };
  }

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const tokens = [];
    let buf = '';
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '{' || ch === '}') {
        if (buf.trim()) tokens.push({ type: 'text', val: buf.trim() });
        tokens.push({ type: ch === '{' ? 'open' : 'close' });
        buf = '';
      } else {
        buf += ch;
      }
    }
    if (buf.trim()) tokens.push({ type: 'text', val: buf.trim() });

    tokens.forEach(tok => {
      if (tok.type === 'text') {
        if (braceDepth > 0 && currentParent) {
          currentParent.children.push(makeNode(tok.val, baseDepth + 1));
        } else {
          const node = makeNode(tok.val, baseDepth);
          topNodes.push(node);
          currentParent = node;
        }
      } else if (tok.type === 'open') {
        if (braceDepth === 0 && !currentParent) {
          const node = makeNode('{', baseDepth);
          topNodes.push(node);
          currentParent = node;
        } else if (currentParent) {
          currentParent.children.push(makeNode('{', baseDepth + 1));
        }
        braceDepth++;
      } else if (tok.type === 'close') {
        braceDepth = Math.max(0, braceDepth - 1);
        const node = makeNode('}', baseDepth + 1);
        if (currentParent) currentParent.children.push(node);
        else topNodes.push(node);
        if (braceDepth === 0) currentParent = null;
      }
    });
  });

  return topNodes;
}

function runCommand(raw) {
  const input = raw.trim();
  if (!input) return;

  state.cmdHistory.unshift(input);
  state.cmdHistoryIdx = -1;

  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  if (cmd !== 'read' && state.readExpanded !== null) {
    state.readExpanded = null;
    renderTreeTable();
  }

  if (cmd === 'showlevel' && /^\d+$/.test(parts[1] || '')) {
    const level = parseInt(parts[1], 10);
    const tree = state.trees[state.activeTree];
    if (!tree) { setOutput('err', 'No tree loaded.'); return; }
    if (level < 1) { setOutput('err', 'Level must be 1 or greater.'); return; }

    setLevelView(level);
    state.highlighted = tree.root.children[0] ? tree.root.children[0].address : state.highlighted;
    renderTreeTable();
    setTimeout(() => {
      scrollRowToTop(document.querySelector('.highlighted'));
    }, 60);
    setOutput('ok', `Level ${level} view: addresses up to depth ${level} shown.`);
    return;
  }

  switch (cmd) {
    case 'help':
      state.helpOpen = true;
      showHelp();
      setOutput('ok', 'Type "back" to return.');
      break;

    case 'back':
      if (state.helpOpen) {
        state.helpOpen = false;
        renderTreeTable();
        setOutput('ok', 'Back to tree.');
      } else {
        setOutput('err', 'Nothing to go back to.');
      }
      break;

    case 'goto': {
      let targetAddr = null;
      if (parts[1]?.toLowerCase() === 'row' && parts[2]) {
        targetAddr = document.querySelector(`#tbody tr[data-row="${parts[2]}"]:not(.collapsed-child)`)?.getAttribute('data-addr');
      } else {
        targetAddr = parts[1];
      }

      if (!targetAddr) { setOutput('err', 'Target not found.'); return; }
      const result = findNode(targetAddr);
      if (!result) { setOutput('err', `"${targetAddr}" not found`); return; }

      if (result.treeIdx !== state.activeTree) { state.activeTree = result.treeIdx; renderSidebar(); }
      expandPathTo(targetAddr);
      state.highlighted = targetAddr;
      renderTreeTable();

      setTimeout(() => {
        scrollRowToTop(document.querySelector('.highlighted'));
      }, 60);
      setOutput('ok', `Moved to ${targetAddr}`);
      break;
    }

    case 'collapse': {
      let targetAddr = null;
      const bareNum = parseInt(parts[1], 10);
      if (parts[1]?.toLowerCase() === 'row' && parts[2]) {
        targetAddr = document.querySelector(`#tbody tr[data-row="${parts[2]}"]`)?.getAttribute('data-addr');
      } else if (parts[1] && /^\d+$/.test(parts[1]) && bareNum >= 1 && bareNum <= state.trees.length) {
        targetAddr = parts[1];
      } else if (!isNaN(parts[1]) && document.querySelector(`#tbody tr[data-row="${parts[1]}"]`)) {
        targetAddr = document.querySelector(`#tbody tr[data-row="${parts[1]}"]`).getAttribute('data-addr');
      } else {
        targetAddr = parts[1];
      }

      if (!targetAddr) { setOutput('err', 'Invalid target.'); return; }
      const result = findNode(targetAddr);
      if (result) {
        collapseAll(result.node);
        state.highlighted = targetAddr;
        renderTreeTable();

        setTimeout(() => {
          scrollRowToTop(document.querySelector('.highlighted'));
        }, 60);
        setOutput('ok', `${targetAddr} collapsed`);
      }
      break;
    }

    case 'expand': {
      let targetAddr = null;
      const bareNum = parseInt(parts[1], 10);
      if (parts[1]?.toLowerCase() === 'row' && parts[2]) {
        targetAddr = document.querySelector(`#tbody tr[data-row="${parts[2]}"]`)?.getAttribute('data-addr');
      } else if (parts[1] && /^\d+$/.test(parts[1]) && bareNum >= 1 && bareNum <= state.trees.length) {
        targetAddr = parts[1];
      } else if (!isNaN(parts[1]) && document.querySelector(`#tbody tr[data-row="${parts[1]}"]`)) {
        targetAddr = document.querySelector(`#tbody tr[data-row="${parts[1]}"]`).getAttribute('data-addr');
      } else {
        targetAddr = parts[1];
      }

      if (!targetAddr) { setOutput('err', 'Invalid target.'); return; }
      const result = findNode(targetAddr);
      if (result) {
        expandAll(result.node);
        expandPathTo(targetAddr);

        state.highlighted = targetAddr;
        renderTreeTable();

        setTimeout(() => {
          scrollRowToTop(document.querySelector('.highlighted'));
        }, 60);

        setOutput('ok', `${targetAddr} expanded`);
      }
      break;
    }

    case 'read': {
      let targetAddr = parts[1];
      if (parts[1]?.toLowerCase() === 'row' && parts[2]) {
        targetAddr = document.querySelector(`#tbody tr[data-row="${parts[2]}"]:not(.collapsed-child)`)?.getAttribute('data-addr');
      } else if (targetAddr && targetAddr.toLowerCase().startsWith('y')) {
        targetAddr = targetAddr.slice(1);
      } else if (!targetAddr) {
        targetAddr = state.highlighted;
      }

      if (!targetAddr) { setOutput('err'); break; }
      const result = findNode(targetAddr);
      if (!result) { setOutput('err', `"${targetAddr}" not found`); break; }

      if (result.treeIdx !== state.activeTree) { state.activeTree = result.treeIdx; renderSidebar(); }
      expandPathTo(targetAddr);
      state.highlighted = targetAddr;
      state.readExpanded = targetAddr;
      renderTreeTable();

      setTimeout(() => {
        scrollRowToTop(document.querySelector('.highlighted'));
      }, 60);

      setOutput('ok');
      break;
    }

    case 'buffer': {
      const num = parseInt(parts[1], 10) - 1;
      if (num >= 0 && num < state.trees.length) {
        switchTree(num);
        setOutput('ok', `Switched to buffer ${parts[1]}`);
      } else {
        setOutput('err', 'number does not exist.');
      }
      break;
    }

    case 'trim': {
      const arg1 = (parts[1] || '').toLowerCase();
      const arg2 = parts[2] || '';

      if (arg1 === 'off') {
        state.trimmedAddrs.clear();
        renderTreeTable();
        setOutput('ok', 'Trim cleared. Full text restored.');
        break;
      }

      let targetAddr = null;
      if (arg1 === 'row' && arg2) {
        targetAddr = document.querySelector(`#tbody tr[data-row="${arg2}"]:not(.collapsed-child)`)?.getAttribute('data-addr');
      } else if (arg1) {
        targetAddr = arg1;
      } else {
        targetAddr = state.highlighted;
      }

      if (!targetAddr) { setOutput('err', 'Usage: trim 2.1 | trim row 3 | trim off'); break; }
      const result = findNode(targetAddr);
      if (!result) { setOutput('err', `"${targetAddr}" not found`); break; }

      state.trimmedAddrs.add(targetAddr);
      state.highlighted = targetAddr;
      renderTreeTable();
      setTimeout(() => {
        scrollRowToTop(document.querySelector('.highlighted'));
      }, 60);
      setOutput('ok', `Trimmed ${targetAddr} to 5 words.`);
      break;
    }

    case 'hide': {
      const arg1 = (parts[1] || '').toLowerCase();
      const arg2 = parts[2] || '';

      if (arg1 === 'row' && arg2) {
        const addr = document.querySelector(`#tbody tr[data-row="${arg2}"]:not(.collapsed-child)`)?.getAttribute('data-addr');
        if (!addr) { setOutput('err', `Row ${arg2} not found.`); break; }
        state.hiddenRows.add(addr);
        renderTreeTable();
        setOutput('ok', `Row ${arg2} hidden.`);
        break;
      }

      if (arg1 && arg1.includes('.')) {
        state.hiddenRows.add(arg1);
        renderTreeTable();
        setOutput('ok', `${arg1} hidden.`);
        break;
      }

      const key = resolveColumnKey(parts.slice(1).join(' '));
      if (!key) { setOutput('err', 'Usage: hide column 1-4 | hide row 5 | hide 1.2.3'); break; }
      state.hiddenColumns.add(key);
      applyColumnVisibility();
      setOutput('ok', `${Column[key].label} column hidden.`);
      break;
    }

    case 'show': {
      const argStr = parts.slice(1).join(' ').toLowerCase().trim();

      if (argStr === 'all' || argStr === 'all columns' || argStr === '') {
        state.hiddenColumns.clear();
        state.hiddenRows.clear();
        applyColumnVisibility();
        renderTreeTable();
        setOutput('ok', 'All columns and rows shown.');
        break;
      }

      if (argStr.startsWith('row ') && parts[2]) {
        const targetRowNum = parts[2];

        const saved = new Set(state.hiddenRows);
        state.hiddenRows.clear();
        renderTreeTable();
        const addr = document.querySelector(`#tbody tr[data-row="${targetRowNum}"]:not(.collapsed-child)`)?.getAttribute('data-addr');
        state.hiddenRows = saved;
        if (!addr) { renderTreeTable(); setOutput('err', `Row ${targetRowNum} not found.`); break; }
        state.hiddenRows.delete(addr);
        state.highlighted = addr;
        renderTreeTable();
        setTimeout(() => scrollRowToTop(document.querySelector('.highlighted')), 60);
        setOutput('ok', `Row ${targetRowNum} shown.`);
        break;
      }

      if (argStr.includes('.')) {
        state.hiddenRows.delete(argStr);
        state.highlighted = argStr;
        renderTreeTable();
        setTimeout(() => scrollRowToTop(document.querySelector('.highlighted')), 60);
        setOutput('ok', `${argStr} shown.`);
        break;
      }

      const key = resolveColumnKey(argStr);
      if (!key) { setOutput('err', 'Usage: show column 1-4 | show row 5 | show 1.2.3 | show all'); break; }
      state.hiddenColumns.delete(key);
      applyColumnVisibility();
      setOutput('ok', `${Column[key].label} column shown.`);
      break;
    }

    case 'clear':
      state.highlighted = "1";
      state.collapsed.clear();
      renderTreeTable();
      setOutput('ok', 'Cleared view');
      break;

    case 'copy': {
      const arg1 = parts[1] || '';
      const arg2 = parts[2] || '';
      let textToCopy = '';

      function isPureInt(s) { return /^\d+$/.test(s); }

      function collectFromRowToEnd(rowNum) {
        const allRows = Array.from(document.querySelectorAll('#tbody tr:not(.collapsed-child)'));
        const startIdx = allRows.findIndex(r => r.getAttribute('data-row') === String(rowNum));
        if (startIdx < 0) return null;
        return allRows.slice(startIdx).map(r => getFullTextFromRow(r));
      }

      function collectFromAddrToEnd(addr) {
        const treeIdx = parseInt(addr.split('.')[0], 10) - 1;
        const flat = flattenVisibleNodes(treeIdx).filter(f => !f.isHidden);
        const startIdx = flat.findIndex(f => f.node.address === addr);
        if (startIdx < 0) return null;
        return flat.slice(startIdx).map(f => f.node.text);
      }

      if (arg1.toLowerCase() === 'row' && parts[2]) {
        const rowEl = document.querySelector(`#tbody tr[data-row="${parts[2]}"]:not(.collapsed-child)`);
        if (!rowEl) { setOutput('err', `Row ${parts[2]} not found.`); break; }
        textToCopy = getFullTextFromRow(rowEl);

      } else if (arg1.startsWith('yt') && isPureInt(arg1.slice(2))) {
        const rowNum = arg1.slice(2);
        const lines = collectFromRowToEnd(rowNum);
        if (!lines) { setOutput('err', `Row ${rowNum} not found.`); break; }
        textToCopy = lines.join('\n');

      } else if (arg1.startsWith('yt')) {
        const addr = arg1.slice(2);
        const lines = collectFromAddrToEnd(addr);
        if (!lines) { setOutput('err', `"${addr}" not found`); break; }
        textToCopy = lines.join('\n');

      } else if (arg2 && isPureInt(arg1.startsWith('y') ? arg1.slice(1) : arg1) && isPureInt(arg2.startsWith('y') ? arg2.slice(1) : arg2)) {
        const r1 = parseInt(arg1.startsWith('y') ? arg1.slice(1) : arg1, 10);
        const r2 = parseInt(arg2.startsWith('y') ? arg2.slice(1) : arg2, 10);
        const from = Math.min(r1, r2);
        const to = Math.max(r1, r2);
        const lines = [];
        for (let i = from; i <= to; i++) {
          const el = document.querySelector(`#tbody tr[data-row="${i}"]:not(.collapsed-child)`);
          if (el) lines.push(getFullTextFromRow(el));
        }
        if (!lines.length) { setOutput('err', 'No rows found in range.'); break; }
        textToCopy = lines.join('\n');

      } else if (arg2) {
        const addr1 = arg1.startsWith('y') ? arg1.slice(1) : arg1;
        const addr2 = arg2.startsWith('y') ? arg2.slice(1) : arg2;
        const treeIdx = parseInt(addr1.split('.')[0], 10) - 1;
        const flat = flattenVisibleNodes(treeIdx).filter(f => !f.isHidden);
        const idx1 = flat.findIndex(f => f.node.address === addr1);
        const idx2 = flat.findIndex(f => f.node.address === addr2);
        if (idx1 < 0 || idx2 < 0) { setOutput('err', `Address not found. (${idx1 < 0 ? addr1 : addr2})`); break; }
        const from = Math.min(idx1, idx2);
        const to = Math.max(idx1, idx2);
        textToCopy = flat.slice(from, to + 1)
          .map(f => f.node.text)
          .join('\n');

      } else if (arg1.startsWith('y')) {
        const addr = arg1.slice(1);
        const result = findNode(addr);
        if (!result) { setOutput('err', `"${addr}" not found`); break; }
        textToCopy = result.node.text;

      } else {
        setOutput('err');
        break;
      }

      state.clipboard = textToCopy;
      const lineCount = textToCopy.split('\n').length;

      const firstAddr = (() => {
        if (arg1.toLowerCase() === 'row' && parts[2]) {
          return document.querySelector(`#tbody tr[data-row="${parts[2]}"]:not(.collapsed-child)`)?.getAttribute('data-addr');
        } else if (arg1.startsWith('yt') && /^\d+$/.test(arg1.slice(2))) {
          return document.querySelector(`#tbody tr[data-row="${arg1.slice(2)}"]:not(.collapsed-child)`)?.getAttribute('data-addr');
        } else if (arg1.startsWith('y')) {
          return arg1.slice(1);
        }
        return null;
      })();
      if (firstAddr) {
        state.highlighted = firstAddr;
        renderTreeTable();
        setTimeout(() => scrollRowToTop(document.querySelector('.highlighted')), 60);
      }

      navigator.clipboard.writeText(textToCopy)
        .then(() => setOutput('ok', `Copied ${lineCount} line(s).`))
        .catch(() => setOutput('ok', `Copied ${lineCount} line(s). (in-app only, system clipboard unavailable)`));
      break;
    }

    case 'paste': {
      const arg = parts[1] || '';
      let targetAddr = null;

      if (!arg) {
        targetAddr = state.highlighted;
      } else {
        const stripped = arg.toLowerCase().startsWith('p') ? arg.slice(1) : arg;
        if (/^\d+$/.test(stripped)) {
          targetAddr = document.querySelector(`#tbody tr[data-row="${stripped}"]:not(.collapsed-child)`)?.getAttribute('data-addr');
        } else {
          targetAddr = stripped;
        }
      }

      if (!targetAddr) { setOutput('err', 'Target not found.'); break; }
      const pasteResult = findNode(targetAddr);
      if (!pasteResult) { setOutput('err', `"${targetAddr}" not found`); break; }

      if (!state.clipboard) { setOutput('err', 'Nothing copied yet. Use copy first.'); break; }
      const lines = state.clipboard.split('\n').filter(l => l.length > 0);
      if (!lines.length) { setOutput('err', 'Nothing to paste.'); break; }

      const insertDepth = pasteResult.parent ? pasteResult.node.depth : pasteResult.node.depth + 1;
      const newNodes = buildPasteNodes(lines, insertDepth);

      if (pasteResult.parent) {
        const idx = pasteResult.parent.children.indexOf(pasteResult.node);
        pasteResult.parent.children.splice(idx + 1, 0, ...newNodes);
      } else {
        pasteResult.node.children.unshift(...newNodes);
      }

      const treeNum = pasteResult.treeIdx + 1;
      assignAddresses(state.trees[pasteResult.treeIdx].root, treeNum, `${treeNum}`);

      const prefix = `${treeNum}.`;
      Array.from(state.collapsed).forEach(addr => {
        if (addr === `${treeNum}` || addr.startsWith(prefix)) state.collapsed.delete(addr);
      });

      if (pasteResult.treeIdx !== state.activeTree) { state.activeTree = pasteResult.treeIdx; renderSidebar(); }
      state.highlighted = newNodes[0].address;
      renderTreeTable();
      renderStats();

      setTimeout(() => {
        document.querySelector('.highlighted')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);

      setOutput('ok', `Pasted ${lines.length} line(s) after ${targetAddr}.`);
      break;
    }

    default:
      setOutput('err', `Unknown command: "${cmd}"`);
  }
}

function showHelp() {
  const view = document.getElementById('tbody');
  const target = document.getElementById('treeView') || view;
  if (!target) return;

  target.innerHTML = `
    <tr><td colspan="4">
      <div style="padding:24px;font-family:monospace;font-size:13px;line-height:2.2;background:#111;color:#fff;">
        <div style="color:#ff79c6;font-size:15px;margin-bottom:20px;letter-spacing:2px">── COMMANDS ──</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">goto 1.2.3</span>          → goto specific comment</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">goto row 10</span>         → goto specific row number</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">expand 1.3</span>          → open all replies by address</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">expand row 30</span>       → open replies for row number</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">collapse 1.2</span>        → close replies by address</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">collapse row 30</span>     → close replies for row number</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">showlevel N</span>         → reveal addresses N levels deep, collapse the rest of comments</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">trim</span>                → trim the line</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">read 1.2.3</span>          → expand full text in place on that row</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">read row 14</span>         → expand full text in place by row number</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">buffer N</span>            → switch to tree number N</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">copy y1.2</span>           → copy single node by address</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">copy yt25</span>           → copy row 25 till end  (all remaining)</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">copy yt1.3</span>          → copy node 1.3 till end(all remaining)</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">copy y25 y62</span>        → copy visible rows 25 to 62 (by row number)</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">copy y1.1 y1.5</span>      → copy visible rows 1.1 to 1.5 (by address)</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">paste p35</span>           → paste clipboard right after row number</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">paste p2.5</span>          → paste clipboard right after address 2.5</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">hide row 1</span>          → hide ROW_NO</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">hide column 1</span>       → hide COLUMN_NO</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">show column 1</span>       → show specific column</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">show all</span>            → show all columns</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">clear</span>               → reset view</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">help</span>                → goto help</div>
        <div style="margin-bottom:8px"><span style="color:#f1fa8c">back</span>                → return from help</div>
        </div>
    </td></tr>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const cmdInput = document.getElementById('cmdInput');

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) { loadFiles(e.target.files); e.target.value = ''; }
    });
  }

  if (cmdInput) {
    cmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = cmdInput.value.trim();
        if (val) { runCommand(val); cmdInput.value = ''; }
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (state.cmdHistoryIdx < state.cmdHistory.length - 1) {
          state.cmdHistoryIdx++;
          cmdInput.value = state.cmdHistory[state.cmdHistoryIdx];
        }
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (state.cmdHistoryIdx > 0) {
          state.cmdHistoryIdx--;
          cmdInput.value = state.cmdHistory[state.cmdHistoryIdx];
        } else { state.cmdHistoryIdx = -1; cmdInput.value = ''; }
      }
    });

    document.addEventListener('keydown', (e) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        if(e.key === 'j' || e.key === 'k' || e.key === 'h' || e.key === 'l') return;
        cmdInput.focus();
        cmdInput.value += e.key;
        e.preventDefault();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    if (e.key === 'j') { e.preventDefault(); moveCursor(1); }
    if (e.key === 'k') { e.preventDefault(); moveCursor(-1); }
    if (e.key === 'h') { e.preventDefault(); document.getElementById('tableWrap').scrollLeft -= 80; }
    if (e.key === 'l') { e.preventDefault(); document.getElementById('tableWrap').scrollLeft += 80; }
  });
});

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unescHtml(str) {
  return String(str)
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function truncateWords(text, limit = 5) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) return text;
  return words.slice(0, limit).join(' ') + ' ...';
}

function getFullTextFromRow(rowEl) {
  const ntEl = rowEl ? rowEl.querySelector('.node-text') : null;
  if (!ntEl) return '';
  const full = ntEl.getAttribute('data-fulltext');
  return full !== null ? unescHtml(full) : ntEl.textContent;
}

function linkify(text) {
  const escaped = escHtml(text);
  return escaped.replace(
    /(https?:\/\/[^\s&"<>]+|www\.[^\s&"<>]+)/g,
    (match) => {
      const href = match.startsWith('www.') ? 'https://' + match : match;
      return `<a href="${href}" target="_blank" style="color:#50fa7b;text-decoration:underline;">${match}</a>`;
    }
  );
}
