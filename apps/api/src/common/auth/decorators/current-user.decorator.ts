import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@vehicle-vault/shared';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, context: ExecutionContext): any => {
    const request = context.switchToHttp().getRequest<{ user: any }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
