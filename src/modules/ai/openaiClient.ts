import axios from 'axios';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<Record<string, unknown>>;
};

export async function callOpenAI(messages: ChatMessage[], responseFormat?: 'json_object') {
  if (!config.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const payload: Record<string, unknown> = {
    model: config.OPENAI_MODEL,
    temperature: 0.2,
    messages
  };

  if (responseFormat) {
    payload.response_format = { type: responseFormat } as unknown;
  }

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    payload,
    {
      headers: {
        Authorization: `Bearer ${config.OPENAI_API_KEY}`
      },
      timeout: config.OPENAI_TIMEOUT_MS
    }
  );

  const choice = response.data?.choices?.[0];
  const content: string = choice?.message?.content || '';
  logger.debug({ content }, 'OpenAI response');
  return content;
}
