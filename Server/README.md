# Productivity App Server

Express.js server for the Productivity App API.

## Setup

1. Install dependencies:
```bash
cd Server
npm install
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

## Notes

- The server uses in-memory storage. Tasks will be lost when the server restarts.
- For production, replace the in-memory storage with a database (MongoDB, PostgreSQL, etc.)

