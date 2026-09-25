import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * The session the request's access token was issued to, or null for a token
 * from before sessions. Set by `JwtStrategy`; only on authenticated routes.
 */
export const CurrentSessionId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    const request = context.switchToHttp().getRequest<{ user?: { sessionId?: string } }>();
    return request.user?.sessionId ?? null;
  },
);
