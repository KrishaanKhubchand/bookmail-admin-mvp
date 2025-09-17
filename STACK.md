# BookMail Admin MVP - Technology Stack

## Core Technologies

### Frontend Framework
- **Next.js 15.5.3** - React framework with App Router for client-side SPA functionality
- **React 19** - UI component library with hooks for state management
- **TypeScript** - Type-safe JavaScript for better developer experience and code reliability

### Styling
- **Tailwind CSS 4** - Utility-first CSS framework for rapid UI development
- **PostCSS** - CSS processing tool

### Database & Backend
- **Supabase** - Backend-as-a-Service providing:
  - PostgreSQL database with Row Level Security (RLS)
  - REST API with auto-generated endpoints
  - Real-time subscriptions (not yet utilized)
  - Authentication (future phase)
  - Edge Functions (future phase)

### Development Tools
- **ESLint** - Code linting and formatting
- **npm** - Package manager

## Architecture Overview

### Data Flow
```
Client Components → Supabase Client → PostgreSQL Database
     ↑                    ↑                    ↑
User Actions        lib/supabaseDb.ts    RLS Policies
```

### Current Implementation (Phase 3)
- **Client-side only**: All operations use `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **No authentication**: Public RLS policies allow anonymous operations
- **Admin dashboard**: Full CRUD operations for user and book management
- **Real-time updates**: UI refreshes after database operations

## Project Structure

```
project-beta/
├── app/
│   ├── (dashboard)/          # Route group for admin dashboard
│   │   ├── layout.tsx       # Shared navigation and layout
│   │   ├── users/           # User management pages
│   │   ├── books/           # Book library pages
│   │   └── test/            # Supabase connection testing
│   ├── globals.css          # Global styles and Tailwind imports
│   └── page.tsx             # Root redirect to /users
├── lib/
│   ├── supabase.ts          # Supabase client with env validation
│   ├── supabaseDb.ts        # Database operations and CRUD functions
│   ├── time.ts              # Timezone and date utilities
│   └── timezones.ts         # Common timezone definitions
├── types/
│   └── domain.ts            # TypeScript interfaces for data models
├── docs/
│   ├── schemas/             # Database table documentation
│   ├── spec1.md             # Original project specification
│   ├── phase1_spec.md       # Frontend-only requirements
│   ├── phase2_spec.md       # Supabase integration requirements
│   └── phase3_spec.md       # Database connection requirements
└── public/                  # Static assets
```

## Database Integration

### Supabase Client Configuration
- Environment validation with helpful error messages
- Centralized client in `lib/supabase.ts`
- Connection testing available at `/test` route

### Database Operations
- **CRUD functions**: `lib/supabaseDb.ts` provides typed operations
- **Error handling**: All operations include try/catch with user feedback
- **Data transformation**: Maps Supabase snake_case to domain camelCase
- **Relationship loading**: Uses joins for complex queries (books with totals, user assignments)

### Row Level Security
Current RLS policies allow public access for MVP:
- `books`, `lessons`: Public read access
- `users`: Public read/insert access
- `user_books`, `user_progress`: Public read/insert/update/delete access

## Development Workflow

### Environment Setup
```bash
# Required environment variables
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Development Commands
```bash
npm install          # Install dependencies
npm run dev         # Start development server (localhost:3000)
npm run build       # Build for production
npm run lint        # Run ESLint
```

### Testing Database Connection
Visit `/test` to verify:
- Environment variables are set correctly
- Supabase client can connect and authenticate
- Database contains expected tables and data

## Key Features (Current)

### User Management
- Create users with email and timezone selection
- View user list with progress indicators and assigned books
- Individual user detail pages with assignment interface

### Book Assignment
- Multi-select book assignment with drag-to-reorder
- Progress initialization for first assigned book
- Real-time UI updates after assignment changes

### Progress Tracking
- Lesson delivery progress per user
- Computed progress percentages
- Current book and next lesson display

### Error Handling
- User-friendly error messages (no browser alerts)
- Loading states for all async operations
- Environment validation with helpful setup instructions

## Data Model

### Core Entities
- **Users**: Email, timezone, creation timestamp
- **Books**: Title, author, description with computed lesson counts
- **Lessons**: Daily content with day numbers and HTML body
- **UserBooks**: Assignment relationships with ordering
- **UserProgress**: Lesson delivery tracking per user/book
- **UserDeliveryTimes**: Preferred email delivery times per user

### Relationships
- Users ↔ Books (many-to-many through UserBooks)
- Books → Lessons (one-to-many)
- Users → UserProgress (one-to-many)
- Users → UserDeliveryTimes (one-to-many)
- UserProgress → Books (many-to-one)

## Future Phases

### Phase 4: Email Delivery
- Resend integration for email sending
- Scheduled delivery based on user timezones
- Email template system

### Phase 5: Authentication & User Portal
- User authentication with Supabase Auth
- Self-service user portal
- Secure RLS policies

### Phase 6: Analytics & Engagement
- Email open/click tracking
- User engagement analytics
- A/B testing for content delivery