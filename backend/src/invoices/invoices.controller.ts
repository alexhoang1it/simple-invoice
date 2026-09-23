import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Caller } from '../auth/auth.guard';
import { type AccountDto } from '../auth/dto/auth.response';
import { ApiPage, type Page } from '../common/paging';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceRow, InvoiceView } from './dto/invoice.response';
import { ListInvoicesQuery } from './dto/list-invoices.query';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Bearer token missing, expired or invalid.' })
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOperation({
    summary: 'List invoices',
    description:
      'Search, status filter, date range, sorting and paging are all applied in Postgres. ' +
      'The response never carries more rows than pageSize.',
  })
  @ApiPage(InvoiceRow, 'A page of invoices plus the total number of matches.')
  @ApiBadRequestResponse({ description: 'A query parameter failed validation.' })
  list(@Query() query: ListInvoicesQuery): Promise<Page<InvoiceRow>> {
    return this.invoices.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one invoice',
    description: 'Includes the customer and line items.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InvoiceView })
  @ApiBadRequestResponse({ description: 'The id is not a UUID.' })
  @ApiNotFoundResponse({ description: 'No invoice with that id.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<InvoiceView> {
    return this.invoices.get(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create an invoice',
    description:
      'Saved as a Draft. Every total is worked out from the line, tax rate and discount; ' +
      'the payload has no total fields and sending one is rejected.',
  })
  @ApiCreatedResponse({ type: InvoiceView, description: 'The invoice as stored.' })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiConflictResponse({ description: 'That invoice number is already in use.' })
  create(@Body() dto: CreateInvoiceDto, @Caller() caller: AccountDto): Promise<InvoiceView> {
    return this.invoices.create(dto, caller.id);
  }
}
