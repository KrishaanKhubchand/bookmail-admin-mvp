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

    // Get eligible users for current time
    const { data: eligibleUsers, error: usersError } = await supabase
      .rpc('get_eligible_users_for_delivery', { 
        check_time: checkTime 
      }) as { data: EligibleUser[] | null, error: any }

    if (usersError) {
      throw new Error(`Error fetching eligible users: ${usersError.message}`)
    }

    const eligible = eligibleUsers?.filter(u => u.is_eligible) || []
    console.log(`👥 Found ${eligible.length} eligible users`)

    const results: ProcessResult[] = []
    let sentCount = 0
    let errorCount = 0

    // Process each eligible user
    for (const user of eligible) {
      let lesson: LessonData | undefined
      
      try {
        console.log(`🔄 Processing user: ${user.user_email}`)

        // Get next lesson for this user
        const { data: lessonData, error: lessonError } = await supabase
          .rpc('get_next_lesson_for_user', { 
            p_user_id: user.user_id 
          }) as { data: LessonData[] | null, error: any }

        if (lessonError) {
          console.error(`❌ Error fetching lesson for ${user.user_email}:`, lessonError)
          results.push({
            user_email: user.user_email,
            action: 'ERROR',
            error: `Database error: ${lessonError.message}`
          })
          errorCount++
          continue
        }

        lesson = lessonData?.[0]
        
        if (!lesson) {
          console.log(`📭 No lesson data for ${user.user_email}`)
          results.push({
            user_email: user.user_email,
            action: 'NO_CONTENT',
            error: 'No lesson data available'
          })
          continue
        }

        if (!lesson.should_send) {
          console.log(`✅ User ${user.user_email} completed all lessons`)
          results.push({
            user_email: user.user_email,
            book_title: lesson.book_title,
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
          console.error(`❌ Error fetching lesson content for ${user.user_email}:`, contentError)
          results.push({
            user_email: user.user_email,
            book_title: lesson.book_title,
            lesson_day: lesson.lesson_day_number,
            action: 'ERROR',
            error: 'Failed to fetch lesson content'
          })
          errorCount++
          continue
        }

        // Send email via Resend
        console.log(`📤 Sending email to ${user.user_email}: ${lesson.lesson_subject}`)
        
        const emailPayload = {
          from: process.env.RESEND_FROM_EMAIL!,
          to: [user.user_email],
          subject: lesson.lesson_subject,
          html: fullLesson.body_html,
          headers: {
            'X-BookMail-Scheduler': 'true',
            'X-BookMail-Run-ID': runId,
            'X-BookMail-Lesson-Day': lesson.lesson_day_number.toString(),
            'X-BookMail-Book': lesson.book_title
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

        console.log(`✅ Email sent successfully to ${user.user_email} - Resend ID: ${emailId}`)

        // Log successful send
        await supabase
          .from('email_logs')
          .insert({
            user_id: user.user_id,
            lesson_id: lesson.lesson_id,
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
          .eq('user_id', user.user_id)
          .eq('book_id', lesson.book_id)

        if (progressError) {
          console.error(`❌ Progress update failed for ${user.user_email}:`, progressError)
          console.error('Progress data:', { 
            user_id: user.user_id, 
            book_id: lesson.book_id, 
            last_lesson_sent: lesson.lesson_day_number 
          })
        } else {
          console.log(`✅ Progress updated: ${user.user_email} completed lesson ${lesson.lesson_day_number}`)
        }

        results.push({
          user_email: user.user_email,
          book_title: lesson.book_title,
          lesson_day: lesson.lesson_day_number,
          progress: `${lesson.lesson_day_number}/${lesson.total_lessons}`,
          action: 'SENT',
          resend_email_id: emailId
        })
        
        sentCount++

      } catch (emailError: any) {
        console.error(`❌ Failed to send email to ${user.user_email}:`, emailError)

        // Log failed send
        await supabase
          .from('email_logs')
          .insert({
            user_id: user.user_id,
            lesson_id: lesson?.lesson_id || null,
            status: 'failed',
            error: emailError.message,
            schedule_run_id: runId,
            scheduled_for: checkTime,
            delivery_reason: 'scheduled'
          })

        results.push({
          user_email: user.user_email,
          book_title: lesson?.book_title,
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