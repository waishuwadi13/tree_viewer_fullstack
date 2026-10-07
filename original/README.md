Hierarchy Tree

This Hierarchy Tree is browser-based javascript application that parses HTML files as well as code files (c,c++,java) and displays their content in a hierarchical tree table structure.

The application allows user to:
   1. Upload multiple HTML/C,C++ files.
   2. Auto-detect the source type and parse it into a tree (post title, username, nested comments).
   3. Expand and collapse replies/branches at any node or jump straight to a given depth with 'showlevel'.
   4. Switch between multiple loaded trees.
   5. Copy single nodes,ranges of nodes or till end of tree and paste them back into the tree as new nodes.
   6. Hide/show individual columns of table.
   7. Uses j,k,h,l for Navigation.

Input File:

1. reddit.html
2. opd_table.c

Use:

1. Javascript
2. HTML/CSS

Working:

[A] const state: 1.This object stores the complete runtime state of the application.
    2.All functions read from and write to this object.
    
a. trees : 1.all parsed file stored as an array of tree objects.
    2.Each entry represents uploaded file.
          
b. activeTree: index of currently visible file.

c. collapsed: set of addresses that are currently collapsed.

d. highlighted: stores the dotted address of currently highlighted node.

e. cmdHistory: array of all commands previously entered by user.

f.cmdHistoryIdx: tracks the user's current position while navigating command history.

[B] const Column/ Column_index:

1. "Column" maps a short key(row no,comment no,username,comments) to its 1-based table column index and display label.
2. "Column_index" is the reverse mapping "Column".
3. Both are used by the hide/show column commands to translate user-typed column numbers into the right table column.

[c] function resolveColumnKey(raw):

1. Normalizes user input and matches patterns like "column1","column2".
2. Looks up the number via Column_index and returns the matching key, or null if it does not match.

[D] function applyColumnVisibility():

1. Hides table column marked in state.hiddenColumns by injecting CSS rules into a single dynamically-created tag.
2. For each hidden column key,adds an nth-child rule that sets display:none on both header and body cells for that column index.
3. Rebuilds the style tag's contents from scratch on every call, so it always reflects the current hiddenColumns set.

[E] const node: each comment in the tree is represented as a node object.

a. id: unique post ID

b. author: username of commenters.

c. text: text content of the comment

d. children: array of reply nodes

f. depth: nesting level 

g. address: dotted address used for navigation

[F] function parseFile(content, filename):

1. Determines how to parse an uploaded file based on its extension and content.
2. For code files ('.c', '.cpp', '.java', '.h') -> parseBraceCode()
3. For '.html' files, inspects the markup to decide which parser to use ->  parseGenericHTML() or parseRedditHTML().

[G] function parseRedditHTML(html,filename):

1. Parse the HTML string using 'DOMParser'
2. Uses selector to locate the title of post.
3. Extracts post ID and author.
4. Creates a root node representing the post.
5. Locates the comment area.
6. Calls inner function 'parseThing()' recursively to extract all comments.
7. Return assembled tree object.

[H]  function parseThings(container, parentNode, depth):

1. Finds all child elements in the container
2. For each comment element : 
    1. reads 'data-fullname' as node ID
    2. reads 'data-author' as author name.
    3. extract comment text from '.md' or 'usertext-body'.
    4. creates node object.
3. Finds the nested child container and calls itself recursively for replies.

[I] function parseGenericHTML(html, filename):

1. Parses the HTML string using 'DOMParser' and uses the document body (or root element) as the starting point.
2. For each element with non-empty direct text content (ignoring script/style/noscript/head/iframe), creates a node showing the element's class list and a text preview.
3. Returns a tree rooted at a synthetic "HTML: <page title>" root node.

[J] function parseBraceCode(content, filename):

1. Splits the file into lines and tokenizes each line on '{' and '}' characters, separating plain text tokens from brace tokens.
2. Maintains a stack of open-brace nodes to track nesting; each '{' pushes a new level and each '}' pops back to its matching opener.
3. Attaches each text token as a node under the current scope, and attaches each '{' / '}' as its own node so braces are visible in the tree.
4. Returns a tree rooted at a node named after the filename, with depth reflecting brace nesting.

[K] function loadFiles(files):

1. Clears previous trees, collapsed nodes, and highlights from state before loading new files.
2. Creates a pre-sized results array to maintain original file order despite async reads.
3. Loops through each file and creates a separate FileReader instance for it
4. Calls readAsText(file) to read the file content as an HTML string.
5. Once a file is read, passes its content to parseRedditHTML() to build the tree object.
6. Stores the parsed tree at its original index in results to preserve order.
7. If a file fails to parse or read, stores a placeholder error tree so the application does not crash.
8. Tracks a loaded counter and waits until all files finish before proceeding.
9. After all files are loaded, filters out any nulls and saves trees to 'state.trees'.
10. Calls assignAddresses() on each tree to give every comment node a unique dotted address.
11. Sets state.activeTree = 0 so the first uploaded thread is shown by default.
12. Calls renderAll() to update the sidebar, tree view, stats bar, and file tags.

