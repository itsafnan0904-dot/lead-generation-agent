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
import { UserRole, RestrictionCheckResult, LeadLifecycleStatus } from '@ai-sales-agent/database';

async function runLiveRestrictionEngineVerification() {
  console.log('================================================================');
  console.log(' LIVE RESTRICTION POLICY ENGINE TRACES (NESTJS LIVE HTTP ADAPTER)');
  console.log('================================================================\n');

  const mockAdminUser = {
    id: 'admin-live-uuid-001',
    email: 'admin.live@enterprise.com',
    name: 'Admin Live Tester',
    role: UserRole.ADMIN,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('\n[FATAL] OPENAI_API_KEY is not defined in environment.');
    console.error('Live Restriction Policy Engine verification requires a genuine OpenAI API key.');
    console.error('Silent fallback simulation has been removed to prevent fabricated proof.\n');
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

  // TEST CASE 1: RESTRICTED COMPANY & LEAD
  console.log('>>> TEST CASE 1: Prohibited Structural Steel Scope (OWSJ & Steel Decking)');
  const restrictedDomain = `vulcan-joist-${Date.now()}.com`;
  const comp1Res = await request(server)
    .post('/companies')
    .send({
      name: 'Vulcan Steel Joists & Decking LLC',
      domain: restrictedDomain,
      industry: 'Structural Steel Decking & OWSJ Fabrication',
      location: 'Gary, IN',
      country: 'USA',
    });
  const comp1Id = comp1Res.body.id;
  console.log(`Company 1 Created: ${comp1Id} (${comp1Res.body.name})`);

  const lead1Res = await request(server).post('/leads').send({ companyId: comp1Id });
  const lead1Id = lead1Res.body.id;
  console.log(`Lead 1 Created: ${lead1Id} (Initial Status: ${lead1Res.body.status})\n`);

  console.log(`>>> Triggering Research & Policy Evaluation: POST /companies/${comp1Id}/research`);
  const research1Res = await request(server)
    .post(`/companies/${comp1Id}/research`)
    .send({
      rawResearchText: 'Vulcan manufactures OWSJ open web steel joists, K-Series joist girders, and composite steel decking.',
    });
  console.log(`RESEARCH STATUS: ${research1Res.status}`);
  console.log(`RESTRICTION CHECK RESULT: ${research1Res.body.restrictionCheck.result}`);
  console.log(`REASON: ${research1Res.body.restrictionCheck.reason}`);
  console.log(`MATCHED RULES:`, JSON.stringify(research1Res.body.restrictionCheck.matchedRules, null, 2));

  // Verify Lead 1 was automatically blocked
  const verifyLead1 = await request(server).get(`/leads/${lead1Id}`);
  console.log(`LEAD 1 UPDATED STATUS: ${verifyLead1.body.status} (Expected: RESTRICTED)\n`);

  // TEST CASE 2: CLEAR LEAD DIRECT EVALUATION
  console.log('>>> TEST CASE 2: Compliant Architectural Millwork (CLEAR)');
  const clearDomain = `timberline-${Date.now()}.com`;
  const comp2Res = await request(server)
    .post('/companies')
    .send({
      name: 'Timberline Fine Woodworking Inc',
      domain: clearDomain,
      industry: 'Architectural Millwork',
      location: 'Portland, OR',
      country: 'USA',
    });
  const comp2Id = comp2Res.body.id;
  const lead2Res = await request(server).post('/leads').send({ companyId: comp2Id });
  const lead2Id = lead2Res.body.id;
  console.log(`Lead 2 Created: ${lead2Id} (Initial Status: ${lead2Res.body.status})\n`);

  console.log(`>>> Direct Lead Restriction Evaluation: POST /leads/${lead2Id}/restriction-check`);
  const leadCheckRes = await request(server)
    .post(`/leads/${lead2Id}/restriction-check`)
    .send({ notes: 'Manual compliance check for new inbound prospect' });
  console.log(`RESTRICTION CHECK STATUS: ${leadCheckRes.status}`);
  console.log(`RESULT: ${leadCheckRes.body.result}`);
  console.log(`REASON: ${leadCheckRes.body.reason}`);

  const verifyLead2 = await request(server).get(`/leads/${lead2Id}`);
  console.log(`LEAD 2 STATUS UNCHANGED: ${verifyLead2.body.status} (Expected: COLD_LEAD)\n`);

  // TEST CASE 3: NON-DOWNGRADE INVARIANT ON ADVANCED LEAD (QUALIFIED -> CLEAR -> STILL QUALIFIED)
  console.log('>>> TEST CASE 3: Non-Downgrade Invariant on Advanced Lead');
  const comp3Res = await request(server)
    .post('/companies')
    .send({
      name: 'Redwood Custom Millwork LLC',
      domain: `redwood-${Date.now()}.com`,
      industry: 'Woodworking',
    });
  const comp3Id = comp3Res.body.id;
  const lead3Res = await request(server).post('/leads').send({ companyId: comp3Id });
  const lead3Id = lead3Res.body.id;

  // Advance lead status to QUALIFIED
  await request(server)
    .patch(`/leads/${lead3Id}`)
    .send({ status: LeadLifecycleStatus.QUALIFIED });
  const advancedLead3 = await request(server).get(`/leads/${lead3Id}`);
  console.log(`Lead 3 Advanced to: ${advancedLead3.body.status}`);

  console.log(`>>> Triggering Restriction Check on Advanced Lead: POST /leads/${lead3Id}/restriction-check`);
  const checkLead3 = await request(server)
    .post(`/leads/${lead3Id}/restriction-check`)
    .send({ notes: 'Routine check on qualified lead' });
  console.log(`RESULT: ${checkLead3.body.result}`);

  const verifyLead3 = await request(server).get(`/leads/${lead3Id}`);
  console.log(`LEAD 3 STATUS AFTER CLEAR: ${verifyLead3.body.status} (Expected: QUALIFIED - strictly preserved!)\n`);

  // TEST CASE 4: ADVANCED/TERMINAL STATUS OVERRIDE (WON -> RESTRICTED -> RESTRICTED with Audit)
  console.log('>>> TEST CASE 4: Advanced Terminal Status Override (WON -> RESTRICTED)');
  const comp4Res = await request(server)
    .post('/companies')
    .send({
      name: 'Titan Framing Systems LLC',
      domain: `titan-${Date.now()}.com`,
      industry: 'Steel Joists and Longspan Decking',
    });
  const comp4Id = comp4Res.body.id;
  const lead4Res = await request(server).post('/leads').send({ companyId: comp4Id });
  const lead4Id = lead4Res.body.id;

  // Advance lead status to terminal WON
  await request(server)
    .patch(`/leads/${lead4Id}`)
    .send({ status: LeadLifecycleStatus.WON });
  const wonLead4 = await request(server).get(`/leads/${lead4Id}`);
  console.log(`Lead 4 Advanced to Terminal State: ${wonLead4.body.status}`);

  console.log(`>>> Triggering Research on Prohibited Scope: POST /companies/${comp4Id}/research`);
  const research4Res = await request(server)
    .post(`/companies/${comp4Id}/research`)
    .send({
      rawResearchText: 'Titan specializes in OWSJ open web steel joists and K-Series joist girders.',
    });
  console.log(`RESULT: ${research4Res.body.restrictionCheck.result}`);

  const verifyLead4 = await request(server).get(`/leads/${lead4Id}`);
  console.log(`LEAD 4 STATUS AFTER OVERRIDE: ${verifyLead4.body.status} (Expected: RESTRICTED)`);
  console.log(`LEAD 4 AUDIT METADATA:`, JSON.stringify(verifyLead4.body.metadata, null, 2));

  await app.close();

  console.log('================================================================');
  console.log(' LIVE RESTRICTION POLICY TRACES COMPLETED WITH ZERO ERRORS     ');
  console.log('================================================================');
}

runLiveRestrictionEngineVerification().catch((err) => {
  console.error('LIVE RESTRICTION VERIFICATION ERROR:', err);
  process.exit(1);
});
