import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const hours = parseInt(searchParams.get('hours') || '24')
    const triggerSource = searchParams.get('trigger_source') // Optional filter
    
    // Calculate time filter
    const hoursAgo = new Date()
    hoursAgo.setHours(hoursAgo.getHours() - hours)

    let query = supabase
      .from('scheduler_runs')
      .select('*')
      .gte('timestamp', hoursAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(limit)

    // Apply trigger source filter if provided
    if (triggerSource && ['github_actions', 'vercel_cron', 'manual', 'test'].includes(triggerSource)) {
      query = query.eq('trigger_source', triggerSource)
    }

    const { data: runs, error } = await query

    if (error) {
      console.error('Error fetching scheduler runs:', error)
      throw error
    }

    // Calculate aggregate statistics
    const allRuns = runs || []
    const completedRuns = allRuns.filter(r => r.status === 'completed')
    const failedRuns = allRuns.filter(r => r.status === 'failed')
    const runningRuns = allRuns.filter(r => r.status === 'running')

    const stats = {
      total_runs: allRuns.length,
      successful_runs: completedRuns.length,
      failed_runs: failedRuns.length,
      running_runs: runningRuns.length,
      total_emails_sent: allRuns.reduce((sum, r) => sum + (r.emails_sent || 0), 0),
      total_emails_failed: allRuns.reduce((sum, r) => sum + (r.emails_failed || 0), 0),
      total_eligible_users: allRuns.reduce((sum, r) => sum + (r.eligible_users || 0), 0),
      total_completed_users: allRuns.reduce((sum, r) => sum + (r.emails_completed || 0), 0),
      total_no_content_users: allRuns.reduce((sum, r) => sum + (r.emails_no_content || 0), 0),
      avg_execution_time: completedRuns.length > 0 ? 
        completedRuns.reduce((sum, r) => sum + (r.execution_time_ms || 0), 0) / completedRuns.length : 0,
      success_rate: allRuns.length > 0 ? 
        (completedRuns.length / allRuns.length * 100).toFixed(1) : '0.0'
    }

    // Group runs by trigger source for breakdown
    const sourceBreakdown = allRuns.reduce((acc, run) => {
      const source = run.trigger_source
      if (!acc[source]) {
        acc[source] = {
          count: 0,
          emails_sent: 0,
          emails_failed: 0,
          success_rate: 0
        }
      }
      acc[source].count++
      acc[source].emails_sent += run.emails_sent || 0
      acc[source].emails_failed += run.emails_failed || 0
      return acc
    }, {} as Record<string, any>)

    // Calculate success rates for each source
    Object.keys(sourceBreakdown).forEach(source => {
      const sourceData = sourceBreakdown[source]
      const sourceRuns = allRuns.filter(r => r.trigger_source === source && r.status === 'completed')
      sourceData.success_rate = sourceRuns.length > 0 ? 
        (sourceRuns.length / sourceData.count * 100).toFixed(1) : '0.0'
    })

    return NextResponse.json({
      runs: allRuns,
      stats,
      source_breakdown: sourceBreakdown,
      filters: {
        hours,
        trigger_source: triggerSource,
        limit
      },
      metadata: {
        time_period: {
          from: hoursAgo.toISOString(),
          to: new Date().toISOString(),
          hours
        }
      }
    })
    
  } catch (error: any) {
    console.error('Error in scheduler runs API:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch scheduler runs',
        success: false 
      },
      { status: 500 }
    )
  }
}
