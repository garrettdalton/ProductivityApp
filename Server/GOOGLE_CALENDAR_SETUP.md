# Google Calendar API Setup Instructions

To enable Google Calendar integration, you need to configure OAuth credentials:

## Step 1: Create a Google Cloud Project and Enable Calendar API

1. Go to https://console.cloud.google.com/
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" (unless you have a Google Workspace account)
   - Fill in the required information (App name, User support email, Developer contact)
   - Add scopes: `https://www.googleapis.com/auth/calendar.readonly`
   - Add test users (your email) if in testing mode
   - Save and continue through the steps
4. Create OAuth client ID:
   - Application type: "Web application"
   - Name: "Productivity App" (or any name)
   - Authorized redirect URIs: `http://127.0.0.1:8000/api/calendar/callback`
   - Click "Create"
5. Copy your **Client ID** and **Client Secret**

## Step 3: Configure Environment Variables

1. In the `Server` directory, update your `.env` file (or create one if it doesn't exist)
2. Add the following:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/api/calendar/callback
```

**Important Notes:**
- Use `127.0.0.1` (not `localhost`) for the redirect URI
- The redirect URI must match exactly what you configured in Google Cloud Console
- Make sure your `.env` file is in `.gitignore` (it should be)

## Step 4: Restart the Server

After adding the credentials, restart the server for changes to take effect.

## Step 5: Test the Integration

1. Start the server
2. Open the app in your browser
3. Click "Connect Google Calendar" button
4. Authorize the app with your Google account
5. You should see your calendar events displayed

## Troubleshooting

- **"Invalid redirect URI"**: Make sure the redirect URI in your `.env` matches exactly what's in Google Cloud Console
- **"Access blocked"**: If you're in testing mode, make sure your email is added as a test user in the OAuth consent screen
- **"Credentials not configured"**: Check that your `.env` file has the correct variable names and values

## Security Notes

- Never commit your `.env` file to version control
- In production, use HTTPS and update the redirect URI accordingly
- Consider using environment variables from your hosting platform instead of a `.env` file

