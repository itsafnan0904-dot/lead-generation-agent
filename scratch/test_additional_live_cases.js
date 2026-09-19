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

  const company = await prisma.company.findFirst({
    where: { name: 'Acme High-Performance Engineering' },
  });
  const contact = await prisma.contact.findFirst({
    where: { email: 'sarah.connor@acme-eng.com' },
  });

  // Test scenario with Afnan Jawad as assigned user
  const afnanUser = await prisma.user.findFirst({
    where: { email: 'afnanjawad174m@gmail.com' },
  });

  const leadAfnan = await prisma.lead.create({
    data: {
      companyId: company.id,
      primaryContactId: contact.id,
      assignedUserId: afnanUser?.id,
      status: 'COLD_LEAD',
    },
  });

  // Test scenario with NULL assigned user (should resolve from connected Gmail Account)
  const leadNoUser = await prisma.lead.create({
    data: {
      companyId: company.id,
      primaryContactId: contact.id,
      assignedUserId: null,
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

  console.log('\n--- Test Case 1: Assigned User Afnan Jawad ---');
  const draft1 = await outreachService.generateDraft(leadAfnan.id, {
    tone: 'consultative',
  });
  console.log('Subject 1:', draft1.subject);
  console.log('Body 1:\n' + draft1.bodyText);
  console.log('Tokens 1:', draft1.aiUsageMetadata?.usage);

  console.log('\n--- Test Case 2: Unassigned Lead (Resolves from connected Gmail) ---');
  const draft2 = await outreachService.generateDraft(leadNoUser.id, {
    tone: 'consultative',
  });
  console.log('Subject 2:', draft2.subject);
  console.log('Body 2:\n' + draft2.bodyText);
  console.log('Tokens 2:', draft2.aiUsageMetadata?.usage);

  const placeholderRegex = /\[(Your |Name|Position|Company|Contact|Title|Phone|Email)[\w\s]*\]/i;
  console.log('\nValidation Summary:');
  console.log('Draft 1 placeholders found:', placeholderRegex.test(draft1.bodyText) ? 'FAIL ❌' : 'PASS ✅ None');
  console.log('Draft 1 has Afnan Jawad signature:', draft1.bodyText.includes('Afnan Jawad') ? 'PASS ✅' : 'FAIL ❌');
  console.log('Draft 2 placeholders found:', placeholderRegex.test(draft2.bodyText) ? 'FAIL ❌' : 'PASS ✅ None');
  console.log('Draft 2 has Afnan / Sales signature:', (draft2.bodyText.includes('Afnan') || draft2.bodyText.includes('Sales Team')) ? 'PASS ✅' : 'FAIL ❌');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
