import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { IAIProvider } from "./IAIProvider";

/**
 * OpenAI API Client Wrapper
 * Provides simplified interface for GPT calls
 */
export class OpenAIClient implements IAIProvider {
  constructor(
    private readonly openai: OpenAI,
    private readonly modelName: string = "gpt-4o"
  ) {}

  /**
   * Call GPT-4o with chat completion
   */
  async chat(
    messages: ChatCompletionMessageParam[],
    options: {
      model?: string;
      temperature?: number;
      jsonMode?: boolean;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    const {
      model = this.modelName,
      temperature = 0.9,
      jsonMode = false,
      maxTokens,
    } = options;

    try {
      const requestSize = JSON.stringify(messages).length;
      console.log("📤 OpenAI API Request", {
        model,
        temperature,
        jsonMode,
        maxTokens,
        requestSize: `${(requestSize / 1024).toFixed(1)} KB`,
        messageCount: messages.length,
      });

      const requestParams: any = {
        model,
        messages,
        temperature,
        ...(maxTokens && { max_tokens: maxTokens }),
      };

      // DeepSeek may not support response_format in the same way
      // Try with json_object format, but be prepared to handle errors
      if (jsonMode) {
        requestParams.response_format = { type: "json_object" };
      }

      const response = await this.openai.chat.completions.create(requestParams);

      console.log("📥 AI API Response", {
        id: response.id,
        model: response.model,
        choices: response.choices?.length || 0,
        usage: response.usage,
        finish_reason: response.choices[0]?.finish_reason,
        has_content: !!response.choices[0]?.message?.content,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        const firstChoice = response.choices[0];
        const finishReason = firstChoice?.finish_reason;

        console.error("❌ Empty response from AI API", {
          response_id: response.id,
          model: response.model,
          choices_length: response.choices?.length,
          finish_reason: finishReason,
          message: firstChoice?.message,
          full_choice: firstChoice,
          usage: response.usage,
        });

        // Handle different finish reasons
        if (finishReason === "length") {
          throw new Error(
            `Response truncated due to max_tokens limit. Increase maxTokens (current: ${maxTokens})`
          );
        } else if (finishReason === "content_filter") {
          throw new Error(
            "Response blocked by content filter. Try adjusting the input."
          );
        } else {
          throw new Error(
            `No response content from AI API (finish_reason: ${
              finishReason || "unknown"
            }, model: ${model})`
          );
        }
      }

      console.log("✅ AI response received", {
        contentLength: content.length,
        contentPreview: content.substring(0, 100),
      });

      return content;
    } catch (error: any) {
      console.error("❌ AI API error:", {
        message: error?.message,
        type: error?.type,
        code: error?.code,
        status: error?.status,
        model,
        requestSize: JSON.stringify(messages).length,
        error: error,
      });

      // Add helpful context for common errors
      if (error?.code === "context_length_exceeded") {
        throw new Error(
          `Context length exceeded for model ${model}. Try reducing input size or using a model with larger context.`
        );
      } else if (error?.status === 401) {
        throw new Error(
          `Authentication failed. Check your API key in .env file.`
        );
      } else if (error?.status === 429) {
        throw new Error(`Rate limit exceeded. Wait a moment and try again.`);
      }

      throw error;
    }
  }

  /**
   * Get trading decision from GPT/DeepSeek
   * Convenience method for AI decision engine
   */
  async getTradingDecision(
    systemPrompt: string,
    context: any
  ): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: JSON.stringify(context),
      },
    ];

    // DeepSeek supports larger max_tokens (up to 8192)
    // OpenAI GPT-4o supports up to 16384
    const isDeepSeek = this.modelName.includes("deepseek");
    const maxTokens = isDeepSeek ? 8000 : 4000;

    console.log("🤖 AI Provider Config", {
      model: this.modelName,
      isDeepSeek,
      maxTokens,
      temperature: 0.7,
      jsonMode: true,
    });

    return this.chat(messages, {
      model: this.modelName,
      temperature: 0.7,
      jsonMode: true,
      maxTokens,
    });
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.chat([{ role: "user", content: "Hello" }], {
        model: this.modelName,
        maxTokens: 10,
      });
      console.log("✅ OpenAI API connection test successful");
      return true;
    } catch (error) {
      console.error("❌ OpenAI API connection test failed:", error);
      return false;
    }
  }
}
