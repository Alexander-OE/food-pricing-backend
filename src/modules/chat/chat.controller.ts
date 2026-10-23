// Handles requests to start a chat, send messages and read a conversation.
import type { Request, Response } from 'express';
import { getValid } from '../../middleware/validate';
import { ApiError } from '../../utils/ApiError';
import { ok } from '../../utils/response';
import type { SendMessageBody, StartConversationBody } from './chat.schemas';
import * as service from './chat.service';

type IdParams = { id: string };

// Chat belongs to an anonymous session, so the session header is required.
function requireSessionId(res: Response): string {
  const sessionId = res.locals.sessionId as string | undefined;
  if (!sessionId) throw ApiError.badRequest('A valid X-Session-Id header is required');
  return sessionId;
}

export async function startConversation(_req: Request, res: Response) {
  const { body } = getValid<StartConversationBody>(res);
  ok(
    res,
    await service.startConversation(requireSessionId(res), body.commoditySlug),
    undefined,
    201,
  );
}

export async function sendMessage(_req: Request, res: Response) {
  const { body, params } = getValid<SendMessageBody, unknown, IdParams>(res);
  ok(res, await service.sendMessage(params.id, requireSessionId(res), body.message));
}

export async function getConversation(_req: Request, res: Response) {
  const { params } = getValid<unknown, unknown, IdParams>(res);
  ok(res, await service.getConversation(params.id, requireSessionId(res)));
}
