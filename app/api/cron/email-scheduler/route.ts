import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🕐 Vercel Cron: Email scheduler triggered at', new Date().toISOString())
    
    // Get environment variables
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey) {
      console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
      return NextResponse.json({ 
        success: false, 
        error: 'Missing service role key' 
      }, { status: 500 })
    }

    // Call your Supabase edge function
    const edgeFunctionUrl = 'https://gloqngqccjiqmowdzvhb.supabase.co/functions/v1/email-scheduler'
    
    console.log('📧 Calling edge function:', edgeFunctionUrl)
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Edge function failed with status ${response.status}:`, errorText)
      
      return NextResponse.json({ 
        success: false, 
        error: `Edge function failed: ${response.status}`,
        details: errorText
      }, { status: 500 })
    }

    const result = await response.json()
    console.log('✅ Edge function completed successfully:', result)
    
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      result: result,
      message: 'Email scheduler completed successfully'
    })
    
  } catch (error: any) {
    console.error('❌ Cron job failed:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Allow manual testing via POST as well
export async function POST() {
  return GET()
}
