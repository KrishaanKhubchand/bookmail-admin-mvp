# BookMail Admin MVP

Admin dashboard for managing email-based book lessons. Users are assigned books that are delivered as daily emails. This project implements the core workflows for user management, book assignment, and progress tracking.

## Getting Started

### Prerequisites
- Node.js 18+ 
- A Supabase project

### Environment Setup
Create a `.env` file with your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Get these values from your Supabase project:
- **URL**: Project Settings → General → Reference ID
- **Anon Key**: Project Settings → API → Project API keys → anon/public

### Installation & Development

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app redirects to `/users`.

### Database Setup
The app expects these Supabase tables with RLS enabled:
- `users` - User accounts with email and timezone
- `books` - Available books with author and description  
- `lessons` - Book content divided into daily lessons
- `user_books` - Book assignments with ordering
- `user_progress` - Lesson delivery tracking
- `user_delivery_times` - User preferred email delivery times
- `books_with_totals` - View with computed lesson counts

See `docs/schemas/` for detailed table schemas.

## Email Scheduler System

The app includes an automated email scheduling system that delivers book lessons to users at their preferred times.

### Current Architecture (Vercel Cron)
- **Scheduler**: Vercel Cron job running hourly (`0 * * * *`)
- **Endpoint**: `/api/cron/email-scheduler` (Next.js API route)
- **Database**: PostgreSQL with timezone-aware functions
- **Email Service**: Resend API
- **Logging**: Full audit trail in `scheduler_runs` and `email_logs` tables

### How It Works
1. **Every hour**, Vercel triggers the cron job
2. **Database function** finds users whose local delivery time matches the current hour
3. **For each eligible user**: Fetches next lesson, sends email, updates progress
4. **Everything is logged** for monitoring and debugging

### Testing & Debugging
- **Debug UI**: `/debug/scheduling-simulations` - Test specific times/timezones
- **Manual trigger**: Use "Test Vercel Cron" button in debug UI
- **Logs**: View scheduler runs at `/debug/scheduled-email-timeline`
- **Database**: Check `scheduler_runs` table for execution history

## Documentation

### Email Scheduler System
- **[Scheduler Overview](docs/scheduler_overview.md)** - High-level overview of the automated email scheduling system
- **[Scheduler Architecture](docs/scheduler_architecture.md)** - Technical architecture and implementation details

### Database Schema
- **[Schema Documentation](docs/schemas/)** - Detailed schema documentation for all tables and views

## Features

### Current (Phase 3)
- **Users Management**: Create users, view list with progress indicators
- **Book Assignment**: Assign multiple books to users in specific order
- **Progress Tracking**: View lesson delivery progress per user
- **Delivery Time Management**: Set multiple preferred delivery times per user
- **Book Library**: Browse available books and preview lessons
- **Live Database**: All data persisted to Supabase with real-time updates

### User Flows
1. **Add User**: Email + timezone → creates account
2. **Assign Books**: Select books for user → sets reading order → initializes progress
3. **Set Delivery Times**: Choose preferred times for email delivery (defaults to 9 AM if not set)
4. **View Progress**: Shows current book, lessons sent, next lesson number
5. **Browse Books**: View available content and lesson previews
6. **Test Scheduler**: Use debug panel to test email scheduling with different times and timezones

## Architecture

### Tech Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Row Level Security)
- **Domain Types**: `types/domain.ts`
- **Database Layer**: `lib/supabaseDb.ts`
- **Utilities**: `lib/time.ts`, `lib/timezone.ts`
- **Email Scheduler**: Automated daily lesson delivery via Supabase Edge Functions and pg_cron

### Key Components
- **Dashboard Layout**: `app/(dashboard)/layout.tsx`
- **Users Management**: `app/(dashboard)/users/`
- **Books Library**: `app/(dashboard)/books/`
- **Scheduler Debug Panel**: `app/(dashboard)/debug/scheduler/`
- **Connection Test**: `app/(dashboard)/test/`

### Database Integration
- **Supabase Client**: `lib/supabase.ts` with environment validation
- **CRUD Operations**: `lib/supabaseDb.ts` with error handling
- **RLS Policies**: Public read/write for admin operations (anon key)

## Development Notes

### Testing Database Connection
Visit `/test` to verify Supabase connectivity and view environment status.

### Error Handling
- User-friendly error messages (no browser alerts)
- Loading states for all async operations
- Graceful fallbacks for failed operations

### Data Model
- Users have timezone for delivery scheduling
- Books are assigned in specific order (1, 2, 3...)
- Progress tracks lessons sent for current book
- Lessons are numbered by day within each book

## Next Steps (Future Phases)

- **Phase 4**: Email delivery scheduler using Resend
- **Phase 5**: User authentication and self-service portal
- **Phase 6**: Analytics and engagement tracking

## Project Documentation

- `docs/spec1.md` - Original project specification
- `docs/phase1_spec.md` - Phase 1 (frontend-only) requirements  
- `docs/phase2_spec.md` - Phase 2 (Supabase integration) requirements
- `docs/phase3_spec.md` - Phase 3 (database connection) requirements
- `docs/schemas/` - Database table documentation
