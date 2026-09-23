-- Rules the API already enforces, restated in the database.
--
-- Prisma's schema language has no way to express a CHECK, so these live in a
-- hand-written migration. The application gives a good error message; the
-- constraint is what keeps the rule true for anything that goes round the API —
-- a bad backfill, a fix-up in psql, or a second service added later.

ALTER TABLE "invoices"
  ADD CONSTRAINT "ck_invoices_due_on_or_after_issue"
  CHECK ("due_date" >= "invoice_date");

ALTER TABLE "invoices"
  ADD CONSTRAINT "ck_invoices_tax_rate_range"
  CHECK ("tax_rate" >= 0 AND "tax_rate" <= 100);

-- balance_amount is deliberately absent: an overpaid invoice has a negative
-- balance and that is worth keeping.
ALTER TABLE "invoices"
  ADD CONSTRAINT "ck_invoices_amounts_non_negative"
  CHECK (
    "invoice_sub_total" >= 0
    AND "total_tax" >= 0
    AND "total_discount" >= 0
    AND "total_amount" >= 0
    AND "total_paid" >= 0
  );

ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "ck_invoice_lines_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "ck_invoice_lines_rate_positive"
  CHECK ("rate" > 0);
