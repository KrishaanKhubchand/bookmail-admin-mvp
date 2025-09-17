# Lessons Table Schema

This is the schema context for the `lessons` table, which stores day-by-day lesson emails that belong to a book.

Each lesson maps to a specific day number within a book and includes subject and HTML content.

## Core Identification Fields

**id (uuid)**: Primary key. Unique identifier for each lesson.

**created_at (timestamptz)**: Timestamp when the lesson was created.

## Lesson Content Fields

**book_id (uuid)**: Foreign key to `books.id`. On delete: cascade.

**day_number (int)**: Lesson order within the book (1..n). Unique together with `book_id`.

**subject (text)**: Email subject for this lesson.

**body_html (text)**: HTML body for the email content.

## Relationships

- **Belongs to**: `books` (many-to-one via `book_id`)

## Indexes & Performance

- **Composite Unique**: `(book_id, day_number)`
- **Lookup Index**: B-tree on `(book_id, day_number)`

## Row Level Security

RLS is enabled. Access is expected via server (service role). Public read policies can be added later if needed.
