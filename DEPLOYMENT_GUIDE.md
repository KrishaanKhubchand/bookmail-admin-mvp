# 🚀 BookMail Phase 4C - Email Scheduler Deployment Guide

## 📋 Overview

This guide walks you through deploying the complete automated email delivery system with Resend integration.

## 🎯 What's Been Implemented

### ✅ **Frontend Dashboard (Ready to Use)**
- **Email Logs Dashboard**: `/debug/logs` - Monitor all email deliveries
- **Email Testing**: `/debug/email` - Test individual email sends
- **Scheduler Debug**: `/debug/scheduler` - Test automation logic
- **Updated Navigation**: All pages accessible via sidebar

### ✅ **API Routes (Ready to Use)**
- `GET /api/debug/logs/recent` - Fetch recent email logs with filters
- `GET /api/debug/logs/stats` - Get delivery statistics and analytics
- `POST /api/debug/logs/retry` - Retry failed email deliveries
- All existing debug APIs work with new logging

### ✅ **Edge Functions (Ready to Deploy)**
- `email-scheduler` - Production hourly email delivery
- `test-scheduler` - Testing and simulation with custom times

## 🛠️ Deployment Steps

### **Step 1: Deploy Edge Functions to Supabase**

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link to your project**:
   ```bash
   supabase link --project-ref YOUR_PROJECT_ID
   ```

4. **Copy the Edge Functions**:
   ```bash
   # Create functions directory in your project
   mkdir -p supabase/functions
   
   # Copy the email-scheduler function
   cp -r supabase-functions/email-scheduler supabase/functions/
   
   # Copy the test-scheduler function  
   cp -r supabase-functions/test-scheduler supabase/functions/
   ```

5. **Deploy the Functions**:
   ```bash
   supabase functions deploy email-scheduler
   supabase functions deploy test-scheduler
   ```

### **Step 2: Set Environment Variables in Supabase**

In your Supabase Dashboard → Project Settings → Edge Functions → Environment Variables:

```bash
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### **Step 3: Set Up Automated Hourly Execution**

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable the pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the email-scheduler to run every hour
SELECT cron.schedule(
  'bookmail-email-scheduler',
  '0 * * * *',  -- Every hour at minute 0
  $$
    SELECT net.http_post(
      url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/email-scheduler',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      )
    );
  $$
);
```

**Replace `YOUR_PROJECT_ID` with your actual Supabase project ID.**

### **Step 4: Test the Complete System**

1. **Test Connection**: Visit `/debug/email` → Test Resend connection
2. **Test Manual Send**: Send a lesson to yourself via `/debug/email`
3. **Test Scheduler**: Use `/debug/scheduler` to simulate different times
4. **Check Logs**: View results in `/debug/logs`
5. **Test Retry**: Trigger a failure and use the retry feature

### **Step 5: Monitor Cron Job**

Check if your cron job is scheduled correctly:

```sql
-- Check cron job status
SELECT * FROM cron.job WHERE jobname = 'bookmail-email-scheduler';

-- View recent cron executions
SELECT * FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'bookmail-email-scheduler'
) 
ORDER BY start_time DESC 
LIMIT 10;
```

## 🎮 **Using the System**

### **Real-Time Monitoring**
- **Email Logs Dashboard**: `/debug/logs`
  - View all recent email deliveries
  - Filter by status (sent/failed/scheduled)
  - See success rates and statistics
  - Retry failed emails with one click
  - Track which users are most active

### **Manual Testing**
- **Email Testing**: `/debug/email`
  - Test individual lesson sends
  - Verify email formatting
  - Check Resend integration

### **Scheduler Testing**
- **Scheduler Debug**: `/debug/scheduler`
  - Simulate different times/timezones
  - Test user eligibility logic
  - Preview what would be sent

### **Analytics & Insights**
- Success/failure rates
- Most active users
- Popular books
- Delivery time patterns
- Error analysis and retry success

## ⚙️ **System Behavior**

### **Hourly Execution**
- Runs every hour at minute 0 (e.g., 9:00, 10:00, 11:00)
- Checks all users' delivery times in their local timezone
- Sends next lesson if user has eligible delivery time
- Updates progress and logs every action

### **Email Delivery Logic**
1. Find users with delivery time matching current hour
2. Get next lesson in their reading sequence
3. Send via Resend with proper headers
4. Update user progress (`last_lesson_sent`)
5. Log success/failure in `email_logs`

### **Error Handling**
- Failed emails are logged but don't block others
- Retry mechanism available via dashboard
- Comprehensive error messages for debugging
- System continues operating even with individual failures

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Emails not sending**:
   - Check Resend API key in Supabase environment variables
   - Verify domain is verified in Resend dashboard
   - Check logs for detailed error messages

2. **Cron job not running**:
   - Verify pg_cron extension is enabled
   - Check cron job exists: `SELECT * FROM cron.job`
   - Review execution history: `SELECT * FROM cron.job_run_details`

3. **Users not receiving emails**:
   - Check user has delivery times set: `user_delivery_times` table
   - Verify user has books assigned: `user_books` table
   - Check user hasn't completed all lessons
   - Use scheduler simulation to test specific times

4. **Environment variables not working**:
   - Double-check variables in Supabase Dashboard
   - Redeploy Edge Functions after adding variables
   - Test connection via `/debug/email`

### **Monitoring Commands**

```sql
-- Check recent email activity
SELECT status, COUNT(*) 
FROM email_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Find users with delivery issues
SELECT u.email, COUNT(el.id) as failed_count
FROM users u
JOIN email_logs el ON u.id = el.user_id
WHERE el.status = 'failed' 
  AND el.created_at > NOW() - INTERVAL '7 days'
GROUP BY u.email
ORDER BY failed_count DESC;

-- Check cron job health
SELECT 
  jobname, 
  schedule, 
  active,
  database
FROM cron.job 
WHERE jobname = 'bookmail-email-scheduler';
```

## 🎉 **Success Criteria Achieved**

✅ **Automated hourly email delivery**  
✅ **User progress tracking**  
✅ **Comprehensive logging**  
✅ **Error handling and retry**  
✅ **Real-time monitoring dashboard**  
✅ **Manual testing capabilities**  
✅ **Timezone-aware scheduling**  
✅ **Failed delivery recovery**  

Your BookMail system is now fully automated and production-ready! 🚀

## 📞 **Next Steps**

1. **Deploy and test** the system end-to-end
2. **Add real users** and books to test at scale
3. **Monitor performance** via the logs dashboard
4. **Set up alerts** for high failure rates (future enhancement)
5. **Add user engagement metrics** (future enhancement)

The system will now automatically deliver lessons to users at their preferred times every hour! 📧✨
