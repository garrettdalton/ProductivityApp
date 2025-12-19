import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for tasks (in production, use a database)
let tasks = [
  {
    id: 1,
    title: 'Sample Task',
    timerEnabled: false,
    hours: 0,
    minutes: 0,
    seconds: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let nextId = 2;

// GET /api/tasks - Get all tasks
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

// GET /api/tasks/:id - Get a single task by ID
app.get('/api/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const task = tasks.find(t => t.id === id);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  res.json(task);
});

// POST /api/tasks - Create a new task
app.post('/api/tasks', (req, res) => {
  const { title, timerEnabled, hours, minutes, seconds } = req.body;
  
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Task title is required' });
  }
  
  const newTask = {
    id: nextId++,
    title: title.trim(),
    timerEnabled: timerEnabled || false,
    hours: hours || 0,
    minutes: minutes || 0,
    seconds: seconds || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  tasks.push(newTask);
  res.status(201).json(newTask);
});

// PUT /api/tasks/:id - Update a task
app.put('/api/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const taskIndex = tasks.findIndex(t => t.id === id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const { title, timerEnabled, hours, minutes, seconds } = req.body;
  
  if (title !== undefined && title.trim() === '') {
    return res.status(400).json({ error: 'Task title cannot be empty' });
  }
  
  const updatedTask = {
    ...tasks[taskIndex],
    ...(title !== undefined && { title: title.trim() }),
    ...(timerEnabled !== undefined && { timerEnabled }),
    ...(hours !== undefined && { hours }),
    ...(minutes !== undefined && { minutes }),
    ...(seconds !== undefined && { seconds }),
    updatedAt: new Date().toISOString()
  };
  
  tasks[taskIndex] = updatedTask;
  res.json(updatedTask);
});

// DELETE /api/tasks/:id - Delete a task
app.delete('/api/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const taskIndex = tasks.findIndex(t => t.id === id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  tasks.splice(taskIndex, 1);
  res.status(204).send();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

