import { useState } from 'react'
import { createTask } from './services/api'
import Tasks from './components/Tasks'
import './App.css'

function App() {
  const [title, setTitle] = useState('')
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [tasksUpdated, setTasksUpdated] = useState(0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setSubmitError('Please enter a task title')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await createTask({
        title: title.trim(),
        timerEnabled,
        hours,
        minutes,
        seconds
      })

      // Reset form
      setTitle('')
      setTimerEnabled(false)
      setHours(0)
      setMinutes(0)
      setSeconds(0)
      
      // Trigger Tasks component to refresh
      setTasksUpdated(prev => prev + 1)
    } catch (error) {
      setSubmitError('Failed to create task. Make sure the server is running on port 8000.')
      console.error('Error creating task:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app">
      <h1 className="app-title">Garrett's Productivity App</h1>
      
      <div className="container">
        <form className="title-form" onSubmit={handleSubmit}>
          <label htmlFor="task-title">Task Title</label>
          <input
            id="task-title"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setSubmitError(null)
            }}
            placeholder="Enter your task title..."
            className="title-input"
            disabled={isSubmitting}
          />

          {submitError && (
            <div className="submit-error">{submitError}</div>
          )}

          <div className="timer-section">
            <div className="timer-toggle">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={timerEnabled}
                  onChange={(e) => {
                    setTimerEnabled(e.target.checked)
                    if (!e.target.checked) {
                      setHours(0)
                      setMinutes(0)
                      setSeconds(0)
                    }
                  }}
                  disabled={isSubmitting}
                />
                <span>Enable Countdown Timer</span>
              </label>
            </div>

            {timerEnabled && (
              <div className="timer-controls">
                <div className="timer-inputs">
                  <div className="time-input-group">
                    <label>Hours</label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={hours}
                      onChange={(e) => setHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                      disabled={isSubmitting}
                      className="time-input"
                    />
                  </div>
                  <div className="time-input-group">
                    <label>Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={minutes}
                      onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      disabled={isSubmitting}
                      className="time-input"
                    />
                  </div>
                  <div className="time-input-group">
                    <label>Seconds</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={seconds}
                      onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      disabled={isSubmitting}
                      className="time-input"
                    />
                  </div>
                </div>
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>

      <Tasks key={tasksUpdated} />
    </div>
  )
}

export default App
