import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function contextFor(user: Partial<AuthUser> | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function reflectorReturning(roles: string[] | undefined): Reflector {
  return { getAllAndOverride: () => roles } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('allows the request when no roles are required', () => {
    const guard = new RolesGuard(reflectorReturning(undefined));

    expect(guard.canActivate(contextFor({ role: 'user' }))).toBe(true);
  });

  it('allows the request when the user has a required role', () => {
    const guard = new RolesGuard(reflectorReturning(['admin']));

    expect(guard.canActivate(contextFor({ role: 'admin' }))).toBe(true);
  });

  it('rejects the request when the user lacks the required role', () => {
    const guard = new RolesGuard(reflectorReturning(['admin']));

    expect(() => guard.canActivate(contextFor({ role: 'user' }))).toThrow(ForbiddenException);
  });

  it('rejects the request when no user is attached', () => {
    const guard = new RolesGuard(reflectorReturning(['admin']));

    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });

  it('exposes the metadata key used by the @Roles decorator', () => {
    expect(ROLES_KEY).toBe('roles');
  });
});
