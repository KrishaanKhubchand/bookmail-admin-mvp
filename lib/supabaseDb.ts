import { supabase } from './supabase'
import type { User, Book, Lesson, UserProgress, AssignedBookDetail, UserDeliveryTime } from '@/types/domain'

// Users functions
export async function listUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Transform to match our domain types
    const users: User[] = (data || []).map(row => ({
      id: row.id,
      email: row.email,
      timezone: row.timezone,
      createdAt: row.created_at
    }))
    
    return users
  } catch (error) {
    console.error('Error listing users:', error)
    throw new Error(`Failed to fetch users: ${error.message}`)
  }
}

export async function createUser(email: string, timezone: string): Promise<User> {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert({ email, timezone })
      .select()
      .single()
    
    if (error) throw error
    
    // Transform to match our domain types
    const user: User = {
      id: data.id,
      email: data.email,
      timezone: data.timezone,
      createdAt: data.created_at
    }
    
    return user
  } catch (error) {
    console.error('Error creating user:', error)
    throw new Error(`Failed to create user: ${error.message}`)
  }
}

// Books functions
export async function listBooks(): Promise<Book[]> {
  try {
    const { data, error } = await supabase
      .from('books_with_totals')
      .select('*')
      .order('title')
    
    if (error) throw error
    
    const books: Book[] = (data || []).map(row => ({
      id: row.id,
      title: row.title,
      author: row.author,
      description: row.description,
      createdAt: row.created_at
    }))
    
    return books
  } catch (error) {
    console.error('Error listing books:', error)
    throw new Error(`Failed to fetch books: ${error.message}`)
  }
}

export async function getBook(id: string): Promise<Book | null> {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    
    return {
      id: data.id,
      title: data.title,
      author: data.author,
      description: data.description,
      createdAt: data.created_at
    }
  } catch (error) {
    console.error('Error getting book:', error)
    return null
  }
}

export async function listLessonsForBook(bookId: string): Promise<Lesson[]> {
  try {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('book_id', bookId)
      .order('day_number')
    
    if (error) throw error
    
    const lessons: Lesson[] = (data || []).map(row => ({
      id: row.id,
      bookId: row.book_id,
      dayNumber: row.day_number,
      subject: row.subject,
      bodyHtml: row.body_html,
      createdAt: row.created_at
    }))
    
    return lessons
  } catch (error) {
    console.error('Error listing lessons:', error)
    throw new Error(`Failed to fetch lessons: ${error.message}`)
  }
}

// Test function - get book count
export async function getBooksCount(): Promise<{ count: number; error?: string }> {
  try {
    const { count, error } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
    
    if (error) throw error
    return { count: count || 0 }
  } catch (error) {
    return { count: 0, error: error.message }
  }
}

// User progress functions
export async function getAssignedBooks(userId: string): Promise<AssignedBookDetail[]> {
  try {
    const { data, error } = await supabase
      .from('user_books')
      .select(`
        *,
        book:books(*)
      `)
      .eq('user_id', userId)
      .order('order_index')
    
    if (error) throw error
    
    const assignedBooks: AssignedBookDetail[] = (data || []).map(row => ({
      userBook: {
        id: row.id,
        userId: row.user_id,
        bookId: row.book_id,
        orderIndex: row.order_index
      },
      book: {
        id: row.book.id,
        title: row.book.title,
        author: row.book.author,
        description: row.book.description,
        createdAt: row.book.created_at
      }
    }))
    
    return assignedBooks
  } catch (error) {
    console.error('Error getting assigned books:', error)
    return []
  }
}

export async function getProgress(userId: string): Promise<UserProgress | null> {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null // No rows found
      throw error
    }
    
    return {
      id: data.id,
      userId: data.user_id,
      bookId: data.book_id,
      lastLessonSent: data.last_lesson_sent,
      updatedAt: data.updated_at
    }
  } catch (error) {
    console.error('Error getting progress:', error)
    return null
  }
}

export async function computeProgressPercent(userId: string): Promise<number> {
  try {
    const progress = await getProgress(userId)
    if (!progress) return 0
    
    const lessons = await listLessonsForBook(progress.bookId)
    if (lessons.length === 0) return 0
    
    return Math.min(100, Math.round((progress.lastLessonSent / lessons.length) * 100))
  } catch (error) {
    console.error('Error computing progress:', error)
    return 0
  }
}

// Book assignment write functions
export async function setAssignedBooks(userId: string, bookIdsInOrder: string[]): Promise<void> {
  try {
    // Delete existing assignments
    const { error: deleteError } = await supabase
      .from('user_books')
      .delete()
      .eq('user_id', userId)
    
    if (deleteError) throw deleteError
    
    // Insert new assignments with order
    if (bookIdsInOrder.length > 0) {
      const assignments = bookIdsInOrder.map((bookId, index) => ({
        user_id: userId,
        book_id: bookId,
        order_index: index + 1
      }))
      
      const { error: insertError } = await supabase
        .from('user_books')
        .insert(assignments)
      
      if (insertError) throw insertError
      
      // Initialize progress for first book if not exists
      await initializeProgress(userId, bookIdsInOrder[0])
    }
  } catch (error) {
    console.error('Error setting assigned books:', error)
    throw new Error(`Failed to assign books: ${error.message}`)
  }
}

export async function initializeProgress(userId: string, bookId: string): Promise<void> {
  try {
    // Check if progress already exists
    const { data: existing } = await supabase
      .from('user_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .single()
    
    if (existing) return // Already exists
    
    // Create new progress record
    const { error } = await supabase
      .from('user_progress')
      .insert({
        user_id: userId,
        book_id: bookId,
        last_lesson_sent: 0
      })
    
    if (error) throw error
  } catch (error) {
    console.error('Error initializing progress:', error)
    // Don't throw - this is not critical
  }
}

// User delivery times functions
export async function getUserDeliveryTimes(userId: string): Promise<UserDeliveryTime[]> {
  try {
    const { data, error } = await supabase
      .from('user_delivery_times')
      .select('*')
      .eq('user_id', userId)
      .order('delivery_time')
    
    if (error) throw error
    
    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      deliveryTime: row.delivery_time,
      createdAt: row.created_at
    }))
  } catch (error) {
    console.error('Error getting delivery times:', error)
    return []
  }
}

export async function setUserDeliveryTimes(
  userId: string, 
  times: string[] // Array of time strings like ["09:00", "17:30"]
): Promise<void> {
  try {
    // Delete existing times
    const { error: deleteError } = await supabase
      .from('user_delivery_times')
      .delete()
      .eq('user_id', userId)
    
    if (deleteError) throw deleteError
    
    // Insert new times
    if (times.length > 0) {
      const records = times.map(time => ({
        user_id: userId,
        delivery_time: time
      }))
      
      const { error: insertError } = await supabase
        .from('user_delivery_times')
        .insert(records)
      
      if (insertError) throw insertError
    }
  } catch (error) {
    console.error('Error setting delivery times:', error)
    throw new Error(`Failed to update delivery times: ${error.message}`)
  }
}

// Test function - list books (legacy)
export async function listBooksFromSupabase(): Promise<{ books: Book[]; error?: string }> {
  try {
    const books = await listBooks()
    return { books }
  } catch (error) {
    return { books: [], error: error.message }
  }
}
