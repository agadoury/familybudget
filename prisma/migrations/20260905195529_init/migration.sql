-- CreateEnum
CREATE TYPE "Person" AS ENUM ('ALEX', 'SELIA');

-- CreateEnum
CREATE TYPE "Owner" AS ENUM ('SHARED', 'ALEX', 'SELIA');

-- CreateEnum
CREATE TYPE "AccountOwner" AS ENUM ('ALEX', 'SELIA', 'JOINT');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('WEEKLY', 'BI_WEEKLY', 'SEMI_MONTHLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "IncomeDestination" AS ENUM ('SPENDING_ACCOUNT', 'RRSP', 'STOCK_PLAN', 'TFSA', 'DEBT_PAYDOWN', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('FIXED', 'FLEXIBLE', 'SAVINGS');

-- CreateEnum
CREATE TYPE "DebtType" AS ENUM ('LOC', 'CREDIT_CARD', 'CAR_LOAN', 'LEASE', 'MORTGAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "MinimumType" AS ENUM ('FIXED', 'PERCENT_OF_BALANCE', 'INTEREST_ONLY');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('MINIMUM', 'EXTRA', 'LUMP_SUM');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('RRSP', 'TFSA', 'RESP', 'NON_REGISTERED', 'STOCK_PLAN', 'CASH');

-- CreateEnum
CREATE TYPE "ContributionSource" AS ENUM ('PAYROLL', 'SPENDING_ACCOUNT', 'LUMP_SUM');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('UNCONFIRMED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'FR');

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "alexName" TEXT NOT NULL DEFAULT 'Alex',
    "seliaName" TEXT NOT NULL DEFAULT 'Sélia',
    "language" "Language" NOT NULL DEFAULT 'EN',
    "defaultScenarioId" TEXT,
    "defaultReturnBps" INTEGER NOT NULL DEFAULT 600,
    "homeValueCents" INTEGER NOT NULL DEFAULT 0,
    "cashBufferCents" INTEGER NOT NULL DEFAULT 200000,
    "includeHomeEquity" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" "Person",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "person" "Person",
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "destination" "IncomeDestination" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "notes" TEXT,
    "investmentAccountId" TEXT,
    "updatedBy" "Person",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "type" "ExpenseType" NOT NULL,
    "owner" "Owner" NOT NULL DEFAULT 'SHARED',
    "essential" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "notes" TEXT,
    "updatedBy" "Person",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DebtType" NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "balanceAsOf" DATE NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "minimumType" "MinimumType" NOT NULL DEFAULT 'FIXED',
    "minimumCents" INTEGER NOT NULL DEFAULT 0,
    "minimumBps" INTEGER NOT NULL DEFAULT 0,
    "minimumFloorCents" INTEGER NOT NULL DEFAULT 0,
    "plannedExtraCents" INTEGER NOT NULL DEFAULT 0,
    "endDate" DATE,
    "amortizationMonths" INTEGER,
    "renewalDate" DATE,
    "includeInPayoff" BOOLEAN NOT NULL DEFAULT true,
    "includeInNetWorth" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedBy" "Person",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtRate" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "annualRateBps" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "DebtRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "type" "PaymentType" NOT NULL,
    "note" TEXT,
    "createdBy" "Person",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LumpSumSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "months" INTEGER[],
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "sourceIncomeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedBy" "Person",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LumpSumSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentAccount" (
    "id" TEXT NOT NULL,
    "owner" "AccountOwner" NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "subType" TEXT,
    "parentId" TEXT,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "balanceAsOf" DATE NOT NULL,
    "returnBps" INTEGER NOT NULL DEFAULT 600,
    "includeInNetWorth" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedBy" "Person",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "source" "ContributionSource" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "incomeId" TEXT,
    "notes" TEXT,
    "updatedBy" "Person",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionRoom" (
    "id" TEXT NOT NULL,
    "person" "Person" NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "roomCents" INTEGER NOT NULL,
    "asOf" DATE NOT NULL,
    "notes" TEXT,
    "updatedBy" "Person",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContributionRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "overrides" JSONB NOT NULL,
    "createdBy" "Person",
    "updatedBy" "Person",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bonus" (
    "id" TEXT NOT NULL,
    "person" "Person" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "expectedYear" INTEGER NOT NULL,
    "expectedMonth" INTEGER NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'UNCONFIRMED',
    "pctAppliedBps" INTEGER NOT NULL DEFAULT 10000,
    "debtPaymentId" TEXT,
    "updatedBy" "Person",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "note" TEXT,
    "projectedPayoffMonth" DATE,
    "projectedInterestCents" INTEGER,
    "netWorthCents" INTEGER,
    "createdBy" "Person",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotDebt" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL,

    CONSTRAINT "SnapshotDebt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotAccount" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL,

    CONSTRAINT "SnapshotAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotSpend" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "SnapshotSpend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "editedBy" "Person" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebtRate_debtId_effectiveDate_idx" ON "DebtRate"("debtId", "effectiveDate");

-- CreateIndex
CREATE INDEX "DebtPayment_debtId_date_idx" ON "DebtPayment"("debtId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_incomeId_key" ON "Contribution"("incomeId");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionRoom_person_accountType_key" ON "ContributionRoom"("person", "accountType");

-- CreateIndex
CREATE UNIQUE INDEX "Bonus_debtPaymentId_key" ON "Bonus"("debtPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_month_key" ON "Snapshot"("month");

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotDebt_snapshotId_debtId_key" ON "SnapshotDebt"("snapshotId", "debtId");

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotAccount_snapshotId_accountId_key" ON "SnapshotAccount"("snapshotId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotSpend_snapshotId_category_key" ON "SnapshotSpend"("snapshotId", "category");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_investmentAccountId_fkey" FOREIGN KEY ("investmentAccountId") REFERENCES "InvestmentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtRate" ADD CONSTRAINT "DebtRate_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LumpSumSchedule" ADD CONSTRAINT "LumpSumSchedule_sourceIncomeId_fkey" FOREIGN KEY ("sourceIncomeId") REFERENCES "Income"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentAccount" ADD CONSTRAINT "InvestmentAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "InvestmentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InvestmentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "Income"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bonus" ADD CONSTRAINT "Bonus_debtPaymentId_fkey" FOREIGN KEY ("debtPaymentId") REFERENCES "DebtPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotDebt" ADD CONSTRAINT "SnapshotDebt_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotDebt" ADD CONSTRAINT "SnapshotDebt_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotAccount" ADD CONSTRAINT "SnapshotAccount_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotAccount" ADD CONSTRAINT "SnapshotAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InvestmentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotSpend" ADD CONSTRAINT "SnapshotSpend_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
