# Email Scheduler Technical Architecture

## System Architecture Overview

The BookMail email scheduler is built on a modern serverless architecture using Vercel Cron for scheduling and Next.js API routes for execution logic, with Supabase PostgreSQL for data storage and timezone-aware processing.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin UI      │    │   Debug Panel    │    │   User Data     │
│  (Next.js)      │    │   (Next.js)      │    │   Management    │
└─────────┬───────┘    └─────────┬────────┘    └─────────────────┘
          │                      │                       │
          └──────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │      Next.js API         │
                    │   /api/cron/email-       │
                    │     scheduler            │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │   Supabase Client        │
                    │   (Service Role)         │
                    └────────────┬─────────────┘
                                 │
    ┌────────────────────────────┼────────────────────────────┐
    │                  Supabase PostgreSQL                    │
    │                                                         │
    │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
    │  │   Tables    │  │   Functions  │  │     Views      │ │
    │  │             │  │              │  │                │ │
    │  │ • users     │  │ • timezone   │  │ • audit logs   │ │
    │  │ • lessons   │  │   logic      │  │ • progress     │ │
    │  │ • logs      │  │ • eligibility│  │ • reporting    │ │
    │  └─────────────┘  └──────────────┘  └────────────────┘ │
    └─────────────────────────────────────────────────────────┘
                                 ▲
                    ┌────────────┴─────────────┐
                    │     Vercel Cron          │
                    │   Schedule: 0 * * * *    │
                    │   (Every hour at :00)    │
                    └──────────────────────────┘
```

## Database Layer

### Core Tables Schema

#### `users`
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  timezone text,                    -- IANA timezone (e.g., 'America/New_York')
  created_at timestamptz DEFAULT now(),
  reading_capacity integer DEFAULT 1,  -- 1-4 books simultaneously (future feature)
  subscription_status text DEFAULT 'free',  -- 'free', 'premium', etc.
  subscription_current_period_end timestamptz,
  stripe_customer_id text
);
```

#### `user_delivery_times`
```sql
CREATE TABLE user_delivery_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  delivery_time time NOT NULL,      -- HH:MM:SS format (e.g., '09:00:00')
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, delivery_time)
);
```

#### `books`
```sql
CREATE TABLE books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  description text,
  book_cover_image_url text,        -- URL to book cover image
  created_at timestamptz DEFAULT now()
);
```

#### `lessons`
```sql
CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES books(id) ON DELETE CASCADE,
  day_number integer NOT NULL,      -- Sequence within book (1, 2, 3...)
  subject text NOT NULL,
  body_html text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(book_id, day_number)
);
```

#### `user_books`
```sql
CREATE TABLE user_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  book_id uuid REFERENCES books(id) ON DELETE CASCADE,
  order_index integer NOT NULL,     -- Book sequence for user (1, 2, 3...)
  last_lesson_sent integer DEFAULT 0,  -- Progress tracking: last day number sent
  progress_updated_at timestamptz DEFAULT now(),
  assigned_at timestamptz DEFAULT now(),
  status text DEFAULT 'queued',     -- 'queued', 'currently_reading', 'completed'
  started_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, book_id),
  UNIQUE(user_id, order_index)
);
```
Note: Progress tracking was consolidated into this table from the deprecated `user_progress` table.

#### `email_logs`
```sql
CREATE TABLE email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id),
  status text NOT NULL,             -- 'scheduled', 'sent', 'failed'
  schedule_run_id uuid,             -- Links logs from same scheduler run
  scheduled_for timestamptz,        -- When this was scheduled
  delivery_reason text,             -- 'scheduled', 'manual', 'test'
  created_at timestamptz DEFAULT now()
);
```

### Database Functions

#### `get_eligible_users_for_delivery(check_time timestamptz)`
```sql
CREATE OR REPLACE FUNCTION get_eligible_users_for_delivery(check_time timestamptz)
RETURNS TABLE (
  user_id uuid,
  user_email text,
  user_timezone text,
  delivery_time time,
  local_time timestamptz,
  is_eligible boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    u.timezone,
    udt.delivery_time,
    (check_time AT TIME ZONE u.timezone)::timestamptz AS local_time,
    -- Check if current hour:minute matches delivery time
    EXTRACT(HOUR FROM (check_time AT TIME ZONE u.timezone))::int = EXTRACT(HOUR FROM udt.delivery_time)::int
    AND EXTRACT(MINUTE FROM (check_time AT TIME ZONE u.timezone))::int = EXTRACT(MINUTE FROM udt.delivery_time)::int
    AS is_eligible
  FROM users u
  JOIN user_delivery_times udt ON u.id = udt.user_id;
END;
$$ LANGUAGE plpgsql;
```

