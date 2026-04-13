#!/usr/bin/env node

/**
 * Beta Testing Coordinator for Flow Finance v0.9.6
 *
 * Usage:
 *   node scripts/beta-testing-coordinator.mjs
 *   node scripts/beta-testing-coordinator.mjs --non-interactive --tester-name "Nome" --tester-email "email@dominio" --tester-business "consultorio" --testing-date "amanha 09:00"
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { pathToFileURL } from 'url';

const BETA_TESTERS_FILE = '.planning/beta-testers-2026-04-12.json';
const FRONTEND_URL = 'https://flow-finance-frontend-nine.vercel.app/';

const FEEDBACK_FORM_TEMPLATE = `
FLOW FINANCE v0.9.6 - BETA TEST FEEDBACK FORM
============================================

Tester Name: _______________
Date: _______________
Testing Time: _____ minutes

ONBOARDING (1-5 scale, 5 = excellent):
  Easiness to login: ___
  Dashboard clarity: ___
  Overall first impression: ___

CRITICAL FLOWS:
  [ ] Successfully logged in
  [ ] Could see dashboard with balance
  [ ] Created a new transaction
  [ ] IA auto-categorized the transaction
  [ ] Transaction synced correctly

OFFLINE TESTING:
  [ ] Created transaction while offline
  [ ] Transaction marked as "pending sync"
  [ ] Transaction synced when back online
  [ ] No data loss detected

FEATURE FEEDBACK (Check what you tested):
  [ ] Dashboard
  [ ] Transaction History
  [ ] Cash Flow Chart
  [ ] IA Consultant (CFO)
  [ ] Settings

TOP 3 IMPROVEMENTS (Priority):
  1. ____________________
  2. ____________________
  3. ____________________

WOULD YOU USE THIS PRODUCT?
  [ ] Yes, immediately
  [ ] Yes, with improvements
  [ ] Maybe, needs work
  [ ] No, not ready

ADDITIONAL FEEDBACK:
(Write freely about any issues, suggestions, or praise)
____________________________________
____________________________________
____________________________________

Thank you for testing Flow Finance!
`;

export function ensureDirectoryForFile(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function getArgValue(rawArgs, key) {
  const index = rawArgs.indexOf(key);
  if (index === -1 || index === rawArgs.length - 1) {
    return null;
  }
  return rawArgs[index + 1];
}

function buildTesterRecord(index, input) {
  return {
    id: `tester-${index + 1}`,
    name: input.name,
    email: input.email,
    business: input.business,
    phone: input.phone || null,
    invitedAt: new Date().toISOString(),
    status: 'invited',
    feedback: null,
  };
}

export function buildCoordinatorInputFromArgs(rawArgs) {
  const nonInteractive = rawArgs.includes('--non-interactive');
  if (!nonInteractive) {
    return { nonInteractive: false };
  }

  const testerName = getArgValue(rawArgs, '--tester-name');
  const testerEmail = getArgValue(rawArgs, '--tester-email');
  const testerBusiness = getArgValue(rawArgs, '--tester-business');
  const testerPhone = getArgValue(rawArgs, '--tester-phone');
  const testingDate = getArgValue(rawArgs, '--testing-date') || 'amanha 09:00';

  if (!testerName || !testerEmail || !testerBusiness) {
    throw new Error('Missing required args for --non-interactive. Required: --tester-name, --tester-email, --tester-business');
  }

  return {
    nonInteractive: true,
    testers: [
      buildTesterRecord(0, {
        name: testerName,
        email: testerEmail,
        business: testerBusiness,
        phone: testerPhone,
      }),
    ],
    testingDate,
  };
}

function createQuestion() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));
  return { ask, close: () => rl.close() };
}

async function collectTestersInteractive(ask) {
  console.log(`
╔═════════════════════════════════════════════════════════╗
║  Flow Finance v0.9.6 - Beta Testing Coordinator        ║
║                                                         ║
║  This will set up your beta testing round for Dia 2    ║
╚═════════════════════════════════════════════════════════╝
  `);

  const testers = [];
  let addMore = true;

  while (addMore) {
    console.log(`\n--- Tester ${testers.length + 1} ---`);

    const name = String(await ask('Full name: ')).trim();
    const email = String(await ask('Email: ')).trim();
    const business = String(await ask('Business type (consultorio/loja/freelancer/outro): ')).trim();
    const phone = String(await ask('Phone (optional): ')).trim();

    testers.push(
      buildTesterRecord(testers.length, {
        name,
        email,
        business,
        phone,
      }),
    );

    const another = String(await ask('\nAdd another tester? (y/n): ')).trim().toLowerCase();
    addMore = another === 'y';
  }

  return testers;
}

function generateInviteEmail(tester, testingDate) {
  return `
From: you@flow-finance.app
To: ${tester.email}
Subject: Beta Access: Flow Finance v0.9.6 - Help Us Test!

---

Hi ${tester.name.split(' ')[0]},

You're invited to be an early tester for Flow Finance v0.9.6 - our new intelligent cash flow management tool!

What: Test the app for ~30 minutes
When: ${testingDate}
Time: Please allow 30 minutes
Where: ${FRONTEND_URL}

What We Need From You:
1. Log in with your Google or Microsoft account
2. Try the main features (create a transaction, check dashboard, etc.)
3. Fill out the feedback form below (~5 minutes)

Feedback Form:
[Google Form Link Here - You'll create this from the template]

Thanks for being part of the beta!
The Flow Team
`;
}

function generateFeedbackForm() {
  return FEEDBACK_FORM_TEMPLATE;
}

async function main() {
  let closeQuestion = null;
  try {
    const parsed = buildCoordinatorInputFromArgs(process.argv.slice(2));

    let testers;
    let testingDate;

    if (parsed.nonInteractive) {
      testers = parsed.testers;
      testingDate = parsed.testingDate;
      console.log('Running in non-interactive mode');
    } else {
      const q = createQuestion();
      closeQuestion = q.close;
      testers = await collectTestersInteractive(q.ask);

      console.log(`\nCollected ${testers.length} testers`);
      testingDate = String(await q.ask('\nWhen do you want to start testing? (e.g., tomorrow at 09:00): ')).trim();
    }

    const testerData = {
      phase: 'dia-2-beta',
      createdAt: new Date().toISOString(),
      plannedTestDate: testingDate,
      testers,
      totalTesters: testers.length,
    };

    ensureDirectoryForFile(BETA_TESTERS_FILE);
    fs.writeFileSync(BETA_TESTERS_FILE, JSON.stringify(testerData, null, 2));

    const invites = testers.map((tester) => generateInviteEmail(tester, testingDate));
    const invitesPath = '.planning/beta-invites-template.txt';
    const feedbackPath = '.planning/beta-feedback-form-template.txt';

    ensureDirectoryForFile(invitesPath);
    ensureDirectoryForFile(feedbackPath);

    fs.writeFileSync(invitesPath, invites.join('\n\n' + '='.repeat(70) + '\n\n'));
    fs.writeFileSync(feedbackPath, generateFeedbackForm());

    console.log(`\nSetup complete. Generated files:\n- ${BETA_TESTERS_FILE}\n- ${invitesPath}\n- ${feedbackPath}`);

    if (closeQuestion) {
      closeQuestion();
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (closeQuestion) {
      closeQuestion();
    }
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  main();
}
