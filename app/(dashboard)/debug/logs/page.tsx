"use client"

import { useState, useEffect } from 'react'
import { formatScheduledTime, getRelativeTime } from '@/lib/time'

interface EmailLog {
  id: string
  status: 'sent' | 'failed' | 'scheduled'
  error?: string
  schedule_run_id: string
  scheduled_for: string
  sent_at: string
  delivery_reason: string
  user: {
    id: string
    email: string
    timezone: string
  }
  lesson: {
    id: string
    day_number: number
    subject: string
    book: {
      id: string
      title: string
      author: string
    }
  } | null
}


interface LogStats {
  time_period: {
    hours: number
    from: string
    to: string
  }
  overall: {
    sent: number
    failed: number
    scheduled: number
    total: number
    success_rate: number
    total_runs: number
  }
  recent_runs: Array<{
    run_id: string
    timestamp: string
    sent: number
    failed: number
    scheduled: number
    total: number
  }>
  top_users: Array<{
    email: string
    count: number
  }>
  top_books: Array<{
    title: string
    count: number
  }>
}

interface RetryResult {
  retry_run_id: string
  timestamp: string
  attempted: number
  successful: number
  failed: number
  results: Array<{
    original_log_id: string
    user_email: string
    lesson_subject: string
    status: 'success' | 'failed'
    error?: string
  }>
}

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [stats, setStats] = useState<LogStats | null>(null)
  const [isLoadingLogs, setIsLoadingLogs] = useState(true)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedHours, setSelectedHours] = useState<number>(24)
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set())
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryResult, setRetryResult] = useState<RetryResult | null>(null)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'historical' | 'upcoming'>('historical')
  

  useEffect(() => {
    loadLogs()
    if (viewMode === 'historical') {
      loadStats()
    }
  }, [selectedStatus, selectedHours, viewMode])

  async function loadLogs() {
    try {
      setIsLoadingLogs(true)
      setError('')
      
      let endpoint = '/api/debug/logs/recent'
      const params = new URLSearchParams({
        hours: selectedHours.toString(),
        limit: '100'
      })
      
      if (viewMode === 'upcoming') {
        endpoint = '/api/debug/logs/upcoming'
        // For upcoming, we don't filter by status
      } else {
        // Historical mode - apply status filter
        if (selectedStatus !== 'all') {
          params.append('status', selectedStatus)
        }
      }
      
      const response = await fetch(`${endpoint}?${params}`)
      if (!response.ok) throw new Error('Failed to load logs')
      
      const data = await response.json()
      setLogs(data.logs || [])
      
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading logs:', err)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  async function loadStats() {
    try {
      setIsLoadingStats(true)
      
      const params = new URLSearchParams({
        hours: selectedHours.toString()
      })
      
      const response = await fetch(`/api/debug/logs/stats?${params}`)
      if (!response.ok) throw new Error('Failed to load stats')
      
      const data = await response.json()
      setStats(data)
      
    } catch (err: any) {
      console.error('Error loading stats:', err)
    } finally {
      setIsLoadingStats(false)
    }
  }


  async function retryFailedEmails() {
    if (selectedLogs.size === 0) {
      setError('Please select emails to retry')
      return
    }

    try {
      setIsRetrying(true)
      setError('')
      setRetryResult(null)
      
      const response = await fetch('/api/debug/logs/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logIds: Array.from(selectedLogs)
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to retry emails')
      }
      
      const result = await response.json()
      setRetryResult(result)
      setSelectedLogs(new Set()) // Clear selection
      
      // Reload logs and stats
      await loadLogs()
      await loadStats()
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsRetrying(false)
    }
  }

  function toggleLogSelection(logId: string) {
    const newSelected = new Set(selectedLogs)
    if (newSelected.has(logId)) {
      newSelected.delete(logId)
    } else {
      newSelected.add(logId)
    }
    setSelectedLogs(newSelected)
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleString()
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'sent': return '✅'
      case 'failed': return '❌'
      case 'scheduled': return '📅'
      default: return '❓'
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'sent': return 'text-green-600 bg-green-50'
      case 'failed': return 'text-red-600 bg-red-50'
      case 'scheduled': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const failedLogs = logs.filter(log => log.status === 'failed')
  const canRetry = selectedLogs.size > 0 && Array.from(selectedLogs).every(id => 
    logs.find(log => log.id === id)?.status === 'failed'
  )

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold dark:text-white">📊 Email Delivery Logs</h1>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Monitor and manage email deliveries
          </div>
        </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-600">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('historical')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              viewMode === 'historical' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            📊 Historical
          </button>
          <button
            onClick={() => setViewMode('upcoming')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              viewMode === 'upcoming' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            🔮 Upcoming
          </button>
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {viewMode === 'historical' 
            ? 'Past email deliveries and attempts'
            : `Next ${selectedHours}h of scheduled emails`
          }
        </div>
      </div>

      {/* Stats Dashboard */}
      {viewMode === 'historical' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-600 shadow-sm">
            <div className="text-sm text-gray-600 dark:text-gray-300">Total Emails</div>
            <div className="text-2xl font-bold dark:text-white">{stats.overall.total}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Last {selectedHours}h</div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
            <div className="text-sm text-green-700 dark:text-green-300">Sent Successfully</div>
            <div className="text-2xl font-bold text-green-800 dark:text-green-200">{stats.overall.sent}</div>
            <div className="text-xs text-green-600 dark:text-green-400">{stats.overall.success_rate}% success rate</div>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
            <div className="text-sm text-red-700 dark:text-red-300">Failed</div>
            <div className="text-2xl font-bold text-red-800 dark:text-red-200">{stats.overall.failed}</div>
            <div className="text-xs text-red-600 dark:text-red-400">
              {stats.overall.total > 0 ? ((stats.overall.failed / stats.overall.total) * 100).toFixed(1) : 0}% failure rate
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="text-sm text-blue-700 dark:text-blue-300">Scheduler Runs</div>
            <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">{stats.overall.total_runs}</div>
            <div className="text-xs text-blue-600 dark:text-blue-400">Automated executions</div>
          </div>
        </div>
      )}


      {/* Upcoming Stats Dashboard */}
      {viewMode === 'upcoming' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="text-sm text-blue-700 dark:text-blue-300">Scheduled Emails</div>
            <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">{logs.length}</div>
            <div className="text-xs text-blue-600 dark:text-blue-400">Next {selectedHours}h</div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
            <div className="text-sm text-green-700 dark:text-green-300">Unique Users</div>
            <div className="text-2xl font-bold text-green-800 dark:text-green-200">
              {new Set(logs.map(log => log.user.id)).size}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">Will receive emails</div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
            <div className="text-sm text-purple-700 dark:text-purple-300">Books Being Delivered</div>
            <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">
              {new Set(logs.map(log => log.lesson?.book?.title).filter(Boolean)).size}
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400">Different books</div>
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
              {viewMode === 'upcoming' ? (
                // Different options for upcoming
                <>
                  <option value={6}>Next 6 Hours</option>
                  <option value={24}>Next 24 Hours</option>
                  <option value={48}>Next 48 Hours</option>
                  <option value={72}>Next 3 Days</option>
                </>
              ) : (
                // Historical options
                <>
                  <option value={1}>Last Hour</option>
                  <option value={6}>Last 6 Hours</option>
                  <option value={24}>Last 24 Hours</option>
                  <option value={72}>Last 3 Days</option>
                  <option value={168}>Last Week</option>
                </>
              )}
            </select>
          </div>
          
          {viewMode === 'historical' && (
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">Status Filter</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="sent">Sent Only</option>
                <option value="failed">Failed Only</option>
                <option value="scheduled">Scheduled Only</option>
              </select>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {viewMode === 'historical' && selectedLogs.size > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {selectedLogs.size} selected
            </div>
          )}
          
          {viewMode === 'historical' && (
            <button
              onClick={retryFailedEmails}
              disabled={!canRetry || isRetrying}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isRetrying ? '🔄 Retrying...' : '🔁 Retry Selected'}
            </button>
          )}
          
          <button
            onClick={() => {
              loadLogs()
              if (viewMode === 'historical') {
                loadStats()
              }
            }}
            disabled={isLoadingLogs || isLoadingStats}
            className="px-4 py-2 border rounded hover:bg-gray-50 text-sm"
          >
            {(isLoadingLogs || isLoadingStats) ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-4 text-red-800 dark:text-red-200">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Retry Result */}
      {retryResult && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-4">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">📤 Retry Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Attempted:</span> {retryResult.attempted}
            </div>
            <div>
              <span className="text-green-700">Successful:</span> {retryResult.successful}
            </div>
            <div>
              <span className="text-red-700">Failed:</span> {retryResult.failed}
            </div>
            <div>
              <span className="text-blue-700">Run ID:</span> {retryResult.retry_run_id.substring(0, 8)}...
            </div>
          </div>
        </div>
      )}

      {/* Recent Scheduler Runs */}
      {viewMode === 'historical' && stats && stats.recent_runs.length > 0 && (
        <div className="border dark:border-gray-600 rounded-lg p-6 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">🚀 Recent Scheduler Runs</h2>
          <div className="space-y-2">
            {stats.recent_runs.slice(0, 5).map((run, index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded text-sm dark:text-white">
                <span>{formatTime(run.timestamp)}</span>
                <div className="flex items-center gap-4">
                  <span className="text-green-600">{run.sent} sent</span>
                  {run.failed > 0 && <span className="text-red-600">{run.failed} failed</span>}
                  <span className="font-mono text-xs">{run.run_id.substring(0, 8)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Logs Table */}
      {(viewMode === 'historical' || viewMode === 'upcoming') && (
        <div className="border dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            <h2 className="text-lg font-semibold dark:text-white">
              {viewMode === 'historical' ? '📧 Email Delivery Details' : '🔮 Upcoming Email Schedule'}
            </h2>
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {viewMode === 'historical' 
                ? `${logs.length} emails in selected time period`
                : `${logs.length} emails scheduled for next ${selectedHours} hours`
              }
            </div>
          </div>
        
        {isLoadingLogs ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            🔄 Loading email logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No email logs found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    {viewMode === 'historical' && failedLogs.length > 0 && 'Select'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Lesson</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Book</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white">
                    <td className="px-4 py-3">
                      {viewMode === 'historical' && log.status === 'failed' && (
                        <input
                          type="checkbox"
                          checked={selectedLogs.has(log.id)}
                          onChange={() => toggleLogSelection(log.id)}
                          className="rounded border-gray-300"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                        {getStatusIcon(log.status)} {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{log.user.email}</div>
                      <div className="text-xs text-gray-500">{log.user.timezone}</div>
                    </td>
                    <td className="px-4 py-3">
                      {log.lesson ? (
                        <div>
                          <div className="text-sm font-medium">Day {log.lesson.day_number}</div>
                          <div className="text-xs text-gray-500">{log.lesson.subject}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No lesson data</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.lesson?.book ? (
                        <div>
                          <div className="text-sm font-medium">{log.lesson.book.title}</div>
                          <div className="text-xs text-gray-500">{log.lesson.book.author}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No book data</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        {viewMode === 'upcoming' ? (
                          <>
                            <div className="font-medium">
                              {formatScheduledTime(log.scheduled_for!, log.user.timezone)}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">
                              {getRelativeTime(log.scheduled_for!)}
                            </div>
                            <div className="text-gray-400 dark:text-gray-500">{log.user.timezone}</div>
                          </>
                        ) : (
                          <>
                            <div>{formatTime(log.sent_at)}</div>
                            {log.scheduled_for && log.scheduled_for !== log.sent_at && (
                              <div className="text-gray-500 dark:text-gray-400">Scheduled: {formatTime(log.scheduled_for)}</div>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">{log.delivery_reason}</span>
                      {log.error && (
                        <div className="text-xs text-red-600 mt-1">{log.error}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}


      {/* Top Users & Books */}
      {viewMode === 'historical' && stats && (stats.top_users.length > 0 || stats.top_books.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stats.top_users.length > 0 && (
            <div className="border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">👥 Most Active Users</h2>
              <div className="space-y-2">
                {stats.top_users.map((user, index) => (
                  <div key={index} className="flex justify-between items-center py-2">
                    <span className="text-sm">{user.email}</span>
                    <span className="text-sm font-medium bg-blue-100 px-2 py-1 rounded">
                      {user.count} emails
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {stats.top_books.length > 0 && (
            <div className="border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">📚 Most Delivered Books</h2>
              <div className="space-y-2">
                {stats.top_books.map((book, index) => (
                  <div key={index} className="flex justify-between items-center py-2">
                    <span className="text-sm">{book.title}</span>
                    <span className="text-sm font-medium bg-green-100 px-2 py-1 rounded">
                      {book.count} lessons
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
