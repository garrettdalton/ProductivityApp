import { useState, useEffect } from 'react';
import { getTasks, deleteTask, updateTask } from '../services/api';
import './Tasks.css';

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      setError('Failed to load tasks. Make sure the server is running on port 8000.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask(id);
        setTasks(tasks.filter(task => task.id !== id));
      } catch (err) {
        setError('Failed to delete task');
        console.error(err);
      }
    }
  };

  const formatTime = (hours, minutes, seconds) => {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="tasks-container">
        <div className="loading">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tasks-container">
        <div className="error">{error}</div>
        <button onClick={loadTasks} className="retry-btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="tasks-container">
      <div className="tasks-header">
        <h2>Tasks</h2>
        <button onClick={loadTasks} className="refresh-btn">Refresh</button>
      </div>

      {tasks.length === 0 ? (
        <div className="no-tasks">
          <p>No tasks yet. Create a task above to get started!</p>
        </div>
      ) : (
        <div className="tasks-list">
          {tasks.map((task) => (
            <div key={task.id} className="task-card">
              <div className="task-header">
                <h3 className="task-title">{task.title}</h3>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="delete-btn"
                  aria-label="Delete task"
                >
                  ×
                </button>
              </div>
              
              {task.timerEnabled && (
                <div className="task-timer-info">
                  <span className="timer-label">Timer:</span>
                  <span className="timer-value">
                    {formatTime(task.hours, task.minutes, task.seconds)}
                  </span>
                </div>
              )}

              <div className="task-meta">
                <span className="task-date">
                  Created: {formatDate(task.createdAt)}
                </span>
                {task.updatedAt !== task.createdAt && (
                  <span className="task-date">
                    Updated: {formatDate(task.updatedAt)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Tasks;

