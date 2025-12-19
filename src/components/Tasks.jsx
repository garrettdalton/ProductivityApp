import { useState, useEffect, useRef } from 'react';
import { getTasks, deleteTask, updateTask, reorderTask, reorderTasks } from '../services/api';
import './Tasks.css';

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTimer, setActiveTimer] = useState(null); // { taskId, remainingSeconds }
  const [isPaused, setIsPaused] = useState(false);
  const [waitingForSkip, setWaitingForSkip] = useState(null); // Task ID we're waiting to skip to
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const intervalRef = useRef(null);
  const nextTaskTimeoutRef = useRef(null);
  const tasksRef = useRef(tasks);
  const taskCardRefs = useRef({});
  
  // Keep tasksRef in sync with tasks
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Scroll to active task when timer starts or when waiting for skip
  useEffect(() => {
    if (activeTimer && !isPaused) {
      const taskCard = taskCardRefs.current[activeTimer.taskId];
      if (taskCard) {
        setTimeout(() => {
          taskCard.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }, 100);
      }
    } else if (waitingForSkip) {
      const taskCard = taskCardRefs.current[waitingForSkip];
      if (taskCard) {
        setTimeout(() => {
          taskCard.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }, 100);
      }
    }
  }, [activeTimer?.taskId, isPaused, waitingForSkip]);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    if (activeTimer && !isPaused && activeTimer.remainingSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setActiveTimer((prev) => {
          if (prev.remainingSeconds <= 1) {
            handleTimerComplete(prev.taskId);
            return null;
          }
          return {
            ...prev,
            remainingSeconds: prev.remainingSeconds - 1
          };
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(nextTaskTimeoutRef.current);
    };
  }, [activeTimer, isPaused]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      setError('Failed to load tasks. Please check your connection and try again.');
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

  const handleReorder = async (id, direction) => {
    try {
      setError(null);
      console.log(`Reordering task ${id} ${direction}`);
      const updatedTasks = await reorderTask(id, direction);
      console.log('Updated tasks:', updatedTasks);
      setTasks(updatedTasks);
    } catch (err) {
      const errorMessage = err.message || 'Failed to reorder task';
      setError(errorMessage);
      console.error('Reorder error:', err);
    }
  };

  const handleDragStart = (e, taskId) => {
    // Don't start drag if clicking on buttons or interactive elements
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      e.preventDefault();
      return;
    }
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', taskId);
  };

  const handleDragOver = (e, taskId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (taskId !== draggedTaskId) {
      setDragOverTaskId(taskId);
    }
  };

  const handleDragLeave = () => {
    setDragOverTaskId(null);
  };

  const handleDrop = async (e, dropTaskId) => {
    e.preventDefault();
    setDragOverTaskId(null);

    if (!draggedTaskId || draggedTaskId === dropTaskId) {
      setDraggedTaskId(null);
      return;
    }

    const draggedIndex = tasks.findIndex(t => t.id === draggedTaskId);
    const dropIndex = tasks.findIndex(t => t.id === dropTaskId);

    if (draggedIndex === -1 || dropIndex === -1) {
      setDraggedTaskId(null);
      return;
    }

    // Save original tasks for error recovery
    const originalTasks = [...tasks];

    // Create new array with reordered tasks
    const newTasks = [...tasks];
    const [removed] = newTasks.splice(draggedIndex, 1);
    newTasks.splice(dropIndex, 0, removed);

    // Update positions
    const taskOrders = newTasks.map((task, index) => ({
      id: task.id,
      position: index
    }));

    // Optimistically update UI
    setTasks(newTasks);
    setDraggedTaskId(null);

    // Update backend
    try {
      const updatedTasks = await reorderTasks(taskOrders);
      setTasks(updatedTasks);
    } catch (err) {
      // Revert on error using original tasks
      setTasks(originalTasks);
      setError('Failed to reorder tasks');
      console.error('Drag and drop error:', err);
    }
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const formatTime = (hours, minutes, seconds) => {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const formatSeconds = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return formatTime(hours, minutes, seconds);
  };

  const playBeep = () => {
    // Create 3 beeps that start low and get higher using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Frequencies for the 3 beeps: low, medium, high
    const frequencies = [400, 600, 800];
    const beepDuration = 0.3; // Duration of each beep in seconds
    const beepGap = 0.1; // Gap between beeps in seconds
    
    frequencies.forEach((frequency, index) => {
      const startTime = audioContext.currentTime + index * (beepDuration + beepGap);
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + beepDuration);

      oscillator.start(startTime);
      oscillator.stop(startTime + beepDuration);
    });
  };

  const handleStartTimer = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.timerEnabled) return;

    const totalSeconds = task.hours * 3600 + task.minutes * 60 + task.seconds;
    if (totalSeconds <= 0) return;

    // If there's already an active timer, pause it first
    if (activeTimer && activeTimer.taskId !== taskId) {
      setActiveTimer(null);
      setIsPaused(false);
    }

    setActiveTimer({
      taskId,
      remainingSeconds: totalSeconds
    });
    setIsPaused(false);
  };

  const handlePauseTimer = () => {
    setIsPaused(true);
  };

  const handleResumeTimer = () => {
    setIsPaused(false);
  };

  const handleSkipToNext = async () => {
    const currentTasks = tasksRef.current;
    let currentTaskId = null;
    
    if (activeTimer) {
      currentTaskId = activeTimer.taskId;
    } else if (waitingForSkip) {
      // When waiting, use the waiting task as the current task
      currentTaskId = waitingForSkip;
    }
    
    if (currentTaskId === null) return;
    
    const currentIndex = currentTasks.findIndex(t => t.id === currentTaskId);
    const nextTask = currentTasks[currentIndex + 1];
    
    if (nextTask) {
      // Stop current timer
      setActiveTimer(null);
      setIsPaused(false);
      setWaitingForSkip(null);
      clearTimeout(nextTaskTimeoutRef.current);

      // Always go to the next task and start it if it has a timer
      if (nextTask.timerEnabled) {
        const totalSeconds = nextTask.hours * 3600 + nextTask.minutes * 60 + nextTask.seconds;
        if (totalSeconds > 0) {
          setActiveTimer({
            taskId: nextTask.id,
            remainingSeconds: totalSeconds
          });
          setIsPaused(false);
        } else {
          // Timer is set to 0, so just move to next task without starting
          setWaitingForSkip(nextTask.id);
        }
      } else {
        // Next task has no timer, wait for another skip
        setWaitingForSkip(nextTask.id);
      }
    }
  };

  const handleTimerComplete = (completedTaskId) => {
    // Play beep
    playBeep();

    // Clear current timer
    setActiveTimer(null);
    setIsPaused(false);

    // Find the next task using the latest tasks
    const currentTasks = tasksRef.current;
    const currentIndex = currentTasks.findIndex(t => t.id === completedTaskId);
    const nextTask = currentTasks[currentIndex + 1];
    
    if (nextTask) {
      if (nextTask.timerEnabled) {
        // Next task has timer - wait 5 seconds, then start it
        nextTaskTimeoutRef.current = setTimeout(async () => {
          const latestTasks = tasksRef.current;
          const task = latestTasks.find(t => t.id === nextTask.id);
          if (task && task.timerEnabled) {
            const totalSeconds = task.hours * 3600 + task.minutes * 60 + task.seconds;
            if (totalSeconds > 0) {
              setActiveTimer({
                taskId: task.id,
                remainingSeconds: totalSeconds
              });
              setIsPaused(false);
            }
          }
        }, 5000);
      } else {
        // Next task has no timer - wait for user to click skip
        setWaitingForSkip(nextTask.id);
      }
    }
  };

  const getTimerDisplay = (task) => {
    if (activeTimer && activeTimer.taskId === task.id) {
      return formatSeconds(activeTimer.remainingSeconds);
    }
    return formatTime(task.hours, task.minutes, task.seconds);
  };

  const isTimerActive = (taskId) => {
    return activeTimer && activeTimer.taskId === taskId && !isPaused;
  };

  const isTimerPaused = (taskId) => {
    return activeTimer && activeTimer.taskId === taskId && isPaused;
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
        <div className="header-actions">
          <button onClick={loadTasks} className="refresh-btn">Refresh</button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="no-tasks">
          <p>No tasks yet. Create a task above to get started!</p>
        </div>
      ) : (
        <div className="tasks-list">
          {tasks.map((task, index) => (
            <div 
              key={task.id} 
              className={`task-card ${activeTimer && activeTimer.taskId === task.id ? 'task-active' : ''} ${waitingForSkip === task.id ? 'task-waiting' : ''} ${draggedTaskId === task.id ? 'task-dragging' : ''} ${dragOverTaskId === task.id ? 'task-drag-over' : ''}`}
              ref={(el) => (taskCardRefs.current[task.id] = el)}
              draggable
              onDragStart={(e) => handleDragStart(e, task.id)}
              onDragOver={(e) => handleDragOver(e, task.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, task.id)}
              onDragEnd={handleDragEnd}
            >
              <div className="task-header">
                <div className="task-reorder-controls">
                  <button
                    onClick={() => handleReorder(task.id, 'up')}
                    className="reorder-btn up-btn"
                    disabled={index === 0}
                    aria-label="Move task up"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleReorder(task.id, 'down')}
                    className="reorder-btn down-btn"
                    disabled={index === tasks.length - 1}
                    aria-label="Move task down"
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
                <h3 className="task-title">{task.title}</h3>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="delete-btn"
                  aria-label="Delete task"
                >
                  ×
                </button>
              </div>
              
              {waitingForSkip === task.id && (
                <div className="task-waiting-message">
                  <p>Click to go to next task</p>
                  <button
                    onClick={handleSkipToNext}
                    className="timer-control-btn skip-btn"
                  >
                    Next Task
                  </button>
                </div>
              )}
              
              {task.timerEnabled && (
                <div className="task-timer-section">
                  <div className="task-timer-info">
                    <span className="timer-label">Timer:</span>
                    <span className={`timer-value ${activeTimer && activeTimer.taskId === task.id ? 'timer-active' : ''}`}>
                      {getTimerDisplay(task)}
                    </span>
                  </div>
                  <div className="timer-controls">
                    {!activeTimer || activeTimer.taskId !== task.id ? (
                      <button
                        onClick={() => handleStartTimer(task.id)}
                        className="timer-control-btn start-btn"
                        disabled={task.hours === 0 && task.minutes === 0 && task.seconds === 0}
                      >
                        Start
                      </button>
                    ) : isPaused ? (
                      <>
                        <button
                          onClick={handleResumeTimer}
                          className="timer-control-btn resume-btn"
                        >
                          Resume
                        </button>
                        <button
                          onClick={handleSkipToNext}
                          className="timer-control-btn skip-btn"
                        >
                          Next Task
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handlePauseTimer}
                          className="timer-control-btn pause-btn"
                        >
                          Pause
                        </button>
                        <button
                          onClick={handleSkipToNext}
                          className="timer-control-btn skip-btn"
                        >
                          Next Task
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Tasks;

