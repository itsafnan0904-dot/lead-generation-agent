-- CreateTable
CREATE TABLE "GmailAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailAccount_email_key" ON "GmailAccount"("email");

-- CreateIndex
CREATE INDEX "GmailAccount_isActive_idx" ON "GmailAccount"("isActive");

-- CreateIndex
CREATE INDEX "GmailAccount_connectedByUserId_idx" ON "GmailAccount"("connectedByUserId");

-- AddForeignKey
ALTER TABLE "GmailAccount" ADD CONSTRAINT "GmailAccount_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
