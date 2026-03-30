import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@vehicle-vault/shared';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    return data ? user?.[data] : user;
  },
);
