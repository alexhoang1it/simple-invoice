import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsCalendarDate, NotBefore } from '../../common/validators';

const clean = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const cleanLower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CustomerInput {
  @ApiProperty({ example: 'Braddon Freight Co', maxLength: 160 })
  @Transform(clean)
  @IsString()
  @IsNotEmpty({ message: 'customer.fullname is required' })
  @MaxLength(160)
  fullname: string;

  @ApiProperty({ format: 'email', example: 'ap@braddonfreight.com.au', maxLength: 255 })
  @Transform(cleanLower)
  @IsEmail({}, { message: 'customer.email must be a valid email address' })
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ example: '+61 2 6100 4455', maxLength: 32 })
  @IsOptional()
  @Transform(clean)
  @IsString()
  @MaxLength(32)
  mobileNumber?: string;

  @ApiPropertyOptional({ example: '14 Lonsdale St, Braddon ACT 2612', maxLength: 512 })
  @IsOptional()
  @Transform(clean)
  @IsString()
  @MaxLength(512)
  address?: string;
}

export class LineInputDto {
  @ApiProperty({ example: 'Freight forwarding — Sydney to Perth', maxLength: 255 })
  @Transform(clean)
  @IsString()
  @IsNotEmpty({ message: 'lines.0.name is required' })
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 2, minimum: 1, description: 'Whole units only.' })
  @Type(() => Number)
  @IsInt({ message: 'lines.0.quantity must be a whole number' })
  @IsPositive({ message: 'lines.0.quantity must be greater than zero' })
  @Max(1_000_000)
  quantity: number;

  @ApiProperty({ example: 1000, minimum: 0, description: 'Unit price, up to 2 decimals.' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'lines.0.rate allows at most 2 decimal places' },
  )
  @IsPositive({ message: 'lines.0.rate must be greater than zero' })
  @Max(99_999_999.99)
  rate: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'SI-2026-0148', maxLength: 64, description: 'Must be unique.' })
  @Transform(clean)
  @IsString()
  @IsNotEmpty({ message: 'invoiceNumber is required' })
  @MaxLength(64)
  invoiceNumber: string;

  @ApiPropertyOptional({ example: 'PO-77431', maxLength: 64 })
  @IsOptional()
  @Transform(clean)
  @IsString()
  @MaxLength(64)
  reference?: string;

  @ApiProperty({ format: 'date', example: '2026-06-03' })
  @IsCalendarDate()
  invoiceDate: string;

  @ApiProperty({ format: 'date', example: '2026-07-03' })
  @IsCalendarDate()
  @NotBefore('invoiceDate')
  dueDate: string;

  @ApiProperty({ example: 'AUD', minLength: 3, maxLength: 3, description: 'ISO 4217 code.' })
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO 4217 code' })
  currency: string;

  @ApiPropertyOptional({ example: 'Q2 freight consolidation', maxLength: 1000 })
  @IsOptional()
  @Transform(clean)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ type: CustomerInput })
  @ValidateNested()
  @Type(() => CustomerInput)
  customer: CustomerInput;

  /**
   * An array even though only one is accepted today. The schema and the
   * calculator already handle many; lifting ArrayMaxSize is the only change
   * multi-line invoices would need here.
   */
  @ApiProperty({ type: [LineInputDto], minItems: 1, maxItems: 1 })
  @IsArray()
  @ArrayMinSize(1, { message: 'exactly one line is required' })
  @ArrayMaxSize(1, { message: 'exactly one line is required' })
  @ValidateNested({ each: true })
  @Type(() => LineInputDto)
  lines: LineInputDto[];

  @ApiPropertyOptional({ example: 10, default: 10, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'taxRate allows at most 2 decimal places' })
  @Min(0, { message: 'taxRate cannot be negative' })
  @Max(100, { message: 'taxRate cannot exceed 100' })
  taxRate?: number;

  @ApiPropertyOptional({
    example: 20,
    default: 0,
    minimum: 0,
    description: 'Cash off, after tax.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'discount allows at most 2 decimal places' })
  @Min(0, { message: 'discount cannot be negative' })
  @Max(99_999_999.99)
  discount?: number;
}
