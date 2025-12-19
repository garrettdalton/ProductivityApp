# Vercel Deployment Guide

This guide explains how to deploy the Productivity App to Vercel with Google Calendar OAuth support.

## Prerequisites

1. A Vercel account
2. A PostgreSQL database (can use Vercel Postgres, Neon, Supabase, or any PostgreSQL provider)
3. Google Cloud Console project with OAuth 2.0 credentials

## Step 1: Set Up Environment Variables in Vercel

In your Vercel project settings, add the following environment variables:

### Database Configuration
```
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-database-user
DB_PASSWORD=your-database-password
```

### Server Configuration
```
PORT=8000
NODE_ENV=production
```

### Session Secret
```
SESSION_SECRET=your-very-secure-random-secret-key-here
```
**Important**: Generate a strong random secret for production!

### Google Calendar OAuth
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-vercel-app.vercel.app/api/calendar/callback
```

### Frontend URL
```
FRONTEND_URL=https://your-vercel-app.vercel.app
```

### Allowed Origins (Optional)
If you have multiple domains, specify them comma-separated:
```
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,https://your-custom-domain.com
```

## Step 2: Update Google OAuth Redirect URI

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Add your Vercel callback URL to **Authorized redirect URIs**:
   ```
   https://your-vercel-app.vercel.app/api/calendar/callback
   ```
5. Save the changes

## Step 3: Deploy to Vercel

### Option 1: Using Vercel CLI
```bash
npm i -g vercel
vercel
```

### Option 2: Using GitHub Integration
1. Push your code to GitHub
2. Import your repository in Vercel
3. Configure build settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Add all environment variables from Step 1
5. Deploy

## Step 4: Verify Deployment

1. Visit your Vercel deployment URL
2. Test the Google Calendar connection
3. Check Vercel function logs for any errors

## Important Notes

### Session Storage
- The app uses in-memory session storage, which works for development
- For production with high traffic, consider using:
  - Redis (via Upstash, Redis Cloud, etc.)
  - Database-backed session store
  - Vercel KV (Key-Value store)

### Database Connection
- Ensure your PostgreSQL database allows connections from Vercel's IP addresses
- For Vercel Postgres, this is handled automatically
- For external databases, you may need to whitelist Vercel IPs

### CORS Configuration
- The app automatically configures CORS based on `FRONTEND_URL` and `ALLOWED_ORIGINS`
- Make sure your frontend URL matches your Vercel deployment URL

### HTTPS
- Vercel provides HTTPS automatically
- Session cookies are set to `secure: true` in production
- This ensures cookies are only sent over HTTPS

## Troubleshooting

### OAuth Redirect Issues
- Verify `GOOGLE_REDIRECT_URI` matches exactly what's in Google Cloud Console
- Check that `FRONTEND_URL` is set correctly
- Ensure cookies are being sent (check browser DevTools > Network > Headers)

### Session Not Persisting
- Verify `SESSION_SECRET` is set and consistent
- Check that cookies are being set (browser DevTools > Application > Cookies)
- For serverless functions, sessions may not persist across cold starts
- Consider using a persistent session store (Redis, database)

### Database Connection Errors
- Verify all database environment variables are set correctly
- Check that your database allows connections from Vercel
- Review Vercel function logs for connection errors

## Support

For issues specific to:
- **Vercel**: Check [Vercel Documentation](https://vercel.com/docs)
- **Google OAuth**: Check [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- **PostgreSQL**: Check your database provider's documentation

