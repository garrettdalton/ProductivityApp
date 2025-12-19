import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import pool from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;


// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// GET /api/tasks - Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    // First, ensure all tasks have position values (migration helper)
    const nullPositionCheck = await pool.query(
      'SELECT COUNT(*) as count FROM tasks WHERE position IS NULL'
    );
    if (parseInt(nullPositionCheck.rows[0].count) > 0) {
      // Initialize positions for tasks that don't have them
      await pool.query(`
        UPDATE tasks 
        SET position = sub.row_num - 1
        FROM (
          SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
          FROM tasks
          WHERE position IS NULL
        ) sub
        WHERE tasks.id = sub.id
      `);
    }
    
    // Check if spotify_playlist_id column exists, if not use NULL
    let result;
    try {
      result = await pool.query(
        'SELECT id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, COALESCE(position, 0) as position, COALESCE(spotify_playlist_id, NULL) as "spotifyPlaylistId", created_at as "createdAt", updated_at as "updatedAt" FROM tasks ORDER BY COALESCE(position, 0) ASC, created_at ASC'
      );
    } catch (columnError) {
      // Column doesn't exist, query without it
      result = await pool.query(
        'SELECT id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, COALESCE(position, 0) as position, NULL as "spotifyPlaylistId", created_at as "createdAt", updated_at as "updatedAt" FROM tasks ORDER BY COALESCE(position, 0) ASC, created_at ASC'
      );
    }
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
      'SELECT id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, position, spotify_playlist_id as "spotifyPlaylistId", created_at as "createdAt", updated_at as "updatedAt" FROM tasks WHERE id = $1',
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
    const { title, timerEnabled, hours, minutes, seconds, spotifyPlaylistId } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Task title is required' });
    }
    
    // Get the maximum position and add 1 for the new task
    const maxPositionResult = await pool.query('SELECT COALESCE(MAX(position), -1) as max_position FROM tasks');
    const newPosition = maxPositionResult.rows[0].max_position + 1;
    
    // Check if spotify_playlist_id column exists
    let result;
    try {
      result = await pool.query(
        'INSERT INTO tasks (title, timer_enabled, hours, minutes, seconds, position, spotify_playlist_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, position, spotify_playlist_id as "spotifyPlaylistId", created_at as "createdAt", updated_at as "updatedAt"',
        [title.trim(), timerEnabled || false, hours || 0, minutes || 0, seconds || 0, newPosition, spotifyPlaylistId || null]
      );
    } catch (columnError) {
      // Column doesn't exist, insert without it
      result = await pool.query(
        'INSERT INTO tasks (title, timer_enabled, hours, minutes, seconds, position) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, position, NULL as "spotifyPlaylistId", created_at as "createdAt", updated_at as "updatedAt"',
        [title.trim(), timerEnabled || false, hours || 0, minutes || 0, seconds || 0, newPosition]
      );
    }
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id/reorder - Reorder a task (move up or down)
// This must come BEFORE /api/tasks/:id to ensure proper route matching
app.put('/api/tasks/:id/reorder', async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id);
    const { direction } = req.body; // 'up' or 'down'
    
    if (!direction || (direction !== 'up' && direction !== 'down')) {
      return res.status(400).json({ error: 'Direction must be "up" or "down"' });
    }
    
    await client.query('BEGIN');
    
    // Get current task
    const currentTaskResult = await client.query(
      'SELECT id, COALESCE(position, 0) as position FROM tasks WHERE id = $1',
      [id]
    );
    
    if (currentTaskResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const currentPosition = currentTaskResult.rows[0].position;
    
    // Find the task to swap with
    let swapTaskId;
    let swapPosition;
    if (direction === 'up') {
      // Find task with position less than current (move up = lower position number)
      const swapResult = await client.query(
        'SELECT id, position FROM tasks WHERE position < $1 ORDER BY position DESC LIMIT 1',
        [currentPosition]
      );
      if (swapResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Task is already at the top' });
      }
      swapTaskId = swapResult.rows[0].id;
      swapPosition = swapResult.rows[0].position;
    } else {
      // Find task with position greater than current (move down = higher position number)
      const swapResult = await client.query(
        'SELECT id, position FROM tasks WHERE position > $1 ORDER BY position ASC LIMIT 1',
        [currentPosition]
      );
      if (swapResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Task is already at the bottom' });
      }
      swapTaskId = swapResult.rows[0].id;
      swapPosition = swapResult.rows[0].position;
    }
    
    // Swap positions
    // Set current task to swap position
    await client.query('UPDATE tasks SET position = $1 WHERE id = $2', [swapPosition, id]);
    // Set swap task to current position
    await client.query('UPDATE tasks SET position = $1 WHERE id = $2', [currentPosition, swapTaskId]);
    
    await client.query('COMMIT');
    
    // Return updated task list
    const result = await pool.query(
      'SELECT id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, position, spotify_playlist_id as "spotifyPlaylistId", created_at as "createdAt", updated_at as "updatedAt" FROM tasks ORDER BY position ASC, created_at ASC'
    );
    
    res.json(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reordering task:', error);
    res.status(500).json({ error: 'Failed to reorder task' });
  } finally {
    client.release();
  }
});

// PUT /api/tasks/reorder - Reorder tasks by updating positions
app.put('/api/tasks/reorder', async (req, res) => {
  const client = await pool.connect();
  try {
    const { taskOrders } = req.body; // Array of { id, position }
    
    if (!Array.isArray(taskOrders)) {
      return res.status(400).json({ error: 'taskOrders must be an array' });
    }
    
    await client.query('BEGIN');
    
    // Update all positions
    for (const { id, position } of taskOrders) {
      await client.query('UPDATE tasks SET position = $1 WHERE id = $2', [position, id]);
    }
    
    await client.query('COMMIT');
    
    // Return updated task list
    const result = await pool.query(
      'SELECT id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, position, spotify_playlist_id as "spotifyPlaylistId", created_at as "createdAt", updated_at as "updatedAt" FROM tasks ORDER BY position ASC, created_at ASC'
    );
    
    res.json(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reordering tasks:', error);
    res.status(500).json({ error: 'Failed to reorder tasks' });
  } finally {
    client.release();
  }
});

// PUT /api/tasks/:id - Update a task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, timerEnabled, hours, minutes, seconds, spotifyPlaylistId } = req.body;
    
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
    if (spotifyPlaylistId !== undefined) {
      updates.push(`spotify_playlist_id = $${paramCount++}`);
      values.push(spotifyPlaylistId || null);
    }
    
    if (updates.length === 0) {
      // No updates provided, return current task
      const result = await pool.query(
        'SELECT id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, position, spotify_playlist_id as "spotifyPlaylistId", created_at as "createdAt", updated_at as "updatedAt" FROM tasks WHERE id = $1',
        [id]
      );
      return res.json(result.rows[0]);
    }
    
    values.push(id);
    const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, title, timer_enabled as "timerEnabled", hours, minutes, seconds, position, spotify_playlist_id as "spotifyPlaylistId", created_at as "createdAt", updated_at as "updatedAt"`;
    
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
});

