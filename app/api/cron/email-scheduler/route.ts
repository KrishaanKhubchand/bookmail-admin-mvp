import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create service role client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface EligibleUser {
  user_id: string
  user_email: string
  user_timezone: string
  delivery_time: string
  local_time: string
  is_eligible: boolean
}

interface EligibleBookAssignment {
  user_book_id: string
  user_id: string
  user_email: string
  user_timezone: string
  book_id: string
  book_title: string
  delivery_time: string
  last_lesson_sent: number
  book_status: string
  local_time: string
  is_eligible: boolean
}

interface LessonData {
  lesson_id: string
  book_id: string
  book_title: string
  lesson_day_number: number
  lesson_subject: string
  lesson_body_html?: string
  current_progress: number
  total_lessons: number
  should_send: boolean
}

interface ProcessResult {
  user_email: string
  book_title?: string
  lesson_day?: number
  progress?: string
  action: 'SENT' | 'FAILED' | 'COMPLETED' | 'NO_CONTENT' | 'ERROR'
  error?: string
  resend_email_id?: string
}

// Handle GET requests from Vercel cron (calls same logic as POST)
export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  // Optional: Verify this is a cron request (for security)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Declare variables outside try block so they're accessible in catch
  let runId: string | undefined
  let startTime: number | undefined

  try {
    // Generate run identifiers
    const checkTime = new Date().toISOString()
    runId = crypto.randomUUID()
    startTime = Date.now()
    
    console.log(`📧 Email Scheduler started - Run ID: ${runId}`)
    console.log(`🕐 Check time: ${checkTime}`)

    // Log scheduler run start
    const { error: runStartError } = await supabase
      .from('scheduler_runs')
      .insert({
        run_id: runId,
        timestamp: checkTime,
        trigger_source: 'vercel_cron',
        status: 'running'
      })

    if (runStartError) {
      throw new Error(`Failed to log scheduler run start: ${runStartError.message}`)
    }

    // Get eligible book assignments for current time
    const { data: eligibleBooks, error: booksError } = await supabase
      .rpc('get_eligible_books_for_delivery', { 
        check_time: checkTime 
      }) as { data: EligibleBookAssignment[] | null, error: any }

    if (booksError) {
      throw new Error(`Error fetching eligible books: ${booksError.message}`)
    }

    const eligible = eligibleBooks?.filter(b => b.is_eligible) || []
    console.log(`📚 Found ${eligible.length} eligible book assignments`)

    const results: ProcessResult[] = []
    let sentCount = 0
    let errorCount = 0

    // Process each eligible book assignment
    for (const bookAssignment of eligible) {
      let lesson: LessonData | undefined
      
      try {
        console.log(`🔄 Processing: ${bookAssignment.user_email} - ${bookAssignment.book_title}`)

        // Get next lesson for this specific book
        const { data: lessonData, error: lessonError } = await supabase
          .rpc('get_next_lesson_for_book', { 
            p_user_book_id: bookAssignment.user_book_id 
          }) as { data: LessonData[] | null, error: any }

        if (lessonError) {
          console.error(`❌ Error fetching lesson:`, lessonError)
          results.push({
            user_email: bookAssignment.user_email,
            book_title: bookAssignment.book_title,
            action: 'ERROR',
            error: `Database error: ${lessonError.message}`
          })
          errorCount++
          continue
        }

        lesson = lessonData?.[0]
        
        if (!lesson) {
          console.log(`📭 No lesson data for ${bookAssignment.book_title}`)
          results.push({
            user_email: bookAssignment.user_email,
            book_title: bookAssignment.book_title,
            action: 'NO_CONTENT',
            error: 'No lesson data available'
          })
          continue
        }

        if (!lesson.should_send) {
          console.log(`✅ Book completed: ${bookAssignment.book_title}`)
          
          // Update book status to completed
          await supabase
            .from('user_books')
            .update({ status: 'completed' })
            .eq('id', bookAssignment.user_book_id)
          
          results.push({
            user_email: bookAssignment.user_email,
            book_title: bookAssignment.book_title,
            lesson_day: lesson.current_progress,
            progress: `${lesson.current_progress}/${lesson.total_lessons}`,
            action: 'COMPLETED'
          })
          continue
        }

        // Fetch the lesson content
        const { data: fullLesson, error: contentError } = await supabase
          .from('lessons')
          .select('body_html')
          .eq('id', lesson.lesson_id)
          .single()

        if (contentError || !fullLesson) {
          console.error(`❌ Error fetching lesson content:`, contentError)
          results.push({
            user_email: bookAssignment.user_email,
            book_title: bookAssignment.book_title,
            lesson_day: lesson.lesson_day_number,
            action: 'ERROR',
            error: 'Failed to fetch lesson content'
          })
          errorCount++
          continue
        }

        // Send email via Resend
        console.log(`📤 Sending email to ${bookAssignment.user_email}: ${lesson.lesson_subject}`)
        
        const emailPayload = {
          from: process.env.RESEND_FROM_EMAIL!,
          to: [bookAssignment.user_email],
          subject: lesson.lesson_subject,
          html: fullLesson.body_html,
          headers: {
            'X-BookMail-Scheduler': 'true',
            'X-BookMail-Run-ID': runId,
            'X-BookMail-User-Book-ID': bookAssignment.user_book_id,
            'X-BookMail-Lesson-Day': lesson.lesson_day_number.toString(),
            'X-BookMail-Book': bookAssignment.book_title
          }
        }

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        })

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text()
          throw new Error(`Resend API error ${emailResponse.status}: ${errorText}`)
        }

        const emailResult = await emailResponse.json()
        const emailId = emailResult.id

        console.log(`✅ Email sent successfully to ${bookAssignment.user_email} - Resend ID: ${emailId}`)

        // Log successful send
        await supabase
          .from('email_logs')
          .insert({
            user_id: bookAssignment.user_id,
            lesson_id: lesson.lesson_id,
            book_id: bookAssignment.book_id,
            status: 'sent',
            schedule_run_id: runId,
            scheduled_for: checkTime,
            delivery_reason: 'scheduled'
          })

        // Update user progress
        const { error: progressError } = await supabase
          .from('user_books')
          .update({
            last_lesson_sent: lesson.lesson_day_number,
            progress_updated_at: new Date().toISOString()
          })
          .eq('id', bookAssignment.user_book_id)

        if (progressError) {
          console.error(`❌ Progress update failed:`, progressError)
        } else {
          console.log(`✅ Progress updated: ${bookAssignment.user_email} - ${bookAssignment.book_title} lesson ${lesson.lesson_day_number}`)
        }

        results.push({
          user_email: bookAssignment.user_email,
          book_title: bookAssignment.book_title,
          lesson_day: lesson.lesson_day_number,
          progress: `${lesson.lesson_day_number}/${lesson.total_lessons}`,
          action: 'SENT',
          resend_email_id: emailId
        })
        
        sentCount++

      } catch (emailError: any) {
        console.error(`❌ Failed to send email to ${bookAssignment.user_email}:`, emailError)

        // Log failed send
        await supabase
          .from('email_logs')
          .insert({
            user_id: bookAssignment.user_id,
            lesson_id: lesson?.lesson_id || null,
            book_id: bookAssignment.book_id,
            status: 'failed',
            error: emailError.message,
            schedule_run_id: runId,
            scheduled_for: checkTime,
            delivery_reason: 'scheduled'
          })

        results.push({
          user_email: bookAssignment.user_email,
          book_title: bookAssignment.book_title,
          lesson_day: lesson?.lesson_day_number,
          action: 'ERROR',
          error: emailError.message
        })
        
        errorCount++
      }
    }

    // Calculate final statistics
    const endTime = Date.now()
    const executionTime = endTime - startTime
    const completedCount = results.filter(r => r.action === 'COMPLETED').length
    const noContentCount = results.filter(r => r.action === 'NO_CONTENT').length

    // Update scheduler run with final stats
    const { error: runEndError } = await supabase
      .from('scheduler_runs')
      .update({
        eligible_users: eligible.length,
        emails_sent: sentCount,
        emails_failed: errorCount,
        emails_completed: completedCount,
        emails_no_content: noContentCount,
        status: 'completed',
        execution_time_ms: executionTime,
        updated_at: new Date().toISOString()
      })
      .eq('run_id', runId)

    if (runEndError) {
      console.error('⚠️ Failed to update scheduler run stats:', runEndError)
    }

    const response = {
      run_id: runId,
      timestamp: checkTime,
      total_eligible: eligible.length,
      sent: sentCount,
      errors: errorCount,
      completed: completedCount,
      no_content: noContentCount,
      execution_time_ms: executionTime,
      results,
      scheduler_type: 'vercel_cron'
    }

    console.log(`🎉 Scheduler completed - Sent: ${sentCount}, Errors: ${errorCount}, Runtime: ${executionTime}ms`)
    
    return NextResponse.json(response)

  } catch (error: any) {
    console.error('💥 Scheduler failed:', error)
    
    // Try to update scheduler run status to failed if runId exists
    if (runId) {
      try {
        const endTime = Date.now()
        const executionTime = startTime ? endTime - startTime : null
        
        await supabase
          .from('scheduler_runs')
          .update({
            status: 'failed',
            error: error.message,
            execution_time_ms: executionTime,
            updated_at: new Date().toISOString()
          })
          .eq('run_id', runId)
      } catch (updateError) {
        console.error('⚠️ Failed to update scheduler run failure status:', updateError)
      }
    }
    
    return NextResponse.json({
      error: error.message,
      timestamp: new Date().toISOString(),
      scheduler_type: 'vercel_cron'
    }, { status: 500 })
  }
}