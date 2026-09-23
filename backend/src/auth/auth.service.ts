import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { env } from '../env';
import { PrismaService } from '../database/prisma.service';
import { type AccountDto, type TokenDto } from './dto/auth.response';
import { type LoginDto } from './dto/login.dto';

export interface JwtClaims {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

// A real bcrypt digest of a value nobody knows. When the email does not exist
// we still run a comparison against it, so "unknown account" and "wrong
// password" take the same time and cannot be told apart from outside.
const DECOY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<TokenDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    const ok = await compare(dto.password, user?.passwordHash ?? DECOY_HASH);

    if (!user || !ok) {
      // One message for both branches: never confirm whether an email is registered.
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const claims: JwtClaims = { sub: user.id, email: user.email };

    return {
      accessToken: await this.jwt.signAsync(claims),
      tokenType: 'Bearer',
      expiresIn: env.JWT_TTL_SECONDS,
      account: { id: user.id, email: user.email, fullname: user.fullname },
    };
  }

  /**
   * Resolves the account behind a token whose signature already verified.
   *
   * Reading the row on every request costs one primary-key lookup and buys
   * immediate revocation: delete an account and its tokens stop working now,
   * rather than whenever they happen to expire.
   */
  async accountFor(claims: JwtClaims): Promise<AccountDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true, fullname: true },
    });

    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    return user;
  }
}
