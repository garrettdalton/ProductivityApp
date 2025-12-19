-- Add Spotify playlist ID column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS spotify_playlist_id VARCHAR(255);

