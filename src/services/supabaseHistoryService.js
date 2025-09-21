import { supabase, handleSupabaseError } from './supabaseClient.js'
import { auth } from '../firebase.js'

/**
 * Supabase Activity History Service
 * Provides functions to log, retrieve, and manage activity history in Supabase
 * Replaces the S3-based history logging system
 */

// Helper function to get current Firebase user
const getCurrentFirebaseUser = () => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('User not authenticated')
  }
  return {
    id: user.uid,
    email: user.email || '',
    displayName: user.displayName || ''
  }
}

/**
 * Log a new activity to Supabase
 * @param {Object} activity - Activity details
 * @param {string} activity.action - Action type (Upload, Download, Delete, Rename)
 * @param {string} activity.itemName - Name of the file/folder
 * @param {number} [activity.size] - File size in bytes
 * @param {number} [activity.fileCount] - Number of files affected
 * @param {string} [activity.folderPath] - Parent folder path
 * @param {Object} [activity.metadata] - Additional metadata
 * @returns {Promise<Object>} Logged activity record
 */
export const logActivity = async (activity) => {
  try {
    const firebaseUser = getCurrentFirebaseUser()
    
    const activityData = {
      user_id: firebaseUser.id,
      user_email: firebaseUser.email,
      action: activity.action,
      item_name: activity.itemName,
      file_size: activity.size || 0,
      file_count: activity.fileCount || 1,
      folder_path: activity.folderPath || null,
      metadata: {
        user_display_name: firebaseUser.displayName,
        timestamp: new Date().toISOString(),
        ...activity.metadata
      }
    }

    const { data, error } = await supabase
      .from('activity_history')
      .insert(activityData)
      .select()
      .single()

    if (error) {
      console.error('Error logging activity:', error)
      throw new Error(handleSupabaseError(error))
    }

    console.log('Activity logged successfully:', data)
    return data
  } catch (error) {
    console.error('Failed to log activity:', error)
    // Don't throw error to avoid breaking the main upload/download flow
    // Just log the error and continue
    return null
  }
}

/**
 * Get activity history for the current user
 * @param {Object} [options] - Query options
 * @param {number} [options.limit] - Maximum number of records to return
 * @param {number} [options.offset] - Number of records to skip
 * @param {string} [options.action] - Filter by action type
 * @param {Date} [options.startDate] - Filter by start date
 * @param {Date} [options.endDate] - Filter by end date
 * @returns {Promise<Array>} Array of activity records
 */
export const getActivityHistory = async (options = {}) => {
  try {
    const firebaseUser = getCurrentFirebaseUser()
    
    let query = supabase
      .from('activity_history')
      .select('*')
      .or(`user_id.eq.${firebaseUser.id},user_id.eq.migrated_user`)
      .order('created_at', { ascending: false })

    // Apply filters
    if (options.action) {
      query = query.eq('action', options.action)
    }
    
    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString())
    }
    
    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString())
    }
    
    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching activity history:', error)
      throw new Error(handleSupabaseError(error))
    }

    // Return data as-is from Supabase (no transformation needed)
    return data || []
  } catch (error) {
    console.error('Failed to fetch activity history:', error)
    throw error
  }
}

/**
 * Clear all activity history for the current user
 * @returns {Promise<boolean>} Success status
 */
export const clearActivityHistory = async () => {
  try {
    const firebaseUser = getCurrentFirebaseUser()
    
    const { error } = await supabase
      .from('activity_history')
      .delete()
      .eq('user_id', firebaseUser.id)

    if (error) {
      console.error('Error clearing activity history:', error)
      throw new Error(handleSupabaseError(error))
    }

    console.log('Activity history cleared successfully')
    return true
  } catch (error) {
    console.error('Failed to clear activity history:', error)
    throw error
  }
}

/**
 * Get activity statistics for the current user
 * @param {Object} [options] - Query options
 * @param {Date} [options.startDate] - Start date for statistics
 * @param {Date} [options.endDate] - End date for statistics
 * @returns {Promise<Object>} Activity statistics
 */
export const getActivityStatistics = async (options = {}) => {
  try {
    const firebaseUser = getCurrentFirebaseUser()
    
    let query = supabase
      .from('activity_history')
      .select('action, file_size, file_count')
      .eq('user_id', firebaseUser.id)
    
    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString())
    }
    
    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching activity statistics:', error)
      throw new Error(handleSupabaseError(error))
    }

    // Calculate statistics
    const stats = {
      totalActivities: data.length,
      uploads: { count: 0, totalSize: 0, totalFiles: 0 },
      downloads: { count: 0, totalSize: 0, totalFiles: 0 },
      deletes: { count: 0, totalFiles: 0 },
      renames: { count: 0 }
    }

    data.forEach(record => {
      const action = record.action.toLowerCase()
      if (stats[action + 's']) {
        stats[action + 's'].count++
        if (record.file_size) {
          stats[action + 's'].totalSize += record.file_size
        }
        if (record.file_count) {
          stats[action + 's'].totalFiles += record.file_count
        }
      }
    })

    return stats
  } catch (error) {
    console.error('Failed to fetch activity statistics:', error)
    throw error
  }
}

/**
 * Migrate existing S3-based history to Supabase
 * This function reads the existing history-log.json from S3 and migrates it to Supabase
 * @param {Array} existingHistory - Array of existing history records from S3
 * @returns {Promise<Object>} Migration results
 */
export const migrateS3HistoryToSupabase = async (existingHistory) => {
  try {
    const firebaseUser = getCurrentFirebaseUser()
    
    if (!Array.isArray(existingHistory) || existingHistory.length === 0) {
      return { migrated: 0, errors: 0, message: 'No history to migrate' }
    }

    let migrated = 0
    let errors = 0
    const batchSize = 100 // Process in batches to avoid timeouts

    for (let i = 0; i < existingHistory.length; i += batchSize) {
      const batch = existingHistory.slice(i, i + batchSize)
      
      const migratedBatch = batch.map(record => ({
        user_id: firebaseUser.id,
        user_email: firebaseUser.email,
        action: record.action || 'Upload',
        item_name: record.itemName || 'Unknown',
        file_size: record.size || 0,
        file_count: record.fileCount || 1,
        created_at: record.date || new Date().toISOString(),
        metadata: {
          migrated_from_s3: true,
          original_record: record,
          user_display_name: firebaseUser.displayName
        }
      }))

      const { error } = await supabase
        .from('activity_history')
        .insert(migratedBatch)

      if (error) {
        console.error('Error migrating batch:', error)
        errors += batch.length
      } else {
        migrated += batch.length
        console.log(`Migrated batch ${i / batchSize + 1}, records: ${batch.length}`)
      }
    }

    return {
      migrated,
      errors,
      message: `Migration completed: ${migrated} records migrated, ${errors} errors`
    }
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

// For backward compatibility with existing code
export const getHistoryLog = getActivityHistory
export const clearHistoryLog = clearActivityHistory

export default {
  logActivity,
  getActivityHistory,
  clearActivityHistory,
  getActivityStatistics,
  migrateS3HistoryToSupabase,
  // Backward compatibility exports
  getHistoryLog,
  clearHistoryLog
}