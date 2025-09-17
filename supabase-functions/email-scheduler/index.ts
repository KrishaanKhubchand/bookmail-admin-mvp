import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Resend configuration
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
    
    if (!resendApiKey || !fromEmail) {
      throw new Error('Missing Resend configuration: RESEND_API_KEY and RESEND_FROM_EMAIL required')
    }

    // Generate run identifiers
    const checkTime = new Date().toISOString()
    const runId = crypto.randomUUID()
    
    console.log(`📧 Email Scheduler started - Run ID: ${runId}`)
    console.log(`🕐 Check time: ${checkTime}`)

    // Get eligible users for current time
    const { data: eligibleUsers, error: usersError } = await supabase
      .rpc('get_eligible_users_for_delivery', { 
        check_time: checkTime 
      }) as { data: EligibleUser[] | null, error: any }

    if (usersError) {
      console.error('❌ Error fetching eligible users:', usersError)
      throw usersError
    }

    const eligible = eligibleUsers?.filter(u => u.is_eligible) || []
    console.log(`👥 Found ${eligible.length} eligible users`)

    const results: ProcessResult[] = []
    let sentCount = 0
    let errorCount = 0

    // Process each eligible user
    for (const user of eligible) {
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

        const lesson = lessonData?.[0]
        
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

        // Fetch the lesson content (including body_html)
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
          from: fromEmail,
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
            'Authorization': `Bearer ${resendApiKey}`,
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
        const { error: logError } = await supabase
          .from('email_logs')
          .insert({
            user_id: user.user_id,
            lesson_id: lesson.lesson_id,
            status: 'sent',
            schedule_run_id: runId,
            scheduled_for: checkTime,
            delivery_reason: 'scheduled'
          })

        if (logError) {
          console.error(`⚠️ Warning: Failed to log email send for ${user.user_email}:`, logError)
        }

        // Update user progress
        const { error: progressError } = await supabase
          .from('user_progress')
          .upsert({
            user_id: user.user_id,
            book_id: lesson.book_id,
            last_lesson_sent: lesson.lesson_day_number
          })

        if (progressError) {
          console.error(`⚠️ Warning: Failed to update progress for ${user.user_email}:`, progressError)
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
        const { error: logError } = await supabase
          .from('email_logs')
          .insert({
            user_id: user.user_id,
            lesson_id: lessonData?.[0]?.lesson_id || null,
            status: 'failed',
            error: emailError.message,
            schedule_run_id: runId,
            scheduled_for: checkTime,
            delivery_reason: 'scheduled'
          })

        if (logError) {
          console.error(`⚠️ Warning: Failed to log email failure for ${user.user_email}:`, logError)
        }

        results.push({
          user_email: user.user_email,
          book_title: lessonData?.[0]?.book_title,
          lesson_day: lessonData?.[0]?.lesson_day_number,
          action: 'ERROR',
          error: emailError.message
        })
        
        errorCount++
      }
    }

    const response = {
      run_id: runId,
      timestamp: checkTime,
      total_eligible: eligible.length,
      sent: sentCount,
      errors: errorCount,
      completed: results.filter(r => r.action === 'COMPLETED').length,
      no_content: results.filter(r => r.action === 'NO_CONTENT').length,
      results
    }

    console.log(`🎉 Scheduler completed - Sent: ${sentCount}, Errors: ${errorCount}`)
    
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('💥 Scheduler failed:', error)
    
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
