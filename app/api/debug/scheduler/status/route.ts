import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get users with delivery times
    const { data: deliveryTimes, error: deliveryError } = await supabase
      .from('user_delivery_times')
      .select('user_id')
    
    if (deliveryError) throw deliveryError

    const usersWithDeliveryTimes = new Set(deliveryTimes?.map(dt => dt.user_id) || []).size

    // Get users with assigned books
    const { data: userBooks, error: userBooksError } = await supabase
      .from('user_books')
      .select('user_id')
    
    if (userBooksError) throw userBooksError

    const usersWithBooks = new Set(userBooks?.map(ub => ub.user_id) || []).size

    // Get total lessons count
    const { count: totalLessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true })
    
    if (lessonsError) throw lessonsError

    // Get recent email logs count (last 24 hours)
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    const { count: recentRuns, error: logsError } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo.toISOString())
    
    if (logsError) throw logsError

    // Calculate next run hour (next hour from current time)
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setHours(now.getHours() + 1, 0, 0, 0)
    
    const status = {
      users_with_delivery_times: usersWithDeliveryTimes,
      users_with_books: usersWithBooks,
      total_lessons: totalLessons || 0,
      recent_runs: recentRuns || 0,
      cron_active: true, // Assume active (would need pg_cron check for real status)
      next_run_hour: nextHour.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }

    return NextResponse.json(status)
    
  } catch (error) {
    console.error('Error getting scheduler status:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
