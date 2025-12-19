import { useState, useEffect, useRef } from 'react'
import { createTask } from './services/api'
import Tasks from './components/Tasks'
import './App.css'

function App() {
  const [title, setTitle] = useState('')
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [tasksUpdated, setTasksUpdated] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }

    return () => clearInterval(intervalRef.current)
  }, [isRunning, timeRemaining])

  const handleStartTimer = () => {
    const totalSeconds = hours * 3600 + minutes * 60 + seconds
    if (totalSeconds > 0) {
      setTimeRemaining(totalSeconds)
      setIsRunning(true)
    }
  }

  const handlePauseTimer = () => {
    setIsRunning(false)
  }

  const handleResetTimer = () => {
    setIsRunning(false)
    setTimeRemaining(0)
    setHours(0)
    setMinutes(0)
    setSeconds(0)
  }

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

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
      setTimeRemaining(0)
      setIsRunning(false)
      
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
      <h1 className="app-title">Productivity</h1>
      
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
                      handleResetTimer()
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
                      disabled={isRunning || isSubmitting}
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
                      disabled={isRunning || isSubmitting}
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
                      disabled={isRunning || isSubmitting}
                      className="time-input"
                    />
                  </div>
                </div>

                {timeRemaining > 0 && (
                  <div className="timer-display">
                    <div className="timer-time">{formatTime(timeRemaining)}</div>
                  </div>
                )}

                <div className="timer-buttons">
                  {!isRunning ? (
                    <button type="button" onClick={handleStartTimer} className="timer-btn start-btn" disabled={isSubmitting}>
                      Start
                    </button>
                  ) : (
                    <button type="button" onClick={handlePauseTimer} className="timer-btn pause-btn" disabled={isSubmitting}>
                      Pause
                    </button>
                  )}
                  <button type="button" onClick={handleResetTimer} className="timer-btn reset-btn" disabled={isSubmitting}>
                    Reset
                  </button>
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
