import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import pool from './db.js';
import { google } from 'googleapis';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Google Calendar OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Use environment variable for redirect URI, or construct from Vercel URL, or fallback to localhost
const VERCEL_URL = process.env.VERCEL_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || (VERCEL_URL ? `https://${VERCEL_URL}` : null);
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 
  (FRONTEND_URL ? `${FRONTEND_URL}/api/calendar/callback` : `http://127.0.0.1:${PORT}/api/calendar/callback`);

// Determine allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : FRONTEND_URL 
    ? [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173']
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Session configuration - use database-backed store for Vercel (serverless)
// For Vercel, we need to use a persistent store since memory store won't work across function invocations
// Using PostgreSQL-based session store
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: true, // Save session even if not modified (important for OAuth)
  saveUninitialized: true, // Save uninitialized sessions
  name: 'sessionId',
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    httpOnly: true,
    sameSite: 'lax', // Allows cookies on top-level navigation (OAuth redirects)
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? undefined : undefined // Let browser handle domain
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
    
    console.log('Reorder task request:', { id, direction, body: req.body });
    
    if (!direction || (direction !== 'up' && direction !== 'down')) {
      return res.status(400).json({ error: 'Direction must be "up" or "down"' });
    }
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
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
    
    // Return updated task list - handle spotify_playlist_id column gracefully
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
    
    console.log('Reorder successful, returning', result.rows.length, 'tasks');
    res.json(result.rows);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }
    console.error('Error reordering task:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to reorder task', details: error.message });
  } finally {
    client.release();
  }
});

// PUT /api/tasks/reorder - Reorder tasks by updating positions
app.put('/api/tasks/reorder', async (req, res) => {
  const client = await pool.connect();
  try {
    const { taskOrders } = req.body; // Array of { id, position }
    
    console.log('Reorder request received:', { taskOrders, body: req.body });
    
    if (!taskOrders) {
      return res.status(400).json({ error: 'taskOrders is required' });
    }
    
    if (!Array.isArray(taskOrders)) {
      return res.status(400).json({ error: 'taskOrders must be an array' });
    }
    
    if (taskOrders.length === 0) {
      return res.status(400).json({ error: 'taskOrders array cannot be empty' });
    }
    
    // Validate each task order entry
    for (const taskOrder of taskOrders) {
      if (!taskOrder.hasOwnProperty('id') || !taskOrder.hasOwnProperty('position')) {
        return res.status(400).json({ error: 'Each taskOrder must have id and position' });
      }
      if (typeof taskOrder.id !== 'number' || typeof taskOrder.position !== 'number') {
        return res.status(400).json({ error: 'id and position must be numbers' });
      }
    }
    
    await client.query('BEGIN');
    
    // Update all positions
    for (const { id, position } of taskOrders) {
      await client.query('UPDATE tasks SET position = $1 WHERE id = $2', [position, id]);
    }
    
    await client.query('COMMIT');
    
    // Return updated task list - handle spotify_playlist_id column gracefully
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
    
    console.log('Reorder successful, returning', result.rows.length, 'tasks');
    res.json(result.rows);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }
    console.error('Error reordering tasks:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to reorder tasks', details: error.message });
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

// Google Calendar OAuth endpoints

// GET /api/calendar/auth - Initiate Google Calendar OAuth flow
app.get('/api/calendar/auth', (req, res) => {
  console.log('=== Google Calendar Auth Request ===');
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('Google Calendar credentials not configured');
    return res.status(500).json({ error: 'Google Calendar credentials not configured' });
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  const state = crypto.randomBytes(16).toString('hex');
  req.session.googleCalendarState = state;
  console.log('Generated state:', state);
  console.log('Session ID:', req.sessionID);
  console.log('Redirect URI:', GOOGLE_REDIRECT_URI);
  
  // Save session and ensure cookie is set
  req.session.save((err) => {
    if (err) {
      console.error('Error saving session:', err);
      return res.status(500).json({ error: 'Failed to save session' });
    }
    
    console.log('Session saved. State stored:', req.session.googleCalendarState);
    console.log('Session ID:', req.sessionID);
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent' // Force consent screen to get refresh token
    });

      console.log('Generated auth URL, sending response...');
      console.log('Response headers will include Set-Cookie for session');
      res.json({ authUrl });
  });
});

