# Users Table Schema

This is the schema context for the `users` table, which stores admin-created user accounts and their timezones for scheduling.

## Core Identification Fields

**id (uuid)**: Primary key. Unique identifier for each user.
- Also references `auth.users.id` (Supabase Auth integration)

**created_at (timestamptz)**: Timestamp when the user was created.

## User Profile Fields

**email (citext)**: Unique, case-insensitive email address for the user.

**timezone (text, nullable)**: IANA timezone (e.g., `America/New_York`).

## Reading Capacity Fields

**reading_capacity (integer)**: Number of books user can read simultaneously. Default: 1. Constraint: 1-4.
- Note: Field exists in database but not actively used in current implementation
- Reserved for future multi-book reading feature

## Subscription & Billing Fields

> **Note:** These fields support future billing integration and are not currently used in scheduler logic.

**subscription_status (text)**: User's subscription tier. Default: 'free'.
- Expected values: 'free', 'premium', etc.

**subscription_current_period_end (timestamptz, nullable)**: When the current subscription period expires.
- Used for billing cycle tracking

**stripe_customer_id (text, nullable)**: Links to Stripe customer for billing.
- Populated when user subscribes via Stripe

## Relationships

- **Links to**: `auth.users.id` (Supabase Auth)
- **Referenced by**: `user_books.user_id`
- **Referenced by**: `user_delivery_times.user_id`
- **Referenced by**: `email_logs.user_id`

## Indexes & Performance

- **Unique Index**: `email`
- **Auth Integration**: Foreign key to `auth.users.id`

## Row Level Security

RLS is enabled. Access is expected via server (service role).
