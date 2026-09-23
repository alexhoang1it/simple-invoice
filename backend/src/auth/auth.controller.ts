import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AllowAnonymous, Caller } from './auth.guard';
import { AccountDto, TokenDto } from './dto/auth.response';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @AllowAnonymous()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sign in',
    description: 'Trades email and password for a bearer token.',
  })
  @ApiOkResponse({ type: TokenDto })
  @ApiUnauthorizedResponse({ description: 'Email or password is incorrect.' })
  login(@Body() dto: LoginDto): Promise<TokenDto> {
    return this.auth.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Who am I',
    description: 'The web client calls this on load to check a stored token is still good.',
  })
  @ApiOkResponse({ type: AccountDto })
  @ApiUnauthorizedResponse({ description: 'Token missing, expired or invalid.' })
  me(@Caller() account: AccountDto): AccountDto {
    return account;
  }
}
