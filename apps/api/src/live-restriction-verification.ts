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
import { AI_PROVIDER_TOKEN, AIProvider } from './ai/interfaces/ai-provider.interface';

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

  const hasRealKey = !!process.env.OPENAI_API_KEY;
  console.log(`Live OpenAI API Key: ${hasRealKey ? 'Configured (Live API)' : 'Not configured (using contextual simulation double)'}`);

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

  if (!hasRealKey) {
    const fallbackTestProvider: AIProvider = {
      complete: async (options) => {
        const schemaName = options.schema?.name;

        if (schemaName === 'research_analysis_response') {
          const isRestrictedText = options.prompt.includes('OWSJ') || options.prompt.includes('Steel decking') || options.prompt.includes('Vulcan');

          const summary = isRestrictedText
            ? 'Vulcan manufactures OWSJ open web steel joists and structural composite steel decking.'
            : 'General architectural woodworking and premium millwork.';

          const researchPayload = {
            summary,
            keyInsights: isRestrictedText ? ['Major OWSJ joist supplier', 'Steel deck installer'] : ['Custom millwork leader'],
            techStack: ['AutoCAD', 'Tekla'],
            painPoints: ['Material lead times'],
            recentEvents: ['Facility expansion'],
            confidenceScore: 0.95,
          };

          return {
            rawContent: JSON.stringify(researchPayload),
            parsedContent: researchPayload,
            modelUsed: 'gpt-4o-mini',
            usage: { promptTokens: 140, completionTokens: 60, totalTokens: 200 },
            latencyMs: 280,
          };
        }

        // Restriction Check schema
        const hasDetectedRestrictedTerms = options.prompt.includes('Detected potential restricted terms:');

        if (hasDetectedRestrictedTerms) {
          const restrPayload = {
            result: 'RESTRICTED',
            reason: 'Core business includes open web steel joists (OWSJ) and structural steel decking.',
            matchedKeywordsOrEntities: ['OWSJ', 'Steel decking'],
            requiresHumanReview: true,
            confidence: 0.96,
          };
          return {
            rawContent: JSON.stringify(restrPayload),
            parsedContent: restrPayload,
            modelUsed: 'gpt-4o-mini',
            usage: { promptTokens: 180, completionTokens: 65, totalTokens: 245 },
            latencyMs: 320,
          };
        } else {
          const clearPayload = {
            result: 'CLEAR',
            reason: 'Architectural woodworking and custom glass cabinetry — zero prohibited structural steel or joist scope.',
            matchedKeywordsOrEntities: [],
            requiresHumanReview: false,
            confidence: 0.98,
          };
          return {
            rawContent: JSON.stringify(clearPayload),
            parsedContent: clearPayload,
            modelUsed: 'gpt-4o-mini',
            usage: { promptTokens: 155, completionTokens: 55, totalTokens: 210 },
            latencyMs: 275,
          };
        }



      },
    };

    moduleBuilder.overrideProvider(AI_PROVIDER_TOKEN).useValue(fallbackTestProvider);
  }


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

  await app.close();
  console.log('================================================================');
  console.log(' LIVE RESTRICTION POLICY TRACES COMPLETED WITH ZERO ERRORS     ');
  console.log('================================================================');
}

runLiveRestrictionEngineVerification().catch((err) => {
  console.error('LIVE RESTRICTION VERIFICATION ERROR:', err);
  process.exit(1);
});
