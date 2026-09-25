import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser } from '@vehicle-vault/shared';

import { AppConfigService } from '../../../config/app-config.service';
import { AuthService } from '../../../modules/auth/auth.service';
import type { JwtPayload } from '../../../modules/auth/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    appConfigService: AppConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: appConfigService.jwtSecret,
    });
  }

  /**
   * The signed-in user, plus the session the token was issued to (see
   * `CurrentSessionId`). A token from before sessions names none.
   */
  async validate(payload: JwtPayload): Promise<AuthUser & { sessionId?: string }> {
    const user = await this.authService.getAuthUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    return payload.sid ? { ...user, sessionId: payload.sid } : user;
  }
}
