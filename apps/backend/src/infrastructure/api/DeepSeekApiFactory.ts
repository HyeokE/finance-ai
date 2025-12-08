import OpenAI from "openai";
import { ApiConfig, ApiFactory, DEFAULT_API_CONFIG } from "./ApiFactory";
import { OpenAIClient } from "./OpenAIClient";

/**
 * DeepSeek API Factory
 * Creates and configures DeepSeek API client
 * DeepSeek uses OpenAI-compatible API
 */
export class DeepSeekApiFactory implements ApiFactory<OpenAIClient> {
  create(config: Partial<ApiConfig> = {}): OpenAIClient {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY must be set in .env");
    }

    const openai = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
      timeout: config.timeout || DEFAULT_API_CONFIG.timeout,
      maxRetries: config.retryAttempts || DEFAULT_API_CONFIG.retryAttempts,
    });

    const modelName = process.env.DEEPSEEK_MODEL || "deepseek-chat";

    // Warn if using deepseek-reasoner for trading
    if (modelName.includes("reasoner")) {
      console.warn(
        "⚠️  WARNING: deepseek-reasoner is not recommended for trading decisions"
      );
      console.warn(
        "    Recommendation: Set DEEPSEEK_MODEL=deepseek-chat in .env"
      );
      console.warn(
        "    Reason: Reasoner models show thinking process and may not work well with JSON mode"
      );
    }

    console.log(`✅ DeepSeek client initialized (model: ${modelName})`);

    return new OpenAIClient(openai, modelName);
  }
}
