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

import { OpenAIProvider } from './ai/providers/openai.provider';
import { AIOrchestratorService } from './ai/services/ai-orchestrator.service';
import { PrismaService } from './prisma/prisma.service';

async function runLiveConnectivityProof() {
  console.log('================================================================');
  console.log(' LIVE OPENAI API CONNECTIVITY & STRUCTURED ORCHESTRATION PROOF ');
  console.log('================================================================\n');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY is not defined in apps/api/.env');
    process.exit(1);
  }

  console.log('API Key Detected:', `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log('Configured AI_MODEL:', process.env.AI_MODEL || 'gpt-4o-mini (default)');

  const openAIProvider = new OpenAIProvider();
  const mockPrisma = {
    client: {
      aIAction: {
        create: async (args: any) => {
          console.log('[AUDIT LOGGED TO AIACTION]:', {
            actionType: args.data.actionType,
            status: args.data.status,
            modelUsed: args.data.modelUsed,
            tokenUsage: args.data.tokenUsage,
            latencyMs: args.data.latencyMs,
          });
          return { id: 'live-test-action-id-001' };
        },
      },
    },
  } as unknown as PrismaService;

  const orchestrator = new AIOrchestratorService(openAIProvider, mockPrisma);

  console.log('\n>>> Calling AIOrchestratorService.analyzeRestriction() with live OpenAI API...');
  const startTime = Date.now();

  try {
    const response = await orchestrator.analyzeRestriction({
      entityName: 'Defense Logistics International LLC',
      domain: 'defenselogistics.example.com',
      notes: 'Testing live AI compliance restriction check against defense and aerospace contractor restrictions.',
    });

    const elapsed = Date.now() - startTime;
    console.log(`\nSUCCESS: Received structured response in ${elapsed}ms!\n`);
    console.log('--- VERBATIM STRUCTURED PAYLOAD RETURNED ---');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n--- METADATA CAPTURED ---');
    console.log(JSON.stringify(response.metadata, null, 2));

    console.log('\n================================================================');
    console.log(' LIVE OPENAI CONNECTIVITY PROOF PASSED WITH ZERO ERRORS ');
    console.log('================================================================');
  } catch (err: any) {
    console.error('\nLIVE PROOF FAILED:', err);
    process.exit(1);
  }
}

runLiveConnectivityProof();
