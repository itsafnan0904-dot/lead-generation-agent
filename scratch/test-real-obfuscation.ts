import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/api/src/app.module';
import { RestrictionEngineService } from '../apps/api/src/restrictions/restriction-engine.service';
import { DeterministicRestrictionChecker } from '../apps/api/src/restrictions/layers/deterministic-checker.layer';
import { RestrictionEntityType } from '@ai-sales-agent/database';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const restrictionEngine = app.get(RestrictionEngineService);
  const deterministicChecker = new DeterministicRestrictionChecker();

  // Test 1: Cyrillic homoglyph substitution in "OWSJ" (Cyrillic \u041e replacing Latin 'O' -> "ОWSJ")
  const cyrillicHomoglyphText = "Prospect scope includes structural fabrication of \u041eWSJ framework for commercial warehouse roofing.";

  console.log('=== TEST 1: CYRILLIC HOMOGLYPH SUBSTITUTION ===');
  console.log('Submitted Text:', cyrillicHomoglyphText);
  const l1_1 = deterministicChecker.check(cyrillicHomoglyphText);
  console.log('Layer 1 Result (Deterministic):', JSON.stringify(l1_1));

  const eval1 = await restrictionEngine.evaluate({
    entityType: RestrictionEntityType.LEAD,
    sourceTrigger: 'manual',
    textCorpus: cyrillicHomoglyphText,
    notes: 'Adversarial evasion testing with Cyrillic homoglyph in OWSJ.'
  });
  console.log('Layer 2 & 3 Outcome (Evaluation Result):', eval1.result);
  console.log('Reason:', eval1.reason);
  console.log('Checked Payload AI Outcome:', JSON.stringify((eval1.checkedPayload as any)?.aiOutcome, null, 2));

  // Test 2: Semantic synonym evasion (no restricted keywords)
  const semanticSynonymText = "Prospect designs and supplies structural open-web steel lattice bar joists and ribbed corrugated metal roof pans.";

  console.log('\n=== TEST 2: SEMANTIC SYNONYM EVASION ===');
  console.log('Submitted Text:', semanticSynonymText);
  const l1_2 = deterministicChecker.check(semanticSynonymText);
  console.log('Layer 1 Result (Deterministic):', JSON.stringify(l1_2));

  const eval2 = await restrictionEngine.evaluate({
    entityType: RestrictionEntityType.LEAD,
    sourceTrigger: 'manual',
    textCorpus: semanticSynonymText,
    notes: 'Adversarial evasion testing with semantic synonyms without restricted acronym.'
  });
  console.log('Layer 2 & 3 Outcome (Evaluation Result):', eval2.result);
  console.log('Reason:', eval2.reason);
  console.log('Checked Payload AI Outcome:', JSON.stringify((eval2.checkedPayload as any)?.aiOutcome, null, 2));

  await app.close();
}

main().catch(err => {
  console.error('Error running test:', err);
  process.exit(1);
});
