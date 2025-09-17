# Email Scheduler System Overview

## What It Does

The BookMail email scheduler is an automated system that delivers daily book lessons to users via email. It respects individual user preferences for delivery timing and timezone, tracks reading progress, and manages multi-book sequences.

### Core Functionality

- **Automated Daily Delivery**: Sends one lesson per day at user-specified times
- **Timezone-Aware Scheduling**: Converts user local times to UTC for accurate delivery
- **Progress Tracking**: Automatically advances users through lessons and books
- **Multi-Book Sequences**: Handles ordered book assignments per user
- **Comprehensive Logging**: Tracks all delivery attempts and outcomes

## How It Works

### 1. User Setup
- Admin creates users with email and timezone (e.g., `America/New_York`, `Europe/London`)
- Users can set multiple preferred delivery times (e.g., 9:00 AM, 6:00 PM)
- Admin assigns books to users in a specific sequence

### 2. Content Structure
- **Books** contain multiple **Lessons** in day-number sequence
- Each lesson has subject, HTML content, and day number
- Users progress through lessons sequentially within each book
- After completing one book, the system advances to the next assigned book

### 3. Scheduling Logic
The scheduler runs every hour and follows this process:

1. **Find Eligible Users**: Checks all users with delivery times matching the current hour
2. **Determine Next Lesson**: For each eligible user, finds their next unread lesson
3. **Log Scheduling Decision**: Records whether a lesson will be sent or user is completed
4. **Send Email**: (Future enhancement - currently logs only)

### 4. Eligibility Criteria
A user is eligible for a lesson if:
- Their local time matches one of their preferred delivery times
- They have books assigned
- They have unread lessons in their current book
- They haven't already received a lesson today

## Key Components

### Database Layer
- **Users Table**: Stores user email, timezone, and metadata
- **User Delivery Times**: Multiple preferred send times per user
- **Books & Lessons**: Content structure and sequencing
- **User Books**: Book assignments and ordering
- **User Progress**: Tracks last lesson sent per book
- **Email Logs**: Complete history of scheduling decisions

### Execution Layer
- **Supabase Edge Functions**: Serverless functions for scheduler logic
- **PostgreSQL Functions**: Database-level eligibility and lesson lookup
- **pg_cron**: Hourly job scheduling within Supabase
- **Timezone Conversion**: Accurate local-to-UTC time handling

### Management Layer
- **Admin Dashboard**: User and book management interface
- **Debug Panel**: Real-time testing and monitoring tools
- **System Status**: Health checks and performance metrics

## User Journey Example

### Setup Phase
1. Admin creates user: `john@example.com` in `America/New_York` timezone
2. User sets delivery preferences: `09:00` (9 AM) and `18:00` (6 PM)
3. Admin assigns books: "Atomic Habits" (1st), "Deep Work" (2nd)

### Daily Execution
- **9:00 AM NYC** (13:00 UTC): Scheduler finds John eligible
- **First day**: Sends "Atomic Habits - Day 1"
- **Second day**: Sends "Atomic Habits - Day 2"
- **...continues daily...**
- **Day 8**: "Atomic Habits" complete, starts "Deep Work - Day 1"

### Progress Tracking
- System maintains `user_progress` record for each book
- Tracks `last_lesson_sent` to know next lesson to deliver
- Handles book transitions automatically
- Logs all decisions for audit and debugging

## Benefits

### For Users
- **Consistent Learning**: Daily lessons delivered reliably
- **Timezone Respect**: Emails arrive at preferred local times
- **Flexible Scheduling**: Multiple delivery time options
- **Automatic Progression**: No manual intervention needed

### For Administrators
- **Simple Setup**: Assign books and users manage their own timing
- **Progress Visibility**: Track user advancement through content
- **Reliable Delivery**: Automated system with comprehensive logging
- **Easy Debugging**: Debug panel for testing and monitoring

### For Developers
- **Modular Architecture**: Clean separation of concerns
- **Testable Components**: Debug panel for real-time testing
- **Comprehensive Logging**: Full audit trail of system behavior
- **Scalable Design**: Handles multiple users and timezones efficiently

## Current Status

### Production Ready Features
- ✅ Hourly automated scheduling via pg_cron
- ✅ Timezone-aware delivery time matching
- ✅ Multi-book sequence management
- ✅ Progress tracking and lesson advancement
- ✅ Comprehensive logging and audit trail
- ✅ Debug panel for testing and monitoring
- ✅ Admin dashboard for user/book management

### Future Enhancements
- 🔄 Email delivery integration (Resend API)
- 🔄 User-facing unsubscribe/preference management
- 🔄 Analytics dashboard and reporting
- 🔄 A/B testing for send times
- 🔄 Smart retry logic for failed deliveries

## Testing and Monitoring

### Debug Panel Features
- **Manual Execution**: Test scheduler immediately without waiting for cron
- **Time Simulation**: Test specific times and timezones
- **UTC Conversion Preview**: Verify timezone calculations
- **System Status**: Monitor user counts and health metrics
- **Recent Logs**: View past scheduler execution results

### Health Monitoring
- Track eligible users per execution
- Monitor delivery success rates
- Alert on system failures
- Performance metrics and optimization

The scheduler system provides a robust foundation for automated, personalized email course delivery with strong timezone handling and comprehensive tracking capabilities.
