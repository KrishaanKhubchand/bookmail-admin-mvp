import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24') // Last N hours
    
    // Calculate time filter
    const hoursAgo = new Date()
    hoursAgo.setHours(hoursAgo.getHours() - hours)

    // Get overall stats for the time period
    const { data: allLogs, error: logsError } = await supabase
      .from('email_logs')
      .select('status, schedule_run_id, sent_at')
      .gte('sent_at', hoursAgo.toISOString())

    if (logsError) throw logsError

    // Calculate status counts
    const statusCounts = {
      sent: 0,
      failed: 0,
      scheduled: 0,
      total: 0
    }

    const scheduleRuns = new Set()
    
    allLogs?.forEach(log => {
      statusCounts[log.status as keyof typeof statusCounts]++
      statusCounts.total++
      if (log.schedule_run_id) {
        scheduleRuns.add(log.schedule_run_id)
      }
    })

    // Calculate success rate
    const successRate = statusCounts.total > 0 
      ? ((statusCounts.sent / statusCounts.total) * 100).toFixed(1)
      : '0.0'

    // Get recent scheduler runs summary
    const { data: recentRuns, error: runsError } = await supabase
      .from('email_logs')
      .select(`
        schedule_run_id,
        scheduled_for,
        status,
        sent_at
      `)
      .not('schedule_run_id', 'is', null)
      .gte('sent_at', hoursAgo.toISOString())
      .order('sent_at', { ascending: false })

    if (runsError) throw runsError

    // Group by schedule run and create summaries
    const runSummaries = new Map()
    
    recentRuns?.forEach(log => {
      const runId = log.schedule_run_id
      if (!runSummaries.has(runId)) {
        runSummaries.set(runId, {
          run_id: runId,
          timestamp: log.scheduled_for || log.sent_at,
          sent: 0,
          failed: 0,
          scheduled: 0,
          total: 0
        })
      }
      
      const summary = runSummaries.get(runId)
      summary[log.status as keyof typeof summary]++
      summary.total++
    })

    const runSummaryArray = Array.from(runSummaries.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10) // Last 10 runs

    // Get most active users (who received emails)
    const { data: userActivity, error: usersError } = await supabase
      .from('email_logs')
      .select(`
        user_id,
        status,
        users!inner (email)
      `)
      .gte('sent_at', hoursAgo.toISOString())
      .eq('status', 'sent')

    if (usersError) throw usersError

    const userStats = new Map()
    userActivity?.forEach(log => {
      const email = log.users.email
      if (!userStats.has(email)) {
        userStats.set(email, 0)
      }
      userStats.set(email, userStats.get(email) + 1)
    })

    const topUsers = Array.from(userStats.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([email, count]) => ({ email, count }))

    // Get book performance stats
    const { data: bookActivity, error: booksError } = await supabase
      .from('email_logs')
      .select(`
        status,
        lessons!inner (
          books!inner (
            id,
            title
          )
        )
      `)
      .gte('sent_at', hoursAgo.toISOString())
      .eq('status', 'sent')

    if (booksError) throw booksError

    const bookStats = new Map()
    bookActivity?.forEach(log => {
      const bookTitle = log.lessons.books.title
      if (!bookStats.has(bookTitle)) {
        bookStats.set(bookTitle, 0)
      }
      bookStats.set(bookTitle, bookStats.get(bookTitle) + 1)
    })

    const topBooks = Array.from(bookStats.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([title, count]) => ({ title, count }))

    const stats = {
      time_period: {
        hours,
        from: hoursAgo.toISOString(),
        to: new Date().toISOString()
      },
      overall: {
        ...statusCounts,
        success_rate: parseFloat(successRate),
        total_runs: scheduleRuns.size
      },
      recent_runs: runSummaryArray,
      top_users: topUsers,
      top_books: topBooks
    }

    return NextResponse.json(stats)
    
  } catch (error: any) {
    console.error('Error in logs stats API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch logs statistics' },
      { status: 500 }
    )
  }
}
