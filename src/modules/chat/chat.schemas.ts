// Validation rules for chat requests.
import { z } from 'zod';
import { MAX_CHAT_MESSAGE_LENGTH } from '../../constants';

export const startConversationSchema = z.object({ commoditySlug: z.string().min(1).max(100) });
export const conversationParamsSchema = z.object({ id: z.string().uuid() });
export const sendMessageSchema = z.object({
  message: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
});

export type StartConversationBody = z.infer<typeof startConversationSchema>;
export type SendMessageBody = z.infer<typeof sendMessageSchema>;
