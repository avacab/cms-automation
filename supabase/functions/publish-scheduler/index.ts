// Supabase Edge Function to automatically trigger LinkedIn post publishing
// This function runs on a cron schedule (every 5 minutes) to process pending posts

Deno.serve(async (req) => {
  try {
    console.log('🔄 Starting scheduled post publishing check...');

    // Call the orchestrator endpoint to process pending posts
    const orchestratorUrl = 'https://cms-automation-api.vercel.app/api/v1/content-publishing/orchestrator/process';

    const response = await fetch(orchestratorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Orchestrator call failed:', result);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Orchestrator call failed',
          details: result,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Orchestrator processing completed:', result);

    // Return the orchestrator result
    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        orchestrator_result: result,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Error in publish-scheduler:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
