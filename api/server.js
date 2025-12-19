// This file is a wrapper for Vercel serverless functions
// Vercel can handle Express apps directly, but we wrap with serverless-http for compatibility
import serverless from 'serverless-http';
import app from '../Server/server.js';

// Wrap the Express app for Vercel serverless functions
// This converts Express req/res to the format expected by serverless platforms
const handler = serverless(app);

// Export the handler for Vercel
// Vercel will call this handler for all /api/* routes
export default handler;

