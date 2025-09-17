import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase'

interface SendEmailRequest {
  email: string
  lessonId: string
}

export async function POST(request: Request) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    
    if (!resendApiKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY environment variable not found' },
        { status: 500 }
      )
    }

    const body: SendEmailRequest = await request.json()
    const { email, lessonId } = body

    if (!email || !lessonId) {
      return NextResponse.json(
        { error: 'Email and lesson ID are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Fetch lesson details with book info
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id,
        day_number,
        subject,
        body_html,
        books!inner (
          title,
          author
        )
      `)
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      console.error('Error fetching lesson:', lessonError)
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      )
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey)

    // Send email
    const emailResult = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com',
      to: [email],
      subject: lesson.subject,
      html: lesson.body_html,
      // Add some debug info in headers (optional)
      headers: {
        'X-BookMail-Test': 'true',
        'X-BookMail-Lesson-Day': lesson.day_number.toString(),
        'X-BookMail-Book': lesson.books.title
      }
    })

    if (emailResult.error) {
      console.error('Resend error:', emailResult.error)
      return NextResponse.json(
        { error: `Failed to send email: ${emailResult.error.message}` },
        { status: 400 }
      )
    }

    // Log the send attempt (optional - you can add this to email_logs table later)
    const sendData = {
      success: true,
      emailId: emailResult.data?.id,
      recipient: email,
      subject: lesson.subject,
      bookTitle: lesson.books.title,
      bookAuthor: lesson.books.author,
      lessonDay: lesson.day_number,
      sentAt: new Date().toISOString()
    }

    return NextResponse.json(sendData)
    
  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to send email',
        success: false 
      },
      { status: 500 }
    )
  }
}
