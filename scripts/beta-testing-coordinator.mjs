#!/usr/bin/env node

/**
 * Beta Testing Coordinator for Flow Finance v0.9.6
 * 
 * Usage: node scripts/beta-testing-coordinator.mjs
 * 
 * Interactive script that:
 * 1. Collects tester information
 * 2. Generates personalized invite emails
 * 3. Creates survey links
 * 4. Logs feedback tracking
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

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

async function collectTesters() {
  console.log(`
╔═════════════════════════════════════════════════════════╗
║  🧪 Flow Finance v0.9.6 - Beta Testing Coordinator     ║
║                                                         ║
║  This will set up your beta testing round for Dia 2    ║
╚═════════════════════════════════════════════════════════╝
  `);

  const testers = [];
  let addMore = true;

  while (addMore) {
    console.log(`\n--- Tester ${testers.length + 1} ---`);
    
    const name = await question('Full name: ');
    const email = await question('Email: ');
    const business = await question('Business type (consultório/loja/freelancer/autre): ');
    const phone = await question('Phone (optional): ');

    testers.push({
      id: `tester-${testers.length + 1}`,
      name,
      email,
      business,
      phone: phone || null,
      invitedAt: new Date().toISOString(),
      status: 'invited',
      feedback: null
    });

    const another = await question('\nAdd another tester? (y/n): ');
    addMore = another.toLowerCase() === 'y';
  }

  return testers;
}

function generateInviteEmail(tester, testingDate) {
  return `
From: you@flow-finance.app
To: ${tester.email}
Subject: 🚀 Beta Access: Flow Finance v0.9.6 - Help Us Test!

---

Hi ${tester.name.split(' ')[0]},

You're invited to be an early tester for Flow Finance v0.9.6 — our new intelligent cash flow management tool!

🎯 What: Test the app for ~30 minutes
📅 When: ${testingDate}
⏱️ Time: Please allow 30 minutes
📍 Where: https://flow-finance-frontend-nine.vercel.app/

✅ What We Need From You:
1. Log in with your Google or Microsoft account
2. Try the main features (create a transaction, check dashboard, etc.)
3. Fill out the feedback form below (~5 minutes)

🔗 Feedback Form:
[Google Form Link Here - You'll create this from the template]

💡 What to Expect:
- Smart cash flow dashboard showing your financial overview
- AI-powered transaction categorization
- Offline-first sync (works even without internet!)
- Mobile-friendly interface

🙏 Your feedback helps us make this better before public launch!

Questions? Reply to this email.

Thanks for being part of the beta!
The Flow Team
`;
}

function generateFeedbackForm() {
  return FEEDBACK_FORM_TEMPLATE;
}

async function main() {
  try {
    // Step 1: Collect testers
    const testers = await collectTesters();

    console.log(`\n✅ Collected ${testers.length} testers`);

    // Step 2: Ask for testing date
    const testingDate = await question('\nWhen do you want to start testing? (e.g., tomorrow at 09:00): ');

    // Step 3: Save tester data
    const testerData = {
      phase: 'dia-2-beta',
      createdAt: new Date().toISOString(),
      plannedTestDate: testingDate,
      testers,
      totalTesters: testers.length
    };

    fs.writeFileSync(
      BETA_TESTERS_FILE,
      JSON.stringify(testerData, null, 2)
    );

    console.log(`\n✅ Tester data saved to ${BETA_TESTERS_FILE}`);

    // Step 4: Generate artifacts
    console.log('\n📋 Generating email invites...');
    const invites = testers.map(t => generateInviteEmail(t, testingDate));
    
    fs.writeFileSync(
      '.planning/beta-invites-template.txt',
      invites.join('\n\n' + '='.repeat(70) + '\n\n')
    );
    console.log('✅ Invite templates saved to .planning/beta-invites-template.txt');

    console.log('\n📝 Generating feedback form...');
    fs.writeFileSync(
      '.planning/beta-feedback-form-template.txt',
      generateFeedbackForm()
    );
    console.log('✅ Feedback form saved to .planning/beta-feedback-form-template.txt');

    // Step 5: Summary
    console.log(`
╔════════════════════════════════════════════════════════╗
║  ✅ BETA TESTING SETUP COMPLETE                       ║
╚════════════════════════════════════════════════════════╝

📊 Summary:
  • Testers recruited: ${testers.length}
  • Testing planned for: ${testingDate}
  • Frontend URL: ${FRONTEND_URL}

📁 Generated Files:
  • ${BETA_TESTERS_FILE}
  • .planning/beta-invites-template.txt
  • .planning/beta-feedback-form-template.txt

🔗 Next Steps:
  1. Create a Google Form from the feedback template
  2. Copy the form URL into the invite emails
  3. Send invites to testers
  4. Collect feedback during testing window
  5. Review results and decide GO for Dia 3

📧 Invite Email Template:
${invites[0].substring(0, 200)}...
(Full version at .planning/beta-invites-template.txt)

💡 Pro Tips:
  • Send invites 24 hours before testing starts
  • Monitor Vercel logs during testing window
  • Respond to feedback within 1 hour if possible
  • Collect results for 2-3 hours after start

Ready to send invites? 
Check .planning/beta-invites-template.txt and customize!
    `);

    rl.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

main();
