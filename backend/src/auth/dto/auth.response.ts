import { ApiProperty } from '@nestjs/swagger';

export class AccountDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email', example: 'reviewer@simpleinvoice.dev' })
  email: string;

  @ApiProperty({ example: 'Ops Reviewer' })
  fullname: string;
}

export class TokenDto {
  @ApiProperty({ description: 'Send as `Authorization: Bearer <token>`.' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 3600, description: 'Lifetime in seconds (JWT_TTL_SECONDS).' })
  expiresIn: number;

  @ApiProperty({ type: AccountDto })
  account: AccountDto;
}
