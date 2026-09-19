const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });

const { PrismaClient } = require('@ai-sales-agent/database');
const { OpenAIProvider } = require(path.resolve(__dirname, '../apps/api/dist/ai/providers/openai.provider'));
const { AIOrchestratorService } = require(path.resolve(__dirname, '../apps/api/dist/ai/services/ai-orchestrator.service'));
const { OutreachService } = require(path.resolve(__dirname, '../apps/api/dist/outreach/outreach.service'));
const { GmailService } = require(path.resolve(__dirname, '../apps/api/dist/gmail/gmail.service'));
const { TokenEncryptionService } = require(path.resolve(__dirname, '../apps/api/dist/gmail/token-encryption.service'));
const { RestrictionEngineService } = require(path.resolve(__dirname, '../apps/api/dist/restrictions/restriction-engine.service'));
const { AuditService } = require(path.resolve(__dirname, '../apps/api/dist/audit/audit.service'));
const { NotificationsService } = require(path.resolve(__dirname, '../apps/api/dist/notifications/notifications.service'));

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  console.log('=== VERIFYING SAFE TEST MODE CONFIGURATION ===');
  const isSafeTestMode = (process.env.OUTREACH_SAFE_TEST_MODE || '').toLowerCase() === 'true';
  const testRecipient = process.env.OUTREACH_TEST_RECIPIENT_EMAIL;

  console.log(`OUTREACH_SAFE_TEST_MODE: ${isSafeTestMode}`);
  console.log(`OUTREACH_TEST_RECIPIENT_EMAIL: ${testRecipient}`);

  if (!isSafeTestMode) {
    throw new Error('SAFETY CHECK FAILED: OUTREACH_SAFE_TEST_MODE is not true!');
  }
  if (testRecipient !== '70176613@student.uol.edu.pk' && testRecipient !== '70176616@student.uol.edu.pk') {
    throw new Error(`SAFETY CHECK FAILED: Unexpected test recipient '${testRecipient}'`);
  }

  // Create clean test company, contact, and lead
  let company = await prisma.company.findFirst({
    where: { name: 'Titan Industrial Systems' },
  });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Titan Industrial Systems',
        domain: 'titan-industrial.com',
        industry: 'Precision Heavy Manufacturing',
      },
    });
  }

  let contact = await prisma.contact.findFirst({
    where: { email: 'david.miller@titan-industrial.com' },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        companyId: company.id,
        firstName: 'David',
        lastName: 'Miller',
        email: 'david.miller@titan-industrial.com',
        title: 'VP of Manufacturing',
      },
    });
  }

  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
  });

  const lead = await prisma.lead.create({
    data: {
      companyId: company.id,
      primaryContactId: contact.id,
      assignedUserId: adminUser?.id,
      status: 'COLD_LEAD',
    },
  });

  const prismaWrapper = { client: prisma };
  const openAIProvider = new OpenAIProvider();
  const orchestrator = new AIOrchestratorService(openAIProvider, prismaWrapper);
  const encryptionService = new TokenEncryptionService();
  const auditService = new AuditService(prismaWrapper);
  const notificationsService = new NotificationsService(prismaWrapper);
  const restrictionEngine = new RestrictionEngineService(prismaWrapper, orchestrator, auditService, notificationsService);
  const gmailService = new GmailService(prismaWrapper, encryptionService, auditService);

  const outreachService = new OutreachService(
    prismaWrapper,
    gmailService,
    orchestrator,
    restrictionEngine,
    auditService,
    notificationsService,
  );

  console.log('\n--- 1. Generating Outreach Draft with Real Sender Identity ---');
  const draft = await outreachService.generateDraft(lead.id, {
    tone: 'professional and consultative',
    additionalContext: 'Exploring manufacturing automation and precision parts supply.',
  });

  console.log('Draft ID:', draft.id);
  console.log('Draft Subject:', draft.subject);
  console.log('Draft Body:\n----------------------------------------\n' + draft.bodyText + '\n----------------------------------------');

  console.log('\n--- 2. Sending Draft with Live Safe Test Mode Redirection ---');
  const sendResult = await outreachService.sendDraft(draft.id);

  console.log('\n=== REAL SEND DISPATCH RESULT ===');
  console.log('Draft ID:', sendResult.draftId);
  console.log('Status:', sendResult.status);
  console.log('Gmail Message ID:', sendResult.gmailMessageId);
  console.log('Gmail Thread ID:', sendResult.gmailThreadId);
  console.log('Original Intended Prospect Recipient:', sendResult.originalRecipient);
  console.log('ACTUAL Recipient Used (Safe Test Mode Target):', sendResult.actualRecipientUsed);
  console.log('Safe Test Mode Active:', sendResult.safeTestModeActive);
  console.log('Sent Timestamp:', sendResult.sentAt);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
