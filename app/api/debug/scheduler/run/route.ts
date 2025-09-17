import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Missing Supabase configuration')
    }

    // Call the email-scheduler Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/email-scheduler`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Scheduler failed: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Error running scheduler:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
