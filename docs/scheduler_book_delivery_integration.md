# Book-Based Delivery Times: Scheduler Integration

This document explains how the email scheduler integrates with the `user_book_delivery_times` table to enable per-book lesson scheduling.

## Overview

The scheduler has migrated from a **user-centric** model (one schedule for all books) to a **book-centric** model (individual schedules per book assignment). This enables:

- Multiple books being read simultaneously with different delivery times
- Multiple lessons per day from the same book
- Flexible scheduling that scales to power readers (1-4 books at once)

## Core Database Function: `get_eligible_books_for_delivery`

The scheduler relies on this PostgreSQL function to determine which book assignments should receive lessons at any given time.

### Function Purpose

Finds all book assignments that:
1. Have delivery times matching the current hour
2. Are in `currently_reading` status
3. Belong to users with valid timezones
4. Have lessons remaining to send

### Function Logic

```sql
CREATE OR REPLACE FUNCTION get_eligible_books_for_delivery(check_time timestamptz)
RETURNS TABLE (
  user_book_id uuid,
  user_id uuid,
  user_email text,
  user_timezone text,
  book_id uuid,
  book_title text,
  delivery_time time,
  last_lesson_sent integer,
  book_status text,
  local_time text,
  is_eligible boolean
)
```

**Key Steps:**
1. **Join tables**: user_book_delivery_times → user_books → users → books
2. **Filter by status**: Only `ub.status = 'currently_reading'` books
3. **Filter by timezone**: Only users with `u.timezone IS NOT NULL`
4. **Convert to local time**: Use PostgreSQL's `AT TIME ZONE` for accurate conversion
5. **Match delivery hour**: Compare local hour with delivery time hour
6. **Return eligibility**: Boolean flag indicating if book should receive lesson

### Timezone Conversion

The function converts the check time (UTC) to each user's local timezone:

```sql
-- Convert UTC to user's local time
(check_time AT TIME ZONE u.timezone)::time as local_time

-- Compare hour component
EXTRACT(HOUR FROM (check_time AT TIME ZONE u.timezone)::time) = 
EXTRACT(HOUR FROM ubdt.delivery_time)
```

This ensures accurate delivery regardless of user location.

## Scheduler Execution Flow

### 1. Cron Trigger
```typescript
// Vercel cron runs hourly at :00
// /api/cron/email-scheduler/route.ts
export async function GET(request: Request)
```

### 2. Get Eligible Books
```typescript
const { data: eligibleBooks } = await supabase
  .rpc('get_eligible_books_for_delivery', { 
    check_time: new Date().toISOString() 
  })

const eligible = eligibleBooks?.filter(b => b.is_eligible) || []
```

### 3. Process Each Book Assignment
For each eligible book:

```typescript
for (const bookAssignment of eligible) {
  // Get next lesson for this specific book
  const { data: lessonData } = await supabase
    .rpc('get_next_lesson_for_book', { 
      p_user_book_id: bookAssignment.user_book_id 
    })
  
  // Send email via Resend
  await resend.emails.send({
    from: 'BookMail <lessons@bookmail.app>',
    to: bookAssignment.user_email,
    subject: lesson.lesson_subject,
    html: emailHtml,
    headers: {
      'X-BookMail-User-Book-ID': bookAssignment.user_book_id
    }
  })
  
  // Update progress
  await supabase
    .from('user_books')
    .update({
      last_lesson_sent: lesson.lesson_day_number,
      progress_updated_at: new Date().toISOString()
    })
    .eq('id', bookAssignment.user_book_id)
  
  // Mark as completed if last lesson
  if (lesson.lesson_day_number >= lesson.total_lessons) {
    await supabase
      .from('user_books')
      .update({ status: 'completed' })
      .eq('id', bookAssignment.user_book_id)
  }
  
  // Log delivery
  await supabase.from('email_logs').insert({
    user_id: bookAssignment.user_id,
    book_id: bookAssignment.book_id,
    lesson_id: lesson.lesson_id,
    // ... other fields
  })
}
```

## Multi-Book Scenarios

### Scenario 1: Two Books at Different Times
```
9:00 AM UTC → Check Time
User: john@example.com (timezone: 'America/New_York')
Local time: 5:00 AM

Book Assignment 1: "Atomic Habits"
├── Delivery Time: 05:00:00
└── Status: currently_reading
→ ✅ ELIGIBLE (hour matches)

Book Assignment 2: "Deep Work"
├── Delivery Time: 17:00:00
└── Status: currently_reading
→ ❌ NOT ELIGIBLE (wrong hour)

Result: 1 email sent (Atomic Habits)
```

### Scenario 2: Two Books at Same Time
```
13:00 UTC → Check Time
User: jane@example.com (timezone: 'Europe/London')
Local time: 13:00

Book Assignment 1: "Atomic Habits"
├── Delivery Time: 13:00:00
└── Status: currently_reading
→ ✅ ELIGIBLE

Book Assignment 2: "Deep Work"
├── Delivery Time: 13:00:00
└── Status: currently_reading
→ ✅ ELIGIBLE

Result: 2 emails sent (both books)
```

