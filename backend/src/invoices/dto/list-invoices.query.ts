import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsCalendarDate, NotBefore } from '../../common/validators';
import { PageQuery } from '../../common/paging';
import { VISIBLE_STATUSES, type VisibleStatus } from '../lifecycle';

/**
 * Sortable fields, as an allow-list.
 *
 * The query value is matched against this and then mapped to a column by the
 * repository, so nothing a caller types ever reaches SQL as an identifier.
 */
export const SORT_FIELDS = ['invoiceDate', 'dueDate', 'totalAmount'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const ORDERINGS = ['ASC', 'DESC'] as const;
export type Ordering = (typeof ORDERINGS)[number];

export class ListInvoicesQuery extends PageQuery {
  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'invoiceDate' })
  @IsOptional()
  @IsIn(SORT_FIELDS, { message: `sortBy must be one of: ${SORT_FIELDS.join(', ')}` })
  sortBy?: SortField;

  @ApiPropertyOptional({ enum: ORDERINGS, default: 'DESC' })
  @IsOptional()
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsIn(ORDERINGS, { message: 'ordering must be ASC or DESC' })
  ordering?: Ordering;

  @ApiPropertyOptional({
    enum: VISIBLE_STATUSES,
    description: 'Overdue is worked out from the due date, not stored.',
  })
  @IsOptional()
  @IsIn(VISIBLE_STATUSES, { message: `status must be one of: ${VISIBLE_STATUSES.join(', ')}` })
  status?: VisibleStatus;

  @ApiPropertyOptional({
    example: 'braddon',
    maxLength: 100,
    description: 'Partial, case-insensitive match on invoice number or customer name.',
  })
  @IsOptional()
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-01-01',
    description: 'invoiceDate from.',
  })
  @IsOptional()
  @IsCalendarDate()
  fromDate?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-12-31',
    description: 'invoiceDate to.',
  })
  @IsOptional()
  @IsCalendarDate()
  @NotBefore('fromDate')
  toDate?: string;
}
