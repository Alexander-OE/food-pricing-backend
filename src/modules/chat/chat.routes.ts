// Routes for /chat, with the strictest rate limits on sending messages.
import { Router } from 'express';
import { chatPerDayLimiter, chatPerMinuteLimiter } from '../../middleware/rateLimiters';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './chat.controller';
import {
  conversationParamsSchema,
  sendMessageSchema,
  startConversationSchema,
} from './chat.schemas';

export const chatRouter = Router();

chatRouter.post(
  '/conversations',
  validate({ body: startConversationSchema }),
  asyncHandler(controller.startConversation),
);
chatRouter.post(
  '/conversations/:id/messages',
  chatPerMinuteLimiter,
  chatPerDayLimiter,
  validate({ params: conversationParamsSchema, body: sendMessageSchema }),
  asyncHandler(controller.sendMessage),
);
chatRouter.get(
  '/conversations/:id',
  validate({ params: conversationParamsSchema }),
  asyncHandler(controller.getConversation),
);
