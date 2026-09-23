import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VISIBLE_STATUSES, type VisibleStatus } from '../lifecycle';

/**
 * Field names here follow the sample payload in the brief (invoiceSubTotal,
 * totalTax, ...), not the shorter internal column names. The presenter bridges
 * the two, which is the point of having one.
 */

export class CustomerView {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Braddon Freight Co' })
  fullname: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiPropertyOptional({ nullable: true, example: '+61 2 6100 4455' })
  mobileNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;
}

export class InvoiceItemView {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Freight forwarding — Sydney to Perth' })
  name: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 1000 })
  rate: number;

  @ApiProperty({ example: 2000, description: 'quantity x rate' })
  amount: number;
}

/** A row in the list. Deliberately excludes line items so listing stays one query. */
export class InvoiceRow {
  @ApiProperty({ format: 'uuid' })
  invoiceId: string;

  @ApiProperty({ example: 'SI-2026-0148' })
  invoiceNumber: string;

  @ApiPropertyOptional({ nullable: true, example: 'PO-77431' })
  invoiceReference: string | null;

  @ApiProperty({ format: 'date', example: '2026-06-03' })
  invoiceDate: string;

  @ApiProperty({ format: 'date', example: '2026-07-03' })
  dueDate: string;

  @ApiProperty({ example: 'AUD' })
  currency: string;

  @ApiProperty({ example: 'AU$' })
  currencySymbol: string;

  @ApiProperty({ example: 2180 })
  totalAmount: number;

  @ApiProperty({ example: 728.66 })
  balanceAmount: number;

  @ApiProperty({ enum: VISIBLE_STATUSES, example: 'Overdue' })
  status: VisibleStatus;

  @ApiProperty({ type: CustomerView })
  customer: CustomerView;
}

export class InvoiceView extends InvoiceRow {
  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ example: 2000 })
  invoiceSubTotal: number;

  @ApiProperty({ example: 10, description: 'Tax rate applied, as a percentage.' })
  taxRate: number;

  @ApiProperty({ example: 200 })
  totalTax: number;

  @ApiProperty({ example: 20 })
  totalDiscount: number;

  @ApiProperty({ example: 1451.34 })
  totalPaid: number;

  @ApiProperty({ type: [InvoiceItemView] })
  items: InvoiceItemView[];

  @ApiProperty({ format: 'uuid' })
  createdBy: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}
