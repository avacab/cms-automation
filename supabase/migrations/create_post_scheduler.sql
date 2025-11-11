-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable http extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS http;

-- Create a function that triggers the orchestrator
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

  -- Log the response (optional)
  RAISE NOTICE 'Orchestrator response: status=%, content=%', response.status, response.content;
END;
$$;

-- Schedule the function to run every 5 minutes
-- This will automatically trigger post publishing
SELECT cron.schedule(
  'publish-pending-posts',  -- job name
  '*/5 * * * *',            -- cron expression: every 5 minutes
  'SELECT trigger_post_orchestrator();'
);

-- Check if the job was created successfully
SELECT * FROM cron.job WHERE jobname = 'publish-pending-posts';
