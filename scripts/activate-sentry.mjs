#!/usr/bin/env node

/**
 * Sentry Activation Script for Flow Finance v0.9.6
 * 
 * Usage: node scripts/activate-sentry.mjs BACKEND_DSN FRONTEND_DSN
 * 
 * Example:
 *   node scripts/activate-sentry.mjs \
 *     "https://key1@id.ingest.sentry.io/proj1" \
 *     "https://key2@id.ingest.sentry.io/proj2"
 * 
 * This script will:
 * 1. Link both Vercel projects
 * 2. Set environment variables in production
 * 3. Deploy both backend and frontend
 * 4. Validate via health check
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);

if (args.length < 2) {
  process.stderr.write(`
Missing Sentry DSNs

Usage: node scripts/activate-sentry.mjs BACKEND_DSN FRONTEND_DSN

Args needed:
  BACKEND_DSN    = https://key@id.ingest.sentry.io/project_id
  FRONTEND_DSN   = https://key@id.ingest.sentry.io/project_id

Example:
  node scripts/activate-sentry.mjs \\
    "https://abc123@def456.ingest.sentry.io/789000" \\
    "https://xyz789@def456.ingest.sentry.io/789001"
  `);
  process.exit(1);
}

const BACKEND_DSN = args[0];
const FRONTEND_DSN = args[1];

process.stdout.write(`
â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
â•‘  ðŸ”§ SENTRY ACTIVATION - Flow Finance v0.9.6               â•‘
â•‘                                                            â•‘
â•‘  Backend DSN:  ${BACKEND_DSN.substring(0, 40)}...        â•‘
â•‘  Frontend DSN: ${FRONTEND_DSN.substring(0, 40)}...       â•‘
â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
`);

const run = (cmd, label) => {
  try {
    process.stdout.write(`\n> ${label}...`);
    process.stdout.write(`   $ ${cmd}`);
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'inherit' });
    process.stdout.write(`${label} completed`);
    return output;
  } catch (error) {
    process.stderr.write(`${label} failed`);
    process.stderr.write(error.message);
    process.exit(1);
  }
};

(async () => {
  try {
    // Step 1: Backend
    process.stdout.write('\nâ”Œâ”€ BACKEND CONFIGURATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”');
    run(
      'npx vercel link --yes --project flow-finance-backend --cwd . 2>&1',
      'Linking backend project'
    );
    
    run(
      `npx vercel env add SENTRY_DSN production --value "${BACKEND_DSN}" --yes --force 2>&1`,
      'Setting SENTRY_DSN in production'
    );
    
    run(
      'npx vercel --prod --yes 2>&1',
      'Deploying backend to production'
    );

    // Step 2: Frontend
    process.stdout.write('\nâ”Œâ”€ FRONTEND CONFIGURATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”');
    run(
      'npx vercel link --yes --project flow-finance-frontend --cwd . 2>&1',
      'Linking frontend project'
    );
    
    run(
      `npx vercel env add VITE_SENTRY_DSN production --value "${FRONTEND_DSN}" --yes --force 2>&1`,
      'Setting VITE_SENTRY_DSN in production'
    );
    
    run(
      'npx vercel --prod --yes 2>&1',
      'Deploying frontend to production'
    );

    // Step 3: Validation
    process.stdout.write('\nâ”Œâ”€ VALIDATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”');
    
    const healthCheck = run(
      'VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app npm run health:vercel 2>&1',
      'Validating health check'
    );

    if (healthCheck.includes('"sentryConfigured": true')) {
      process.stdout.write('\nâœ… Sentry is fully configured and active!');
      process.stdout.write('\nðŸ“Š Next steps:');
      process.stdout.write('   1. Verify in Sentry dashboard: https://sentry.io/');
      process.stdout.write('   2. Trigger test error to confirm integration');
      process.stdout.write('   3. Check error grouping in Sentry');
    } else {
      process.stderr.write('\nâš ï¸  Sentry not yet showing as configured');
      process.stdout.write('   This may take 1-2 minutes to propagate');
    }

    process.stdout.write('\nðŸŽ‰ Sentry activation complete!');
    process.exit(0);

  } catch (error) {
    process.stderr.write('\nActivation failed:', error.message);
    process.exit(1);
  }
})();

