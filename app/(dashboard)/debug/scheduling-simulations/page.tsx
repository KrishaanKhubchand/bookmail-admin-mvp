"use client"

import { useState } from 'react'

interface SchedulerRunResult {
  run_id: string
  timestamp: string
  total_eligible: number
  sent: number
  errors: number
  completed: number
  no_content: number
  execution_time_ms: number
  results: any[]
}

export default function SchedulerTestPage() {
  // State Management
  const [isRunningScheduler, setIsRunningScheduler] = useState(false)
  const [schedulerResults, setSchedulerResults] = useState<SchedulerRunResult | null>(null)
  const [isTestingVercel, setIsTestingVercel] = useState(false)
  const [vercelTestResults, setVercelTestResults] = useState<any>(null)
  const [error, setError] = useState('')

  const runManualScheduler = async () => {
    try {
      setIsRunningScheduler(true)
      setError('')
      
      const response = await fetch('/api/debug/scheduler/run', {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to run scheduler: ${response.status}`)
      }
      
      const result = await response.json()
      setSchedulerResults(result)
      setVercelTestResults(null) // Clear Vercel test results
      
    } catch (err: any) {
      setError(err.message)
      console.error('Error running scheduler:', err)
    } finally {
      setIsRunningScheduler(false)
    }
  }

  const testVercelScheduler = async () => {
    try {
      setIsTestingVercel(true)
      setError('')
      
      const response = await fetch('/api/debug/scheduler/test-vercel', {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to test Vercel scheduler: ${response.status}`)
      }
      
      const result = await response.json()
      setVercelTestResults(result)
      setSchedulerResults(null) // Clear other results
      
    } catch (err: any) {
      setError(err.message)
      console.error('Error testing Vercel scheduler:', err)
    } finally {
      setIsTestingVercel(false)
    }
  }

  const refreshLogs = () => {
    // Clear all results
    setSchedulerResults(null)
    setVercelTestResults(null)
    setError('')
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          📧 Email Scheduler Test Panel
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Test the production email scheduling system
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={runManualScheduler}
          disabled={isRunningScheduler}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
        >
          🚀 {isRunningScheduler ? 'Running Scheduler...' : 'Run Scheduler Now'}
        </button>
        
        <button
          onClick={testVercelScheduler}
          disabled={isTestingVercel}
          className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
        >
          🧪 {isTestingVercel ? 'Testing Vercel Cron...' : 'Test Vercel Cron'}
        </button>
        
        <button
          onClick={refreshLogs}
          className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
        >
          📊 Clear Results
        </button>
      </div>

      {/* Information Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          ℹ️ Testing Information
        </h2>
        
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              🚀 Run Scheduler Now
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Tests the current production scheduler logic with real-time data. Uses the current UTC timestamp to find eligible users and sends actual emails if users are due for lessons.
            </p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
              🧪 Test Vercel Cron
            </h3>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Directly calls the Vercel Cron API endpoint that runs hourly in production. This tests the exact same code path that Vercel executes automatically.
            </p>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>⚠️ Note:</strong> Both testing methods run the production scheduler logic and will send real emails to users who are currently eligible for lessons based on their timezone and delivery time settings.
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            ❌ Error: {error}
          </p>
        </div>
      )}

      {/* Results Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          📋 Test Results
        </h2>
        
        {vercelTestResults && (
          <div className="space-y-4">
            {/* Vercel Test Summary */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
                🧪 Vercel Cron Test Results
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Eligible</div>
                  <div className="font-semibold">{vercelTestResults.total_eligible}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Sent</div>
                  <div className="font-semibold text-green-600">{vercelTestResults.sent}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Errors</div>
                  <div className="font-semibold text-red-600">{vercelTestResults.errors}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Completed</div>
                  <div className="font-semibold text-blue-600">{vercelTestResults.completed}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Runtime</div>
                  <div className="font-semibold">{vercelTestResults.execution_time_ms}ms</div>
                </div>
              </div>
            </div>
            
            {/* Individual Results */}
            {vercelTestResults.results && vercelTestResults.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-white">User Actions:</h4>
                {vercelTestResults.results.map((result: any, i: number) => (
                  <div key={i} className="border-l-4 pl-4 py-2 text-sm border-gray-300 dark:border-gray-600">
                    {result.action === 'SENT' && (
                      <div className="text-green-600 dark:text-green-400">
                        ✅ <strong>SENT:</strong> {result.user_email} - {result.book_title} Day {result.lesson_day} ({result.progress})
                      </div>
                    )}
                    {result.action === 'COMPLETED' && (
                      <div className="text-blue-600 dark:text-blue-400">
                        🎯 <strong>COMPLETED:</strong> {result.user_email} - finished {result.book_title}
                      </div>
                    )}
                    {result.action === 'NO_CONTENT' && (
                      <div className="text-gray-600 dark:text-gray-400">
                        📭 <strong>NO_CONTENT:</strong> {result.user_email} - no lesson data available
                      </div>
                    )}
                    {result.action === 'ERROR' && (
                      <div className="text-red-600 dark:text-red-400">
                        ❌ <strong>ERROR:</strong> {result.user_email} - {result.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {schedulerResults && (
          <div className="space-y-4">
            {/* Manual Run Summary */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                🚀 Manual Scheduler Run Results
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Eligible</div>
                  <div className="font-semibold">{schedulerResults.total_eligible}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Sent</div>
                  <div className="font-semibold text-green-600">{schedulerResults.sent}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Errors</div>
                  <div className="font-semibold text-red-600">{schedulerResults.errors}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Completed</div>
                  <div className="font-semibold text-blue-600">{schedulerResults.completed}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Runtime</div>
                  <div className="font-semibold">{schedulerResults.execution_time_ms}ms</div>
                </div>
              </div>
            </div>
            
            {/* Individual Results */}
            {schedulerResults.results && schedulerResults.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-white">User Actions:</h4>
                {schedulerResults.results.map((result: any, i: number) => (
                  <div key={i} className="border-l-4 pl-4 py-2 text-sm border-gray-300 dark:border-gray-600">
                    {result.action === 'SENT' && (
                      <div className="text-green-600 dark:text-green-400">
                        ✅ <strong>SENT:</strong> {result.user_email} - {result.book_title} Day {result.lesson_day} ({result.progress})
                      </div>
                    )}
                    {result.action === 'COMPLETED' && (
                      <div className="text-blue-600 dark:text-blue-400">
                        🎯 <strong>COMPLETED:</strong> {result.user_email} - finished {result.book_title}
                      </div>
                    )}
                    {result.action === 'NO_CONTENT' && (
                      <div className="text-gray-600 dark:text-gray-400">
                        📭 <strong>NO_CONTENT:</strong> {result.user_email} - no lesson data available
                      </div>
                    )}
                    {result.action === 'ERROR' && (
                      <div className="text-red-600 dark:text-red-400">
                        ❌ <strong>ERROR:</strong> {result.user_email} - {result.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!schedulerResults && !vercelTestResults && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>📊 No test results yet. Run a test to see results here.</p>
          </div>
        )}
      </div>
    </div>
  )
}