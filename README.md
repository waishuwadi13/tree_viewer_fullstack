# Hierarchy Tree Viewer (Full-Stack)

Upload a Reddit comment-thread HTML file or a C source file and view it as a navigable tree-table, with a command bar and vim-style keys.

This project started as a browser-only JavaScript tool (see `original/`) and was rebuilt as a full-stack app: parsing now runs on a Django server and the trees are stored in MySQL.

## Tech stack
- Backend: Python, Django, Django REST Framework, BeautifulSoup
- Database: MySQL
- Frontend: React (Vite)
- Version control: Git / GitHub

## How it works
Upload file -> React -> Django API -> parser (Reddit HTML / C code) -> MySQL

MySQL -> Django API (nested JSON tree) -> React tree-table

- `Tree` table: one row per uploaded file
- `Node` table: one row per comment / code line, linked to its parent with `parent_id`
- The API rebuilds the nested tree and gives every node a dotted address (1, 1.1, 1.1.1 ...)

## API
| Method | URL | Purpose |
|---|---|---|
| POST | `/api/trees/upload/` | Upload a `.html` or `.c` file, parse and save it |
| GET | `/api/trees/` | List saved trees |
| GET | `/api/trees/<id>/` | Get one full nested tree |

## Features in the React app
- Upload `.html` (Reddit threads) and `.c` files
- List of saved trees, click one to open it
- Tree-table with indentation, row numbers and dotted addresses
- Commands: `goto`, `expand`, `collapse`, `showlevel`, `trim`, `read`, `buffer`, `copy`, `paste`, `hide`, `show`, `clear`, `help`, `back`
- Command history with ArrowUp / ArrowDown
- Keyboard: `j` / `k` to move between rows, `h` / `l` to scroll sideways

## Not in the full-stack version
- Generic HTML / C++ / Java parsing (the Django version parses Reddit HTML and C files)
- Pasted nodes are not saved to the database yet (they exist only until the page is refreshed)

## Run locally
Backend:

    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt

Create `backend/.env` with DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, then:

    python manage.py migrate
    python manage.py runserver

Frontend (new terminal):

    cd frontend
    npm install
    npm run dev

Open http://localhost:5173

## Folders
- `backend/` Django project (API, parsers, models)
- `frontend/` React app
- `original/` the original browser-only JavaScript version and its README
- `samplefiles/` sample Reddit and C files for testing
