/**
 * Timezone conversion utilities for the debug panel
 */

/**
 * Convert a time string in a specific timezone to UTC timestamp
 * @param timeString - "HH:MM" format (e.g., "09:00")
 * @param timezone - IANA timezone (e.g., "America/New_York")
 * @returns ISO timestamp string in UTC
 */
export function convertTimeInTimezoneToUTC(
  timeString: string, 
  timezone: string
): string {
  const [hours, minutes] = timeString.split(':').map(Number)
  
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error('Invalid time format. Use HH:MM with valid hours (0-23) and minutes (0-59)')
  }
  
  try {
    // Get today's date components
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    const day = today.getDate()
    
    // Create a date string that represents the target time
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
    
    // Use a more direct approach: create the time as if it's in the target timezone
    // then find what UTC time produces that local time
    
    // We'll use the reverse approach: try different UTC times until we find
    // one that produces the desired local time in the target timezone
    
    // Start with a rough estimate (assuming the target time is already UTC)
    let testUTC = new Date(`${dateStr}T${timeStr}Z`)
    
    // Check what this UTC time produces in the target timezone
    let localTimeStr = testUTC.toLocaleString('sv-SE', { 
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    // Extract just the time part from the local time string (HH:mm)
    let localTime = localTimeStr.split(' ')[1] || localTimeStr.split('T')[1]
    if (localTime) {
      localTime = localTime.substring(0, 5) // Get HH:mm part
    }
    
    // If it doesn't match, adjust by the difference
    if (localTime !== timeString) {
      // Calculate how many hours we're off
      const [localHours, localMinutes] = localTime.split(':').map(Number)
      const localTotalMinutes = localHours * 60 + localMinutes
      const targetTotalMinutes = hours * 60 + minutes
      
      let diffMinutes = targetTotalMinutes - localTotalMinutes
      
      // Handle day boundary crossing
      if (diffMinutes > 12 * 60) {
        diffMinutes -= 24 * 60
      } else if (diffMinutes < -12 * 60) {
        diffMinutes += 24 * 60
      }
      
      // Adjust the UTC time
      testUTC = new Date(testUTC.getTime() + (diffMinutes * 60 * 1000))
    }
    
    return testUTC.toISOString()
    
  } catch (error) {
    throw new Error(`Failed to convert ${timeString} in ${timezone} to UTC: ${error.message}`)
  }
}

/**
 * Convert a time in a specific timezone to UTC
 * Uses a more reliable approach with explicit timezone handling
 */
function convertLocalTimeToUTC(localTime: Date, timezone: string): Date {
  try {
    const year = localTime.getFullYear()
    const month = localTime.getMonth()
    const day = localTime.getDate()
    const hours = localTime.getHours()
    const minutes = localTime.getMinutes()
    
    // Create a date string in ISO format without timezone
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
    
    // Parse this as if it's in the target timezone by using the timezone offset
    const testDate = new Date(dateString)
    
    // Get the offset for this timezone on this date (handles DST automatically)
    const offsetMinutes = getTimezoneOffsetMinutes(testDate, timezone)
    
    // Adjust the time by the offset to get UTC
    return new Date(testDate.getTime() - (offsetMinutes * 60 * 1000))
  } catch (error) {
    throw new Error(`Invalid timezone: ${timezone}. Please use a valid IANA timezone identifier.`)
  }
}

/**
 * Get the timezone offset in minutes for a specific date and timezone
 */
function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  try {
    // Create two dates: one in UTC, one in the target timezone
    const utcDate = new Date(date.toLocaleString('sv-SE', { timeZone: 'UTC' }))
    const localDate = new Date(date.toLocaleString('sv-SE', { timeZone: timezone }))
    
    // Calculate the difference in minutes
    return (localDate.getTime() - utcDate.getTime()) / (1000 * 60)
  } catch (error) {
    return 0 // Default to no offset if timezone is invalid
  }
}

/**
 * Alternative approach using Intl.DateTimeFormat for better accuracy
 */
export function convertTimeInTimezoneToUTCAlternative(
  timeString: string,
  timezone: string
): string {
  const [hours, minutes] = timeString.split(':').map(Number)
  
  // Get today's date
  const today = new Date()
  
  // Create a date string in the target timezone
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  
  // Create the date in the target timezone
  const dateTimeString = `${year}-${month}-${day}T${time}`
  
  try {
    // Parse the date as if it's in the target timezone
    // This is a bit tricky with native Date - we'll use a workaround
    const tempDate = new Date(dateTimeString)
    
    // Get the timezone offset for the target timezone
    const offsetMinutes = getTimezoneOffset(timezone, tempDate)
    
    // Adjust for the timezone offset
    const utcTime = new Date(tempDate.getTime() - (offsetMinutes * 60 * 1000))
    
    return utcTime.toISOString()
  } catch (error) {
    throw new Error(`Failed to convert time ${timeString} in timezone ${timezone}: ${error.message}`)
  }
}

/**
 * Get timezone offset in minutes for a specific timezone and date
 */
function getTimezoneOffset(timezone: string, date: Date): number {
  try {
    // Use Intl.DateTimeFormat to get timezone info
    const utcDate = new Date(date.toLocaleString('en-CA', { timeZone: 'UTC' }))
    const tzDate = new Date(date.toLocaleString('en-CA', { timeZone: timezone }))
    
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60)
  } catch (error) {
    return 0 // Default to UTC if timezone is invalid
  }
}

/**
 * Format UTC time for display
 */
export function formatUTCTime(utcTimestamp: string): string {
  try {
    const date = new Date(utcTimestamp)
    return date.toISOString().substring(11, 16) + ' UTC'
  } catch {
    return 'Invalid time'
  }
}

/**
 * Get a preview of what UTC time a local time converts to
 */
export function getUTCPreview(timeString: string, timezone: string): string {
  try {
    const utcTimestamp = convertTimeInTimezoneToUTC(timeString, timezone)
    return formatUTCTime(utcTimestamp)
  } catch (error) {
    return `Error: ${error.message}`
  }
}

// Export common timezones for the dropdown
export const DEBUG_TIMEZONES = [
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
  { value: 'UTC', label: 'UTC' }
]

/**
 * Validate if a timezone is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch {
    return false
  }
}
