export type UUID = string;

export interface User {
  id: UUID;
  email: string;
  timezone: string;
  createdAt: string;
}

export interface Book {
  id: UUID;
  title: string;
  author: string;
  description?: string;
  createdAt: string;
}

export interface Lesson {
  id: UUID;
  bookId: UUID;
  dayNumber: number;
  subject?: string;
  bodyHtml: string;
  createdAt: string;
}

export interface UserBook {
  id: UUID;
  userId: UUID;
  bookId: UUID;
  orderIndex: number;
  // Progress tracking fields (migrated from UserProgress)
  lastLessonSent: number;
  progressUpdatedAt: string;
  assignedAt: string;
}

// UserProgress interface removed - now consolidated into UserBook

export interface UserDeliveryTime {
  id: UUID;
  userId: UUID;
  deliveryTime: string;
  createdAt: string;
}

export interface AssignedBookDetail {
  userBook: UserBook;
  book: Book;
}
