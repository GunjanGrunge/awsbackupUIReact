# Supabase Setup Instructions

## IMPORTANT: You MUST complete this step before the integration will work!

### Step 1: Create the Database Table

1. **Open Supabase Dashboard**
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Login and select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Execute the SQL Script**
   - Copy the entire content from `activity_history_table.sql`
   - Paste it into the SQL editor
   - Click "RUN" to execute the script

4. **Verify Table Creation**
   - Go to "Table Editor" in the left sidebar
   - You should see a new table called `activity_history`
   - The table should have columns: id, user_id, user_email, action, item_name, etc.

### Step 2: Verify Row Level Security (RLS)

1. **Check RLS Policies**
   - In Table Editor, click on your `activity_history` table
   - Click the "Authentication" tab
   - You should see policies for INSERT, SELECT, DELETE operations
   - All policies should be enabled

2. **Test RLS (Optional)**
   - The policies ensure users can only see their own activity history
   - Each policy uses `user_id = auth.uid()` for security

### Step 3: Test the Integration

1. **Try logging in to your app**
2. **Upload a test file** - This should create an activity log entry
3. **Check the History page** - You should see the activity
4. **Verify in Supabase** - Go to Table Editor → activity_history to see the actual data

### Troubleshooting

**If you see "User not authenticated" errors:**
- Make sure you're logged in with Firebase
- Check that your Firebase user has a valid `uid`

**If you see "permission denied" errors:**
- Verify that RLS policies were created correctly
- Check that `auth.uid()` function is working in Supabase

**If no data appears in history:**
- Check the browser console for error messages
- Verify the Supabase URL and anon key in your `.env` file
- Make sure the table was created with the exact column names

### Migration Process (After Table Creation)

1. **Use the Migration Utility Component:**
   ```jsx
   import MigrationUtility from './components/MigrationUtility';
   // Add <MigrationUtility /> to any page temporarily
   ```

2. **Or use the programmatic script in browser console:**
   ```javascript
   import { quickMigration } from './utils/migrationScript.js';
   const result = await quickMigration();
   console.log('Migration result:', result);
   ```

### Environment Variables Required

Make sure your `.env` file contains:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## What This Integration Provides

✅ **Secure Activity Logging** - Each user sees only their own history
✅ **Real-time Updates** - Activity history updates immediately  
✅ **Better Performance** - Database queries instead of S3 JSON parsing
✅ **Rich Querying** - Filter by date, action type, file size, etc.
✅ **Statistics** - Built-in analytics for activity patterns
✅ **Scalability** - Handles thousands of activity records efficiently
✅ **Data Integrity** - ACID compliance, foreign keys, constraints
✅ **Backup & Recovery** - Supabase handles database backups
✅ **Multi-user Support** - Proper isolation between users

Remember: The original S3-based history will continue to work as a fallback, but new activities will be logged to Supabase once this setup is complete.