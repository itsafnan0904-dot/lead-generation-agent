-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALES_REP', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadLifecycleStatus" AS ENUM ('COLD_LEAD', 'CONTACTED', 'RESPONDED', 'INTERESTED', 'GATHERING_REQUIREMENTS', 'QUALIFIED', 'DEAL_DISCUSSION', 'WON', 'LOST', 'WAITING_FOR_CLIENT', 'FOLLOW_UP_REQUIRED', 'HUMAN_REVIEW', 'RESTRICTED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "RestrictionCheckResult" AS ENUM ('CLEAR', 'HUMAN_REVIEW', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "RestrictionEntityType" AS ENUM ('COMPANY', 'CONTACT', 'LEAD');

-- CreateEnum
CREATE TYPE "HumanReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "AIActionStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('INFO', 'IMPORTANT', 'ACTION_REQUIRED');

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SALES_REP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "targetCriteria" JSONB,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "location" TEXT,
    "country" TEXT,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "title" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "timezone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "primaryContactId" TEXT,
    "campaignId" TEXT,
    "assignedUserId" TEXT,
    "status" "LeadLifecycleStatus" NOT NULL DEFAULT 'COLD_LEAD',
    "scoreTotal" INTEGER NOT NULL DEFAULT 0,
    "scoreServiceMatch" INTEGER NOT NULL DEFAULT 0,
    "scoreCompanyRelevance" INTEGER NOT NULL DEFAULT 0,
    "scoreContactQuality" INTEGER NOT NULL DEFAULT 0,
    "scoreProjectPotential" INTEGER NOT NULL DEFAULT 0,
    "scoreLocationMatch" INTEGER NOT NULL DEFAULT 0,
    "scoreBreakdownReason" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Research" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "companySummary" TEXT,
    "newsAndEvents" JSONB,
    "painPoints" JSONB,
    "techStack" JSONB,
    "keyInsights" JSONB,
    "rawResearchData" JSONB,
    "sources" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Research_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "gmailThreadId" TEXT,
    "subject" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "gmailMessageId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scope" JSONB,
    "budget" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timeline" TEXT,
    "documentKey" TEXT,
    "documentBucket" TEXT,
    "documentName" TEXT,
    "documentMime" TEXT,
    "documentSize" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "budgetFit" BOOLEAN,
    "authorityFit" BOOLEAN,
    "needFit" BOOLEAN,
    "timelineFit" BOOLEAN,
    "technicalFit" BOOLEAN,
    "fitSummary" TEXT,
    "dealBlockers" JSONB,
    "answers" JSONB,
    "qualifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestrictionCheck" (
    "id" TEXT NOT NULL,
    "entityType" "RestrictionEntityType" NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "leadId" TEXT,
    "result" "RestrictionCheckResult" NOT NULL,
    "matchedRules" JSONB,
    "reason" TEXT,
    "checkedPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestrictionCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanReview" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "conversationId" TEXT,
    "assignedToId" TEXT,
    "status" "HumanReviewStatus" NOT NULL DEFAULT 'PENDING',
    "triggerReason" TEXT NOT NULL,
    "aiDraftContent" TEXT,
    "reviewedContent" TEXT,
    "reviewNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HumanReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAction" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "conversationId" TEXT,
    "messageId" TEXT,
    "actionType" TEXT NOT NULL,
    "promptSnapshot" TEXT,
    "rawOutput" TEXT,
    "parsedPayload" JSONB,
    "modelUsed" TEXT,
    "tokenUsage" JSONB,
    "latencyMs" INTEGER,
    "status" "AIActionStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldState" JSONB,
    "newState" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Company_domain_key" ON "Company"("domain");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- CreateIndex
CREATE INDEX "Contact_firstName_lastName_idx" ON "Contact"("firstName", "lastName");

-- CreateIndex
CREATE INDEX "Lead_companyId_idx" ON "Lead"("companyId");

-- CreateIndex
CREATE INDEX "Lead_primaryContactId_idx" ON "Lead"("primaryContactId");

-- CreateIndex
CREATE INDEX "Lead_campaignId_idx" ON "Lead"("campaignId");

-- CreateIndex
CREATE INDEX "Lead_assignedUserId_idx" ON "Lead"("assignedUserId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_scoreTotal_idx" ON "Lead"("scoreTotal");

-- CreateIndex
CREATE UNIQUE INDEX "Research_leadId_key" ON "Research"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_gmailThreadId_key" ON "Conversation"("gmailThreadId");

-- CreateIndex
CREATE INDEX "Conversation_leadId_idx" ON "Conversation"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_gmailMessageId_key" ON "Message"("gmailMessageId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_sentAt_idx" ON "Message"("sentAt");

-- CreateIndex
CREATE INDEX "Project_leadId_idx" ON "Project"("leadId");

-- CreateIndex
CREATE INDEX "Qualification_leadId_idx" ON "Qualification"("leadId");

-- CreateIndex
CREATE INDEX "RestrictionCheck_entityType_idx" ON "RestrictionCheck"("entityType");

-- CreateIndex
CREATE INDEX "RestrictionCheck_companyId_idx" ON "RestrictionCheck"("companyId");

-- CreateIndex
CREATE INDEX "RestrictionCheck_contactId_idx" ON "RestrictionCheck"("contactId");

-- CreateIndex
CREATE INDEX "RestrictionCheck_leadId_idx" ON "RestrictionCheck"("leadId");

-- CreateIndex
CREATE INDEX "RestrictionCheck_result_idx" ON "RestrictionCheck"("result");

-- CreateIndex
CREATE INDEX "RestrictionCheck_createdAt_idx" ON "RestrictionCheck"("createdAt");

-- CreateIndex
CREATE INDEX "HumanReview_leadId_idx" ON "HumanReview"("leadId");

-- CreateIndex
CREATE INDEX "HumanReview_conversationId_idx" ON "HumanReview"("conversationId");

-- CreateIndex
CREATE INDEX "HumanReview_assignedToId_idx" ON "HumanReview"("assignedToId");

-- CreateIndex
CREATE INDEX "HumanReview_status_idx" ON "HumanReview"("status");

-- CreateIndex
CREATE INDEX "AIAction_leadId_idx" ON "AIAction"("leadId");

-- CreateIndex
CREATE INDEX "AIAction_conversationId_idx" ON "AIAction"("conversationId");

-- CreateIndex
CREATE INDEX "AIAction_messageId_idx" ON "AIAction"("messageId");

-- CreateIndex
CREATE INDEX "AIAction_actionType_idx" ON "AIAction"("actionType");

-- CreateIndex
CREATE INDEX "AIAction_createdAt_idx" ON "AIAction"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_userId_idx" ON "AuditEvent"("userId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Research" ADD CONSTRAINT "Research_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestrictionCheck" ADD CONSTRAINT "RestrictionCheck_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestrictionCheck" ADD CONSTRAINT "RestrictionCheck_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestrictionCheck" ADD CONSTRAINT "RestrictionCheck_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReview" ADD CONSTRAINT "HumanReview_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReview" ADD CONSTRAINT "HumanReview_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReview" ADD CONSTRAINT "HumanReview_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
