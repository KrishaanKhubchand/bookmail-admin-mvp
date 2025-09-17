📄 BookMail Admin MVP – Phase 4 
🎯 Goal

Automate lesson delivery using Supabase Scheduled Functions + Resend.

Support multiple delivery times per user.

At each eligible delivery time, the system sends the next lesson.

Progress is tracked + logged in Supabase.

🔑 Deliverables

Supabase Scheduled Function running hourly.

Database query that checks user’s timezone + all their delivery times.

Logic for selecting the correct next lesson.

Resend integration for sending the lesson.

Updates to user_progress after each send.

Logging of every send attempt in email_logs.