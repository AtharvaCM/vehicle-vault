import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser } from '@vehicle-vault/shared';

import { AppConfigService } from '../../../config/app-config.service';
import { AuthService } from '../../../modules/auth/auth.service';

type JwtPayload = {
  sub: string;
  email: string;
  name: string;
};

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

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.authService.getAuthUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    return user;
  }
}
