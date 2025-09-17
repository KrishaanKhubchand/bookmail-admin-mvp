import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get recent email logs grouped by schedule_run_id
    const { data: logs, error } = await supabase
      .from('email_logs')
      .select(`
        schedule_run_id,
        scheduled_for,
        status,
        created_at
      `)
      .not('schedule_run_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) throw error

    // Group logs by run_id and create summary
    const runSummaries = new Map()
    
    logs?.forEach(log => {
      const runId = log.schedule_run_id
      if (!runSummaries.has(runId)) {
        runSummaries.set(runId, {
          run_id: runId,
          timestamp: log.scheduled_for || log.created_at,
          eligible: 0,
          sent: 0,
          total_logs: 0
        })
      }
      
      const summary = runSummaries.get(runId)
      summary.total_logs++
      
      if (log.status === 'scheduled' || log.status === 'sent') {
        summary.eligible++
        if (log.status === 'sent') {
          summary.sent++
        }
      }
    })

    // Convert to array and sort by timestamp
    const runs = Array.from(runSummaries.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10) // Limit to last 10 runs

    return NextResponse.json({
      runs: runs
    })
    
  } catch (error) {
    console.error('Error getting scheduler logs:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
