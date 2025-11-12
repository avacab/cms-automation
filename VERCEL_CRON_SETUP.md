# Vercel Cron Setup for Automated LinkedIn Post Publishing

## Overview

The system uses **Vercel Cron Jobs** to automatically trigger the orchestrator every 5 minutes to process and publish scheduled LinkedIn posts.

## How It Works

1. **Configuration**: `backend/api/vercel.json` contains the cron job definition
2. **Schedule**: Runs every 5 minutes (`*/5 * * * *`)
3. **Endpoint**: Calls `GET /api/v1/content-publishing/orchestrator/process`
4. **Execution**: Vercel makes an HTTP GET request to the production deployment

## Configuration

The cron job is defined in `backend/api/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/v1/content-publishing/orchestrator/process",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## Verification

To verify the cron job is registered:

1. Go to your Vercel project dashboard
2. Navigate to **Settings → Cron Jobs**
3. You should see the job listed with schedule `*/5 * * * *`
4. Click **View Logs** to see execution history

### Vercel Dashboard URL
https://vercel.com/dashboard (select cms-automation-api project)

## API Endpoints

The orchestrator endpoint supports both GET and POST:

- **GET** `/api/v1/content-publishing/orchestrator/process` - Used by Vercel Cron
- **POST** `/api/v1/content-publishing/orchestrator/process` - Manual triggering

### Manual Testing

```bash
# Test via POST (works from anywhere)
curl -X POST https://cms-automation-api.vercel.app/api/v1/content-publishing/orchestrator/process \
  -H "Content-Type: application/json" \
  -d '{}'

# Test via GET (same endpoint Vercel Cron uses)
curl -X GET https://cms-automation-api.vercel.app/api/v1/content-publishing/orchestrator/process
```

## How Posts Get Published

1. **User creates post** in CMS frontend with publishing options
2. **Post is saved** to Supabase with status "scheduled" and scheduled time
3. **Every 5 minutes**, Vercel Cron triggers the orchestrator
4. **Orchestrator checks** for posts where `scheduled_time <= NOW()` and `status = 'scheduled'`
5. **Posts are published** to LinkedIn via the API
6. **Status is updated** to "published" or "failed" in the database

## Cron Schedule Format

Vercel uses standard cron expressions (5 fields, UTC timezone):

```
┌─────────── minute (0-59)
│ ┌───────── hour (0-23)
│ │ ┌─────── day of month (1-31)
│ │ │ ┌───── month (1-12)
│ │ │ │ ┌─── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

### Common Schedules

```bash
*/5 * * * *    # Every 5 minutes (current)
*/10 * * * *   # Every 10 minutes
0 * * * *      # Every hour
0 12 * * *     # Every day at 12:00 PM UTC
0 9 * * 1-5    # Every weekday at 9:00 AM UTC
```

## Advantages Over Supabase pg_cron

1. **Native Integration** - Already using Vercel for hosting
2. **Simpler Setup** - Just add config to `vercel.json`, no database extensions needed
3. **Better Visibility** - View logs and execution history in Vercel dashboard
4. **No External Dependencies** - Doesn't require Supabase extensions (pg_cron, http)
5. **Automatic Deployment** - Cron config deploys with code via git push
6. **Free** - Included in all Vercel plans

## Important Notes

- **All times are UTC** - Cron runs in UTC timezone
- **Production only** - Cron jobs only run on production deployments
- **User Agent** - Vercel adds `vercel-cron/1.0` user agent to requests
- **Serverless** - Each execution is a fresh serverless function invocation
- **Even 404s execute** - Vercel will still trigger the cron even if endpoint returns 404

## Monitoring

### Check if Cron is Running

1. **Vercel Dashboard**: Settings → Cron Jobs → View Logs
2. **Function Logs**: Check serverless function logs for execution
3. **Database**: Query `social_posts` table for status changes

### Check Pending Posts

```bash
curl https://cms-automation-api.vercel.app/api/v1/content-publishing/pending
```

### Check System Status

```bash
curl https://cms-automation-api.vercel.app/api/v1/content-publishing/status
```

## Troubleshooting

### Cron not appearing in dashboard
- Ensure `vercel.json` is in the project root or in the API directory
- Verify deployment completed successfully
- Check that `crons` array is properly formatted

### Posts not publishing
1. Check orchestrator endpoint manually: `curl -X POST [endpoint]`
2. Verify orchestrator is initialized: check `/status` endpoint
3. Check database for posts with `status='scheduled'` and `scheduled_time < NOW()`
4. Review Vercel function logs for errors

### Service initialization issues
- Ensure all environment variables are set in Vercel dashboard
- Check that `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are configured
- Verify LinkedIn access token is valid and not expired

## Deployment

Changes to `vercel.json` are automatically deployed when pushed to the main branch:

```bash
git add backend/api/vercel.json
git commit -m "Update cron schedule"
git push origin main
```

Vercel will automatically rebuild and deploy with the new cron configuration.

## Migration from Supabase pg_cron

The previous setup used Supabase pg_cron. Files for reference:

- `supabase/migrations/create_post_scheduler.sql` - SQL migration (deprecated)
- `supabase/functions/publish-scheduler/index.ts` - Edge function (deprecated)
- `SUPABASE_SCHEDULER_SETUP.md` - Old setup guide (deprecated)

These files are kept for reference but are no longer needed. Vercel Cron is now the primary scheduling mechanism.
