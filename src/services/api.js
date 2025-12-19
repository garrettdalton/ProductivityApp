// Use environment variable for API URL, or default based on environment
// In production (Vercel), use relative path /api
// In development, use localhost
const getApiBaseUrl = () => {
  // Check for explicit environment variable first
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // In production (Vercel), use relative path
  // Check if we're on a production domain (not localhost)
  if (typeof window !== 'undefined') {
    const isProduction = window.location.hostname !== 'localhost' && 
                         window.location.hostname !== '127.0.0.1';
    return isProduction ? '/api' : 'http://127.0.0.1:8000/api';
  }
  
  // Fallback for SSR or initial load
  return import.meta.env.PROD ? '/api' : 'http://127.0.0.1:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Fetch all tasks
export const getTasks = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to fetch tasks');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
};

// Fetch a single task by ID
export const getTask = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch task');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching task:', error);
    throw error;
  }
};

// Create a new task
export const createTask = async (taskData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });
    if (!response.ok) {
      throw new Error('Failed to create task');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
};

// Update a task
export const updateTask = async (id, taskData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });
    if (!response.ok) {
      throw new Error('Failed to update task');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

// Delete a task
export const deleteTask = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete task');
    }
    return true;
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

// Reorder a task (move up or down)
export const reorderTask = async (id, direction) => {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ direction }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to reorder task: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error reordering task:', error);
    throw error;
  }
};

// Reorder tasks by updating positions (for drag and drop)
export const reorderTasks = async (taskOrders) => {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskOrders }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to reorder tasks: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error reordering tasks:', error);
    throw error;
  }
};

// Google Calendar OAuth functions
export const getGoogleCalendarAuthUrl = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/calendar/auth`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to get auth URL: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!data.authUrl) {
      throw new Error('No auth URL in response');
    }
    
    return data.authUrl;
  } catch (error) {
    console.error('Error getting Google Calendar auth URL:', error);
    throw error;
  }
};

export const getGoogleCalendarToken = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/calendar/token`, {
      credentials: 'include'
    });
    if (!response.ok) {
      // 401 is expected when not authenticated - return null silently
      if (response.status === 401) {
        return null;
      }
      throw new Error(`Failed to get token: ${response.status}`);
    }
    const data = await response.json();
    return data.accessToken;
  } catch (error) {
    // Only log non-401 errors
    if (!error?.message?.includes('401')) {
      console.error('Error getting Google Calendar token:', error);
    }
    return null;
  }
};

export const getGoogleCalendarEvents = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/calendar/events`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }
    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
};

export const logoutGoogleCalendar = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/calendar/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    return response.ok;
  } catch (error) {
    console.error('Error logging out from Google Calendar:', error);
    return false;
  }
};

