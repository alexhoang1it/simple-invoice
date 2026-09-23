import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../env';
import { AuthService, type JwtClaims } from './auth.service';
import { type AccountDto } from './dto/auth.response';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    });
  }

  // Runs only after the signature and expiry check out. Whatever this returns
  // becomes `request.user`.
  validate(claims: JwtClaims): Promise<AccountDto> {
    return this.auth.accountFor(claims);
  }
}
