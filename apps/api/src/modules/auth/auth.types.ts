export type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  /** The session the token was issued to. Absent on tokens from before sessions. */
  sid?: string;
};

export type RefreshTokenPayload = {
  sub: string;
  type: 'refresh';
  jti?: string;
};
