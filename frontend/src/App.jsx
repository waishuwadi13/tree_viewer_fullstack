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

function App() {
  const [trees, setTrees] = useState([])
  const [activeTree, setActiveTree] = useState(null)
  const [message, setMessage] = useState('')
  const [collapsed, setCollapsed] = useState([])
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
    if (el) el.scrollIntoView({ block: 'center' })
  }, [highlighted, collapsed])

  function openTree(id) {
    fetch(`${API}/trees/${id}/`)
      .then(res => res.json())
      .then(data => {
        setActiveTree(data)
        setCollapsed([])
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

  function runCommand(text) {
    const parts = text.trim().split(/\s+/)
    const name = parts[0].toLowerCase()
    const arg = parts[1]

    if (!activeTree) {
      setOutput('Error: aadhi ek tree ughad')
      return
    }

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
    } else if (name === 'clear') {
      setCollapsed([])
      setHighlighted(null)
      setOutput('View reset')
    } else {
      setOutput(`Error: unknown command "${name}"`)
    }
  }

  function handleKeyDown(e) {
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
              placeholder="collapse 1.1 | expand 1.1 | showlevel 2 | goto 1.2 | clear"
              style={{ width: 420 }}
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
                    {node.text}
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
