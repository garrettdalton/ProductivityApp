-- Migration script to add position field to existing tasks table
-- Run this if you already have a tasks table without the position field

-- Add position column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'position'
    ) THEN
        ALTER TABLE tasks ADD COLUMN position INTEGER;
        
        -- Set initial positions based on created_at (oldest first = position 0)
        UPDATE tasks 
        SET position = sub.row_num - 1
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
            FROM tasks
        ) sub
        WHERE tasks.id = sub.id;
        
        -- Make position NOT NULL with default
        ALTER TABLE tasks ALTER COLUMN position SET NOT NULL;
        ALTER TABLE tasks ALTER COLUMN position SET DEFAULT 0;
        
        -- Create index on position
        CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(position);
    END IF;
END $$;