[L] function assignAddresses(node, treeIdx, prefix):

1. Function walks the entire tree recursively.
2. Stamps each node with a unique dotted address string.

[M] function countNodes(node):

1. Recursively counts all nodes in a subtree (including the node itself).
2. Used for comment/element counts in the sidebar and stats bar.

[N] function renderAll():

1. It re-renders every part of the UI:sidebar,tree table.
2. Called after major state changes like loading file or switching trees.

[O] function renderStats():

1. Shows total number of loaded trees and total comment count across all trees.
2. Uses countNodes() on each tree root and subtracts 1 to exclude the root node itself.
3. Writes result into the statsBar element as plain text.

[P] function renderSidebar():
1. Renders one clickable entry per loaded tree, showing its number, title, and comment count.
2. Marks the currently active tree with an 'active' class.
3. Clicking an entry calls switchTree() for that tree's index

[Q] function switchTree(idx):
1. Switches the main view to different tree.
2. Clears the highlighted node and re-renders sodebar.

[R] function flattenVisibleNodes(treeIdx):
1. Walks a tree depth-first and returns a flat array of { node, isHidden } entries in display order.
2. A node is marked isHidden if any ancestor address is present in state.collapsed — this is what lets renderTreeTable() and the copy/range commands agree on what's currently "visible".

[S] function renderTreeTable():
1. Checks if tree are loaded ,hides table,and shows empty state if not.
2. Gets the active tree from state.trees using state.activeTree index.
3. Calls inner faltten() function which walks the entire tree recursively.
4. Flatten() checks state.collapsed — if a node's address is in collapsed set, all its children get isHidden = true.
5. Loops through flatNodes array and builds HTML table rows.
6. Visible rows get a sequential visibleRowCounter number, the dotted address, and the comment text.

[T] function moveCursor:
1. Collects all visible rows and finds the index of the currently highlighted row by matching data-address.
2. If no highlighted row is found, defaults to index 0.
3. Adds delta (+1 or -1) to current index.
4. Updates state.highlighted to the new row's data-addr value.
5. Removes highlighted class from all rows and adds it only to the new row.
6. Scrolls the new row smoothly into the center of the viewport.

[U] function collapseAll(startNode):
1. Collapses a node and every single descendant beneath it in one operation.
2. adds each node's address to state.collapsed.

[V] function expandAll(startNode):
1. Expands a node and every descendant beneath it in one operation.

[W] function findNode(addr):
1. Looks up a node by its dotted '.' address string.
2. Split the address into numeric parts and traverse the tree step by step from the root to locate the exact node.

[X] function expandPathTo(addr):
1. Ensures all nodes of a target address are expanded so the target node is reachable and visible.

[Y] function runCommand(raw):
1. Trims the raw input string and returns early if empty.
2. Saves the command to state.cmdHistory and resets cmdHistoryIdx to -1.
3. Splits input by whitespace to get command name and arguments.
4. Matches the command name against known commands using a switch statement.
5. Calls setOutput() with success or error message after each command.

[Z] command 'goto' :
1. The goto command is used to directly navigate to a specific comment node.
2. The required tree becomes active.
3. Parent nodes are automatically expanded.
4. The target node gets highlighted.
5. The page scrolls smoothly to that comment.

[AA] command 'expand':
1. The expand command is used to open all replies and nested comments under a specific node.
2. calls expandAll() to recursively remove collapsed states from that node and all its child nodes.
3. The selected node is highlighted and automatically scrolled into view.

[AB] command 'collapse':
1. The collapse command is used to close or hide all replies and nested comments under a specific node.
2. calls collapseAll() to recursively add that node and all its child nodes to the collapsed set.
3. All replies under that node become hidden from the user.

[AC] command 'buffer':
1. Used to switch between loaded trees by number.
2. Acepts buffer N where N is the 1-based tree number.
3. Converts N to 0-based index and calls switchTree() if the index is valid.
4. Shows error if the buffer number does not exist.

[AD]command 'copy' : 
1. Copies text to both state.clipboard and the system clipboard, supporting several forms:
    1. copy row N — copies a single visible row's text by row number.
    2. copy y<addr> — copies a single node's text by dotted address.
    3. copy yt<N> — copies row N and every visible row after it.
    4. copy yt<addr> — copies the node at that address and everything visible after it.
    5. copy y<N1> y<N2> or copy <N1> <N2> — copies all visible rows between two row numbers (inclusive).
    6. copy y<addr1> y<addr2> — copies all visible rows between two addresses.
2. Reports how many lines were copied.

