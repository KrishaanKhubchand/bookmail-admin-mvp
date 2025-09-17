import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24') // Next N hours
    
    // Calculate time range  
    const now = new Date()
    const endTime = new Date(now.getTime() + (hours * 60 * 60 * 1000))

    // Get all users with their delivery times
    const { data: usersWithTimes, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        timezone,
        user_delivery_times (
          delivery_time
        )
      `)

    if (usersError) throw usersError

    const upcomingEmails = []

    for (const user of usersWithTimes || []) {
      const deliveryTimes = user.user_delivery_times || []
      
      // If no delivery times set, use default 9:00 AM
      const times = deliveryTimes.length > 0 
        ? deliveryTimes.map(dt => dt.delivery_time)
        : ['09:00:00']

      for (const timeStr of times) {
        const nextDelivery = getNextDeliveryTime(user.timezone, timeStr, now, endTime)
        
        if (nextDelivery) {
          // Check what lesson this user would get
          const { data: lessonData, error: lessonError } = await supabase
            .rpc('get_next_lesson_for_user', { p_user_id: user.id })

          if (lessonError) {
            console.error(`Error getting lesson for user ${user.email}:`, lessonError)
            continue
          }

          const lesson = lessonData?.[0]
          
          if (lesson && lesson.should_send) {
            // Get book details from the lesson
            const { data: bookData, error: bookError } = await supabase
              .from('books')
              .select('author')
              .eq('id', lesson.book_id)
              .single()

            upcomingEmails.push({
              id: `upcoming-${user.id}-${nextDelivery.getTime()}`,
              status: 'scheduled',
              error: null,
              schedule_run_id: null,
              scheduled_for: nextDelivery.toISOString(),
              sent_at: nextDelivery.toISOString(), // For consistency with existing interface
              delivery_reason: 'scheduled',
              user: {
                id: user.id,
                email: user.email,
                timezone: user.timezone
              },
              lesson: {
                id: lesson.lesson_id,
                day_number: lesson.lesson_day_number,
                subject: lesson.lesson_subject,
                book: {
                  id: lesson.book_id,
                  title: lesson.book_title,
                  author: bookData?.author || 'Unknown'
                }
              }
            })
          }
        }
      }
    }

    // Sort by scheduled time
    upcomingEmails.sort((a, b) => 
      new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
    )

    return NextResponse.json({
      logs: upcomingEmails,
      total: upcomingEmails.length,
      mode: 'upcoming',
      filters: {
        hours,
        from: now.toISOString(),
        to: endTime.toISOString()
      }
    })
    
  } catch (error: any) {
    console.error('Error in upcoming logs API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch upcoming emails' },
      { status: 500 }
    )
  }
}

function getNextDeliveryTime(
  timezone: string, 
  timeStr: string, 
  fromTime: Date, 
  toTime: Date
): Date | null {
  const [hours, minutes] = timeStr.split(':').map(Number)
  
  // Try today first
  const today = new Date()
  today.setHours(hours, minutes, 0, 0)
  
  // Convert to UTC considering user's timezone
  const todayUTC = convertToUserTimezone(today, timezone)
  
  if (todayUTC > fromTime && todayUTC <= toTime) {
    return todayUTC
  }
  
  // Try tomorrow
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowUTC = convertToUserTimezone(tomorrow, timezone)
  
  if (tomorrowUTC <= toTime) {
    return tomorrowUTC
  }
  
  // Try day after tomorrow if within window
  const dayAfter = new Date(today)
  dayAfter.setDate(today.getDate() + 2)
  const dayAfterUTC = convertToUserTimezone(dayAfter, timezone)
  
  if (dayAfterUTC <= toTime) {
    return dayAfterUTC
  }
  
  return null
}

function convertToUserTimezone(date: Date, timezone: string): Date {
  // This is a simplified approach - in production you'd want a more robust timezone conversion
  try {
    // Convert the local time to UTC considering the user's timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    
    const parts = formatter.formatToParts(date)
    const utcDate = new Date(`${parts[0].value}-${parts[2].value}-${parts[4].value}T${parts[6].value}:${parts[8].value}:${parts[10].value}Z`)
    
    return utcDate
  } catch (error) {
    console.error('Error converting timezone:', error)
    return date
  }
}
