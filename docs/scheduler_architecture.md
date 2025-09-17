# Email Scheduler Technical Architecture

## System Architecture Overview

The BookMail email scheduler is built on a modern serverless architecture using Supabase as the backend platform. The system leverages PostgreSQL for data storage, Edge Functions for execution logic, and pg_cron for scheduling.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin UI      │    │   Debug Panel    │    │   User Data     │
│  (Next.js)      │    │   (Next.js)      │    │   Management    │
└─────────┬───────┘    └─────────┬────────┘    └─────────────────┘
          │                      │                       │
          └──────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │      API Routes          │
                    │   (Next.js API)          │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │   Supabase Client        │
                    │   (Authentication)       │
                    └────────────┬─────────────┘
                                 │
    ┌────────────────────────────┼────────────────────────────┐
    │                    Supabase Backend                     │
    │                                                         │
    │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
    │  │ PostgreSQL  │  │ Edge         │  │ pg_cron        │ │
    │  │ Database    │  │ Functions    │  │ Scheduler      │ │
    │  │             │  │              │  │                │ │
    │  │ • Tables    │  │ • Scheduler  │  │ • Hourly Runs  │ │
    │  │ • Functions │  │ • Test       │  │ • Triggers     │ │
    │  │ • RLS       │  │ • Debug      │  │ • Monitoring   │ │
    │  └─────────────┘  └──────────────┘  └────────────────┘ │
    └─────────────────────────────────────────────────────────┘
```

## Database Layer

### Core Tables Schema

#### `users`
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  timezone text NOT NULL,           -- IANA timezone (e.g., 'America/New_York')
  created_at timestamptz DEFAULT now()
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
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, book_id),
  UNIQUE(user_id, order_index)
);
```

#### `user_progress`
```sql
CREATE TABLE user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  book_id uuid REFERENCES books(id) ON DELETE CASCADE,
  last_lesson_sent integer DEFAULT 0,  -- Last day_number sent
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, book_id)
);
```

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
    COALESCE(up.last_lesson_sent, 0) as current_progress,
    (SELECT COUNT(*)::int FROM lessons WHERE lessons.book_id = l.book_id) as total_lessons,
    -- Should send if we haven't completed all lessons
    (COALESCE(up.last_lesson_sent, 0) + 1) <= (SELECT COUNT(*) FROM lessons WHERE lessons.book_id = l.book_id) as should_send
  FROM user_books ub
  JOIN books b ON ub.book_id = b.id
  LEFT JOIN user_progress up ON up.user_id = ub.user_id AND up.book_id = ub.book_id
  LEFT JOIN lessons l ON l.book_id = ub.book_id AND l.day_number = (COALESCE(up.last_lesson_sent, 0) + 1)
  WHERE ub.user_id = p_user_id
  ORDER BY ub.order_index
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

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

### Edge Functions Architecture

#### `email-scheduler` (Primary Function)
**Location**: `supabase/functions/email-scheduler/index.ts`

**Execution Flow**:
1. **Initialize**: Create run ID and timestamp
2. **Find Eligible Users**: Call `get_eligible_users_for_delivery(now())`
3. **Process Each User**:
   - Call `get_next_lesson_for_user(user_id)`
   - Check if `should_send` is true
   - Log decision to `email_logs` table
   - (Future: Send email via Resend API)
4. **Return Summary**: Count of eligible users, decisions made

**Triggered By**: pg_cron hourly job

**Key Code Structure**:
```typescript
serve(async (req) => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const checkTime = new Date().toISOString()
  const runId = crypto.randomUUID()
  
  // Get eligible users
  const { data: eligibleUsers } = await supabase
    .rpc('get_eligible_users_for_delivery', { check_time: checkTime })
  
  // Process each eligible user
  for (const user of eligibleUsers?.filter(u => u.is_eligible) || []) {
    const { data: lessonData } = await supabase
      .rpc('get_next_lesson_for_user', { p_user_id: user.user_id })
    
    if (lesson && lesson.should_send) {
      // Log scheduling decision
      await supabase.from('email_logs').insert({
        user_id: user.user_id,
        lesson_id: lesson.lesson_id,
        status: 'scheduled',
        schedule_run_id: runId,
        scheduled_for: checkTime,
        delivery_reason: 'scheduled'
      })
    }
  }
})
```

#### `test-scheduler` (Debug Function)
**Location**: `supabase/functions/test-scheduler/index.ts`

**Purpose**: Manual testing and simulation with custom timestamps

**Features**:
- Accepts custom `check_time` parameter
- Simulation mode (doesn't write to database)
- Enhanced logging for debugging
- Used by debug panel for real-time testing

### Cron Job Configuration

#### pg_cron Setup
```sql
-- Schedule hourly execution
SELECT cron.schedule(
  'email-scheduler',
  '0 * * * *',  -- Every hour at minute 0
  $$
    SELECT net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/email-scheduler',
      headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb
    );
  $$
);
```

#### Monitoring Cron Jobs
```sql
-- Check cron job status
SELECT * FROM cron.job WHERE jobname = 'email-scheduler';

-- View cron job run history
SELECT * FROM cron.job_run_details WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'email-scheduler'
) ORDER BY start_time DESC LIMIT 10;
```

## Frontend Integration Layer

### Next.js API Routes

#### Debug Panel APIs
**`/api/debug/scheduler/run`**: Manual scheduler execution
```typescript
export async function POST() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/email-scheduler`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  })
  return NextResponse.json(await response.json())
}
```

**`/api/debug/scheduler/simulate`**: Time simulation testing
```typescript
export async function POST(request: Request) {
  const { test_time, timezone } = await request.json()
  const testTimestamp = convertTimeInTimezoneToUTC(test_time, timezone)
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/test-scheduler`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      check_time: testTimestamp,
      simulate: true
    })
  })
  return NextResponse.json(await response.json())
}
```

### Timezone Conversion Logic

#### Core Conversion Function
**Location**: `lib/timezone.ts`

**Purpose**: Convert user input time + timezone to accurate UTC timestamp

**Algorithm**:
1. Parse input time (HH:MM format)
2. Create initial UTC guess
3. Check what local time this produces in target timezone
4. Calculate difference and adjust UTC time
5. Return accurate UTC timestamp

**Key Challenge Solved**: Daylight saving time and timezone offset handling

```typescript
export function convertTimeInTimezoneToUTC(timeString: string, timezone: string): string {
  // Create initial UTC time guess
  let testUTC = new Date(`${dateStr}T${timeStr}Z`)
  
  // Check what local time this produces
  let localTimeStr = testUTC.toLocaleString('sv-SE', { 
    timeZone: timezone,
    hour12: false
  })
  
  // Adjust if it doesn't match target
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

### Debug Panel Data Flow
```
1. User inputs time + timezone → 2. convertTimeInTimezoneToUTC()
                                      ↓
3. API call to test-scheduler with UTC timestamp
                                      ↓
4. Same logic as hourly execution but with custom time
                                      ↓
5. Return results to UI with conversion details
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
