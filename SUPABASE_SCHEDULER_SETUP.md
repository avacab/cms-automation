# Supabase Automated Scheduler Setup Guide

This guide will help you set up automated LinkedIn post publishing using Supabase pg_cron.

## Why Supabase pg_cron Instead of Vercel Cron?

**Vercel Cron Limitation**: Hobby/free tier accounts only support daily cron jobs. Running every 5 minutes requires a Pro plan ($20/month).

**Supabase pg_cron**: Free on all tiers and supports any schedule including every 5 minutes.

## Overview

Once configured, posts will automatically publish at their scheduled time without manual intervention. The system checks every 5 minutes for posts that are ready to publish.

## Setup Steps

### Step 1: Enable Required Extensions

Go to your Supabase SQL Editor:
**https://supabase.com/dashboard/project/neezcjbguizmkbyglroe/sql/new**

Run this SQL to enable the required extensions:

```sql
-- Enable pg_cron for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable http for making HTTP requests
CREATE EXTENSION IF NOT EXISTS http;
```

### Step 2: Create the Orchestrator Trigger Function

Still in the SQL Editor, run this SQL to create the function that calls the orchestrator:

```sql
-- Create a function that triggers the post orchestrator
CREATE OR REPLACE FUNCTION trigger_post_orchestrator()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response http_response;
BEGIN
  -- Call the orchestrator endpoint
  SELECT * INTO response
  FROM http_post(
    'https://cms-automation-api.vercel.app/api/v1/content-publishing/orchestrator/process',
    '{}',
    'application/json'
  );

  -- Log the response
  RAISE NOTICE 'Orchestrator response: status=%, content=%', response.status, response.content;
END;
$$;
```

### Step 3: Schedule the Cron Job

Run this SQL to schedule the function to run every 5 minutes:

```sql
-- Schedule to run every 5 minutes
SELECT cron.schedule(
  'publish-pending-posts',  -- job name
  '*/5 * * * *',            -- every 5 minutes
  'SELECT trigger_post_orchestrator();'
);
```

### Step 4: Verify the Job Was Created

Run this to check if the cron job is active:

```sql
-- View all scheduled jobs
SELECT * FROM cron.job;
```

You should see a job named `publish-pending-posts` with the schedule `*/5 * * * *`.

## How It Works

1. **You create a post** in the CMS frontend and select a schedule
2. **Post is saved** to the database with status "scheduled"
3. **Every 5 minutes**, Supabase pg_cron automatically runs the trigger function
4. **The trigger function** calls your orchestrator API endpoint
5. **The orchestrator** checks for posts ready to publish and publishes them to LinkedIn

## Testing

After setup, create a test post with "Publish immediately" selected. Within 5 minutes, it should automatically appear on LinkedIn.

You can monitor the cron job execution:

```sql
-- View job run history
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'publish-pending-posts')
ORDER BY start_time DESC
LIMIT 10;
```

## Troubleshooting

### Check if extensions are enabled:
```sql
SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'http');
```

### Manually trigger the function to test:
```sql
SELECT trigger_post_orchestrator();
```

### View any errors:
```sql
SELECT * FROM cron.job_run_details WHERE status = 'failed' ORDER BY start_time DESC LIMIT 5;
```

### Remove the cron job (if needed):
```sql
SELECT cron.unschedule('publish-pending-posts');
```

## Alternative: Change Schedule Frequency

If you want to check more or less frequently, modify the cron expression:

```sql
-- Every 10 minutes
SELECT cron.schedule('publish-pending-posts', '*/10 * * * *', 'SELECT trigger_post_orchestrator();');

-- Every 1 minute (not recommended - may hit rate limits)
SELECT cron.schedule('publish-pending-posts', '* * * * *', 'SELECT trigger_post_orchestrator();');

-- Every hour at minute 0
SELECT cron.schedule('publish-pending-posts', '0 * * * *', 'SELECT trigger_post_orchestrator();');
```

Remember to unschedule the old job before creating a new one with the same name.

## Notes

- pg_cron runs in UTC timezone
- The cron job will survive database restarts
- You can have multiple cron jobs for different purposes
- This is completely free on Supabase's free tier
