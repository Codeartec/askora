import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private groqClient: OpenAI | null;
  private openRouterClient: OpenAI | null;

  constructor(private config: ConfigService) {
    const groqKey = this.config.get('GROQ_API_KEY');
    const orKey = this.config.get('OPENROUTER_API_KEY');

    this.groqClient = groqKey
      ? new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' })
      : null;

    this.openRouterClient = orKey
      ? new OpenAI({ apiKey: orKey, baseURL: 'https://openrouter.ai/api/v1' })
      : null;
  }

  async chatCompletion(systemPrompt: string, userPrompt: string): Promise<string | null> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    // Try Groq first
    if (this.groqClient) {
      try {
        const res = await this.groqClient.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.2,
          max_tokens: 2048,
          response_format: { type: 'json_object' },
        });
        return res.choices[0]?.message?.content ?? null;
      } catch (err: any) {
        this.logger.warn(`Groq failed, trying OpenRouter: ${err?.message}`);
      }
    }

    if (this.openRouterClient) {
      try {
        const res = await this.openRouterClient.chat.completions.create({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages,
          temperature: 0.2,
          max_tokens: 2048,
        });
        return res.choices[0]?.message?.content ?? null;
      } catch (err: any) {
        this.logger.error(`OpenRouter also failed: ${err?.message}`);
      }
    }

    this.logger.error('All LLM providers failed');
    return null;
  }
}
