import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'

interface RetryRequest {
  logId?: string
  logIds?: string[]
}

export async function POST(request: Request) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL

    if (!resendApiKey || !fromEmail) {
      return NextResponse.json(
        { error: 'Resend configuration missing. Check RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.' },
        { status: 500 }
      )
    }

    const body: RetryRequest = await request.json()
    const { logId, logIds } = body

    // Determine which logs to retry
    let idsToRetry: string[] = []
    if (logId) {
      idsToRetry = [logId]
    } else if (logIds && Array.isArray(logIds)) {
      idsToRetry = logIds
    } else {
      return NextResponse.json(
        { error: 'Either logId or logIds array is required' },
        { status: 400 }
      )
    }

    if (idsToRetry.length === 0) {
      return NextResponse.json(
        { error: 'No log IDs provided for retry' },
        { status: 400 }
      )
    }

    // Fetch failed email logs with all necessary data
    const { data: failedLogs, error: fetchError } = await supabase
      .from('email_logs')
      .select(`
        id,
        user_id,
        lesson_id,
        status,
        error,
        users!inner (
          id,
          email
        ),
        lessons!inner (
          id,
          day_number,
          subject,
          body_html,
          book_id,
          books!inner (
            id,
            title,
            author
          )
        )
      `)
      .in('id', idsToRetry)
      .eq('status', 'failed')

    if (fetchError) {
      console.error('Error fetching failed logs:', fetchError)
      throw fetchError
    }

    if (!failedLogs || failedLogs.length === 0) {
      return NextResponse.json(
        { error: 'No failed email logs found for the provided IDs' },
        { status: 404 }
      )
    }

    const resend = new Resend(resendApiKey)
    const results = []
    const newRunId = crypto.randomUUID()

    // Process each failed email
    for (const log of failedLogs) {
      try {
        // Send email via Resend
        const emailResult = await resend.emails.send({
          from: fromEmail,
          to: [log.users.email],
          subject: log.lessons.subject,
          html: log.lessons.body_html,
          headers: {
            'X-BookMail-Retry': 'true',
            'X-BookMail-Original-Log-ID': log.id,
            'X-BookMail-Lesson-Day': log.lessons.day_number.toString(),
            'X-BookMail-Book': log.lessons.books.title
          }
        })

        if (emailResult.error) {
          throw new Error(`Resend API error: ${emailResult.error.message}`)
        }

        // Log successful retry
        const { error: logError } = await supabase
          .from('email_logs')
          .insert({
            user_id: log.user_id,
            lesson_id: log.lesson_id,
            status: 'sent',
            schedule_run_id: newRunId,
            scheduled_for: new Date().toISOString(),
            delivery_reason: 'retry'
          })

        if (logError) {
          console.error('Error logging successful retry:', logError)
        }

        // Update user progress if this was the next lesson
        const { error: progressError } = await supabase
          .from('user_books')
          .update({
            last_lesson_sent: log.lessons.day_number,
            progress_updated_at: new Date().toISOString()
          })
          .eq('user_id', log.user_id)
          .eq('book_id', log.lessons.book_id)

        if (progressError) {
          console.error('Error updating progress:', progressError)
        }

        results.push({
          original_log_id: log.id,
          user_email: log.users.email,
          lesson_subject: log.lessons.subject,
          lesson_day: log.lessons.day_number,
          book_title: log.lessons.books.title,
          status: 'success',
          resend_email_id: emailResult.data?.id
        })

      } catch (retryError: any) {
        console.error(`Error retrying email for log ${log.id}:`, retryError)

        // Log failed retry
        const { error: logError } = await supabase
          .from('email_logs')
          .insert({
            user_id: log.user_id,
            lesson_id: log.lesson_id,
            status: 'failed',
            error: `Retry failed: ${retryError.message}`,
            schedule_run_id: newRunId,
            scheduled_for: new Date().toISOString(),
            delivery_reason: 'retry'
          })

        if (logError) {
          console.error('Error logging failed retry:', logError)
        }

        results.push({
          original_log_id: log.id,
          user_email: log.users.email,
          lesson_subject: log.lessons.subject,
          lesson_day: log.lessons.day_number,
          book_title: log.lessons.books.title,
          status: 'failed',
          error: retryError.message
        })
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const failureCount = results.filter(r => r.status === 'failed').length

    return NextResponse.json({
      retry_run_id: newRunId,
      timestamp: new Date().toISOString(),
      attempted: results.length,
      successful: successCount,
      failed: failureCount,
      results
    })
    
  } catch (error: any) {
    console.error('Error in retry API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retry emails' },
      { status: 500 }
    )
  }
}
