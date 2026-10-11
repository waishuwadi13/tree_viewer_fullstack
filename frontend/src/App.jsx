import { useState, useEffect, useRef } from 'react'

const API = 'http://127.0.0.1:8000/api'
const COLUMNS = ['ROW_NO', 'COMMENT_NO', 'USERNAME', 'COMMENTS']

const HELP = [
  ['goto 1.2.3', 'goto specific comment'],
  ['goto row 10', 'goto row number'],
  ['expand 1.3', 'open replies of an address'],
  ['collapse 1.2', 'close replies of an address'],
  ['showlevel N', 'show N levels deep, collapse the rest'],
  ['trim 1.2 | trim row 3 | trim off', 'cut text to 5 words'],
  ['read 1.2 | read row 3', 'show full text of a row'],
  ['buffer N', 'switch to tree number N'],
  ['copy y1.2', 'copy one node by address'],
  ['copy row 5', 'copy one visible row by number'],
  ['copy yt25 | copy yt1.3', 'copy from that row/address till end'],
  ['copy y25 y62 | copy y1.1 y1.5', 'copy a range of rows / addresses'],
  ['paste | paste p35 | paste p2.5', 'paste after highlighted / row / address'],
  ['hide column 1-4 | hide row 5 | hide 1.2.3', 'hide column / row'],
  ['show column 1-4 | show 1.2.3 | show all', 'show them again'],
  ['clear', 'reset view'],
  ['help', 'show this list'],
  ['back', 'return from help'],
  ['j / k', 'move down / up'],
  ['h / l', 'scroll left / right'],
  ['ArrowUp / ArrowDown', 'previous commands'],
]

function isInt(s) {
  return /^\d+$/.test(s)
}

function flatten(node, rows = []) {
  rows.push(node)
  node.children.forEach(child => flatten(child, rows))
  return rows
}

function isHidden(address, collapsed) {
  return collapsed.some(c => address.startsWith(c + '.'))
}

function firstWords(text, limit) {
  return text.trim().split(/\s+/).filter(Boolean).slice(0, limit).join(' ')
}

function truncateWords(text, limit) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= limit) return text
  return words.slice(0, limit).join(' ') + ' ...'
}

function findNode(root, address) {
  const parts = address.split('.').map(Number)
  if (parts.some(isNaN) || parts[0] !== 1) return null
  let node = root
  let parent = null
  for (let i = 1; i < parts.length; i++) {
    parent = node
    node = node.children[parts[i] - 1]
    if (!node) return null
  }
  return { node, parent }
}

function assignAddresses(node, address, depth) {
  node.address = address
  node.depth = depth
  node.children.forEach((child, i) => {
    assignAddresses(child, `${address}.${i + 1}`, depth + 1)
  })
}

function buildPasteNodes(lines) {
  const topNodes = []
  let currentParent = null
  let braceDepth = 0
  const make = text => ({ author: 'pasted', text, permalink: null, children: [] })

  lines.forEach(line => {
    const trimmedLine = line.trim()
    if (!trimmedLine) return

    const tokens = []
    let buf = ''
    for (const ch of trimmedLine) {
      if (ch === '{' || ch === '}') {
        if (buf.trim()) tokens.push({ type: 'text', val: buf.trim() })
        tokens.push({ type: ch === '{' ? 'open' : 'close' })
        buf = ''
      } else {
        buf += ch
      }
    }
    if (buf.trim()) tokens.push({ type: 'text', val: buf.trim() })

    tokens.forEach(tok => {
      if (tok.type === 'text') {
        if (braceDepth > 0 && currentParent) {
          currentParent.children.push(make(tok.val))
        } else {
          const node = make(tok.val)
          topNodes.push(node)
          currentParent = node
        }
      } else if (tok.type === 'open') {
        if (braceDepth === 0 && !currentParent) {
          const node = make('{')
          topNodes.push(node)
          currentParent = node
        } else if (currentParent) {
          currentParent.children.push(make('{'))
        }
        braceDepth++
      } else {
        braceDepth = Math.max(0, braceDepth - 1)
        const node = make('}')
        if (currentParent) currentParent.children.push(node)
        else topNodes.push(node)
        if (braceDepth === 0) currentParent = null
      }
    })
  })

  return topNodes
}

