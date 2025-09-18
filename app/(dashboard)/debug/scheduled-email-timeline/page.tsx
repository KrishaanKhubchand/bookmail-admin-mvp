"use client"

import { useState, useEffect } from 'react'

interface SchedulerRun {
  id: string
  run_id: string
  timestamp: string
  trigger_source: string
  eligible_users: number
  emails_sent: number
  emails_failed: number
  emails_completed: number
  emails_no_content: number
  status: string
  error?: string
  execution_time_ms?: number
}

interface SchedulerStats {
  total_runs: number
  successful_runs: number
  failed_runs: number
  running_runs: number
  total_emails_sent: number
  total_emails_failed: number
  total_eligible_users: number
  total_completed_users: number
  total_no_content_users: number
  avg_execution_time: number
  success_rate: string
}

export default function ScheduledEmailTimelinePage() {
  const [schedulerRuns, setSchedulerRuns] = useState<SchedulerRun[]>([])
  const [schedulerStats, setSchedulerStats] = useState<SchedulerStats | null>(null)
  const [isLoadingScheduler, setIsLoadingScheduler] = useState(true)
  const [selectedHours, setSelectedHours] = useState<number>(24)
  const [schedulerTriggerSource, setSchedulerTriggerSource] = useState<string>('all')
  const [schedulerStatus, setSchedulerStatus] = useState<string>('all')
  const [error, setError] = useState('')

  useEffect(() => {
    loadSchedulerRuns()
  }, [selectedHours, schedulerTriggerSource, schedulerStatus])

  async function loadSchedulerRuns() {
    try {
      setIsLoadingScheduler(true)
      setError('')
      
      const params = new URLSearchParams({
        hours: selectedHours.toString(),
        limit: '50'
      })
      
      // Apply scheduler-specific filters
      if (schedulerTriggerSource !== 'all') {
        params.append('trigger_source', schedulerTriggerSource)
      }
      
      const response = await fetch(`/api/debug/scheduler/runs?${params}`)
      if (!response.ok) throw new Error('Failed to load scheduler runs')
      
      const data = await response.json()
      
      // Apply status filter on frontend (since API doesn't support it yet)
      let filteredRuns = data.runs || []
      if (schedulerStatus !== 'all') {
        filteredRuns = filteredRuns.filter((run: SchedulerRun) => run.status === schedulerStatus)
      }
      
      setSchedulerRuns(filteredRuns)
      setSchedulerStats(data.stats)
      
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading scheduler runs:', err)
    } finally {
      setIsLoadingScheduler(false)
    }
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">📅 Scheduled Email Timeline</h1>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Monitor and analyze scheduler performance
        </div>
      </div>

      {/* Scheduler Stats Dashboard */}
      {schedulerStats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="text-sm text-blue-700 dark:text-blue-300">Total Runs</div>
            <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">{schedulerStats.total_runs}</div>
            <div className="text-xs text-blue-600 dark:text-blue-400">Last {selectedHours}h</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
            <div className="text-sm text-green-700 dark:text-green-300">Successful</div>
            <div className="text-2xl font-bold text-green-800 dark:text-green-200">{schedulerStats.successful_runs}</div>
            <div className="text-xs text-green-600 dark:text-green-400">{schedulerStats.success_rate}% success rate</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
            <div className="text-sm text-red-700 dark:text-red-300">Failed</div>
            <div className="text-2xl font-bold text-red-800 dark:text-red-200">{schedulerStats.failed_runs}</div>
            <div className="text-xs text-red-600 dark:text-red-400">
              {schedulerStats.running_runs > 0 && `${schedulerStats.running_runs} running`}
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
            <div className="text-sm text-purple-700 dark:text-purple-300">Emails Sent</div>
            <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">{schedulerStats.total_emails_sent}</div>
            <div className="text-xs text-purple-600 dark:text-purple-400">Across all runs</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
            <div className="text-sm text-orange-700 dark:text-orange-300">Eligible Users</div>
            <div className="text-2xl font-bold text-orange-800 dark:text-orange-200">{schedulerStats.total_eligible_users}</div>
            <div className="text-xs text-orange-600 dark:text-orange-400">Total checked</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-700 dark:text-gray-300">Avg Runtime</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {Math.round(schedulerStats.avg_execution_time)}ms
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Per execution</div>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Time Period</label>
            <select
              value={selectedHours}
              onChange={(e) => setSelectedHours(parseInt(e.target.value))}
              className="border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
            >
              <option value={1}>Last Hour</option>
              <option value={6}>Last 6 Hours</option>
              <option value={24}>Last 24 Hours</option>
              <option value={72}>Last 3 Days</option>
              <option value={168}>Last Week</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Trigger Source</label>
            <select
              value={schedulerTriggerSource}
              onChange={(e) => setSchedulerTriggerSource(e.target.value)}
              className="border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Sources</option>
              <option value="github_actions">GitHub Actions</option>
              <option value="manual">Manual</option>
              <option value="test">Test</option>
              <option value="vercel_cron">Vercel Cron (Legacy)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Status Filter</label>
            <select
              value={schedulerStatus}
              onChange={(e) => setSchedulerStatus(e.target.value)}
              className="border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={loadSchedulerRuns}
            disabled={isLoadingScheduler}
            className="px-4 py-2 border rounded hover:bg-gray-50 text-sm"
          >
            {isLoadingScheduler ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-4 text-red-800 dark:text-red-200">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Scheduler Runs Table */}
      <div className="border dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
          <h2 className="text-lg font-semibold dark:text-white">📧 Email Delivery Timeline</h2>
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {schedulerRuns.length} scheduler runs in selected time period
          </div>
        </div>
        
        {isLoadingScheduler ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            🔄 Loading scheduler runs...
          </div>
        ) : schedulerRuns.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No scheduler runs found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Trigger Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Users Checked</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Results</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Performance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {schedulerRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        run.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                        run.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                      }`}>
                        {run.status === 'completed' ? '✅' : run.status === 'failed' ? '❌' : '🔄'} {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{formatTime(run.timestamp)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Run ID: {run.run_id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-sm">{run.trigger_source.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{run.eligible_users} eligible</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs space-y-1">
                        <div className="text-green-600 dark:text-green-400">✅ {run.emails_sent} sent</div>
                        {run.emails_failed > 0 && <div className="text-red-600 dark:text-red-400">❌ {run.emails_failed} failed</div>}
                        {run.emails_completed > 0 && <div className="text-blue-600 dark:text-blue-400">🎯 {run.emails_completed} completed</div>}
                        {run.emails_no_content > 0 && <div className="text-gray-600 dark:text-gray-400">📭 {run.emails_no_content} no content</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {run.execution_time_ms ? (
                        <div className="text-sm">
                          <div>{run.execution_time_ms}ms</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {run.execution_time_ms > 5000 ? 'Slow' : run.execution_time_ms > 2000 ? 'Normal' : 'Fast'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {run.error ? (
                        <div className="text-xs text-red-600 dark:text-red-400 max-w-40 truncate" title={run.error}>
                          Error: {run.error}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400">No issues</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
