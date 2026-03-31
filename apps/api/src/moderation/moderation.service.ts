import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';

export interface ModerationResult {
  approved: boolean;
  standardViolation: boolean;
  standardReason: string | null;
  customViolation: boolean;
  customReason: string | null;
  /** True when Groq/OpenRouter both failed — host must choose manual approval or wait for AI. */
  llmUnavailable?: boolean;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private llm: LlmService) {}

  async moderateQuestion(questionText: string, customFilterRules?: string | null): Promise<ModerationResult> {
    const systemPrompt = `You are a content moderator for a live Q&A platform.
Evaluate each question on two levels:

LEVEL 1 - Standard filter (always active):
Reject questions with: explicit sexual content, racism, discrimination, hate speech, violence, personal harassment, spam, or illegal content.

LEVEL 2 - Custom event rules:
${customFilterRules || 'No custom rules defined.'}

Respond ONLY with valid JSON:
{
  "approved": boolean,
  "standard_violation": boolean,
  "standard_reason": string | null,
  "custom_violation": boolean,
  "custom_reason": string | null
}`;

    const userPrompt = `Question to evaluate: "${questionText}"`;

    try {
      const result = await this.llm.chatCompletion(systemPrompt, userPrompt);
      if (!result.ok) {
        return {
          approved: false,
          standardViolation: false,
          standardReason: null,
          customViolation: false,
          customReason: null,
          llmUnavailable: true,
        };
      }

      const raw = result.content;
      const parsed = JSON.parse(raw);
      return {
        approved: parsed.approved ?? true,
        standardViolation: parsed.standard_violation ?? false,
        standardReason: parsed.standard_reason ?? null,
        customViolation: parsed.custom_violation ?? false,
        customReason: parsed.custom_reason ?? null,
      };
    } catch (err: any) {
      this.logger.warn(`Moderation parse failed, treating as LLM unavailable: ${err?.message}`);
      return {
        approved: false,
        standardViolation: false,
        standardReason: null,
        customViolation: false,
        customReason: null,
        llmUnavailable: true,
      };
    }
  }
}
