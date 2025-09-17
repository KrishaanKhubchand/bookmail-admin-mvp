import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST() {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    
    if (!resendApiKey) {
      return NextResponse.json(
        { 
          error: 'RESEND_API_KEY environment variable not found. Please add it to your .env file.',
          success: false 
        },
        { status: 400 }
      )
    }

    const resend = new Resend(resendApiKey)
    
    // Test connection by checking domains
    // Note: This is a lightweight test - if the API key is invalid, this will fail
    try {
      await resend.domains.list()
      
      return NextResponse.json({
        success: true,
        message: 'Resend API connection successful',
        apiKeyPresent: true,
        apiKeyLength: resendApiKey.length
      })
      
    } catch (resendError: any) {
      console.error('Resend API error:', resendError)
      
      // Parse Resend-specific errors
      let errorMessage = 'Unknown Resend API error'
      if (resendError.message) {
        errorMessage = resendError.message
      }
      
      return NextResponse.json(
        { 
          error: `Resend API Error: ${errorMessage}`,
          success: false,
          apiKeyPresent: true
        },
        { status: 400 }
      )
    }
    
  } catch (error: any) {
    console.error('Error testing Resend connection:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to test Resend connection',
        success: false 
      },
      { status: 500 }
    )
  }
}
