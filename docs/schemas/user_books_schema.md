# User Books Table Schema

This is the schema context for `user_books`, which stores the sequence of books assigned to each user.

## Core Identification Fields

**id (uuid)**: Primary key. Unique identifier for each assignment.

## Assignment Fields

**user_id (uuid)**: Foreign key to `users.id`. On delete: cascade.

**book_id (uuid)**: Foreign key to `books.id`. On delete: cascade.

**order_index (int)**: Position of this book in the user's sequence (1..n).

## Relationships

- **Belongs to**: `users` via `user_id`
- **Belongs to**: `books` via `book_id`

## Indexes & Performance

- **Unique Constraints**: `(user_id, book_id)` and `(user_id, order_index)`
- **Lookup Index**: B-tree on `user_id`

## Row Level Security

RLS is enabled. Access is expected via server (service role).
