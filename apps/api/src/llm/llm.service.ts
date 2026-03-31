import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ChatCompletionFailureReason, ChatCompletionResult, LlmProviderId } from './llm.types';

function classifyOpenAiError(err: unknown): { reason: ChatCompletionFailureReason; message: string } {
  const e = err as { status?: number; message?: string; code?: string };
  const message = typeof e?.message === 'string' ? e.message : String(err);
  const status = typeof e?.status === 'number' ? e.status : undefined;
  const code = typeof e?.code === 'string' ? e.code : '';

  if (status === 429) {
    return { reason: 'rate_limited', message };
  }
  if (status !== undefined && status >= 500) {
    return { reason: 'provider_error', message };
  }
  if (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    /fetch failed|network|timeout/i.test(message)
  ) {
    return { reason: 'network', message };
  }
  if (status !== undefined && status >= 400) {
    return { reason: 'provider_error', message };
  }
  return { reason: 'unknown', message };
}

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

  /**
   * Groq first, then OpenRouter. Returns structured success/failure (no thrown errors for provider failures).
   */
  async chatCompletion(systemPrompt: string, userPrompt: string): Promise<ChatCompletionResult> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    if (!this.groqClient && !this.openRouterClient) {
      this.logger.warn('No LLM API keys configured (GROQ_API_KEY / OPENROUTER_API_KEY)');
      return { ok: false, reason: 'no_keys' };
    }

    if (this.groqClient) {
      try {
        const res = await this.groqClient.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.2,
          max_tokens: 2048,
          response_format: { type: 'json_object' },
        });
        const content = res.choices[0]?.message?.content ?? null;
        if (content === null || content === '') {
          return { ok: false, reason: 'provider_error', message: 'Empty Groq response', provider: 'groq' };
        }
        return { ok: true, content };
      } catch (err: unknown) {
        const { reason, message } = classifyOpenAiError(err);
        this.logger.warn(`Groq failed (${reason}), trying OpenRouter: ${message}`);
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
        const content = res.choices[0]?.message?.content ?? null;
        if (content === null || content === '') {
          return {
            ok: false,
            reason: 'provider_error',
            message: 'Empty OpenRouter response',
            provider: 'openrouter',
          };
        }
        return { ok: true, content };
      } catch (err: unknown) {
        const { reason, message } = classifyOpenAiError(err);
        this.logger.error(`OpenRouter also failed (${reason}): ${message}`);
        return { ok: false, reason, message, provider: 'openrouter' };
      }
    }

    this.logger.error('All LLM providers failed');
    return { ok: false, reason: 'unknown', message: 'All providers failed' };
  }
}
