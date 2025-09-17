import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: books, error } = await supabase
      .from('books')
      .select('id, title, author, description')
      .order('title')
    
    if (error) {
      console.error('Error fetching books:', error)
      throw error
    }

    return NextResponse.json({ books: books || [] })
    
  } catch (error) {
    console.error('Error in books API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch books' },
      { status: 500 }
    )
  }
}
