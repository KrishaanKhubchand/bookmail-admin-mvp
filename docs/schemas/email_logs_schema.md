# Email Logs Table Schema

This is the schema context for `email_logs`, which records email send attempts and outcomes for auditing and debugging.

## Core Identification Fields

**id (uuid)**: Primary key. Unique identifier for each log entry.

**sent_at (timestamptz)**: Timestamp when the email was queued/sent.

## Log Fields

**user_id (uuid)**: Foreign key to `users.id`. On delete: cascade.

**book_id (uuid, nullable)**: Foreign key to `books.id`. On delete: set null.

**lesson_id (uuid, nullable)**: Foreign key to `lessons.id`. On delete: set null.

**status (text)**: One of `queued`, `sent`, `failed`.

**error (text, nullable)**: Error message if a failure occurred.

## Relationships

- **Belongs to**: `users` via `user_id`
- **Optional**: `books` via `book_id`
- **Optional**: `lessons` via `lesson_id`

## Indexes & Performance

- **Lookup Index**: B-tree on `(user_id, sent_at desc)`

## Row Level Security

RLS is enabled. Access is expected via server (service role).
