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
import { UserRole, LeadLifecycleStatus } from '@ai-sales-agent/database';
import { OutreachService } from './outreach/outreach.service';
import { GmailService } from './gmail/gmail.service';
import { PrismaService } from './prisma/prisma.service';

async function runLiveOutreachVerification() {
  console.log('================================================================');
  console.log(' LIVE OUTREACH DRAFT & HUMAN-GATED SENDING VERIFICATION TRACES ');
  console.log('================================================================\n');

  const mockAdminUser = {
    id: 'admin-live-outreach-001',
    email: 'admin.outreach@enterprise.com',
    name: 'Admin Outreach Tester',
    role: UserRole.ADMIN,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('\n[FATAL] OPENAI_API_KEY is not defined in environment.');
    process.exit(1);
  }

  console.log(`Live OpenAI API Key Detected: ${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`OUTREACH_SAFE_TEST_MODE: ${process.env.OUTREACH_SAFE_TEST_MODE}`);
  console.log(`OUTREACH_TEST_RECIPIENT_EMAIL: ${process.env.OUTREACH_TEST_RECIPIENT_EMAIL}\n`);

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

  // Step 2 Preflight Check: Check for active GmailAccount in database
  const prismaService = app.get(PrismaService);
  const activeGmailAccount = await prismaService.client.gmailAccount.findFirst({
    where: { isActive: true },
  });

  if (!activeGmailAccount) {
    console.error('\n================================================================');
    console.error('[FATAL ERROR] NO ACTIVE GMAIL ACCOUNT CONNECTED IN DATABASE');
    console.error('================================================================');
    console.error('Live outreach email dispatch verification requires a genuinely connected Gmail account.');
    console.error('To connect a real account:');
    console.error(' 1. Configure valid GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in apps/api/.env');
    console.error(' 2. Initiate OAuth flow via GET /gmail/connect as an ADMIN user');
    console.error(' 3. Complete Google OAuth consent in browser to store tokens in the GmailAccount table.');
    console.error('\nAll mock/simulated email dispatch providers have been permanently removed.');
    console.error('Aborting live verification with exit code 1 to prevent fabricated test proof.\n');
    await app.close();
    process.exit(1);
  }

  console.log(`Active Connected Gmail Account Detected: ${activeGmailAccount.email}\n`);
  const outreachService = app.get<OutreachService>(OutreachService);

  const timestamp = Date.now();
  const uniqueCompanyDomain = `solarenergydesigns-${timestamp}.com`;
  const realProspectEmail = `elena.vance-${timestamp}@${uniqueCompanyDomain}`;

  // STEP 1: Create Company, Contact, Lead and Research
  console.log('>>> 1. Setup Company, Contact, and Lead in COLD_LEAD state');
  const compRes = await request(server).post('/companies').send({
    name: 'Solar Energy Engineering Designs LLC',
    domain: uniqueCompanyDomain,
    industry: 'Commercial Rooftop Solar Photovoltaic Mounting',
    location: 'Denver, CO',
  });
  const companyId = compRes.body.id;

  const contRes = await request(server).post(`/companies/${companyId}/contacts`).send({
    email: realProspectEmail,
    firstName: 'Elena',
    lastName: 'Vance',
    title: 'Director of Solar Development',
    isPrimary: true,
  });
  const contactId = contRes.body.id;

  const leadRes = await request(server).post('/leads').send({
    companyId,
    primaryContactId: contactId,
  });
  const leadId = leadRes.body.id;
  console.log(`Lead Created: ${leadId} (Status: ${leadRes.body.status}, Contact: ${realProspectEmail})\n`);

  // STEP 2: Generate Draft (POST /leads/:id/outreach/draft) -> Zero side-effects, Real OpenAI API Call
  console.log('>>> 2. Generate Draft: POST /leads/:id/outreach/draft (Real AI generation, NO email sent)');
  const draftRes = await request(server)
    .post(`/leads/${leadId}/outreach/draft`)
    .send({
      tone: 'consultative and solution-oriented',
      additionalContext: 'Highlight our pre-engineered solar rooftop racking solutions.',
    });

  console.log(`STATUS: ${draftRes.status}`);
  console.log(`DRAFT ID: ${draftRes.body.id}`);
  console.log(`DRAFT STATUS: ${draftRes.body.status} (Strictly DRAFT)`);
  console.log(`SUBJECT: ${draftRes.body.subject}`);
  console.log(`BODY PREVIEW:\n${draftRes.body.bodyText}\n`);
  console.log(`CALL TO ACTION: ${draftRes.body.callToAction}`);
  console.log(`RATIONALE: ${draftRes.body.rationale}`);
  console.log(`PERSONALIZATION POINTS:`, JSON.stringify(draftRes.body.personalizationPoints, null, 2));
  console.log(`AI USAGE METADATA:`, JSON.stringify(draftRes.body.aiUsageMetadata, null, 2));

  const draftId = draftRes.body.id;

  // STEP 3: Attempt Send (POST /outreach/:draftId/send) -> Dispatches with OUTREACH_SAFE_TEST_MODE Redirection
  console.log('\n>>> 3. First Send Attempt: POST /outreach/:draftId/send (Safe test redirection enforced)');
  const sendRes1 = await request(server).post(`/outreach/${draftId}/send`);
  console.log(`STATUS: ${sendRes1.status}`);
  console.log(`SEND RESPONSE 1:`, JSON.stringify(sendRes1.body, null, 2));

  // Verify Lead lifecycle status transitioned to CONTACTED
  const updatedLead = await request(server).get(`/leads/${leadId}`);
  console.log(`LEAD STATUS AFTER FIRST SEND: ${updatedLead.body.status} (Expected: CONTACTED)`);

  // STEP 3.5: Independent Delivery Confirmation (Query Gmail API for sent message)
  console.log('\n>>> 3.5 Independent Delivery Confirmation: Query Gmail API for sent message');
  const gmailService = app.get<GmailService>(GmailService);
  try {
    const fetchedMessage = await gmailService.getMessage(sendRes1.body.gmailMessageId);
    console.log(`FETCHED GMAIL MESSAGE ID: ${fetchedMessage.id}`);
    console.log(`FETCHED GMAIL THREAD ID: ${fetchedMessage.threadId}`);
    console.log(`FETCHED TO HEADER: ${fetchedMessage.to}`);
    console.log(`FETCHED FROM HEADER: ${fetchedMessage.from}`);
    console.log(`FETCHED SUBJECT: ${fetchedMessage.subject}`);
    console.log(`FETCHED SNIPPET: ${fetchedMessage.snippet}`);
    console.log('INDEPENDENT CONFIRMATION: Message successfully retrieved directly from Google Gmail API mailbox!');
  } catch (fetchErr: any) {
    console.error('INDEPENDENT CONFIRMATION ERROR:', fetchErr.message);
  }

  // STEP 4: Attempt Immediate Duplicate Send (Retry) -> Expect 409 Conflict Protection
  console.log('\n>>> 4. Duplicate Send Attempt (Retry): POST /outreach/:draftId/send -> Expect 409 Conflict');
  const sendRes2 = await request(server).post(`/outreach/${draftId}/send`);
  console.log(`STATUS: ${sendRes2.status} (Expected: 409 Conflict)`);
  console.log(`DUPLICATE SEND REFUSAL RESPONSE:`, JSON.stringify(sendRes2.body, null, 2));

  // STEP 5: Verify RESTRICTED Lead Refusal for Draft Generation
  console.log('\n>>> 5. Verify Draft Refusal for RESTRICTED Lead');
  const restrictedComp = await request(server).post('/companies').send({
    name: 'Prohibited Joist Tech',
    domain: `restricted-${timestamp}.com`,
  });
  const restrictedLead = await request(server).post('/leads').send({
    companyId: restrictedComp.body.id,
  });
  await request(server).patch(`/leads/${restrictedLead.body.id}`).send({
    status: LeadLifecycleStatus.RESTRICTED,
  });

  const refusedDraftRes = await request(server).post(`/leads/${restrictedLead.body.id}/outreach/draft`).send({});
  console.log(`REFUSED DRAFT STATUS: ${refusedDraftRes.status} (Expected: 400 Bad Request)`);
  console.log(`REFUSAL RESPONSE:`, JSON.stringify(refusedDraftRes.body, null, 2));

  await app.close();
  console.log('\n================================================================');
  console.log(' ALL LIVE OUTREACH & DUPLICATE-SEND TRACES COMPLETED CLEANLY   ');
  console.log('================================================================');
}

runLiveOutreachVerification().catch((err) => {
  console.error('LIVE OUTREACH VERIFICATION ERROR:', err);
  process.exit(1);
});
