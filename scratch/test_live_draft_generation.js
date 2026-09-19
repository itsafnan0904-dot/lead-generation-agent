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

  console.log('--- Checking DB and Safe Test Mode ---');
  console.log('OUTREACH_SAFE_TEST_MODE:', process.env.OUTREACH_SAFE_TEST_MODE);
  console.log('OUTREACH_TEST_RECIPIENT_EMAIL:', process.env.OUTREACH_TEST_RECIPIENT_EMAIL);

  // Find or create an eligible COLD_LEAD for real draft generation
  let company = await prisma.company.findFirst({
    where: { name: 'Acme High-Performance Engineering' },
  });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Acme High-Performance Engineering',
        domain: 'acme-eng.com',
        industry: 'Structural & Civil Engineering',
      },
    });
  }

  let contact = await prisma.contact.findFirst({
    where: { email: 'sarah.connor@acme-eng.com' },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        companyId: company.id,
        firstName: 'Sarah',
        lastName: 'Connor',
        email: 'sarah.connor@acme-eng.com',
        title: 'Director of Procurement',
      },
    });
  }

  // Get active Admin user
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

  console.log(`Created test lead '${lead.id}' assigned to '${adminUser?.name}' (${adminUser?.email})`);

  // Initialize services
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

  console.log('\n--- Generating REAL AI Outreach Draft via OpenAI API (gpt-4o-mini) ---');
  const draft = await outreachService.generateDraft(lead.id, {
    tone: 'professional and consultative',
    additionalContext: 'Exploring custom structural fabrication partnerships and engineering services.',
  });

  console.log('\n=== REAL GENERATED DRAFT DETAILS ===');
  console.log('Draft ID:', draft.id);
  console.log('Subject:', draft.subject);
  console.log('Body Text:\n----------------------------------------\n' + draft.bodyText + '\n----------------------------------------');
  console.log('Call To Action:', draft.callToAction);
  console.log('Rationale:', draft.rationale);
  console.log('AI Usage Metadata:', JSON.stringify(draft.aiUsageMetadata, null, 2));

  // Check for bracket placeholders
  const placeholderRegex = /\[(Your |Name|Position|Company|Contact|Title|Phone|Email)[\w\s]*\]/i;
  const hasPlaceholders = placeholderRegex.test(draft.bodyText);
  console.log('\n--- Placeholder Check ---');
  console.log('Contains [Your ...] placeholders?:', hasPlaceholders ? 'FAIL ❌' : 'PASS ✅ (No placeholders found)');
  console.log('Contains real sender signature?:', draft.bodyText.includes(adminUser?.name || 'Afnan') ? 'PASS ✅' : 'CHECK SIGNATURE');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
