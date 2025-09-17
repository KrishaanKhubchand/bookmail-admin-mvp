# 🚀 BookMail Vercel Deployment Guide

## 📋 Overview
Deploy your BookMail app to Vercel with automated hourly email delivery using Vercel Cron Jobs.

## 🛠️ Deployment Steps

### **Step 1: Install Vercel CLI**
```bash
npm install -g vercel
```

### **Step 2: Initial Deployment**
```bash
# From your project root
vercel

# Follow the prompts:
# - Link to existing project? No (first time)
# - What's your project name? bookmail-mvp (or whatever you prefer)
# - Which directory? ./ (current directory)
# - Want to modify settings? No
```

### **Step 3: Set Environment Variables**

Go to your **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables** and add:

**Required Variables:**
```bash
SUPABASE_URL=https://gloqngqccjiqmowdzvhb.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**How to find your Supabase keys:**
1. Go to **Supabase Dashboard** → **Project Settings** → **API**
2. Copy the **Project URL** (for `SUPABASE_URL`)
3. Copy the **anon public** key (for `SUPABASE_ANON_KEY`)
4. Copy the **service_role secret** key (for `SUPABASE_SERVICE_ROLE_KEY`)

### **Step 4: Deploy with Cron Jobs**
```bash
# Deploy to production with cron jobs enabled
vercel --prod
```

## 🕐 **How the Cron Job Works**

### **Schedule**: Every hour at minute 0 (9:00, 10:00, 11:00, etc.)

### **What Happens**:
1. **Vercel triggers** `/api/cron/email-scheduler` every hour
2. **API route calls** your Supabase edge function
3. **Edge function** finds eligible users and sends emails
4. **Results logged** to your database
5. **Success/failure** reported back to Vercel

### **Monitoring**:
- **Vercel Dashboard** → Functions → View cron job logs
- **Your App** → `/debug/logs` → See email delivery results
- **Upcoming View** → Toggle to "🔮 Upcoming" to see scheduled emails

## 🧪 **Testing**

### **Test Manual Trigger**:
```bash
# Test the cron endpoint directly
curl https://your-app.vercel.app/api/cron/email-scheduler
```

### **Test via Browser**:
Visit: `https://your-app.vercel.app/api/cron/email-scheduler`

### **Expected Response**:
```json
{
  "success": true,
  "timestamp": "2024-01-15T15:00:00.000Z",
  "result": {
    "eligible_users": 3,
    "emails_sent": 2,
    "completed_users": 1,
    "run_id": "abc123..."
  },
  "message": "Email scheduler completed successfully"
}
```

## 📊 **Monitoring & Debugging**

### **Vercel Function Logs**:
1. Go to **Vercel Dashboard** → Your Project → **Functions**
2. Click on **Cron Jobs** tab
3. View execution history and logs

### **App Debug Dashboard**:
1. Visit your app → `/debug/logs`
2. Toggle to "📊 Historical" to see sent emails
3. Toggle to "🔮 Upcoming" to see scheduled emails
4. Check stats and recent activity

### **Common Issues**:

**❌ "Missing service role key"**
- Check environment variable `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel

**❌ "Edge function failed: 500"**
- Check your Resend API key is valid
- Verify your sending domain is verified in Resend
- Check Supabase edge function logs

**❌ "No users eligible"**
- Check users have delivery times set
- Check users have books assigned
- Use `/debug/scheduler` to simulate different times

## 🎯 **Success Criteria**

✅ App deployed and accessible  
✅ Cron job running every hour  
✅ Emails being sent to eligible users  
✅ Logs showing in `/debug/logs`  
✅ No errors in Vercel function logs  

## 🔄 **Making Updates**

```bash
# After making code changes
vercel --prod

# Environment variable changes
# Update in Vercel Dashboard → Settings → Environment Variables
# Then redeploy:
vercel --prod
```

## 🚨 **Troubleshooting**

### **Cron Not Running**:
- Check `vercel.json` is in root directory
- Verify cron syntax: `"schedule": "0 * * * *"`
- Redeploy after adding vercel.json

### **Environment Variables Not Working**:
- Ensure variables are set for **Production** environment
- Redeploy after adding variables
- Check variable names match exactly

### **Edge Function Errors**:
- Check Supabase edge function logs
- Verify service role key has proper permissions
- Test edge function directly via Supabase dashboard

Your BookMail system will now run automatically every hour! 🎉
