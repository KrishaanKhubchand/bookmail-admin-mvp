import { NextResponse } from 'next/server'

export async function POST() {
  try {
    console.log('🧪 Testing Vercel Cron scheduler manually...')
    
    // Call our new Vercel cron endpoint directly
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    
    const response = await fetch(`${baseUrl}/api/cron/email-scheduler`, {
      method: 'POST',
      headers: {
        'Authorization': process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Vercel scheduler failed: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    
    console.log('✅ Vercel scheduler test completed:', result)
    
    return NextResponse.json({
      ...result,
      test_mode: true,
      message: 'Vercel Cron scheduler test completed successfully'
    })
    
  } catch (error: any) {
    console.error('❌ Vercel scheduler test failed:', error)
    return NextResponse.json(
      { 
        error: error.message,
        test_mode: true,
        message: 'Vercel Cron scheduler test failed'
      },
      { status: 500 }
    )
  }
}
