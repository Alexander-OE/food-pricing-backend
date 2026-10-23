// Wrapper around the Gemini SDK, so the rest of the app never sees Gemini's message format.
import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { env } from '../../config/env';
import { LLM_TIMEOUT_MS } from '../../constants';

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Gemini calls the assistant "model" and takes the system prompt separately. */
function toGeminiHistory(messages: LlmMessage[]): Content[] {
  const turns = messages.map((message): Content => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
  // Gemini requires the history to start with a user turn
  while (turns.length > 0 && turns[0].role === 'model') turns.shift();
  return turns;
}

export class LlmClient {
  private client: GoogleGenerativeAI | null;

  constructor() {
    // Without a key there is no client, so chat uses the rule-based fallback.
    this.client = env.LLM_API_KEY ? new GoogleGenerativeAI(env.LLM_API_KEY) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Sends the conversation and returns the reply; throws on any failure. */
  async complete(messages: LlmMessage[]): Promise<string> {
    if (!this.client) throw new Error('LLM is not configured');

    const system = messages.find((message) => message.role === 'system');
    const conversation = messages.filter((message) => message.role !== 'system');
    const newMessage = conversation.pop(); // the last message is the user's new question
    if (!newMessage) throw new Error('No message to send');

    const model = this.client.getGenerativeModel(
      {
        model: env.LLM_MODEL,
        systemInstruction: system?.content,
        generationConfig: {
          maxOutputTokens: env.LLM_MAX_TOKENS,
          temperature: 0.4, // low temperature keeps answers factual and consistent
        },
      },
      { timeout: LLM_TIMEOUT_MS },
    );

    const chat = model.startChat({ history: toGeminiHistory(conversation) });
    const result = await chat.sendMessage(newMessage.content);
    const text = result.response.text().trim();
    if (!text) throw new Error('LLM returned an empty reply');
    return text;
  }
}
