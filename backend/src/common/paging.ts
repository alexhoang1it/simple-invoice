import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Type as Cast } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { env } from '../env';

/** Absolute cap, whatever PAGE_SIZE_MAX is set to. Stops a caller asking for the table. */
export const HARD_PAGE_LIMIT = 100;

export class PageQuery {
  @ApiProperty({ required: false, minimum: 1, default: 1, description: 'Page number, from 1.' })
  @IsOptional()
  @Cast(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number;

  @ApiProperty({
    required: false,
    minimum: 1,
    maximum: HARD_PAGE_LIMIT,
    default: env.PAGE_SIZE_DEFAULT,
    description: 'Rows per page. Clamped to the configured maximum.',
  })
  @IsOptional()
  @Cast(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1, { message: 'pageSize must be at least 1' })
  @Max(HARD_PAGE_LIMIT, { message: `pageSize cannot exceed ${HARD_PAGE_LIMIT}` })
  pageSize?: number;
}

export class Paging {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({ example: 33, description: 'Total rows matching the query, ignoring paging.' })
  total: number;
}

export interface Page<T> {
  data: T[];
  paging: Paging;
}

/** Resolves the requested window against configuration. */
export function resolveWindow(query: PageQuery): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? env.PAGE_SIZE_DEFAULT, env.PAGE_SIZE_MAX);

  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function page<T>(data: T[], paging: Paging): Page<T> {
  return { data, paging };
}

/** Swagger cannot see through a generic, so list endpoints name their row type. */
export function ApiPage<T extends Type<unknown>>(row: T, description?: string) {
  return applyDecorators(
    ApiExtraModels(Paging, row),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['data', 'paging'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(row) } },
          paging: { $ref: getSchemaPath(Paging) },
        },
      },
    }),
  );
}
