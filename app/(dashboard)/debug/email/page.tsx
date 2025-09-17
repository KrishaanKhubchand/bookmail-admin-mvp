"use client"

import { useState, useEffect } from 'react'

interface Book {
  id: string
  title: string
  author: string
  description: string
}

interface Lesson {
  id: string
  day_number: number
  subject: string
  body_html: string
}

interface SendResult {
  success: boolean
  emailId?: string
  recipient: string
  subject: string
  bookTitle: string
  bookAuthor: string
  lessonDay: number
  sentAt: string
  error?: string
}

interface ConnectionStatus {
  success: boolean
  message?: string
  error?: string
  apiKeyPresent: boolean
}

export default function EmailDebugPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedBookId, setSelectedBookId] = useState('')
  const [selectedLessonId, setSelectedLessonId] = useState('')
  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingBooks, setIsLoadingBooks] = useState(true)
  const [isLoadingLessons, setIsLoadingLessons] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [error, setError] = useState('')
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)

  // Load books on component mount
  useEffect(() => {
    loadBooks()
  }, [])

  // Load lessons when book is selected
  useEffect(() => {
    if (selectedBookId) {
      loadLessons(selectedBookId)
    } else {
      setLessons([])
      setSelectedLessonId('')
    }
  }, [selectedBookId])

  async function loadBooks() {
    try {
      setIsLoadingBooks(true)
      setError('')
      
      const response = await fetch('/api/debug/email/books')
      if (!response.ok) throw new Error('Failed to load books')
      
      const data = await response.json()
      setBooks(data.books || [])
      
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading books:', err)
    } finally {
      setIsLoadingBooks(false)
    }
  }

  async function loadLessons(bookId: string) {
    try {
      setIsLoadingLessons(true)
      setSelectedLessonId('')
      
      const response = await fetch(`/api/debug/email/lessons?bookId=${bookId}`)
      if (!response.ok) throw new Error('Failed to load lessons')
      
      const data = await response.json()
      setLessons(data.lessons || [])
      
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading lessons:', err)
    } finally {
      setIsLoadingLessons(false)
    }
  }

  async function testConnection() {
    try {
      setIsTestingConnection(true)
      setError('')
      
      const response = await fetch('/api/debug/email/test-connection', {
        method: 'POST'
      })
      
      const data = await response.json()
      setConnectionStatus(data)
      
      if (!response.ok) {
        setError(data.error || 'Connection test failed')
      }
      
    } catch (err: any) {
      setError(err.message)
      setConnectionStatus({
        success: false,
        error: err.message,
        apiKeyPresent: false
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  async function sendEmail() {
    if (!email || !selectedLessonId) {
      setError('Please select an email address and lesson')
      return
    }

    try {
      setIsSending(true)
      setError('')
      setSendResult(null)
      
      const response = await fetch('/api/debug/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          lessonId: selectedLessonId
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email')
      }
      
      setSendResult(result)
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSending(false)
    }
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleString()
  }

  const selectedBook = books.find(book => book.id === selectedBookId)
  const selectedLesson = lessons.find(lesson => lesson.id === selectedLessonId)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📧 Resend Email Debug Panel</h1>
        <div className="text-sm text-gray-600">
          Test sending lesson emails via Resend
        </div>
      </div>

      {/* Connection Status */}
      <div className="border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">🔗 Resend Connection</h2>
          <button
            onClick={testConnection}
            disabled={isTestingConnection}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {isTestingConnection ? '🔄 Testing...' : '🧪 Test Connection'}
          </button>
        </div>
        
        {connectionStatus && (
          <div className={`p-3 rounded border ${
            connectionStatus.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className={`text-sm font-medium ${
              connectionStatus.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {connectionStatus.success ? '✅ ' : '❌ '}
              {connectionStatus.message || connectionStatus.error}
            </div>
            {connectionStatus.apiKeyPresent && (
              <div className="text-xs text-gray-600 mt-1">
                API Key: {connectionStatus.success ? 'Valid' : 'Present but invalid'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Email Compose */}
      <div className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">✍️ Compose Test Email</h2>
        
        <div className="space-y-4">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Recipient Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@test.com"
              className="border rounded px-3 py-2 w-full"
            />
          </div>

          {/* Book Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Select Book
            </label>
            <select
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              disabled={isLoadingBooks}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="">
                {isLoadingBooks ? 'Loading books...' : 'Choose a book'}
              </option>
              {books.map(book => (
                <option key={book.id} value={book.id}>
                  {book.title} by {book.author}
                </option>
              ))}
            </select>
          </div>

          {/* Lesson Selection */}
          {selectedBookId && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Select Lesson
              </label>
              <select
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                disabled={isLoadingLessons}
                className="border rounded px-3 py-2 w-full"
              >
                <option value="">
                  {isLoadingLessons ? 'Loading lessons...' : 'Choose a lesson'}
                </option>
                {lessons.map(lesson => (
                  <option key={lesson.id} value={lesson.id}>
                    Day {lesson.day_number}: {lesson.subject}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Send Button */}
          <div>
            <button
              onClick={sendEmail}
              disabled={isSending || !email || !selectedLessonId}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? '📤 Sending...' : '📧 Send Email'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Send Result */}
      {sendResult && (
        <div className="border rounded-lg p-6 bg-green-50">
          <h2 className="text-lg font-semibold mb-4 text-green-800">✅ Email Sent Successfully</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">Email ID</div>
              <div className="font-mono text-xs">{sendResult.emailId}</div>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">Sent At</div>
              <div className="text-sm">{formatTime(sendResult.sentAt)}</div>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">Recipient</div>
              <div className="text-sm">{sendResult.recipient}</div>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">Subject</div>
              <div className="text-sm">{sendResult.subject}</div>
            </div>
          </div>
          
          <div className="mt-4 bg-white p-3 rounded shadow-sm">
            <div className="text-sm text-gray-600">Book & Lesson</div>
            <div className="text-sm">
              <strong>{sendResult.bookTitle}</strong> by {sendResult.bookAuthor} - Day {sendResult.lessonDay}
            </div>
          </div>
        </div>
      )}

      {/* Preview Selected Content */}
      {selectedBook && selectedLesson && (
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">👀 Email Preview</h2>
          
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">From Book</div>
              <div className="font-medium">{selectedBook.title} by {selectedBook.author}</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Subject</div>
              <div className="font-medium">{selectedLesson.subject}</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">HTML Content (first 500 chars)</div>
              <div className="text-sm text-gray-700 font-mono text-xs mt-1 max-h-32 overflow-y-auto">
                {selectedLesson.body_html.substring(0, 500)}
                {selectedLesson.body_html.length > 500 && '...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="border rounded-lg p-6 bg-blue-50">
        <h2 className="text-lg font-semibold mb-2 text-blue-800">💡 How to Use</h2>
        <div className="text-sm text-blue-700 space-y-2">
          <p><strong>1. Test Connection:</strong> First, verify your Resend API key is working.</p>
          <p><strong>2. Select Content:</strong> Choose a book, then pick a specific lesson to send.</p>
          <p><strong>3. Enter Email:</strong> Add your test email address (e.g., admin@test.com).</p>
          <p><strong>4. Send:</strong> Click "Send Email" and check your inbox!</p>
        </div>
        
        <div className="mt-4 text-xs text-blue-600">
          <strong>Environment Setup:</strong> Make sure you have <code>RESEND_API_KEY</code> and <code>RESEND_FROM_EMAIL</code> in your .env file.
        </div>
      </div>
    </div>
  )
}
