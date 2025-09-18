import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Call the Vercel Cron API instead of Edge Function
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3002'
    
    const response = await fetch(`${baseUrl}/api/cron/email-scheduler`, {
      method: 'POST',
      headers: {
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
