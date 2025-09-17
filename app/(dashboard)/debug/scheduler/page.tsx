"use client"

import { useState, useEffect } from 'react'
import { DEBUG_TIMEZONES, getUTCPreview } from '@/lib/timezone'

interface SchedulerRun {
  run_id: string
  timestamp: string
  total_eligible: number
  would_send: number
  completed: number
  errors: number
  results: Array<{
    user_email: string
    book_title?: string
    lesson_day?: number
    progress?: string
    action: string
    error?: string
  }>
}

interface SystemStatus {
  users_with_delivery_times: number
  users_with_books: number
  total_lessons: number
  recent_runs: number
  cron_active: boolean
  next_run_hour: string
}

export default function SchedulerDebugPage() {
  const [lastRun, setLastRun] = useState<SchedulerRun | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState('')
  const [simulateTime, setSimulateTime] = useState('')
  const [simulateTimezone, setSimulateTimezone] = useState('America/New_York')
  const [conversionPreview, setConversionPreview] = useState('')
  const [recentLogs, setRecentLogs] = useState<Array<{
    timestamp: string
    eligible: number
    sent: number
    run_id: string
  }>>([])

  useEffect(() => {
    loadSystemStatus()
    loadRecentLogs()
  }, [])

  // Update conversion preview when time or timezone changes
  useEffect(() => {
    if (simulateTime && simulateTimezone) {
      const preview = getUTCPreview(simulateTime, simulateTimezone)
      setConversionPreview(preview)
    } else {
      setConversionPreview('')
    }
  }, [simulateTime, simulateTimezone])

  async function loadSystemStatus() {
    try {
      const response = await fetch('/api/debug/scheduler/status')
      if (!response.ok) throw new Error('Failed to load status')
      const data = await response.json()
      setSystemStatus(data)
    } catch (err) {
      console.error('Error loading status:', err)
    }
  }

  async function loadRecentLogs() {
    try {
      const response = await fetch('/api/debug/scheduler/logs')
      if (!response.ok) throw new Error('Failed to load logs')
      const data = await response.json()
      setRecentLogs(data.runs || [])
    } catch (err) {
      console.error('Error loading logs:', err)
    }
  }

  async function runScheduler() {
    try {
      setIsRunning(true)
      setError('')
      
      const response = await fetch('/api/debug/scheduler/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!response.ok) throw new Error('Failed to run scheduler')
      
      const result = await response.json()
      setLastRun(result)
      
      // Reload status and logs
      await loadSystemStatus()
      await loadRecentLogs()
      
    } catch (err) {
      setError(err.message)
    } finally {
      setIsRunning(false)
    }
  }

  async function simulateAtTime() {
    if (!simulateTime) return
    
    try {
      setIsRunning(true)
      setError('')
      
      const response = await fetch('/api/debug/scheduler/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_time: simulateTime,
          timezone: simulateTimezone
        })
      })
      
      if (!response.ok) throw new Error('Failed to simulate')
      
      const result = await response.json()
      setLastRun(result)
      
    } catch (err) {
      setError(err.message)
    } finally {
      setIsRunning(false)
    }
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleString()
  }

  function getActionIcon(action: string) {
    switch (action) {
      case 'WOULD_SEND': return '✅'
      case 'COMPLETED': return '⏭️'
      case 'NO_CONTENT': return '❌'
      case 'ERROR': return '🚨'
      default: return '❓'
    }
  }

  function getActionText(action: string) {
    switch (action) {
      case 'WOULD_SEND': return 'Would Send'
      case 'COMPLETED': return 'Completed'
      case 'NO_CONTENT': return 'No Content'
      case 'ERROR': return 'Error'
      default: return action
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📧 Email Scheduler Debug Panel</h1>
        <div className="text-sm text-gray-600">
          Test and monitor the email scheduling system
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={runScheduler}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? '🔄 Running...' : '🚀 Run Scheduler Now'}
        </button>
        
        <button
          onClick={loadRecentLogs}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          📊 Refresh Logs
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Last Run Results */}
      {lastRun && (
        <div className="border rounded-lg p-6 bg-gray-50">
          <h2 className="text-lg font-semibold mb-4">📋 Last Run Results</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">Run ID</div>
              <div className="font-mono text-xs">{lastRun.run_id.substring(0, 8)}...</div>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">Time</div>
              <div className="text-sm">{formatTime(lastRun.timestamp)}</div>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">Eligible Users</div>
              <div className="text-lg font-semibold">{lastRun.total_eligible}</div>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">Would Send</div>
              <div className="text-lg font-semibold text-green-600">{lastRun.would_send}</div>
            </div>
          </div>

          {lastRun.results.length > 0 && (
            <div className="bg-white rounded border">
              <div className="px-4 py-2 border-b bg-gray-50 text-sm font-medium">
                Details ({lastRun.results.length} users)
              </div>
              <div className="max-h-60 overflow-y-auto">
                {lastRun.results.map((result, index) => (
                  <div key={index} className="px-4 py-3 border-b last:border-b-0 flex items-center gap-3">
                    <span className="text-lg">{getActionIcon(result.action)}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{result.user_email}</div>
                      {result.book_title && (
                        <div className="text-xs text-gray-600">
                          {result.book_title}
                          {result.lesson_day && ` - Day ${result.lesson_day}`}
                          {result.progress && ` (${result.progress})`}
                        </div>
                      )}
                      {result.error && (
                        <div className="text-xs text-red-600">{result.error}</div>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                      {getActionText(result.action)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* System Status */}
      {systemStatus && (
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">⚙️ System Status</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Users with Delivery Times</div>
              <div className="text-xl font-semibold">{systemStatus.users_with_delivery_times}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Users with Books</div>
              <div className="text-xl font-semibold">{systemStatus.users_with_books}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Total Lessons</div>
              <div className="text-xl font-semibold">{systemStatus.total_lessons}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Cron Status</div>
              <div className={`text-sm font-medium ${systemStatus.cron_active ? 'text-green-600' : 'text-red-600'}`}>
                {systemStatus.cron_active ? 'Active' : 'Inactive'}
              </div>
              <div className="text-xs text-gray-500">Next: {systemStatus.next_run_hour}</div>
            </div>
          </div>
        </div>
      )}

      {/* Time Simulation */}
      <div className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">🕐 Time Simulation</h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Time (HH:MM)
              </label>
              <input
                type="time"
                value={simulateTime}
                onChange={(e) => setSimulateTime(e.target.value)}
                className="border rounded px-3 py-2 w-full"
                placeholder="09:00"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Timezone
              </label>
              <select
                value={simulateTimezone}
                onChange={(e) => setSimulateTimezone(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              >
                {DEBUG_TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={simulateAtTime}
                disabled={isRunning || !simulateTime}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 w-full"
              >
                {isRunning ? '🔄 Testing...' : '🧪 Test Run'}
              </button>
            </div>
          </div>
          
          {/* UTC Conversion Preview */}
          {conversionPreview && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="text-sm text-blue-800">
                <strong>🔄 Conversion Preview:</strong>
              </div>
              <div className="text-sm text-blue-700 mt-1">
                <span className="font-medium">{simulateTime}</span> in{' '}
                <span className="font-medium">{DEBUG_TIMEZONES.find(tz => tz.value === simulateTimezone)?.label}</span>
                {' '}= <span className="font-bold text-blue-900">{conversionPreview}</span>
              </div>
            </div>
          )}
          
          {/* Error handling for conversion */}
          {simulateTime && simulateTimezone && conversionPreview.startsWith('Error:') && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <div className="text-sm text-red-800">
                <strong>⚠️ Conversion Error:</strong>
              </div>
              <div className="text-sm text-red-700 mt-1">
                {conversionPreview}
              </div>
            </div>
          )}
        </div>
        
        <div className="text-sm text-gray-600 mt-4">
          <strong>💡 How to use:</strong> Select the time and timezone you want to test. 
          The preview shows what UTC time will be sent to the scheduler. 
          This tests which users would be eligible at that exact moment.
        </div>
        
        <div className="text-xs text-gray-500 mt-2">
          <strong>Example:</strong> "09:00" + "New York" tests if NYC users with 9 AM delivery times would receive emails.
        </div>
      </div>

      {/* Recent Logs */}
      <div className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">📝 Recent Scheduler Logs</h2>
        
        {recentLogs.length > 0 ? (
          <div className="space-y-2">
            {recentLogs.map((log, index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded text-sm">
                <span>{formatTime(log.timestamp)}</span>
                <span>{log.eligible} eligible</span>
                <span className="text-green-600">{log.sent} sent</span>
                <span className="font-mono text-xs">{log.run_id.substring(0, 8)}...</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-8">
            No recent logs found. Run the scheduler to see results here.
          </div>
        )}
      </div>
    </div>
  )
}
