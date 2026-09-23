import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ format: 'email', example: 'reviewer@simpleinvoice.dev' })
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  email: string;

  // bcrypt only looks at the first 72 bytes and an unbounded field is a free
  // way to burn CPU, so the length is capped. No complexity rules: the brief
  // puts password policy out of scope.
  @ApiProperty({ format: 'password', example: 'invoice2026', maxLength: 72 })
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  @MaxLength(72, { message: 'password cannot exceed 72 characters' })
  password: string;
}
