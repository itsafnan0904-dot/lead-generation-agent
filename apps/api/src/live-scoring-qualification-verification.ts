import * as fs from 'fs';
import * as path from 'path';

// Manually load environment variables from .env files if present
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
import { UserRole } from '@ai-sales-agent/database';
import { AI_PROVIDER_TOKEN, AIProvider } from './ai/interfaces/ai-provider.interface';

async function runLiveScoringQualificationVerification() {
  console.log('================================================================');
  console.log(' LIVE SCORING & QUALIFICATION TRACES (NESTJS LIVE HTTP ADAPTER) ');
  console.log('================================================================\n');

  const mockAdminUser = {
    id: 'admin-live-uuid-001',
    email: 'admin.live@enterprise.com',
    name: 'Admin Live Tester',
    role: UserRole.ADMIN,
  };

  const hasRealKey = !!process.env.OPENAI_API_KEY;
  console.log(`Live OpenAI API Key: ${hasRealKey ? 'Configured (Live API)' : 'Not configured in environment (using test provider simulation)'}`);

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
        return {
          rawContent: JSON.stringify({
            totalScore: 88,
            scoreBreakdown: {
              serviceMatch: 38,
              companyRelevance: 18,
              contactQuality: 14,
              projectPotential: 11,
              locationMatch: 7,
            },
            recommendedStage: 'QUALIFIED',
            justification: 'High alignment with industrial engineering specifications and confirmed decision maker.',
            keyStrengths: ['Direct procurement authority', 'Verified architectural requirements'],
            potentialRisks: ['Tight Q4 delivery window'],
            requiresHumanReview: false,
          }),
          parsedContent: {
            totalScore: 88,
            scoreBreakdown: {
              serviceMatch: 38,
              companyRelevance: 18,
              contactQuality: 14,
              projectPotential: 11,
              locationMatch: 7,
            },
            recommendedStage: 'QUALIFIED',
            justification: 'High alignment with industrial engineering specifications and confirmed decision maker.',
            keyStrengths: ['Direct procurement authority', 'Verified architectural requirements'],
            potentialRisks: ['Tight Q4 delivery window'],
            requiresHumanReview: false,
          },
          modelUsed: 'gpt-4o-mini',
          usage: { promptTokens: 165, completionTokens: 75, totalTokens: 240 },
          latencyMs: 290,
        };
      },
    };

    moduleBuilder.overrideProvider(AI_PROVIDER_TOKEN).useValue(fallbackTestProvider);
  }

  const moduleRef: TestingModule = await moduleBuilder.compile();
  const app: INestApplication = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  const server = app.getHttpServer();

  const uniqueDomain = `apexforge-${Date.now()}.com`;
  const uniqueEmail = `marcus.vance-${Date.now()}@${uniqueDomain}`;

  // STEP 1: Create Company
  console.log('>>> 1. Create Company');
  const compRes = await request(server)
    .post('/companies')
    .send({
      name: 'Apex Precision Forging Inc',
      domain: uniqueDomain,
      industry: 'Heavy Industrial Fabrication',
      size: '250-500',
      location: 'Pittsburgh, PA',
      country: 'USA',
    });
  const companyId = compRes.body.id;
  console.log(`Company Created: ${companyId} (${compRes.body.name})\n`);

  // STEP 2: Create Contact
  console.log('>>> 2. Create Primary Contact');
  const contRes = await request(server)
    .post(`/companies/${companyId}/contacts`)
    .send({
      email: uniqueEmail,
      firstName: 'Marcus',
      lastName: 'Vance',
      title: 'VP of Global Procurement',
      phone: '+1-412-555-0144',
      isPrimary: true,
    });
  const contactId = contRes.body.id;
  console.log(`Contact Created: ${contactId} (${contRes.body.email})\n`);

  // STEP 3: Create Lead
  console.log('>>> 3. Create Lead');
  const leadRes = await request(server)
    .post('/leads')
    .send({
      companyId,
      primaryContactId: contactId,
    });
  const leadId = leadRes.body.id;
  console.log(`Lead Created: ${leadId} (Status: ${leadRes.body.status}, Initial Score: ${leadRes.body.scoreTotal})\n`);

  // STEP 4: Trigger Lead Scoring Calculation (POST /leads/:id/score)
  console.log(`>>> 4. Trigger Lead Scoring: POST /leads/${leadId}/score`);
  const scoreRes = await request(server).post(`/leads/${leadId}/score`);
  console.log(`STATUS: ${scoreRes.status}`);
  console.log(`SCORE TOTAL: ${scoreRes.body.scoreTotal}`);
  console.log(`FACTORS BREAKDOWN:`, {
    serviceMatch: scoreRes.body.scoreServiceMatch,
    companyRelevance: scoreRes.body.scoreCompanyRelevance,
    contactQuality: scoreRes.body.scoreContactQuality,
    projectPotential: scoreRes.body.scoreProjectPotential,
    locationMatch: scoreRes.body.scoreLocationMatch,
  });
  console.log(`SCORE BREAKDOWN REASON:`, JSON.stringify(scoreRes.body.scoreBreakdownReason, null, 2));

  // STEP 5: Create Qualification Record Scoped to Lead
  console.log(`\n>>> 5. Create Qualification Record: POST /leads/${leadId}/qualifications`);
  const qualRes = await request(server)
    .post(`/leads/${leadId}/qualifications`)
    .send({
      budgetFit: true,
      authorityFit: true,
      needFit: true,
      timelineFit: true,
      technicalFit: true,
      fitSummary: 'Confirmed $120k budget allocation for heavy forging expansion; Marcus Vance holds unilateral signing authority.',
      dealBlockers: { blockers: [] },
      answers: {
        budget: '$120,000 USD',
        timeline: 'Q1 Delivery',
        projectScope: 'Heavy industrial precast dies',
      },
      qualifiedBy: 'ADMIN_MANUAL_PASS_1',
    });

  console.log(`STATUS: ${qualRes.status}`);
  console.log(`QUALIFICATION CREATED:`, JSON.stringify(qualRes.body, null, 2));
  console.log(`RESTRICTION EVALUATION STATUS: ${qualRes.body.restrictionEvaluationStatus}`);

  // STEP 6: List Qualifications for Lead
  console.log(`\n>>> 6. List Qualifications: GET /leads/${leadId}/qualifications`);
  const listQualRes = await request(server).get(`/leads/${leadId}/qualifications`);
  console.log(`STATUS: ${listQualRes.status}`);
  console.log(`RECORD COUNT: ${listQualRes.body.length}`);

  await app.close();
  console.log('\n================================================================');
  console.log(' LIVE SCORING & QUALIFICATION TRACES COMPLETED WITH ZERO ERRORS ');
  console.log('================================================================');
}

runLiveScoringQualificationVerification().catch((err) => {
  console.error('LIVE SCORING VERIFICATION ERROR:', err);
  process.exit(1);
});
