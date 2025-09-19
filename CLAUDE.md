# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev        # Start development server on port 3002 with Turbopack
npm run build      # Build for production using Turbopack
npm run start      # Run production server
npm run lint       # Run ESLint
```

### Testing Database Connection
Visit `/test` to verify Supabase connectivity and view environment status.

### Environment Setup
Create a `.env` file with:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com
CRON_SECRET=your-optional-cron-secret
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Email**: Resend API for automated lesson delivery
- **Scheduler**: Vercel Cron jobs (hourly execution)

### Key Design Patterns

1. **Database Abstraction Layer** (`lib/supabaseDb.ts`)
   - All Supabase operations centralized in one module
   - Consistent error handling and data transformation
   - Domain types (`types/domain.ts`) separate from database schema

2. **Email Scheduling System**
   - Vercel Cron triggers hourly (`/api/cron/email-scheduler`)
   - Database functions identify eligible users based on timezone
   - Progress tracking consolidated in `user_books` table
   - Full audit trail in `scheduler_runs` and `email_logs` tables

3. **Progress Tracking**
   - Consolidated into `user_books` table (no separate `user_progress`)
   - Tracks `last_lesson_sent` and `progress_updated_at` per book assignment
   - Automatic initialization when books are assigned

### Database Schema

Key tables and their relationships:
- `users` → `user_books` → `books` → `lessons`
- `users` → `user_delivery_times` (preferred email times)
- `scheduler_runs` and `email_logs` (audit trail)
- `books_with_totals` (view with computed lesson counts)

### API Routes Structure

- `/api/cron/email-scheduler` - Main scheduler endpoint (GET/POST)
- `/api/debug/*` - Debug tools for testing scheduler, emails, and logs

### Important Implementation Notes

1. **TypeScript Configuration**
   - Build errors and lint errors are ignored in production (`next.config.ts`)
   - Strict mode enabled but not enforced during builds

2. **Supabase Integration**
   - Service role key required for server-side operations (email scheduler)
   - Anon key used for client-side operations with RLS policies

3. **Email Delivery Logic**
   - Users must have assigned books and set delivery times
   - Default delivery time is 9 AM if not specified
   - Scheduler respects user timezone for delivery timing

4. **Debug Tools**
   - `/debug/scheduling-simulations` - Test scheduler with specific times/timezones
   - `/debug/scheduled-email-timeline` - View scheduler run history
   - Manual trigger available via debug UI

## Common Development Tasks

### Adding New Features
1. Define types in `types/domain.ts`
2. Add database operations to `lib/supabaseDb.ts`
3. Create UI components in appropriate `app/(dashboard)/` directory
4. Follow existing patterns for error handling and loading states

### Debugging Email Scheduler
1. Check `/debug/scheduler/` for simulation tools
2. View logs in `scheduler_runs` and `email_logs` tables
3. Test manual triggers via debug UI
4. Verify user eligibility with database functions

### Database Migrations
- Schema changes should maintain backward compatibility
- Update `lib/supabaseDb.ts` with new operations
- Document schema changes in `docs/schemas/`