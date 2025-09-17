# Users Table Schema

This is the schema context for the `users` table, which stores admin-created user accounts and their timezones for scheduling.

## Core Identification Fields

**id (uuid)**: Primary key. Unique identifier for each user.

**created_at (timestamptz)**: Timestamp when the user was created.

## User Fields

**email (citext)**: Unique, case-insensitive email address for the user.

**timezone (text)**: IANA timezone (e.g., `America/New_York`).

## Relationships

- **Referenced by**: `user_books.user_id`
- **Referenced by**: `user_progress.user_id`
- **Referenced by**: `user_delivery_times.user_id`
- **Referenced by**: `email_logs.user_id`

## Indexes & Performance

- **Unique Index**: `email`

## Row Level Security

RLS is enabled. Access is expected via server (service role).