#### `get_next_lesson_for_user(p_user_id uuid)`
```sql
CREATE OR REPLACE FUNCTION get_next_lesson_for_user(p_user_id uuid)
RETURNS TABLE (
  lesson_id uuid,
  book_id uuid,
  book_title text,
  lesson_day_number int,
  lesson_subject text,
  current_progress int,
  total_lessons int,
  should_send boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.book_id,
    b.title,
    l.day_number,
    l.subject,
    COALESCE(ub.last_lesson_sent, 0) as current_progress,
    (SELECT COUNT(*)::int FROM lessons WHERE lessons.book_id = l.book_id) as total_lessons,
    -- Should send if we haven't completed all lessons
    (COALESCE(ub.last_lesson_sent, 0) + 1) <= (SELECT COUNT(*) FROM lessons WHERE lessons.book_id = l.book_id) as should_send
  FROM user_books ub
  JOIN books b ON ub.book_id = b.id
  LEFT JOIN lessons l ON l.book_id = ub.book_id AND l.day_number = (COALESCE(ub.last_lesson_sent, 0) + 1)
  WHERE ub.user_id = p_user_id
  ORDER BY ub.order_index
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```
Note: Progress is now tracked in `user_books.last_lesson_sent` instead of a separate `user_progress` table.

### Views

#### `books_with_totals`
```sql
CREATE VIEW books_with_totals AS
SELECT 
  b.*,
  COUNT(l.id) as total_lessons
FROM books b
LEFT JOIN lessons l ON b.id = l.book_id
GROUP BY b.id, b.title, b.author, b.description, b.created_at;
```

## Execution Layer

### Current Architecture: Vercel Cron + Next.js API

#### Primary Scheduler: `/api/cron/email-scheduler`
**Location**: `app/api/cron/email-scheduler/route.ts`

**Triggered By**: Vercel Cron (hourly: `0 * * * *`)

**Execution Flow**:
1. **Initialize**: Create run ID and timestamp
2. **Log Start**: Insert into `scheduler_runs` table with status 'running'
3. **Find Eligible Users**: Call `get_eligible_users_for_delivery(now())`
4. **Process Each User**:
   - Call `get_next_lesson_for_user(user_id)`
   - Check if `should_send` is true
   - Send email via Resend API
   - Log result to `email_logs` table
   - Update `user_progress` table
5. **Log Completion**: Update `scheduler_runs` with final statistics
6. **Return Summary**: Count of eligible users, emails sent, errors

**Key Features**:
- Uses service role key for full database access
- Handles both GET (Vercel cron) and POST (manual testing) requests
- Full TypeScript integration with existing codebase
- Comprehensive error handling and logging

**Environment Variables Required**:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=your_verified_sender_email
```

**Vercel Configuration** (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/cron/email-scheduler",
    "schedule": "0 * * * *"
  }]
}
```

### Testing & Debug Tools

#### Manual Testing API: `/api/debug/scheduler/test-vercel`
**Purpose**: Manual trigger for testing the Vercel Cron endpoint

#### Debug UI: `/debug/scheduling-simulations`
**Features**:
- Test Vercel Cron button
- Timezone-specific simulations
- Real-time testing without affecting production

#### Monitoring: `/debug/scheduled-email-timeline`
**Features**:
- View recent scheduler runs
- Filter by trigger source (`vercel_cron`)
- Execution statistics and performance metrics

---

## Deprecated Approaches

### ⚠️ GitHub Actions + Edge Functions (Deprecated)

**Previous Architecture**:
- GitHub Actions cron → Supabase Edge Function → Database
- **Status**: Removed as of September 2025
- **Location**: `.github/workflows/email-scheduler.yml` (removed)
- **Edge Function**: `supabase-functions/email-scheduler/` (removed)

**Issues that led to migration**:
- Edge Function environment complexity
- Silent failures difficult to debug
- Separate deployment pipeline from main app
- Limited TypeScript integration

**Migration Path**: Use Vercel Cron approach above

### ⚠️ pg_cron Database Scheduling (Considered but not implemented)

**Approach**: PostgreSQL native cron jobs
- **Status**: Evaluated but not implemented
- **Reason**: Limited HTTP capabilities for email sending

---

## Current Data Flow

### Hourly Execution Data Flow (Current - Vercel Cron)
```
1. Vercel Cron triggers → 2. /api/cron/email-scheduler
                               ↓
3. get_eligible_users_for_delivery(current_time)
   ↓
4. Filter users where is_eligible = true
   ↓
5. For each eligible user → get_next_lesson_for_user(user_id)
                              ↓
6. If lesson.should_send = true → Send email + Log to email_logs + Update progress
                                      ↓
7. Update scheduler_runs with final statistics
                                      ↓
8. Return summary (eligible count, sent count, errors, etc.)
```

### Debug Panel Data Flow
```
1. User clicks "Test Vercel Cron" → 2. Direct API call to /api/cron/email-scheduler
                                         ↓
3. Same execution flow as above but marked as manual trigger
                                         ↓
4. Return results to UI with test metadata
```

