import { useState, useEffect } from 'react';
import { getGoogleCalendarAuthUrl, getGoogleCalendarToken, getGoogleCalendarEvents, logoutGoogleCalendar } from '../services/api';
import './Calendar.css';

function Calendar() {
  const [calendarToken, setCalendarToken] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [calendarConnecting, setCalendarConnecting] = useState(false);

  useEffect(() => {
    // Check for OAuth callback first
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('calendar_connected') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
      checkCalendarConnection();
    } else if (urlParams.get('calendar_error')) {
      const error = urlParams.get('calendar_error');
      setError(`Google Calendar connection failed: ${error}`);
      window.history.replaceState({}, document.title, window.location.pathname);
      checkCalendarConnection();
    } else {
      checkCalendarConnection();
    }
  }, []);

  const checkCalendarConnection = async () => {
    try {
      const token = await getGoogleCalendarToken();
      if (token) {
        setCalendarToken(token);
      } else {
        setCalendarToken(null);
      }
    } catch (error) {
      // 401 is expected when not authenticated - don't log as error
      if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        setCalendarToken(null);
        return;
      }
      console.error('Error checking Google Calendar connection:', error);
      setCalendarToken(null);
    }
  };

  const loadEvents = async () => {
    if (!calendarToken) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const calendarEvents = await getGoogleCalendarEvents();
      setEvents(calendarEvents || []);
    } catch (err) {
      const errorMessage = err?.message || 'Unknown error';
      if (errorMessage.includes('Not authenticated') || errorMessage.includes('Authentication expired')) {
        setCalendarToken(null);
        setError('Please reconnect to Google Calendar');
      } else {
        setError('Failed to load calendar events');
      }
      console.error('Error loading calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load events when token becomes available
  useEffect(() => {
    if (calendarToken) {
      loadEvents();
    }
  }, [calendarToken]);

  const handleConnectCalendar = async () => {
    try {
      setCalendarConnecting(true);
      setError(null);
      const authUrl = await getGoogleCalendarAuthUrl();
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        throw new Error('No auth URL returned from server');
      }
    } catch (error) {
      console.error('Google Calendar connection error:', error);
      setError(`Failed to connect to Google Calendar: ${error.message || 'Unknown error'}`);
      setCalendarConnecting(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      await logoutGoogleCalendar();
      setCalendarToken(null);
      setEvents([]);
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      setError('Failed to disconnect from Google Calendar');
    }
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatEventTime = (startDate, endDate) => {
    if (!startDate) return '';
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    
    const startTime = start.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
    
    if (end) {
      const endTime = end.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
      return `${startTime} - ${endTime}`;
    }
    
    return startTime;
  };

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h2>Google Calendar</h2>
        <div className="calendar-actions">
          {calendarToken ? (
            <>
              <span className="calendar-status">✓ Connected</span>
              <button onClick={handleDisconnectCalendar} className="calendar-disconnect-btn">
                Disconnect
              </button>
              <button onClick={loadEvents} className="calendar-refresh-btn" disabled={loading}>
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </>
          ) : (
            <button 
              onClick={handleConnectCalendar} 
              className="calendar-connect-btn"
              disabled={calendarConnecting}
            >
              {calendarConnecting ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="calendar-error">{error}</div>
      )}

      {!calendarToken ? (
        <div className="calendar-placeholder">
          <p>Connect your Google Calendar to view your upcoming events</p>
        </div>
      ) : loading ? (
        <div className="calendar-loading">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="calendar-empty">
          <p>No upcoming events in the next 30 days</p>
        </div>
      ) : (
        <div className="calendar-events">
          {events.map((event) => (
            <div key={event.id} className="calendar-event">
              <div className="event-time">
                {formatEventTime(event.start?.dateTime || event.start?.date, event.end?.dateTime || event.end?.date)}
              </div>
              <div className="event-details">
                <h3 className="event-title">{event.summary || 'No Title'}</h3>
                {event.description && (
                  <p className="event-description">{event.description}</p>
                )}
                {event.location && (
                  <p className="event-location">📍 {event.location}</p>
                )}
                <div className="event-date">
                  {formatEventDate(event.start?.dateTime || event.start?.date)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Calendar;