### Scenario 3: Queued Book (Not Sent)
```
8:00 UTC → Check Time
User: alex@example.com (timezone: 'Europe/Madrid')
Local time: 10:00

Book Assignment 1: "Atomic Habits"
├── Delivery Time: 10:00:00
└── Status: queued
→ ❌ NOT ELIGIBLE (wrong status)

Only books with status='currently_reading' receive emails
```

## Database Query Examples

### View All Scheduled Deliveries
```sql
SELECT 
  u.email,
  b.title,
  ub.status,
  ubdt.delivery_time,
  ub.last_lesson_sent,
  (SELECT COUNT(*) FROM lessons WHERE book_id = b.id) as total_lessons
FROM user_book_delivery_times ubdt
JOIN user_books ub ON ubdt.user_book_id = ub.id
JOIN users u ON ub.user_id = u.id
JOIN books b ON ub.book_id = b.id
WHERE ub.status = 'currently_reading'
ORDER BY u.email, ubdt.delivery_time;
```

### Check Eligibility for Specific Time
```sql
-- Test what would be sent at 9:00 AM EST
SELECT * FROM get_eligible_books_for_delivery('2025-10-16 14:00:00+00'::timestamptz);
-- (14:00 UTC = 9:00 AM EST)
```

### Find Books With Multiple Daily Deliveries
```sql
SELECT 
  u.email,
  b.title,
  COUNT(ubdt.id) as deliveries_per_day,
  ARRAY_AGG(ubdt.delivery_time ORDER BY ubdt.delivery_time) as times
FROM user_book_delivery_times ubdt
JOIN user_books ub ON ubdt.user_book_id = ub.id
JOIN users u ON ub.user_id = u.id
JOIN books b ON ub.book_id = b.id
GROUP BY u.email, b.title
HAVING COUNT(ubdt.id) > 1
ORDER BY deliveries_per_day DESC;
```

## Performance Considerations

### Indexes Required
```sql
-- For efficient scheduler queries
CREATE INDEX idx_user_book_delivery_times_lookup 
ON user_book_delivery_times(user_book_id, delivery_time);

-- For status filtering
CREATE INDEX idx_user_books_status 
ON user_books(status) WHERE status = 'currently_reading';
```

### Query Optimization
- The `get_eligible_books_for_delivery` function uses indexed lookups
- Single query returns all eligible books (no N+1 problem)
- Timezone conversion done at database level (efficient)

### Scalability
- **100 users × 4 books × 2 times/day = 800 potential daily emails**
- Each hourly cron checks ~33 deliveries on average
- Query execution: < 100ms for thousands of book assignments

## Admin UI Integration

### Viewing Delivery Times
The dashboard displays book-specific times as blue pills:

```typescript
// /users/[id]/page.tsx
{a.deliveryTimes && a.deliveryTimes.length > 0 ? (
  <div className="flex flex-wrap gap-1">
    {a.deliveryTimes.map(time => (
      <span key={time} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
        {formatDeliveryTime(time)}
      </span>
    ))}
  </div>
) : (
  <div className="text-sm opacity-60">No delivery times set</div>
)}
```

### Editing Delivery Times
```typescript
// lib/supabaseDb.ts
export async function setUserBookDeliveryTimes(
  userBookId: string,
  times: string[]
): Promise<void> {
  // Delete existing times
  await supabase
    .from('user_book_delivery_times')
    .delete()
    .eq('user_book_id', userBookId)
  
  // Insert new times
  if (times.length > 0) {
    const records = times.map(time => ({
      user_book_id: userBookId,
      delivery_time: time
    }))
    await supabase
      .from('user_book_delivery_times')
      .insert(records)
  }
}
```

## Testing the Scheduler

### Manual Test
1. Set a book to `status = 'currently_reading'`
2. Set delivery time to current hour in user's timezone
3. Run scheduler manually: `/api/cron/email-scheduler`
4. Check `email_logs` table for delivery record

### Automated Test
```typescript
// Test eligibility function
const testTime = '2025-10-16 14:00:00+00' // 9 AM EST
const { data } = await supabase.rpc('get_eligible_books_for_delivery', {
  check_time: testTime
})

console.log('Eligible books:', data?.filter(b => b.is_eligible))
```

## Migration from User-Based Scheduling

### Before (User-Based)
```
User → user_delivery_times → [09:00, 17:00]
└── All books use these times
```

### After (Book-Based)
```
User
├── Book 1 → user_book_delivery_times → [08:00]
├── Book 2 → user_book_delivery_times → [12:00, 20:00]
└── Book 3 → user_book_delivery_times → [18:00]
```

**Key Changes:**
- Scheduler now queries `user_book_delivery_times` instead of `user_delivery_times`
- Each book assignment evaluated independently
- Progress tracked per book in `user_books.last_lesson_sent`
- Status filter ensures only active books receive lessons

## Related Documentation

- [User Book Delivery Times Schema](./schemas/user_book_delivery_times_schema.md) - Table structure
- [Scheduler Overview](./scheduler_overview.md) - High-level system design
- [Scheduler Architecture](./scheduler_architecture.md) - Technical implementation details

