# User Progress Table Schema

This is the schema context for `user_progress`, which tracks each user's progress for a specific book.

## Core Identification Fields

**id (uuid)**: Primary key. Unique identifier for each progress record.

**updated_at (timestamptz)**: Timestamp automatically updated on changes.

## Progress Fields

**user_id (uuid)**: Foreign key to `users.id`. On delete: cascade.

**book_id (uuid)**: Foreign key to `books.id`. On delete: cascade.

**last_lesson_sent (int)**: Last day number sent to the user (default 0).

## Relationships

- **Belongs to**: `users` via `user_id`
- **Belongs to**: `books` via `book_id`

## Indexes & Performance

- **Unique Constraint**: `(user_id, book_id)`
- **Lookup Index**: B-tree on `(user_id, book_id)`

## Row Level Security

RLS is enabled. Access is expected via server (service role).
