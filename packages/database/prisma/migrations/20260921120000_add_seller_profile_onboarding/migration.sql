-- CreateEnum
CREATE TYPE "RestrictionRuleType" AS ENUM ('SERVICE', 'INDUSTRY', 'KEYWORD');

-- CreateEnum
CREATE TYPE "InterventionTrigger" AS ENUM ('PRICING_DISCUSSION', 'CONTRACT_OR_LEGAL', 'MEETING_REQUESTED', 'OBJECTION_RAISED', 'DEAL_VALUE_ABOVE', 'READINESS_ABOVE', 'CUSTOM_KEYWORD');

-- CreateTable
CREATE TABLE "SellerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyName" TEXT,
    "title" TEXT,
    "bio" TEXT,
    "skills" TEXT[],
    "yearsExperience" INTEGER,
    "portfolioUrls" TEXT[],
    "caseStudies" JSONB,
    "tone" TEXT,
    "signature" TEXT,
    "resumeText" TEXT,
    "resumeFileName" TEXT,
    "resumeParsedData" JSONB,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerService" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "keywords" TEXT[],
    "priceMin" DECIMAL(12,2),
    "priceMax" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetMarket" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "regions" TEXT[],
    "industries" TEXT[],
    "minCompanySize" INTEGER,
    "maxCompanySize" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TargetMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestrictionRule" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" "RestrictionRuleType" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestrictionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionRule" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "trigger" "InterventionTrigger" NOT NULL,
    "threshold" DECIMAL(12,2),
    "keyword" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerProfile_userId_key" ON "SellerProfile"("userId");

-- CreateIndex
CREATE INDEX "SellerService_profileId_idx" ON "SellerService"("profileId");

-- CreateIndex
CREATE INDEX "TargetMarket_profileId_idx" ON "TargetMarket"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetMarket_profileId_countryCode_key" ON "TargetMarket"("profileId", "countryCode");

-- CreateIndex
CREATE INDEX "RestrictionRule_profileId_idx" ON "RestrictionRule"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "RestrictionRule_profileId_type_value_key" ON "RestrictionRule"("profileId", "type", "value");

-- CreateIndex
CREATE INDEX "InterventionRule_profileId_idx" ON "InterventionRule"("profileId");

-- AddForeignKey
ALTER TABLE "SellerProfile" ADD CONSTRAINT "SellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerService" ADD CONSTRAINT "SellerService_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetMarket" ADD CONSTRAINT "TargetMarket_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestrictionRule" ADD CONSTRAINT "RestrictionRule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionRule" ADD CONSTRAINT "InterventionRule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
