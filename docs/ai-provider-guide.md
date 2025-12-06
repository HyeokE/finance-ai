# AI Provider Guide

This guide explains how to use and switch between different AI providers (OpenAI and Google Gemini) in the Auto-Finance trading bot.

## Overview

The system now supports multiple AI providers through a common interface architecture, allowing you to choose between OpenAI's GPT models and Google's Gemini models for trading decisions.

## Supported Providers

### OpenAI (Default)
- **Models**: GPT-4o, GPT-4.5, GPT-5.1
- **Configuration**: `AI_PROVIDER=openai`
- **API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Cost**: Higher per-token cost, excellent reasoning quality

### Google Gemini
- **Models**: gemini-2.0-flash-exp (default), gemini-1.5-pro, gemini-1.5-flash
- **Configuration**: `AI_PROVIDER=gemini`
- **API Key**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Cost**: Lower cost, fast response times, competitive quality

## Configuration

### Using OpenAI (Default)

In your `.env` file:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o  # Optional, defaults to gpt-4o
```

Available OpenAI models:
- `gpt-4o` - Balanced performance and cost (recommended)
- `gpt-4o-mini` - Faster and cheaper, good for development
- `gpt-5.1` - Latest model, best reasoning (higher cost)
- `o1-preview` - Advanced reasoning model
- `o1-mini` - Faster reasoning model

### Using Google Gemini

In your `.env` file:

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.0-flash-exp  # Optional, defaults to gemini-2.0-flash-exp
```

Available Gemini models:
- `gemini-2.0-flash-exp` - Latest experimental model, fast and cost-effective (recommended)
- `gemini-1.5-pro` - Larger context window, better reasoning
- `gemini-1.5-flash` - Fastest responses, lower cost

## Switching Providers

1. **Update `.env` file**:
   ```bash
   AI_PROVIDER=gemini  # or openai
   ```

2. **Add the required API key**:
   ```bash
   GEMINI_API_KEY=your-key  # for Gemini
   # or
   OPENAI_API_KEY=your-key  # for OpenAI
   ```

3. **Restart the backend**:
   ```bash
   pnpm dev:backend
   ```

4. **Verify the provider** in logs:
   ```
   AI Decision Engine initialized with gemini provider
   ✅ Gemini client initialized (model: gemini-2.0-flash-exp)
   ```

## Testing Provider Connection

You can test the AI provider connection before running a batch:

```bash
curl http://localhost:3000/api/test/ai-connection
```

Response:
```json
{
  "success": true,
  "provider": "gemini",
  "message": "AI connection test successful"
}
```

## Architecture

### Interface-Based Design

The system uses the **Strategy Pattern** with a common `IAIProvider` interface:

```typescript
interface IAIProvider {
    getTradingDecision(systemPrompt: string, context: any): Promise<string>;
    testConnection(): Promise<boolean>;
}
```

Both `OpenAIClient` and `GeminiApiClient` implement this interface, allowing the `AIDecisionEngine` to work with any provider without modification.

### Provider Selection Flow

```
AIDecisionEngine.constructor()
  ↓
getProviderFromEnv()  // Read AI_PROVIDER from .env
  ↓
createProvider(type)  // Instantiate appropriate factory
  ↓
Factory.create()      // Create client instance
  ↓
aiProvider: IAIProvider  // Store as interface type
```

## Cost Comparison

Based on typical trading batch (analyzing 20 stocks):

| Provider | Model | Tokens/Batch | Cost/Batch | Monthly Cost (4x daily) |
|----------|-------|--------------|------------|-------------------------|
| OpenAI | GPT-4o | ~8,000 | $0.12 | ~$14.40 |
| OpenAI | GPT-5.1 | ~8,000 | $0.16 | ~$19.20 |
| Gemini | gemini-2.0-flash-exp | ~8,000 | $0.02 | ~$2.40 |
| Gemini | gemini-1.5-pro | ~8,000 | $0.04 | ~$4.80 |

*Costs are approximate and based on current pricing as of December 2025*

## Performance Considerations

### Response Time
- **Gemini Flash**: ~1-2 seconds average
- **OpenAI GPT-4o**: ~2-4 seconds average
- **Gemini Pro**: ~3-5 seconds average

### Quality
- Both providers produce high-quality trading decisions
- OpenAI may have slight edge in complex reasoning
- Gemini 2.0 Flash matches GPT-4o quality in most cases

### Rate Limits
- **OpenAI**: 10,000 requests/minute (Tier 1)
- **Gemini**: 1,500 requests/minute (free tier), higher for paid

## Troubleshooting

### Provider Not Switching

**Issue**: Changed `AI_PROVIDER` but still using old provider

**Solution**:
1. Verify `.env` file has the correct `AI_PROVIDER` value
2. Restart the backend completely (kill process, restart)
3. Check logs for initialization message

### API Key Errors

**Issue**: `GEMINI_API_KEY must be set in .env`

**Solution**:
1. Ensure API key is in root `.env` file
2. No spaces around `=` in `.env`
3. Restart backend after adding key

### JSON Parsing Errors

**Issue**: `Failed to parse AI response`

**Solution**:
- Both providers are configured for JSON output
- Check system prompt hasn't been modified
- Verify model name is correct in `.env`

## Adding New Providers

To add support for additional AI providers (Claude, Llama, etc.):

1. **Create Client Class** implementing `IAIProvider`:
   ```typescript
   // infrastructure/api/ClaudeApiClient.ts
   export class ClaudeApiClient implements IAIProvider {
       async getTradingDecision(systemPrompt: string, context: any): Promise<string> {
           // Implementation
       }
       async testConnection(): Promise<boolean> {
           // Implementation
       }
   }
   ```

2. **Create Factory Class**:
   ```typescript
   // infrastructure/api/ClaudeApiFactory.ts
   export class ClaudeApiFactory implements ApiFactory<ClaudeApiClient> {
       create(config: Partial<ApiConfig> = {}): ClaudeApiClient {
           // Factory implementation
       }
   }
   ```

3. **Update AIDecisionEngine**:
   ```typescript
   type AIProviderType = 'openai' | 'gemini' | 'claude';

   private createProvider(type: AIProviderType): IAIProvider {
       switch (type) {
           case 'claude':
               return new ClaudeApiFactory().create();
           // ... other cases
       }
   }
   ```

4. **Update `.env.example`** with new provider credentials

## Best Practices

1. **Start with Gemini for cost savings**: Use `gemini-2.0-flash-exp` for development and testing
2. **Use OpenAI for production**: If cost is not a concern, GPT-4o/GPT-5.1 provides excellent reliability
3. **Monitor costs**: Check API usage dashboards regularly
4. **Test both providers**: Compare decision quality before committing to production
5. **Keep API keys secure**: Never commit `.env` files to version control

## Support

For issues or questions:
- Check logs: `pm2 logs auto-finance` (production) or console output (development)
- Review API provider status pages
- Check [CLAUDE.md](../CLAUDE.md) for architecture details