## Summary

The current email scheduler architecture provides:

- **Reliability**: Vercel Cron with native Next.js integration
- **Observability**: Full logging and audit trail in database
- **Testability**: Multiple testing approaches and debug interfaces  
- **Scalability**: Serverless execution with PostgreSQL timezone handling
- **Maintainability**: TypeScript codebase with shared libraries

The migration from Edge Functions to Vercel Cron has simplified deployment, improved debugging capabilities, and provided better integration with the main application codebase.
  // Test-scheduler functionality has been removed
  // All testing now uses the production Vercel API endpoint
    body: JSON.stringify({
      local_time: test_time,      // "09:00"
      target_timezone: timezone,  // "Europe/Paris"
      simulate: true
    })
  })
  return NextResponse.json(await response.json())
}
```

### Database-Centric Timezone Logic

#### Core Database Function
**Location**: Supabase Database

**Purpose**: Let PostgreSQL handle all timezone math directly

**Algorithm**:
1. Pass local time and timezone directly to database
2. PostgreSQL matches users in that timezone with that delivery time
3. No client-side timezone conversion needed!
4. Handles DST automatically and reliably

**Key Benefits**: Eliminates complex timezone conversion, uses PostgreSQL's proven timezone handling

```sql
CREATE OR REPLACE FUNCTION get_eligible_users_for_local_time(
  local_time time,
  target_timezone text
)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  WHERE u.timezone = target_timezone
    AND udt.delivery_time = local_time;
END;
$$;
  if (localTime !== timeString) {
    const diffMinutes = targetTotalMinutes - localTotalMinutes
    testUTC = new Date(testUTC.getTime() + (diffMinutes * 60 * 1000))
  }
  
  return testUTC.toISOString()
}
```

## Data Flow Architecture

### Hourly Execution Data Flow
```
1. pg_cron triggers → 2. email-scheduler Edge Function
                           ↓
3. get_eligible_users_for_delivery(current_time)
   ↓
4. Filter users where is_eligible = true
   ↓
5. For each eligible user → get_next_lesson_for_user(user_id)
                              ↓
6. If lesson.should_send = true → Insert into email_logs
                                      ↓
7. Return summary (eligible count, send count, etc.)
```

### Debug Panel Data Flow (Current)
```
1. User clicks "Run Scheduler Now" → 2. Direct API call to /api/cron/email-scheduler
                                         ↓
3. Same execution flow as production (current UTC time)
                                         ↓
4. Return results to UI with actual email sending
```

### User Management Data Flow
```
1. Admin creates user → users table
                         ↓
2. User sets delivery times → user_delivery_times table
                               ↓
3. Admin assigns books → user_books table (with order_index)
                          ↓
4. First lesson triggers → user_progress table initialization
                            ↓
5. Subsequent lessons → Update last_lesson_sent in user_progress
```

## Security and Permissions

### Row Level Security (RLS)
- **Public read access**: `books`, `lessons`, `users` (for admin dashboard)
- **Public read/write**: `user_delivery_times`, `user_books`, `email_logs`
- **Service role required**: Edge Functions, cron jobs

### Environment Variables
```bash
# Client-side (Next.js frontend)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Server-side (API routes, Edge Functions)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### API Key Usage
- **Anon key**: Frontend operations, basic CRUD
- **Service role key**: Scheduler execution, debug panel operations, bypasses RLS

## Performance and Scalability

### Database Optimizations
- **Indexes**: On `user_id`, `book_id`, `user_delivery_times.user_id`
- **Query optimization**: Database functions reduce client-server round trips
- **Connection pooling**: Supabase handles automatically

### Edge Function Performance
- **Cold start mitigation**: Functions stay warm with regular execution
- **Batch processing**: Single function call processes all eligible users
- **Timeout handling**: 60-second timeout for Edge Functions

### Monitoring and Observability
- **Email logs**: Complete audit trail of all scheduling decisions
- **Debug panel**: Real-time system health and status
- **Cron monitoring**: Built-in pg_cron logging and status

## Future Architecture Considerations

### Email Delivery Integration
- **Resend API**: Integration point in Edge Functions
- **Retry logic**: Failed delivery handling and rescheduling
- **Rate limiting**: Respect email provider limits

### Scaling Considerations
- **User volume**: Current architecture supports thousands of users
- **Lesson volume**: Database design handles large content libraries
- **Geographic distribution**: Supabase provides global edge locations

### Enhanced Monitoring
- **Metrics dashboard**: Success rates, delivery times, user engagement
- **Alerting**: Failed deliveries, system health issues
- **Analytics**: User behavior and content performance

This architecture provides a robust, scalable foundation for automated email course delivery with strong timezone handling, comprehensive logging, and excellent developer experience through the debug panel and monitoring tools.
