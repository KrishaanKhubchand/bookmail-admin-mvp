# Books Table Schema

This is the database schema context for how book content and metadata is stored in the `books` table in BookMail's Supabase database.

It serves as the central repository for all book titles available in the platform, accessible via Supabase client queries and the server API layer. Each book can have multiple lessons and be included in user assignments.

## Core Identification Fields

**id (uuid)**: Primary key. Unique identifier for each book entry.

**created_at (timestamptz)**: Timestamp when the book was added to the database.

## Book Content Fields

**title (text)**: The full title of the book.

**author (text)**: The author(s) of the book.

**description (text)**: A detailed description or summary of what the book covers.

## Relationships

- **Referenced by**: `lessons.book_id` (one-to-many: each book has multiple lessons)
- **Referenced by**: `user_books.book_id` (many-to-many: users can have books in their queue)

## Indexes & Performance

- **Primary Index**: `id` (uuid primary key)

## Row Level Security

RLS is enabled. For Phase 2, reads/writes are expected via server (service role). Public read policies can be added later if needed.
