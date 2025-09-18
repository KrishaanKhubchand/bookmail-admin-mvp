# Scheduler Runs Table Schema

Records every execution of the email scheduler, providing complete audit trail and performance metrics.

## Core Identification Fields

**id (uuid)**: Primary key. Unique identifier for each scheduler run.

**run_id (uuid)**: Unique run identifier. Links to `email_logs.schedule_run_id` to connect individual emails to their scheduler run.

**timestamp (timestamptz)**: When the scheduler run started.

## Source Tracking

**trigger_source (text)**: What triggered this scheduler run. One of:
- `github_actions` - Hourly GitHub Actions cron job
- `vercel_cron` - Legacy Vercel cron (deprecated)
- `manual` - Manual trigger via API
- `test` - Test scheduler function

## Execution Metrics

**eligible_users (integer)**: Number of users who matched delivery time criteria.

**emails_sent (integer)**: Number of emails successfully sent during this run.

**emails_failed (integer)**: Number of failed email attempts during this run.

**emails_completed (integer)**: Number of users who have finished all lessons for their books.

**emails_no_content (integer)**: Number of users who had no lesson data available.

## Status & Performance

**status (text)**: Current status of the run. One of:
- `running` - Scheduler is currently executing
- `completed` - Run finished successfully
- `failed` - Run encountered a fatal error

**error (text, nullable)**: Any scheduler-level error messages.

**execution_time_ms (integer, nullable)**: Total runtime in milliseconds.

## Audit Fields

**created_at (timestamptz)**: When the record was created.

**updated_at (timestamptz)**: When the record was last updated.

## Relationships

- **Links to**: `email_logs` via `run_id = schedule_run_id`
- **Parent of**: Multiple email_logs entries for the same scheduler execution

## Indexes & Performance

- **Primary lookup**: B-tree on `timestamp DESC` for recent runs
- **Run linking**: Unique index on `run_id` for email_logs joins
- **Status filtering**: B-tree on `status`
- **Source filtering**: B-tree on `trigger_source`

## Row Level Security

RLS is enabled. Access is controlled via service role for backend operations.

## Usage Examples

```sql
-- Get recent scheduler runs with email counts
SELECT 
  timestamp,
  trigger_source,
  eligible_users,
  emails_sent,
  emails_failed,
  execution_time_ms
FROM scheduler_runs 
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Get all emails for a specific scheduler run
SELECT sr.*, el.*
FROM scheduler_runs sr
LEFT JOIN email_logs el ON sr.run_id = el.schedule_run_id
WHERE sr.run_id = 'specific-run-id';
```
