# User Delivery Times Table Schema

Database schema for storing user preferred email delivery times in BookMail's Supabase database. This table allows users to specify multiple preferred times for receiving daily email lessons.

## Core Identification Fields

**id (uuid)**: Primary key. Unique identifier for each delivery time preference.

**user_id (uuid)**: Foreign key reference to users.id. Links delivery time preference to specific user.

**created_at (timestamptz)**: Timestamp when the delivery time preference was created.

## Time Configuration Fields

**delivery_time (time)**: Preferred delivery time in HH:MM:SS format (e.g., '09:30:00'). Uses PostgreSQL's native time type for proper validation and sorting.

## Constraints & Validation

- **Unique constraint**: (user_id, delivery_time) prevents duplicate times per user
- **Time format**: PostgreSQL time type automatically validates HH:MM:SS format
- **Cascade deletion**: ON DELETE CASCADE removes delivery times when user is deleted

## Relationships

- **References**: users.id (many-to-one: each delivery time belongs to one user)
- **Referenced by**: None (leaf table)

## Row Level Security

RLS enabled with public read/write policies for MVP admin operations using anonymous key.

## Indexes

- **Primary index**: id (uuid primary key)  
- **User lookup index**: user_id for efficient queries by user
