import { useState, useEffect } from 'react'

function flatten(node, rows = []) {
  rows.push(node)
  node.children.forEach(child => flatten(child, rows))
  return rows
}

function App() {
  const [trees, setTrees] = useState([])
  const [activeTree, setActiveTree] = useState(null)

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/trees/')
      .then(res => res.json())
      .then(data => setTrees(data))
  }, [])

  function openTree(id) {
    fetch(`http://127.0.0.1:8000/api/trees/${id}/`)
      .then(res => res.json())
      .then(data => setActiveTree(data))
  }

  const rows = activeTree ? flatten(activeTree.root) : []

  return (
    <div>
      <h1>Hierarchy Tree</h1>
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
              {rows.map((node, i) => (
                <tr key={node.address}>
                  <td>{i + 1}</td>
                  <td>{node.address}</td>
                  <td>{node.author}</td>
                  <td style={{ paddingLeft: node.depth * 20 }}>{node.text}</td>
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
