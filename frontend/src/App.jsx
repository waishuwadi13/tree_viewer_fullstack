import { useState, useEffect } from 'react'

const API = 'http://127.0.0.1:8000/api'

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

function App() {
  const [trees, setTrees] = useState([])
  const [activeTree, setActiveTree] = useState(null)
  const [message, setMessage] = useState('')
  const [collapsed, setCollapsed] = useState([])
  const [trimmed, setTrimmed] = useState([])
  const [readAddr, setReadAddr] = useState(null)
  const [highlighted, setHighlighted] = useState(null)
  const [cmd, setCmd] = useState('')
  const [output, setOutput] = useState('')

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

  function openTree(id) {
    fetch(`${API}/trees/${id}/`)
      .then(res => res.json())
      .then(data => {
        setActiveTree(data)
        setCollapsed([])
        setTrimmed([])
        setReadAddr(null)
        setHighlighted(null)
        setOutput('')
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
  const visibleRows = rows.filter(node => !isHidden(node.address, collapsed))

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
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

  function runCommand(text) {
    const parts = text.trim().split(/\s+/)
    const name = parts[0].toLowerCase()
    const arg = parts[1]

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
    if (e.key === 'Enter' && cmd.trim()) {
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
        {trees.map(tree => (
          <li
            key={tree.id}
            onClick={() => openTree(tree.id)}
            style={{ cursor: 'pointer' }}
          >
            {tree.id}. {tree.title} ({tree.source_type})
          </li>
        ))}
      </ul>

      {activeTree && (
        <div>
          <h3>{activeTree.title} - {rows.length - 1} elements</h3>

          <div>
            {'> '}
            <input
              value={cmd}
              onChange={e => setCmd(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="collapse | expand | showlevel | goto | trim | read | clear"
              style={{ width: 480 }}
            />
            <span style={{ marginLeft: 12 }}>{output}</span>
          </div>

          <table border="1">
            <thead>
              <tr>
                <th>ROW_NO</th>
                <th>COMMENT_NO</th>
                <th>USERNAME</th>
                <th>COMMENTS</th>
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
                  <td>{i + 1}</td>
                  <td>{node.address}</td>
                  <td>{node.author}</td>
                  <td style={{ paddingLeft: node.depth * 20 }}>
                    {displayText(node)}
                    {collapsed.includes(node.address) && ' ++'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default App
