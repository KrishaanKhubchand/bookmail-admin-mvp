export function formatNextSendAt(timezone: string | null | undefined, hour: number = 9): string {
  // Handle null/undefined timezone with fallback
  if (!timezone) {
    return "—";  // Simple fallback, no timezone calculation
  }
  
  // Rest of function stays exactly the same
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(next);
}

export function getNowIso(): string {
  return new Date().toISOString();
}

// Format time for display (convert "09:30:00" to "9:30 AM")
export function formatDeliveryTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

// Format scheduled time for upcoming emails
export function formatScheduledTime(isoString: string, userTimezone: string): string {
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: userTimezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)
}

// Get relative time from now
export function getRelativeTime(isoString: string): string {
  const now = new Date()
  const time = new Date(isoString)
  const diffMs = time.getTime() - now.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  
  if (diffHours < 1) return 'Within 1 hour'
  if (diffHours < 24) return `In ${diffHours} hours`
  if (diffHours < 48) return 'Tomorrow'
  return `In ${Math.floor(diffHours / 24)} days`
}

// Convert hour/minute to "HH:MM" format for database
export function parseTimeToString(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

// Generate all 24 hours for dropdowns
export const ALL_HOURS = Array.from({length: 24}, (_, i) => ({
  value: i,
  label: new Date(0, 0, 0, i).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    hour12: true 
  }).replace(':00 ', ' ')
}))

// Generate all 60 minutes (0-59) for full minute precision
export const MINUTE_OPTIONS = Array.from({length: 60}, (_, i) => ({
  value: i,
  label: i.toString().padStart(2, '0')
}))

// Quick select options (subset of common times)
export const QUICK_SELECT_TIMES = [
  { value: '06:00', label: '6 AM' },
  { value: '09:00', label: '9 AM' },
  { value: '12:00', label: '12 PM' },
  { value: '18:00', label: '6 PM' },
  { value: '20:00', label: '8 PM' },
]

// Legacy: Common delivery time options (kept for backward compatibility)
export const COMMON_DELIVERY_TIMES = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
]

