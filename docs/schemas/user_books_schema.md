# User Books Table Schema

This is the schema context for `user_books`, which stores the sequence of books assigned to each user and tracks their reading progress.

> **Note:** Progress tracking was consolidated from the deprecated `user_progress` table into `user_books` to simplify the schema. All progress-related fields are now stored here.

## Core Identification Fields

**id (uuid)**: Primary key. Unique identifier for each assignment.

## Assignment Fields

**user_id (uuid)**: Foreign key to `users.id`. On delete: cascade.

**book_id (uuid)**: Foreign key to `books.id`. On delete: cascade.

**order_index (int)**: Position of this book in the user's sequence (1..n). Constraint: must be > 0.

## Progress Tracking Fields

**last_lesson_sent (integer)**: The day number of the last lesson sent to the user for this book. Default: 0. Constraint: must be ≥ 0.
- Used by the scheduler to determine the next lesson to send
- Replaces the old `user_progress.last_lesson_sent` field

**progress_updated_at (timestamptz)**: Timestamp when progress was last updated. Default: now().
- Automatically updated when `last_lesson_sent` changes

**status (text)**: Current reading status of this book assignment. Default: 'queued'.
- Constraint: Must be one of 'currently_reading', 'queued', or 'completed'
- Tracks the state of this book in the user's reading sequence

**started_at (timestamptz, nullable)**: Timestamp when the user started reading this book (first lesson sent).

**assigned_at (timestamptz)**: Timestamp when this book was assigned to the user. Default: now().

## Relationships

- **Belongs to**: `users` via `user_id`
- **Belongs to**: `books` via `book_id`
- **Referenced by**: `user_book_delivery_times.user_book_id` (for per-book delivery schedules)

## Indexes & Performance

- **Unique Constraints**: `(user_id, book_id)` and `(user_id, order_index)`
- **Lookup Index**: B-tree on `user_id`
- **Progress Tracking**: Efficient queries on `last_lesson_sent` for scheduler operations

## Row Level Security

RLS is enabled. Access is expected via server (service role).

## Migration Note

This table now consolidates both book assignments AND progress tracking. Previously, progress was stored in a separate `user_progress` table, but this caused unnecessary complexity and joins. The consolidated design provides:
- Simpler queries (no joins needed for progress)
- Better data locality
- Clearer relationship between assignment and progress