function App() {
  const [trees, setTrees] = useState([])
  const [activeTree, setActiveTree] = useState(null)
  const [message, setMessage] = useState('')
  const [collapsed, setCollapsed] = useState([])
  const [trimmed, setTrimmed] = useState([])
  const [readAddr, setReadAddr] = useState(null)
  const [hiddenColumns, setHiddenColumns] = useState([])
  const [hiddenRows, setHiddenRows] = useState([])
  const [highlighted, setHighlighted] = useState(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [clipboard, setClipboard] = useState('')
  const [cmdHistory, setCmdHistory] = useState([])
  const [histIdx, setHistIdx] = useState(-1)
  const [cmd, setCmd] = useState('')
  const [output, setOutput] = useState('')
  const cmdRef = useRef(null)

  function loadTrees() {
    fetch(`${API}/trees/`)
      .then(res => res.json())
      .then(data => setTrees(data))
  }

  useEffect(() => {
    loadTrees()
  }, [])

  useEffect(() => {
    if (!highlighted) return
    const el = document.getElementById(`row-${highlighted}`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [highlighted, collapsed])

  function openTree(id, msg = '') {
    fetch(`${API}/trees/${id}/`)
      .then(res => res.json())
      .then(data => {
        setActiveTree(data)
        setCollapsed([])
        setTrimmed([])
        setReadAddr(null)
        setHiddenColumns([])
        setHiddenRows([])
        setHighlighted(null)
        setHelpOpen(false)
        setOutput(msg)
      })
  }

  function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    setMessage('Uploading...')

    fetch(`${API}/trees/upload/`, { method: 'POST', body: formData })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          setMessage(`Uploaded: ${data.title}`)
          loadTrees()
          openTree(data.id)
        } else {
          setMessage(`Error: ${data.error}`)
        }
      })

    e.target.value = ''
  }

  const rows = activeTree ? flatten(activeTree.root) : []
  const visibleRows = rows.filter(
    node => !isHidden(node.address, collapsed) && !hiddenRows.includes(node.address)
  )

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const isMoveKey = 'jkhl'.includes(e.key) && e.key.length === 1

      if (
        cmdRef.current &&
        !isMoveKey &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        e.key.length === 1
      ) {
        e.preventDefault()
        cmdRef.current.focus()
        setCmd(c => c + e.key)
        return
      }

      if (e.key === 'h' || e.key === 'l') {
        const wrap = document.getElementById('tableWrap')
        if (wrap) wrap.scrollLeft += e.key === 'l' ? 80 : -80
        return
      }

      if (e.key !== 'j' && e.key !== 'k') return
      if (visibleRows.length === 0) return
      e.preventDefault()

      const idx = visibleRows.findIndex(n => n.address === highlighted)
      let next
      if (idx < 0) {
        next = 0
      } else if (e.key === 'j') {
        next = Math.min(idx + 1, visibleRows.length - 1)
      } else {
        next = Math.max(idx - 1, 0)
      }
      setHighlighted(visibleRows[next].address)
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [visibleRows, highlighted])

  function displayText(node) {
    if (node.depth === 0 || node.address === readAddr) return node.text
    if (trimmed.includes(node.address)) return truncateWords(node.text, 5)
    if (collapsed.includes(node.address)) return firstWords(node.text, 5)
    return node.text
  }

  function resolveTarget(parts) {
    if (parts[1] && parts[1].toLowerCase() === 'row') {
      const node = visibleRows[parseInt(parts[2], 10) - 1]
      return node ? node.address : null
    }
    return parts[1] || highlighted
  }

  function copyCommand(parts) {
    const a1 = parts[1] || ''
    const a2 = parts[2] || ''
    const strip = s => (s.startsWith('y') ? s.slice(1) : s)
    let lines = null
    let first = null

    if (a1.toLowerCase() === 'row' && a2) {
      const n = visibleRows[parseInt(a2, 10) - 1]
      if (n) {
        lines = [n.text]
        first = n.address
      }
    } else if (a1.startsWith('yt') && isInt(a1.slice(2))) {
      const i = parseInt(a1.slice(2), 10) - 1
      if (visibleRows[i]) {
        lines = visibleRows.slice(i).map(n => n.text)
        first = visibleRows[i].address
      }
    } else if (a1.startsWith('yt')) {
      const i = visibleRows.findIndex(n => n.address === a1.slice(2))
      if (i >= 0) {
        lines = visibleRows.slice(i).map(n => n.text)
        first = visibleRows[i].address
      }
    } else if (a2 && isInt(strip(a1)) && isInt(strip(a2))) {
      const r1 = parseInt(strip(a1), 10)
      const r2 = parseInt(strip(a2), 10)
      const from = Math.min(r1, r2) - 1
      const to = Math.max(r1, r2) - 1
      const part = visibleRows.slice(from, to + 1)
      if (part.length) {
        lines = part.map(n => n.text)
        first = part[0].address
      }
    } else if (a2) {
      const i1 = visibleRows.findIndex(n => n.address === strip(a1))
      const i2 = visibleRows.findIndex(n => n.address === strip(a2))
      if (i1 >= 0 && i2 >= 0) {
        const part = visibleRows.slice(Math.min(i1, i2), Math.max(i1, i2) + 1)
        lines = part.map(n => n.text)
        first = part[0].address
      }
    } else if (a1.startsWith('y')) {
      const n = rows.find(r => r.address === a1.slice(1))
      if (n) {
        lines = [n.text]
        first = n.address
      }
    }

    if (!lines || lines.length === 0) {
      setOutput('Error: copy y1.2 | copy row 5 | copy yt5 | copy y5 y9 | copy y1.1 y1.4')
      return
    }

    const text = lines.join('\n')
    setClipboard(text)
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {})
    setHighlighted(first)
    setOutput(`Copied ${lines.length} line(s).`)
  }

  function pasteCommand(parts) {
    const arg = parts[1] || ''
    let target
    if (!arg) {
      target = highlighted
    } else {
      const s = arg.toLowerCase().startsWith('p') ? arg.slice(1) : arg
      if (isInt(s)) {
        const node = visibleRows[parseInt(s, 10) - 1]
        target = node ? node.address : null
      } else {
        target = s
      }
    }

    if (!target) {
      setOutput('Error: target sapadla nahi')
      return
    }
    if (!clipboard) {
      setOutput('Error: Nothing copied yet. Use copy first.')
      return
    }

    const lines = clipboard.split('\n').filter(l => l.length > 0)
    const copy = JSON.parse(JSON.stringify(activeTree))
    const found = findNode(copy.root, target)
    if (!found) {
      setOutput(`Error: "${target}" sapadla nahi`)
      return
    }

    const newNodes = buildPasteNodes(lines)
    if (newNodes.length === 0) {
      setOutput('Error: Nothing to paste.')
      return
    }

    if (found.parent) {
      const idx = found.parent.children.indexOf(found.node)
      found.parent.children.splice(idx + 1, 0, ...newNodes)
    } else {
      found.node.children.unshift(...newNodes)
    }

    assignAddresses(copy.root, '1', 0)
    setActiveTree(copy)
    setCollapsed([])
    setTrimmed([])
    setHiddenRows([])
    setReadAddr(null)
    setHighlighted(newNodes[0].address)
    setOutput(`Pasted ${lines.length} line(s) after ${target}.`)
  }

  function runCommand(text) {
    const parts = text.trim().split(/\s+/)
    const name = parts[0].toLowerCase()
    const arg = parts[1]

    if (name === 'help') {
      setHelpOpen(true)
      setOutput('Type "back" to return.')
      return
    }

    if (name === 'back') {
      if (helpOpen) {
        setHelpOpen(false)
        setOutput('Back to tree.')
      } else {
        setOutput('Error: Nothing to go back to.')
      }
      return
    }

    if (name === 'buffer') {
      const n = parseInt(arg, 10) - 1
      if (n >= 0 && n < trees.length) {
        openTree(trees[n].id, `Switched to buffer ${arg}`)
      } else {
        setOutput('Error: number does not exist.')
      }
      return
    }

    if (!activeTree) {
      setOutput('Error: aadhi ek tree ughad')
      return
    }

    if (name !== 'read') setReadAddr(null)

    if (name === 'collapse') {
      if (!arg || !rows.some(n => n.address === arg)) {
        setOutput(`Error: "${arg}" sapadla nahi`)
        return
      }
      if (!collapsed.includes(arg)) setCollapsed([...collapsed, arg])
      setHighlighted(arg)
      setOutput(`${arg} collapsed`)
    } else if (name === 'expand') {
      setCollapsed(collapsed.filter(c => c !== arg))
      setHighlighted(arg)
      setOutput(`${arg} expanded`)
    } else if (name === 'showlevel') {
      const level = parseInt(arg, 10)
      if (!level || level < 1) {
        setOutput('Error: showlevel 1, 2, 3... asa vapar')
        return
      }
      const toCollapse = rows
        .filter(n => n.depth === level && n.children.length > 0)
        .map(n => n.address)
      setCollapsed(toCollapse)
      setOutput(`Level ${level} view`)
    } else if (name === 'goto') {
      let target = arg
      if (arg && arg.toLowerCase() === 'row') {
        const node = visibleRows[parseInt(parts[2], 10) - 1]
        target = node ? node.address : null
      }
      if (!target || !rows.some(n => n.address === target)) {
        setOutput('Error: target sapadla nahi')
        return
      }
      setCollapsed(collapsed.filter(c => !target.startsWith(c + '.')))
      setHighlighted(target)
      setOutput(`Moved to ${target}`)
    } else if (name === 'trim') {
      if (arg && arg.toLowerCase() === 'off') {
        setTrimmed([])
        setOutput('Trim cleared')
        return
      }
      const target = resolveTarget(parts)
      if (!target || !rows.some(n => n.address === target)) {
        setOutput('Error: trim 1.2 | trim row 3 | trim off')
        return
      }
      if (!trimmed.includes(target)) setTrimmed([...trimmed, target])
      setHighlighted(target)
      setOutput(`Trimmed ${target} to 5 words`)
    } else if (name === 'read') {
      const target = resolveTarget(parts)
      if (!target || !rows.some(n => n.address === target)) {
        setOutput('Error: read 1.2 | read row 3')
        return
      }
      setCollapsed(collapsed.filter(c => !target.startsWith(c + '.')))
      setReadAddr(target)
      setHighlighted(target)
      setOutput(`Reading ${target}`)
    } else if (name === 'copy') {
      copyCommand(parts)
    } else if (name === 'paste') {
      pasteCommand(parts)
    } else if (name === 'hide') {
      if (arg && arg.toLowerCase() === 'column') {
        const n = parseInt(parts[2], 10)
        if (!n || n < 1 || n > 4) {
          setOutput('Error: hide column 1 te 4')
          return
        }
        if (!hiddenColumns.includes(n)) setHiddenColumns([...hiddenColumns, n])
        setOutput(`${COLUMNS[n - 1]} column hidden`)
      } else if (arg && arg.toLowerCase() === 'row') {
        const node = visibleRows[parseInt(parts[2], 10) - 1]
        if (!node) {
          setOutput('Error: hi row sapadli nahi')
          return
        }
        setHiddenRows([...hiddenRows, node.address])
        setOutput(`Row ${parts[2]} hidden`)
      } else if (arg && rows.some(n => n.address === arg)) {
        if (!hiddenRows.includes(arg)) setHiddenRows([...hiddenRows, arg])
        setOutput(`${arg} hidden`)
      } else {
        setOutput('Error: hide column 1-4 | hide row 5 | hide 1.2.3')
      }
    } else if (name === 'show') {
      if (!arg || arg.toLowerCase() === 'all') {
        setHiddenColumns([])
        setHiddenRows([])
        setOutput('All columns and rows shown')
      } else if (arg.toLowerCase() === 'column') {
        const n = parseInt(parts[2], 10)
        if (!n || n < 1 || n > 4) {
          setOutput('Error: show column 1 te 4')
          return
        }
        setHiddenColumns(hiddenColumns.filter(c => c !== n))
        setOutput(`${COLUMNS[n - 1]} column shown`)
      } else if (rows.some(n => n.address === arg)) {
        setHiddenRows(hiddenRows.filter(a => a !== arg))
        setHighlighted(arg)
        setOutput(`${arg} shown`)
      } else {
        setOutput('Error: show all | show column 1-4 | show 1.2.3')
      }
    } else if (name === 'clear') {
      setCollapsed([])
      setTrimmed([])
      setHighlighted(null)
      setOutput('View reset')
    } else {
      setOutput(`Error: unknown command "${name}"`)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.target.blur()
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (histIdx < cmdHistory.length - 1) {
        const i = histIdx + 1
        setHistIdx(i)
        setCmd(cmdHistory[i])
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx > 0) {
        const i = histIdx - 1
        setHistIdx(i)
        setCmd(cmdHistory[i])
      } else {
        setHistIdx(-1)
        setCmd('')
      }
      return
    }

    if (e.key === 'Enter' && cmd.trim()) {
      setCmdHistory([cmd.trim(), ...cmdHistory])
      setHistIdx(-1)
      runCommand(cmd)
      setCmd('')
    }
  }

  return (
    <div>
      <h1>Hierarchy Tree</h1>

      <input type="file" accept=".html,.c" onChange={handleUpload} />
      <p>{message}</p>

      <h3>Saved trees: {trees.length}</h3>
      <ul>
        {trees.map((tree, i) => (
          <li
            key={tree.id}
            onClick={() => openTree(tree.id)}
            style={{ cursor: 'pointer' }}
          >
            {i + 1}. {tree.title} ({tree.source_type})
          </li>
        ))}
      </ul>

      {activeTree && (
        <div>
          <h3>{activeTree.title} - {rows.length - 1} elements</h3>

          <div>
            {'> '}
            <input
              ref={cmdRef}
              value={cmd}
              onChange={e => setCmd(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="type a command, or help"
              style={{ width: 560 }}
            />
            <span style={{ marginLeft: 12 }}>{output}</span>
          </div>

          {helpOpen ? (
            <div style={{ padding: 16, lineHeight: 2 }}>
              <div style={{ color: '#ff79c6', letterSpacing: 2 }}>-- COMMANDS --</div>
              {HELP.map(([syntax, what]) => (
                <div key={syntax}>
                  <span style={{ color: '#f1fa8c' }}>{syntax}</span>
                  {'  ->  '}
                  {what}
                </div>
              ))}
            </div>
          ) : (
            <div id="tableWrap" style={{ overflowX: 'auto' }}>
              <table border="1">
                <thead>
                  <tr>
                    {COLUMNS.map((label, i) =>
                      hiddenColumns.includes(i + 1) ? null : <th key={label}>{label}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((node, i) => (
                    <tr
                      key={node.address}
                      id={`row-${node.address}`}
                      style={{
                        backgroundColor:
                          node.address === highlighted ? '#2a0f00' : 'transparent',
                      }}
                    >
                      {!hiddenColumns.includes(1) && <td>{i + 1}</td>}
                      {!hiddenColumns.includes(2) && <td>{node.address}</td>}
                      {!hiddenColumns.includes(3) && <td>{node.author}</td>}
                      {!hiddenColumns.includes(4) && (
                        <td style={{ paddingLeft: node.depth * 20 }}>
                          {displayText(node)}
                          {collapsed.includes(node.address) && ' ++'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
