import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const bookId = searchParams.get('bookId')
    
    if (!bookId) {
      return NextResponse.json(
        { error: 'Book ID is required' },
        { status: 400 }
      )
    }

    const { data: lessons, error } = await supabase
      .from('lessons')
      .select('id, day_number, subject, body_html')
      .eq('book_id', bookId)
      .order('day_number')
    
    if (error) {
      console.error('Error fetching lessons:', error)
      throw error
    }

    return NextResponse.json({ lessons: lessons || [] })
    
  } catch (error) {
    console.error('Error in lessons API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch lessons' },
      { status: 500 }
    )
  }
}
