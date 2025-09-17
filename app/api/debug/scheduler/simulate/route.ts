import { NextResponse } from 'next/server'
import { convertTimeInTimezoneToUTC, isValidTimezone } from '@/lib/timezone'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Missing Supabase configuration')
    }

    const { test_time, timezone } = await request.json()
    
    if (!test_time) {
      throw new Error('test_time is required')
    }
    
    if (!timezone) {
      throw new Error('timezone is required')
    }

    // Validate timezone
    if (!isValidTimezone(timezone)) {
      throw new Error(`Invalid timezone: ${timezone}. Please use a valid IANA timezone identifier.`)
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(test_time)) {
      throw new Error('Invalid time format. Please use HH:MM format (e.g., 09:00, 14:30)')
    }

    // Properly convert timezone + time to UTC
    const testTimestamp = convertTimeInTimezoneToUTC(test_time, timezone)

    // Call the test-scheduler Edge Function with the simulated time
    const response = await fetch(`${SUPABASE_URL}/functions/v1/test-scheduler`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        check_time: testTimestamp,
        simulate: true
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Simulation failed: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    
    // Add simulation metadata
    const simulationResult = {
      ...result,
      simulation: true,
      simulated_time: testTimestamp,
      simulated_timezone: timezone,
      input_time: test_time,
      conversion_info: {
        input: `${test_time} in ${timezone}`,
        output: `${testTimestamp.substring(11, 16)} UTC`,
        full_utc_timestamp: testTimestamp
      }
    }
    
    return NextResponse.json(simulationResult)
    
  } catch (error) {
    console.error('Error simulating scheduler:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
