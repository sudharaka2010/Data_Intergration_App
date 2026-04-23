# DATAC Data Integration App

DATAC is a full-stack data integration and validation application. It lets a user upload a supplier file and a target-market file, inspect columns, preview spreadsheet data, edit preview cells, select row/column mappings, translate metadata, and save the selected validation state into PostgreSQL.

The project is designed to be easy to understand. Frontend, backend, database models, services, and Docker setup are separated into clear folders.

## Main Purpose

The program helps compare and prepare supplier data for a selected target market.

It is useful for workflows where a team needs to:

- Upload supplier CSV/XLSX data.
- Upload target-market CSV/XLSX data.
- Read columns from both files.
- Merge column names into a new supplier/market structure.
- Preview tabular data in a spreadsheet-style UI.
- Edit preview cells directly in the browser.
- Select a column, row, name box, and target language.
- Save the selected validation and edited preview data to PostgreSQL.

## Main Functions

- `Login`: authenticates demo users from the backend.
- `Market loading`: reads market options from PostgreSQL.
- `Session creation`: creates one data session for each validation workflow.
- `Supplier upload`: uploads and parses supplier CSV/XLSX files.
- `Target upload`: uploads and parses target-market CSV/XLSX files.
- `Column preview`: displays parsed columns from uploaded files.
- `Merged columns`: combines supplier and target columns without duplicates.
- `Editable spreadsheet`: lets users edit preview cells directly.
- `Select row/column`: highlights and focuses the selected cell.
- `Translate preview`: stores the requested target language.
- `Save`: stores selected mapping and edited preview data in PostgreSQL.
- `Download/open uploaded file`: exposes stored uploads from the backend.

## Technology Stack

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript
- Browser Fetch API

### Backend

- Python 3.12
- FastAPI
- Uvicorn
- SQLAlchemy
- Pydantic / Pydantic Settings
- Psycopg2 PostgreSQL driver
- Pandas
- OpenPyXL
- Python Multipart
- Email Validator

### Database

- PostgreSQL 16 Alpine Docker image

### DevOps

- Docker
- Docker Compose

## Full Folder Structure

```text
Data Intergration App/
|-- README.md
|-- .env.example
|-- .gitignore
|-- docker-compose.yml
|-- docker/
|   `-- postgres/
|       `-- init.sql
|-- frontend/
|   |-- index.html
|   `-- assets/
|       |-- css/
|       |   `-- styles.css
|       `-- js/
|           `-- app.js
`-- backend/
    |-- Dockerfile
    |-- requirements.txt
    |-- storage/
    |   `-- uploads/
    |       `-- .gitkeep
    `-- app/
        |-- __init__.py
        |-- main.py
        |-- api/
        |   |-- __init__.py
        |   |-- router.py
        |   `-- routes/
        |       |-- __init__.py
        |       |-- auth.py
        |       |-- health.py
        |       |-- markets.py
        |       |-- sessions.py
        |       `-- uploads.py
        |-- core/
        |   |-- __init__.py
        |   |-- config.py
        |   `-- security.py
        |-- db/
        |   |-- __init__.py
        |   |-- base.py
        |   `-- session.py
        |-- models/
        |   |-- __init__.py
        |   |-- data_session.py
        |   |-- data_upload.py
        |   |-- enums.py
        |   |-- market.py
        |   |-- saved_selection.py
        |   `-- user.py
        |-- schemas/
        |   |-- __init__.py
        |   |-- auth.py
        |   |-- market.py
        |   |-- session.py
        |   `-- upload.py
        |-- services/
        |   |-- __init__.py
        |   |-- auth_service.py
        |   |-- bootstrap_service.py
        |   |-- session_service.py
        |   `-- upload_service.py
        `-- utils/
            |-- __init__.py
            `-- file_parser.py
