# OpenAI API Key Setup for Wayzo Staging

## Current Issue
The Wayzo staging deployment is experiencing 502 errors because the OpenAI API key is set to a placeholder value `sk-your-openai-api-key-here` instead of a real API key.

## Root Cause
In `render.yaml`, the `OPENAI_API_KEY` environment variable is configured to use a secret, but the secret `openai-api-key` needs to be created in Render with a valid OpenAI API key.

## How to Fix

### Option 1: Set the Secret in Render Dashboard
1. Go to your Render dashboard
2. Navigate to your `wayzo-staging` service
3. Go to "Environment" tab
4. Create a new secret named `openai-api-key` with your actual OpenAI API key
5. Redeploy the service

### Option 2: Update render.yaml to use direct value (temporary)
If you want to test quickly, you can temporarily update `render.yaml`:

```yaml
envVars:
  - key: NODE_ENV
    value: production
  - key: OPENAI_API_KEY
    value: sk-your-actual-openai-api-key-here
```

**Note**: This is not recommended for production as it exposes the API key in your repository.

## Testing the Fix

After setting up the API key, test these endpoints:

1. **API Key Status**: `https://wayzo-staging.onrender.com/debug/api-key-status`
   - Should return `"status": "VALID"`

2. **Simple AI Test**: `https://wayzo-staging.onrender.com/debug/test-ai`
   - Should return a successful AI response

3. **Main Endpoints**: Try generating a plan on the main site
   - Should work without 502 errors

## Debug Endpoints Available

- `/debug/ping` - Basic health check
- `/debug/api-key-status` - Check API key configuration
- `/debug/test-ai` - Test OpenAI API with simple call

## Fallback Behavior

The application now includes fallback responses when AI is unavailable:
- Basic travel plan template with budget breakdown
- Generic recommendations and tips
- Clear message that AI service is temporarily unavailable

This ensures users get a response even when the AI service is down.