// GET /api/calendar/callback - Handle Google Calendar OAuth callback
app.get('/api/calendar/callback', async (req, res) => {
  console.log('=== Google Calendar Callback ===');
  console.log('Session ID:', req.sessionID);
  console.log('Cookies received:', req.headers.cookie);
  console.log('Query params:', req.query);
  
  const { code, state, error } = req.query;
  
  // Regenerate session to ensure we have a valid session
  if (!req.sessionID) {
    req.session.regenerate((err) => {
      if (err) {
        console.error('Error regenerating session:', err);
      }
    });
  }
  
  const storedState = req.session.googleCalendarState;

  console.log('Received state:', state);
  console.log('Stored state:', storedState);
  console.log('Session keys:', Object.keys(req.session));

  const redirectUrl = FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    console.error('Google Calendar OAuth error from callback:', error);
    return res.redirect(`${redirectUrl}?calendar_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.error('No authorization code received');
    return res.redirect(`${redirectUrl}?calendar_error=no_code`);
  }

  if (!state) {
    console.error('No state parameter received from Google');
    return res.redirect(`${redirectUrl}?calendar_error=no_state_received`);
  }

  if (!storedState) {
    console.error('No stored state in session - session may have been lost');
    console.error('This usually means cookies/sessions are not working properly');
    return res.redirect(`${redirectUrl}?calendar_error=session_lost`);
  }

  if (state !== storedState) {
    console.error('State mismatch!');
    console.error('  Received state:', state);
    console.error('  Stored state:', storedState);
    console.error('  Session ID:', req.sessionID);
    return res.redirect(`${redirectUrl}?calendar_error=state_mismatch`);
  }

  console.log('State matches! Proceeding with token exchange...');

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${redirectUrl}?calendar_error=server_config_missing`);
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in session
    req.session.googleCalendarAccessToken = tokens.access_token;
    req.session.googleCalendarRefreshToken = tokens.refresh_token;
    req.session.googleCalendarTokenExpiry = tokens.expiry_date;

    const redirectUrl = FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${redirectUrl}?calendar_connected=true`);
  } catch (error) {
    console.error('Google Calendar OAuth error:', error);
    const redirectUrl = FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${redirectUrl}?calendar_error=${encodeURIComponent(error.message)}`);
  }
});

// GET /api/calendar/token - Get current access token (with refresh if needed)
app.get('/api/calendar/token', async (req, res) => {
  if (!req.session.googleCalendarAccessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check if token is expired and refresh if needed
  if (req.session.googleCalendarTokenExpiry && Date.now() >= req.session.googleCalendarTokenExpiry) {
    if (!req.session.googleCalendarRefreshToken || !GOOGLE_CLIENT_SECRET) {
      req.session.destroy();
      return res.status(401).json({ error: 'Token expired and refresh failed' });
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        refresh_token: req.session.googleCalendarRefreshToken
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      req.session.googleCalendarAccessToken = credentials.access_token;
      if (credentials.refresh_token) {
        req.session.googleCalendarRefreshToken = credentials.refresh_token;
      }
      req.session.googleCalendarTokenExpiry = credentials.expiry_date;
    } catch (error) {
      console.error('Error refreshing Google Calendar token:', error);
      req.session.destroy();
      return res.status(401).json({ error: 'Failed to refresh token' });
    }
  }

  res.json({ accessToken: req.session.googleCalendarAccessToken });
});

// GET /api/calendar/events - Get calendar events
app.get('/api/calendar/events', async (req, res) => {
  if (!req.session.googleCalendarAccessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: req.session.googleCalendarAccessToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Get events for the next 30 days
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin,
      timeMax: timeMax,
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    res.json({ events });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    if (error.response?.status === 401) {
      // Token expired, clear session
      req.session.destroy();
      return res.status(401).json({ error: 'Authentication expired. Please reconnect.' });
    }
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// POST /api/calendar/logout - Logout from Google Calendar
app.post('/api/calendar/logout', (req, res) => {
  req.session.googleCalendarAccessToken = null;
  req.session.googleCalendarRefreshToken = null;
  req.session.googleCalendarTokenExpiry = null;
  req.session.googleCalendarState = null;
  res.json({ success: true });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Export for Vercel serverless functions
export default app;

// Only listen if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
  });
}

