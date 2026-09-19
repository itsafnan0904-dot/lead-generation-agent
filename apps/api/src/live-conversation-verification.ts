import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnvFile(path.resolve(__dirname, '../.env'));
loadEnvFile(path.resolve(__dirname, '../../packages/database/.env'));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { UserRole, LeadLifecycleStatus, RestrictionCheckResult } from '@ai-sales-agent/database';
import { ConversationsService } from './conversations/conversations.service';

async function runLiveConversationVerification() {
  console.log('================================================================');
  console.log(' LIVE CONVERSATION, AI REPLY & RESTRICTION VERIFICATION TRACES ');
  console.log('================================================================\n');

  const mockAdminUser = {
    id: 'admin-live-conv-001',
    email: 'admin.conv@enterprise.com',
    name: 'Admin Conv Tester',
    role: UserRole.ADMIN,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('\n[FATAL] OPENAI_API_KEY is not defined in environment.');
    process.exit(1);
  }

  console.log(`Live OpenAI API Key Detected: ${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`);

  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: any) => {
        const req = context.switchToHttp().getRequest();
        req.user = mockAdminUser;
        return true;
      },
    });

  const moduleRef: TestingModule = await moduleBuilder.compile();
  const app: INestApplication = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  const server = app.getHttpServer();
  const convService = app.get<ConversationsService>(ConversationsService);

  const timestamp = Date.now();
  const uniqueCompanyDomain = `precisionfabrication-${timestamp}.com`;
  const uniqueContactEmail = `marcus.director-${timestamp}@${uniqueCompanyDomain}`;

  // STEP 1: Setup Company, Contact, and Single Open Lead (CONTACTED)
  console.log('>>> 1. Setup Company, Contact, and Single Open Lead');
  const compRes = await request(server).post('/companies').send({
    name: 'Precision Fabrication Partners LLC',
    domain: uniqueCompanyDomain,
    industry: 'Commercial Structural Engineering',
  });
  const companyId = compRes.body.id;

  const contRes = await request(server).post(`/companies/${companyId}/contacts`).send({
    email: uniqueContactEmail,
    firstName: 'Marcus',
    lastName: 'Vance',
    title: 'Managing Director',
    isPrimary: true,
  });
  const contactId = contRes.body.id;

  const leadRes = await request(server).post('/leads').send({
    companyId,
    primaryContactId: contactId,
  });
  const leadId = leadRes.body.id;

  // Set lead status to CONTACTED
  await request(server).patch(`/leads/${leadId}`).send({ status: LeadLifecycleStatus.CONTACTED });
  console.log(`Lead setup: ID=${leadId}, Status=CONTACTED, ContactEmail=${uniqueContactEmail}\n`);

  // STEP 2: Ingest Inbound Email from Contact (EXACTLY 1 OPEN LEAD) -> Real OpenAI analyzeReply + Restriction Check
  console.log('>>> 2. Ingest Inbound Reply from Single Open Lead (Real OpenAI API analyzeReply call)');
  const inboundMsg1 = {
    id: `gmail-msg-${timestamp}-1`,
    threadId: `thread-id-${timestamp}-1`,
    from: `Marcus Vance <${uniqueContactEmail}>`,
    to: 'sales@enterprise.com',
    subject: 'Re: Commercial Engineering Partnership Inquiry',
    date: new Date().toISOString(),
    bodyText: 'Thanks for reaching out! We are definitely interested in your structural engineering services and would like to review the full pricing proposal next week.',
    snippet: 'Thanks for reaching out! We are definitely interested...',
    headers: [
      { name: 'From', value: `Marcus Vance <${uniqueContactEmail}>` },
      { name: 'Subject', value: 'Re: Commercial Engineering Partnership Inquiry' },
    ],
  };

  const result1 = await convService.ingestSingleInboundMessage(inboundMsg1);
  console.log('INGESTION RESULT 1:', JSON.stringify(result1, null, 2));

  // Verify Lead Lifecycle Status update
  const updatedLead1 = await request(server).get(`/leads/${leadId}`);
  console.log(`LEAD 1 UPDATED STATUS: ${updatedLead1.body.status} (Expected: INTERESTED)`);
  console.log(`LEAD 1 METADATA:`, JSON.stringify(updatedLead1.body.metadata, null, 2));

  // Verify Message stored with AI Reply Analysis
  const conv1 = await convService.getConversationById(result1.conversationId);
  const storedMsg1 = (conv1 as any).messages[0];
  console.log('\nSTORED MESSAGE 1 AI ANALYSIS METADATA:');
  console.log(JSON.stringify(storedMsg1.metadata.aiReplyAnalysis, null, 2));

  // STEP 3: Ingest Inbound Email from Contact with ZERO OPEN LEADS (UNASSIGNED STATE)
  console.log('\n>>> 3. Ingest Inbound Message from Contact with 0 Open Leads (UNASSIGNED / NEEDS_HUMAN_ASSIGNMENT)');
  const unknownEmail = `stranger-${timestamp}@unregistered-corp.com`;
  const inboundMsg2 = {
    id: `gmail-msg-${timestamp}-2`,
    threadId: `thread-id-${timestamp}-2`,
    from: `Dr. Unknown <${unknownEmail}>`,
    to: 'sales@enterprise.com',
    subject: 'Inquiry on software pricing',
    date: new Date().toISOString(),
    bodyText: 'Hello, looking for a demo of your system.',
    snippet: 'Hello, looking for a demo...',
    headers: [],
  };

  const result2 = await convService.ingestSingleInboundMessage(inboundMsg2);
  console.log('INGESTION RESULT 2 (0 Open Leads):', JSON.stringify(result2, null, 2));
  console.log(`CONVERSATION ASSIGNMENT STATUS: ${result2.assignmentStatus}, LEAD ID: ${result2.leadId}`);

  // Query UNASSIGNED conversations
  const unassignedList = await request(server).get('/conversations?status=UNASSIGNED');
  console.log(`UNASSIGNED CONVERSATIONS QUERY COUNT: ${unassignedList.body.total}`);

  // STEP 4: Inbound Email with Prohibited Scope -> Restriction Engine Triggered
  console.log('\n>>> 4. Inbound Email with Prohibited Scope (OWSJ / Decking) -> Restriction Engine Verification');
  const restrictedDomain = `restricted-framing-${timestamp}.com`;
  const restrictedContactEmail = `contact-${timestamp}@${restrictedDomain}`;

  const comp3 = await request(server).post('/companies').send({
    name: 'Prohibited Framing Systems',
    domain: restrictedDomain,
  });
  const cont3 = await request(server).post(`/companies/${comp3.body.id}/contacts`).send({
    email: restrictedContactEmail,
    firstName: 'Bob',
  });
  const lead3 = await request(server).post('/leads').send({
    companyId: comp3.body.id,
    primaryContactId: cont3.body.id,
  });

  const inboundMsg3 = {
    id: `gmail-msg-${timestamp}-3`,
    threadId: `thread-id-${timestamp}-3`,
    from: `Bob <${restrictedContactEmail}>`,
    to: 'sales@enterprise.com',
    subject: 'Re: Joist and Decking Order',
    date: new Date().toISOString(),
    bodyText: 'We fabricate longspan OWSJ joists, K-Series joist girders, and composite steel decking.',
    snippet: 'We fabricate longspan OWSJ joists...',
    headers: [],
  };

  const result3 = await convService.ingestSingleInboundMessage(inboundMsg3);
  console.log('INGESTION RESULT 3 (Restricted Content):', JSON.stringify(result3, null, 2));

  const verifyLead3 = await request(server).get(`/leads/${lead3.body.id}`);
  console.log(`LEAD 3 STATUS AFTER RESTRICTED INBOUND: ${verifyLead3.body.status} (Expected: RESTRICTED)`);

  await app.close();
  console.log('\n================================================================');
  console.log(' ALL LIVE CONVERSATION & INGESTION TRACES COMPLETED CLEANLY ');
  console.log('================================================================');
}

runLiveConversationVerification().catch((err) => {
  console.error('LIVE CONVERSATION VERIFICATION ERROR:', err);
  process.exit(1);
});
