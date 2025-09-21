-- =====================================================
-- SUPABASE TABLE SCHEMA FOR ACTIVITY HISTORY
-- =====================================================

-- Create the activity_history table
-- This table will store all upload/download activities for the AWS File Manager

CREATE TABLE IF NOT EXISTS activity_history (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- User identification (from Firebase Auth)
    user_id TEXT NOT NULL,
    user_email TEXT,
    
    -- Activity details
    action TEXT NOT NULL CHECK (action IN ('Upload', 'Download', 'Delete', 'Rename')),
    item_name TEXT NOT NULL,
    
    -- File/folder metadata
    file_size BIGINT DEFAULT 0,
    file_count INTEGER DEFAULT 1,
    folder_path TEXT,
    
    -- Additional metadata (JSON format for extensibility)
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_activity_history_user_id ON activity_history(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_history_created_at ON activity_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_history_action ON activity_history(action);
CREATE INDEX IF NOT EXISTS idx_activity_history_user_created ON activity_history(user_id, created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the updated_at column
CREATE OR REPLACE TRIGGER update_activity_history_updated_at
    BEFORE UPDATE ON activity_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE activity_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own activities
CREATE POLICY "Users can view own activity history" ON activity_history
    FOR SELECT USING (auth.uid()::text = user_id);

-- Users can insert their own activities
CREATE POLICY "Users can insert own activity history" ON activity_history
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own activities (if needed)
CREATE POLICY "Users can update own activity history" ON activity_history
    FOR UPDATE USING (auth.uid()::text = user_id);

-- Users can delete their own activities (for clear history functionality)
CREATE POLICY "Users can delete own activity history" ON activity_history
    FOR DELETE USING (auth.uid()::text = user_id);

-- =====================================================
-- TABLE STRUCTURE EXPLANATION
-- =====================================================

/*
COLUMN DESCRIPTIONS:

id: UUID primary key for unique record identification
user_id: Firebase Auth user ID to associate activities with specific users
user_email: User's email address for easier identification (optional)
action: Type of activity (Upload, Download, Delete, Rename)
item_name: Name of the file or folder being acted upon
file_size: Size of the file in bytes (0 for folders)
file_count: Number of files affected (1 for single file, multiple for folders)
folder_path: Path of the parent folder (for organization)
metadata: JSON field for storing additional information like:
  - file_type: File extension or type
  - storage_class: S3 storage class (STANDARD, GLACIER, etc.)
  - transfer_duration: Time taken for upload/download
  - error_details: Error information if operation failed
  - client_info: Browser/device information
created_at: When the activity occurred
updated_at: When the record was last modified

INDEXES:
- idx_activity_history_user_id: Fast lookup by user
- idx_activity_history_created_at: Fast sorting by date (newest first)
- idx_activity_history_action: Fast filtering by action type
- idx_activity_history_user_created: Composite index for user + date queries

RLS POLICIES:
- Ensures users can only access their own activity history
- Provides secure multi-tenant architecture
*/

-- =====================================================
-- SAMPLE QUERIES
-- =====================================================

-- Get recent activities for a user (ordered by newest first)
-- SELECT * FROM activity_history 
-- WHERE user_id = 'firebase_user_id' 
-- ORDER BY created_at DESC 
-- LIMIT 50;

-- Get activities by action type
-- SELECT * FROM activity_history 
-- WHERE user_id = 'firebase_user_id' AND action = 'Upload' 
-- ORDER BY created_at DESC;

-- Get total file size uploaded by user
-- SELECT SUM(file_size) as total_uploaded 
-- FROM activity_history 
-- WHERE user_id = 'firebase_user_id' AND action = 'Upload';

-- Get activity statistics
-- SELECT 
--     action,
--     COUNT(*) as count,
--     SUM(file_size) as total_size,
--     SUM(file_count) as total_files
-- FROM activity_history 
-- WHERE user_id = 'firebase_user_id'
-- GROUP BY action;