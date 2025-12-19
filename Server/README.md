# Productivity App Server

Express.js server for the Productivity App API with PostgreSQL database.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

## Database Setup

1. **Install PostgreSQL** (if not already installed)
   - Windows: Download from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)
   - macOS: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql` (Ubuntu/Debian)

2. **Create the database:**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres

   # Create the database
   CREATE DATABASE productivity_app;

   # Exit psql
   \q
   ```

3. **Run the schema:**
   ```bash
   psql -U postgres -d productivity_app -f schema.sql
   ```

## Setup

1. **Install dependencies:**
   ```bash
   cd Server
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   # Copy the example env file
   cp .env.example .env

   # Edit .env with your database credentials
   # Default values:
   # DB_HOST=localhost
   # DB_PORT=5432
   # DB_NAME=productivity_app
   # DB_USER=postgres
   # DB_PASSWORD=postgres
   ```

## Running the Server

Start the server:
```bash
npm start
```

Or run in development mode with auto-reload:
```bash
npm run dev
```

The server will run on `http://localhost:8000`

## API Endpoints

### GET /api/tasks
Get all tasks

### GET /api/tasks/:id
Get a single task by ID

### POST /api/tasks
Create a new task
```json
{
  "title": "Task title",
  "timerEnabled": true,
  "hours": 1,
  "minutes": 30,
  "seconds": 0
}
```

### PUT /api/tasks/:id
Update a task
```json
{
  "title": "Updated title",
  "timerEnabled": false
}
```

### DELETE /api/tasks/:id
Delete a task

### GET /health
Health check endpoint

## Database Schema

The `tasks` table has the following structure:
- `id` - SERIAL PRIMARY KEY
- `title` - VARCHAR(255) NOT NULL
- `timer_enabled` - BOOLEAN DEFAULT FALSE
- `hours` - INTEGER DEFAULT 0
- `minutes` - INTEGER DEFAULT 0
- `seconds` - INTEGER DEFAULT 0
- `created_at` - TIMESTAMP (auto-set on creation)
- `updated_at` - TIMESTAMP (auto-updated on modification)

## Notes

- Tasks are now stored in PostgreSQL and will persist across server restarts.
- Make sure PostgreSQL is running before starting the server.
- The `updated_at` field is automatically updated by a database trigger.

