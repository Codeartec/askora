export type ChatCompletionFailureReason =
  | 'rate_limited'
  | 'network'
  | 'provider_error'
  | 'no_keys'
  | 'unknown';

export type LlmProviderId = 'groq' | 'openrouter';

export type ChatCompletionResult =
  | { ok: true; content: string }
  | {
      ok: false;
      reason: ChatCompletionFailureReason;
      message?: string;
      provider?: LlmProviderId;
    };
