-- User account state and phone verification fields.
ALTER TABLE "User"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- Financial details for invoices. Existing invoices default to IRR.
ALTER TABLE "Invoice"
  ADD COLUMN "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "otherCharges" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'IRR';

-- Composite unique keys allow foreign keys to enforce tenant ownership.
CREATE UNIQUE INDEX "Party_id_organizationId_key" ON "Party"("id", "organizationId");
CREATE UNIQUE INDEX "Product_id_organizationId_key" ON "Product"("id", "organizationId");
CREATE UNIQUE INDEX "Invoice_id_organizationId_key" ON "Invoice"("id", "organizationId");
CREATE UNIQUE INDEX "Batch_id_organizationId_productId_key" ON "Batch"("id", "organizationId", "productId");

-- Backfill tenant id on invoice items before making it mandatory.
ALTER TABLE "InvoiceItem" ADD COLUMN "organizationId" TEXT;
UPDATE "InvoiceItem" AS item
SET "organizationId" = invoice."organizationId"
FROM "Invoice" AS invoice
WHERE item."invoiceId" = invoice."id";
ALTER TABLE "InvoiceItem" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE UNIQUE INDEX "InvoiceItem_id_organizationId_invoiceId_productId_key"
  ON "InvoiceItem"("id", "organizationId", "invoiceId", "productId");

-- Replace single-column references with organization-scoped foreign keys.
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_partyId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_partyId_organizationId_fkey"
  FOREIGN KEY ("partyId", "organizationId") REFERENCES "Party"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Batch" DROP CONSTRAINT "Batch_productId_fkey";
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_invoiceId_fkey";
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productId_organizationId_fkey"
  FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_invoiceId_organizationId_fkey"
  FOREIGN KEY ("invoiceId", "organizationId") REFERENCES "Invoice"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_invoiceId_fkey";
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_productId_fkey";
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_organizationId_fkey"
  FOREIGN KEY ("invoiceId", "organizationId") REFERENCES "Invoice"("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_productId_organizationId_fkey"
  FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "InvoiceItem_invoiceId_organizationId_idx" ON "InvoiceItem"("invoiceId", "organizationId");
CREATE INDEX "InvoiceItem_productId_organizationId_idx" ON "InvoiceItem"("productId", "organizationId");
DROP INDEX "InvoiceItem_invoiceId_idx";
DROP INDEX "InvoiceItem_productId_idx";

-- Verification challenges and one-time password reset tokens store only hashes.
CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PhoneVerificationCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhoneVerificationCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PhoneVerificationCode_userId_key" ON "PhoneVerificationCode"("userId");
CREATE INDEX "PhoneVerificationCode_phone_idx" ON "PhoneVerificationCode"("phone");
CREATE INDEX "PhoneVerificationCode_expiresAt_idx" ON "PhoneVerificationCode"("expiresAt");
ALTER TABLE "PhoneVerificationCode" ADD CONSTRAINT "PhoneVerificationCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-organization, per-year invoice number counters.
CREATE TABLE "InvoiceSequence" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "type" "InvoiceType" NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvoiceSequence_organizationId_year_type_key"
  ON "InvoiceSequence"("organizationId", "year", "type");
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payments are retained as accounting records; reversals update state instead of deleting rows.
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER');
CREATE TYPE "PaymentStatus" AS ENUM ('ACTIVE', 'REVERSED');
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "reference" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'ACTIVE',
  "reversedAt" TIMESTAMP(3),
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Payment_invoiceId_organizationId_idx" ON "Payment"("invoiceId", "organizationId");
CREATE INDEX "Payment_createdByUserId_idx" ON "Payment"("createdByUserId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_organizationId_fkey"
  FOREIGN KEY ("invoiceId", "organizationId") REFERENCES "Invoice"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only stock movement/cost ledger. No application endpoint updates or deletes these rows.
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE_IN', 'SALE_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'REVERSAL_IN', 'REVERSAL_OUT');
CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "invoiceItemId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unitCost" DECIMAL(12,2),
  "unitPrice" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockMovement_organizationId_productId_createdAt_idx"
  ON "StockMovement"("organizationId", "productId", "createdAt");
CREATE INDEX "StockMovement_batchId_createdAt_idx" ON "StockMovement"("batchId", "createdAt");
CREATE INDEX "StockMovement_invoiceId_organizationId_idx" ON "StockMovement"("invoiceId", "organizationId");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_organizationId_fkey"
  FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_organizationId_productId_fkey"
  FOREIGN KEY ("batchId", "organizationId", "productId") REFERENCES "Batch"("id", "organizationId", "productId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_invoiceId_organizationId_fkey"
  FOREIGN KEY ("invoiceId", "organizationId") REFERENCES "Invoice"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_invoiceItemId_organizationId_invoiceId_productId_fkey"
  FOREIGN KEY ("invoiceItemId", "organizationId", "invoiceId", "productId")
  REFERENCES "InvoiceItem"("id", "organizationId", "invoiceId", "productId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Double-entry general ledger. Application posting routines create balanced, immutable entries.
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AccountType" NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Account_organizationId_code_key" ON "Account"("organizationId", "code");
CREATE UNIQUE INDEX "Account_id_organizationId_key" ON "Account"("id", "organizationId");
ALTER TABLE "Account" ADD CONSTRAINT "Account_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "JournalEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JournalEntry_organizationId_sourceType_sourceId_key"
  ON "JournalEntry"("organizationId", "sourceType", "sourceId");
CREATE UNIQUE INDEX "JournalEntry_id_organizationId_key" ON "JournalEntry"("id", "organizationId");
CREATE INDEX "JournalEntry_organizationId_transactionDate_idx" ON "JournalEntry"("organizationId", "transactionDate");
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "JournalLine" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "JournalLine_organizationId_accountId_createdAt_idx"
  ON "JournalLine"("organizationId", "accountId", "createdAt");
CREATE INDEX "JournalLine_journalEntryId_organizationId_idx" ON "JournalLine"("journalEntryId", "organizationId");
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_organizationId_fkey"
  FOREIGN KEY ("journalEntryId", "organizationId") REFERENCES "JournalEntry"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_organizationId_fkey"
  FOREIGN KEY ("accountId", "organizationId") REFERENCES "Account"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