[AE]command 'paste':
1. Pastes the current clipboard contents as new sibling/child nodes after a target position.
2. Target defaults to the currently highlighted node; can also be given as 'paste pN' (row number) or 'paste p<addr>' (dotted address).
3. Builds new nodes from the clipboard text via buildPasteNodes(), inserting them as siblings after the target.
4. Re-assigns addresses for the affected tree, clears any stale collapsed entries under that tree, switches to and re-renders that tree, highlights the first newly pasted node, and scrolls it into view.

[AF] function setLevelView(level):

1. Used by the 'showlevel' command to show the tree up to a given depth and collapse everything beyond it.
2. Walks the active tree for any node whose address-depth equals level, collapses that node and its subtree for nodes at a shallower depth, makes sure they are expanded.

[AG] function scrollRowToTop():

1. Scrolls the tree table so the given row sits just below the header, accounting for the header's height.
2. Used after goto/expand/collapse/read/trim/copy so the relevant row is visible without manual scrolling.

[AH] command 'showlevel N':
1. Reveals nodes up to depth N and collapses everything deeper, via setLevelView().
2. Highlights the active tree's first child and scrolls to it.

[AI] command 'trim':
1. Force-truncates a node's displayed text down to its first 5 words, without changing the underlying data.
2. Accepts a dotted address , a row number , no argument.
3. Adds the target address to state.trimmedAddrs, highlights it, and scrolls it into view.

[AJ] command 'read':
1. Expands the full text of a single row in place, without permanently changing collapse/trim state.
2. Accepts a dotted address, a row number.
3. Switches tree if needed, expands the path to the target, highlights it, sets state.readExpanded to that address, and scrolls it into view.
4. The expanded text reverts automatically as soon as a different command is run.

[AK] command 'hide':
1. Hides part of the table without deleting any data.
2. 'hide column 1' — hides an entire column (rowno/commentno/author/comments) via resolveColumnKey() and applyColumnVisibility().

[AL] command 'show':
1. Reverses 'hide'.
2. 'show all' clears hiddenColumns, showing everything.
3. 'show column 1'..'show column 4' — unhides a column.

[AM] function setOutput(type, msg):
1. Displays a short status message below the command bar.
2. Green for success  or red for error.

[AN] command 'help':
1. Sets state.helpOpen = true.
2. Calls showHelp() to replace the table body with the full command reference.
3. Does not touch the underlying tree state — 'back' returns to exactly where you left off.

[AO] command 'back':
1. Only does something if state.helpOpen is true; otherwise reports an error.
2. Sets state.helpOpen = false and calls renderTreeTable() to restore the normal tree view.

[AP] command 'clear':
1. Resets state.highlighted back to "1" and clears state.collapsed.
2. Re-renders the tree table.
3. This only resets the tree view — it no longer shows the command reference; use 'help' for that.

[AQ] DOMContentLoaded:
1. Initializes the entire application after the page fully loads.
2. Attaches change event to fileInput — calls loadFiles() when files are selected, then clears the input so the same files can be re-uploaded if needed.
3. Attaches keydown to cmdInput for Enter key — trims value, calls runCommand(), clears input.
4. ArrowUp in cmdInput — increments cmdHistoryIdx and fills input with that history entry.
5. ArrowDown in cmdInput — decrements index; when index reaches -1, clears the input field.
6. Global keydown listener — if a printable character is typed while input is not focused, focuses cmdInput and types that character into it.

[AR]function truncateWords(text, limit = 5):
1. Splits text on whitespace and, if it has more words than the limit, cuts it down to the first `limit` words followed by ' ...'.
2. Returns the text unchanged if it's already short enough.
3. Used by the 'trim' command and by the collapsed-row preview logic in renderTreeTable()

[AS] function getFullTextFromRow(rowEl):
1. Reads the data-fulltext attribute off a row's .node-text span and unescapes it via unescHtml().
2. Falls back to the element's plain textContent if no data-fulltext attribute is present.
3. Used by 'copy' so copying always returns the full original text, regardless of whether the row is currently trimmed or collapsed to a preview.

[AT] Keyboard Navigation:
1. j -> move curser down 
2. k -> move curser up
3. h -> move curser left
4. l -> move curser right

[AU]function showHelp():
1. Replaces the tree table body with a themed, monospace command-reference panel.
2. Lists every command with example syntax and a short description (goto, expand, collapse, showlevel, trim, read, buffer, copy, paste, hide, show, clear, help, back).
3. Stays visible until 'back' is run.

[AV] function escHtml(str):
1. escapes &, <, >, and " so node text can be safely inserted into the table's HTML.

[AW]function unescHtml(str):
1. Reverses escHtml() — turns &amp;/&gt;/&lt;/&quot; back into their literal characters.
2. Used to recover the original, unescaped text stored in a row's data-fulltext attribute.