```

## Backend Package Structure

### `backend/app/main.py`

Main FastAPI application file.

Responsibilities:

- Creates the FastAPI app.
- Runs database initialization on startup.
- Registers API routes.
- Serves frontend static assets.
- Serves uploaded files from `/downloads`.
- Serves the frontend page at `/`.

### `backend/app/api/`

Contains API routing.

- `router.py`: combines all route files under `/api/v1`.
- `routes/auth.py`: login endpoint.
- `routes/health.py`: backend/database health endpoint.
- `routes/markets.py`: market list endpoint.
- `routes/sessions.py`: data session, save, and translate endpoints.
- `routes/uploads.py`: supplier/target upload endpoint.

### `backend/app/core/`

Contains shared core configuration.

- `config.py`: app settings, environment values, paths, database URL.
- `security.py`: password hash and verification helpers.

### `backend/app/db/`

Contains database setup.

- `base.py`: SQLAlchemy declarative base and model registration.
- `session.py`: SQLAlchemy engine, session factory, and dependency.

### `backend/app/models/`

Contains SQLAlchemy models. These models define the PostgreSQL table structure.

- `user.py`: users table.
- `market.py`: markets table.
- `data_session.py`: data validation sessions.
- `data_upload.py`: uploaded supplier/target files.
- `saved_selection.py`: saved mappings and edited preview data.
- `enums.py`: shared enum values such as upload type.

### `backend/app/schemas/`

Contains Pydantic request and response schemas.

- `auth.py`: login request and response.
- `market.py`: market response.
- `session.py`: session, save, and translate schemas.
- `upload.py`: upload response schema.

### `backend/app/services/`

Contains business logic.

- `auth_service.py`: checks login credentials.
- `bootstrap_service.py`: creates tables, seeds admin user, seeds markets, applies small schema updates.
- `session_service.py`: creates sessions, builds summaries, saves selections, tracks translation state.
- `upload_service.py`: stores uploaded files and creates upload records.

### `backend/app/utils/`

Contains helper utilities.

- `file_parser.py`: reads CSV/XLSX files with Pandas and prepares preview rows/columns.

## Frontend Structure

### `frontend/index.html`

Main UI layout.

Contains:

- Loading screen.
- Login screen.
- Supplier upload panel.
- Target-market upload panel.
- File tree.
- Column preview lists.
- Merged column preview.
- Row/column/language controls.
- Editable spreadsheet preview.

### `frontend/assets/css/styles.css`

All frontend styling.

Contains:

- Dark DATAC visual theme.
- Responsive layout.
- Upload cards.
- Preview column layout.
- Select bar.
- Editable spreadsheet styling.
- Sticky header and row number column.
- Toast and overlay styling.

### `frontend/assets/js/app.js`

Frontend behavior and API integration.

Contains:

- Login API call.
- Market loading API call.
- File upload API calls.
- Session handling.
- Spreadsheet rendering.
- Editable cell tracking.
- Row/column selection.
- Save and translate API calls.
- Toast messages and loading overlays.

## Docker Structure

### `docker-compose.yml`

Starts the full application.

Services:

- `postgres`: PostgreSQL database container.
- `backend`: FastAPI backend container.

The backend is exposed on:

```text
http://localhost:8000
```

PostgreSQL is private inside Docker. It is not exposed on Windows port `5432`, because that port may already be used by a local PostgreSQL installation.

### `backend/Dockerfile`

Builds the Python backend image.

Steps:

- Uses `python:3.12-slim`.
- Installs packages from `backend/requirements.txt`.
- Copies backend and frontend files into the image.
- Starts Uvicorn on port `8000`.

### `docker/postgres/init.sql`

PostgreSQL initialization placeholder.

Current table creation is handled by the backend automatically through SQLAlchemy during application startup.

## Docker Containers

When the project is running, Docker creates:

- `datac_postgres`: PostgreSQL database container.
- `datac_backend`: FastAPI backend and frontend-serving container.
- `dataintergrationapp_default`: Docker network used by both containers.
- `dataintergrationapp_postgres_data`: Docker volume for database data.

## Database Tables

The backend creates these tables automatically when it starts.

### `users`

Stores application users.

Main columns:

- `id`
- `username`
- `email`
- `password_hash`
- `full_name`
- `is_active`
- `created_at`

Seeded demo user:

- Username: `admin`
- Email: `admin@datac.io`
- Password: `datac123`

### `markets`

Stores available target markets.

Main columns:

- `id`
- `code`
- `name`
- `default_language`
- `region`
- `created_at`

Seeded market examples:

- Australia
- Denmark
- Finland
- France
- Germany
- United Kingdom
- United States

### `data_sessions`

Stores each validation workflow session.

Main columns:

- `id`
- `name`
- `status`
- `selected_language`
- `user_id`
- `created_at`
- `updated_at`

### `data_uploads`

Stores uploaded supplier and target files.

Main columns:

- `id`
- `session_id`
- `market_id`
- `kind`
- `original_filename`
- `stored_filename`
- `file_type`
- `total_rows`
- `total_columns`
- `columns_json`
- `preview_rows_json`
- `created_at`

The `kind` value is either:

- `supplier`
- `target`

### `saved_selections`

Stores selected mapping information and edited preview data.

Main columns:

- `id`
- `session_id`
- `selected_column_name`
- `selected_box`
- `selected_column_alpha`
- `selected_row`
- `target_language`
- `skip_row_one`
- `active_preview_kind`
- `edited_headers_json`
- `edited_preview_rows_json`
- `edited_cell_count`
- `created_at`

## API Endpoints

Base prefix:

```text
/api/v1
```

### Health

```text
GET /api/v1/health
```

Checks backend and database connection.

### Login

```text
POST /api/v1/auth/login
```

Authenticates a user.

### Markets

```text
GET /api/v1/markets
```

Returns market options for dropdowns.

### Sessions

```text
POST /api/v1/sessions
```

Creates a new validation session.

```text
GET /api/v1/sessions/{session_id}/summary
```

Returns current session upload and column summary.

### Uploads

```text
POST /api/v1/sessions/{session_id}/uploads/supplier
POST /api/v1/sessions/{session_id}/uploads/target
```

Uploads supplier or target-market CSV/XLSX files.

### Translate

```text
POST /api/v1/sessions/{session_id}/translate-preview
```

Stores selected language for the session.

### Save Selection

```text
POST /api/v1/sessions/{session_id}/selections
```

Saves selected mapping and edited preview data.

## Run The Project

Start Docker Desktop first.

From the project root:

```powershell
cd "c:\Users\ASUS\OneDrive\Desktop\Data Intergration App"
docker compose up -d
```

Open the application:

```text
http://localhost:8000
```

Open API documentation:

```text
http://localhost:8000/docs
```

Check backend health:

```powershell
Invoke-WebRequest -Uri http://localhost:8000/api/v1/health -UseBasicParsing
```

Stop the project:

```powershell
docker compose down
```

Rebuild after dependency or Dockerfile changes:

```powershell
docker compose up -d --build
```

## Login Details

Use the seeded demo account:

```text
Username: admin
Email: admin@datac.io
Password: datac123
```

## Normal User Workflow

1. Open `http://localhost:8000`.
2. Login with the demo admin user.
3. Select and upload a supplier CSV/XLSX file.
4. Select and upload a target-market CSV/XLSX file.
5. Review supplier and target columns.
6. Review merged columns.
7. Edit spreadsheet preview cells if needed.
8. Select column name, name box, column letter, row, and language.
9. Click `Select` to focus the selected cell.
10. Click `Translate to` to store translation preview language.
11. Click `Save` to store mapping and edited preview data in PostgreSQL.

## Supported File Types

- `.csv`
- `.xlsx`

Files are stored in:

```text
backend/storage/uploads/
```

Inside Docker, the backend serves stored files from:

```text
/downloads/{stored_filename}
```

## Environment Variables

Example values are in `.env.example`.

```text
POSTGRES_DB=datac_db
POSTGRES_USER=datac_user
POSTGRES_PASSWORD=datac_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

When running with Docker Compose, the backend uses:

```text
POSTGRES_HOST=postgres
```

## Important Notes

- Tables are created automatically by the backend on startup.
- Demo markets and demo admin user are seeded automatically.
- PostgreSQL data is stored in the Docker volume `dataintergrationapp_postgres_data`.
- If the UI does not update after code changes, hard refresh the browser with `Ctrl + F5`.
- If port `5432` is already used on Windows, it is fine because PostgreSQL is private inside Docker.

## Verification Commands

Check JavaScript syntax:

```powershell
node --check frontend\assets\js\app.js
```

Check Python syntax:

```powershell
python -m compileall backend\app
```

Check Docker Compose file:

```powershell
docker compose config
```
