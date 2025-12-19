import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// GET /api/tasks - Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, created_at as "createdAt", updated_at as "updatedAt" FROM tasks ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/:id - Get a single task by ID
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query(
      'SELECT id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, created_at as "createdAt", updated_at as "updatedAt" FROM tasks WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// POST /api/tasks - Create a new task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, timerEnabled, hours, minutes, seconds } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Task title is required' });
    }
    
    const result = await pool.query(
      'INSERT INTO tasks (title, timer_enabled, hours, minutes, seconds) VALUES ($1, $2, $3, $4, $5) RETURNING id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, created_at as "createdAt", updated_at as "updatedAt"',
      [title.trim(), timerEnabled || false, hours || 0, minutes || 0, seconds || 0]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - Update a task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, timerEnabled, hours, minutes, seconds } = req.body;
    
    // Check if task exists
    const checkResult = await pool.query('SELECT id FROM tasks WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (title !== undefined && title.trim() === '') {
      return res.status(400).json({ error: 'Task title cannot be empty' });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title.trim());
    }
    if (timerEnabled !== undefined) {
      updates.push(`timer_enabled = $${paramCount++}`);
      values.push(timerEnabled);
    }
    if (hours !== undefined) {
      updates.push(`hours = $${paramCount++}`);
      values.push(hours);
    }
    if (minutes !== undefined) {
      updates.push(`minutes = $${paramCount++}`);
      values.push(minutes);
    }
    if (seconds !== undefined) {
      updates.push(`seconds = $${paramCount++}`);
      values.push(seconds);
    }
    
    if (updates.length === 0) {
      // No updates provided, return current task
      const result = await pool.query(
        'SELECT id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, created_at as "createdAt", updated_at as "updatedAt" FROM tasks WHERE id = $1',
        [id]
      );
      return res.json(result.rows[0]);
    }
    
    values.push(id);
    const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, created_at as "createdAt", updated_at as "updatedAt"`;
    
    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id - Delete a task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

