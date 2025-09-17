import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status') // 'sent', 'failed', 'scheduled'
    const hours = parseInt(searchParams.get('hours') || '24') // Last N hours
    
    // Calculate time filter
    const hoursAgo = new Date()
    hoursAgo.setHours(hoursAgo.getHours() - hours)

    let query = supabase
      .from('email_logs')
      .select(`
        id,
        status,
        error,
        schedule_run_id,
        scheduled_for,
        sent_at,
        delivery_reason,
        users!inner (
          id,
          email,
          timezone
        ),
        lessons (
          id,
          day_number,
          subject,
          books (
            id,
            title,
            author
          )
        )
      `)
      .gte('sent_at', hoursAgo.toISOString())
      .order('sent_at', { ascending: false })
      .limit(limit)

    // Apply status filter if provided
    if (status && ['sent', 'failed', 'scheduled'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('Error fetching email logs:', error)
      throw error
    }

    // Transform data for frontend consumption
    const transformedLogs = logs?.map(log => ({
      id: log.id,
      status: log.status,
      error: log.error,
      schedule_run_id: log.schedule_run_id,
      scheduled_for: log.scheduled_for,
      sent_at: log.sent_at,
      delivery_reason: log.delivery_reason,
      user: {
        id: log.users.id,
        email: log.users.email,
        timezone: log.users.timezone
      },
      lesson: log.lessons ? {
        id: log.lessons.id,
        day_number: log.lessons.day_number,
        subject: log.lessons.subject,
        book: log.lessons.books ? {
          id: log.lessons.books.id,
          title: log.lessons.books.title,
          author: log.lessons.books.author
        } : null
      } : null
    })) || []

    return NextResponse.json({
      logs: transformedLogs,
      total: transformedLogs.length,
      filters: {
        hours,
        status,
        limit
      }
    })
    
  } catch (error: any) {
    console.error('Error in recent logs API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recent logs' },
      { status: 500 }
    )
  }
}
