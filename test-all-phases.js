#!/usr/bin/env node

/**
 * BIZSTASH COMPREHENSIVE TEST - ALL PHASES
 * 
 * Runs Phase 1 through Phase 4 in sequence:
 * Phase 1: Fetch data from Tally (Masters + Vouchers)
 * Phase 2: Parse XML to JSON
 * Phase 3: Analyze and enrich data
 * Phase 4: Generate output reports
 * 
 * This is the complete data sync pipeline test
 */

const path = require('path');
const fs = require('fs-extra');
const { runPhase1 } = require('./sync-modules/phase1-fetch/fetch-phase1');
const { runPhase2 } = require('./sync-modules/phase2-parse');
const { runPhase3 } = require('./sync-modules/phase3-analyze');
const { runPhase4 } = require('./sync-modules/phase4-output');

async function main() {
  const startTime = Date.now();

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   BIZSTASH - COMPREHENSIVE DATA SYNC PIPELINE              ║
║   Phase 1→4: Fetch, Parse, Analyze, Report                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

  const phases = [];

  try {
    // Phase 1: Fetch
    console.log('PHASE 1: FETCHING DATA FROM TALLY...\n');
    const phase1Start = Date.now();
    const phase1 = await runPhase1();
    const phase1Duration = Date.now() - phase1Start;
    
    if (!phase1.success) {
      throw new Error(`Phase 1 failed: ${phase1.error}`);
    }
    phases.push({ name: 'Phase 1: Fetch', duration: phase1Duration, success: true });
    console.log(`✅ Phase 1 completed in ${(phase1Duration / 1000).toFixed(2)}s\n`);

    // Phase 2: Parse
    console.log('PHASE 2: PARSING XML TO JSON...\n');
    const phase2Start = Date.now();
    const phase2 = await runPhase2();
    const phase2Duration = Date.now() - phase2Start;
    
    if (!phase2.success) {
      throw new Error(`Phase 2 failed: ${phase2.error}`);
    }
    phases.push({ name: 'Phase 2: Parse', duration: phase2Duration, success: true });
    console.log(`✅ Phase 2 completed in ${(phase2Duration / 1000).toFixed(2)}s\n`);

    // Phase 3: Analyze
    console.log('PHASE 3: ANALYZING DATA...\n');
    const phase3Start = Date.now();
    const phase3 = await runPhase3();
    const phase3Duration = Date.now() - phase3Start;
    
    if (!phase3.success) {
      throw new Error(`Phase 3 failed: ${phase3.error}`);
    }
    phases.push({ name: 'Phase 3: Analyze', duration: phase3Duration, success: true });
    console.log(`✅ Phase 3 completed in ${(phase3Duration / 1000).toFixed(2)}s\n`);

    // Phase 4: Output
    console.log('PHASE 4: GENERATING REPORTS...\n');
    const phase4Start = Date.now();
    const phase4 = await runPhase4();
    const phase4Duration = Date.now() - phase4Start;
    
    if (!phase4.success) {
      throw new Error(`Phase 4 failed: ${phase4.error}`);
    }
    phases.push({ name: 'Phase 4: Output', duration: phase4Duration, success: true });
    console.log(`✅ Phase 4 completed in ${(phase4Duration / 1000).toFixed(2)}s\n`);

    // Final summary
    const totalDuration = Date.now() - startTime;
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║            COMPREHENSIVE TEST SUMMARY                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('PHASE EXECUTION TIMES:');
    for (const phase of phases) {
      const duration = (phase.duration / 1000).toFixed(2);
      const pct = ((phase.duration / totalDuration) * 100).toFixed(1);
      console.log(`  ${phase.name}: ${duration}s (${pct}%)`);
    }

    console.log(`\nTOTAL TIME: ${(totalDuration / 1000).toFixed(2)}s (${(totalDuration / 60000).toFixed(1)} minutes)\n`);

    // List output files
    console.log('OUTPUT ARTIFACTS:');
    const reportFiles = fs.readdirSync(path.join(process.cwd(), 'tally_data/reports'));
    for (const file of reportFiles.filter(f => !f.endsWith('.json'))) {
      const filePath = path.join(process.cwd(), 'tally_data/reports', file);
      const size = fs.statSync(filePath).size;
      console.log(`  ✓ ${file} (${(size / 1024).toFixed(1)} KB)`);
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ ALL PHASES COMPLETED SUCCESSFULLY                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    process.exit(0);

  } catch (error) {
    console.error(`\n❌ PIPELINE FAILED: ${error.message}\n`);
    
    console.log('Completed Phases:');
    for (const phase of phases) {
      console.log(`  ✅ ${phase.name}`);
    }
    
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
