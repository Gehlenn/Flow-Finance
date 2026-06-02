#!/usr/bin/env node

/**
 * Flow Finance â€” Interactive Setup Wizard
 * 
 * This script guides you through the complete setup process:
 * 1. OpenAI API Key
 * 2. Firebase Configuration
 * 3. Vercel Linking
 * 4. Deployment
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

const log = {
  info: (msg) => process.stdout.write(`â„¹ï¸  ${msg}`),
  success: (msg) => process.stdout.write(`âœ… ${msg}`),
  warning: (msg) => process.stdout.write(`âš ï¸  ${msg}`),
  error: (msg) => process.stderr.write(`ERROR ${msg}\n`),
  title: (msg) => process.stdout.write(`\nðŸš€ ${msg}\n`),
};

async function main() {
  log.title('Flow Finance - Setup Wizard');

  // Create .env.local if doesn't exist
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    const examplePath = path.join(__dirname, '.env.local.example');
    fs.copyFileSync(examplePath, envPath);
    log.success('Created .env.local from template');
  } else {
    log.info('.env.local already exists');
  }

  let envContent = fs.readFileSync(envPath, 'utf-8');

  // 1. OpenAI Setup
  log.title('1ï¸âƒ£  OPENAI API KEY CONFIGURATION');
  process.stdout.write('Get your key from: https://platform.openai.com/api/keys\n');

  const openaiKey = await question('Enter your OpenAI API Key (sk-proj-...): ');
  if (openaiKey.trim()) {
    envContent = envContent.replace(
      /OPENAI_API_KEY=.*/,
      `OPENAI_API_KEY=${openaiKey.trim()}`
    );
    log.success('OpenAI API Key saved');
  }

  // 2. Firebase Setup
  log.title('2ï¸âƒ£  FIREBASE CONFIGURATION');
  process.stdout.write('Get from: https://console.firebase.google.com â†’ Project Settings â†’ Service Accounts\n');

  const firebaseProject = await question('Enter FIREBASE_PROJECT_ID (komodo-flow): ');
  if (firebaseProject.trim()) {
    envContent = envContent.replace(
      /FIREBASE_PROJECT_ID=.*/,
      `FIREBASE_PROJECT_ID=${firebaseProject.trim()}`
    );
  }

  const firebaseEmail = await question('Enter FIREBASE_CLIENT_EMAIL (firebase-adminsdk-xxx@...): ');
  if (firebaseEmail.trim()) {
    envContent = envContent.replace(
      /FIREBASE_CLIENT_EMAIL=.*/,
      `FIREBASE_CLIENT_EMAIL=${firebaseEmail.trim()}`
    );
    log.success('Firebase credentials saved');
  }

  // 3. Backend URL
  log.title('3ï¸âƒ£  BACKEND CONFIGURATION');
  const backendUrl = await question('Enter VITE_API_PROD_URL (https://your-backend.com): ');
  if (backendUrl.trim()) {
    envContent = envContent.replace(
      /VITE_API_PROD_URL=.*/,
      `VITE_API_PROD_URL=${backendUrl.trim()}`
    );
    log.success('Backend URL saved');
  }

  // Save .env.local
  fs.writeFileSync(envPath, envContent);
  log.success('Configuration saved to .env.local');

  // 4. Next Steps
  log.title('âœ… SETUP COMPLETE - NEXT STEPS');
  
  process.stdout.write('ðŸ“ Configuration saved to .env.local\n');
  
  process.stdout.write('ðŸ”— Link Vercel Account:');
  process.stdout.write('   1. npm install -g vercel');
  process.stdout.write('   2. vercel login');
  process.stdout.write('   3. vercel link\n');

  process.stdout.write('ðŸš€ Deploy:');
  process.stdout.write('   1. npm run build          (Test locally)');
  process.stdout.write('   2. npm run deploy:preview (Test deployment)');
  process.stdout.write('   3. npm run deploy         (Production)\n');

  process.stdout.write('ðŸ“š Documentation:');
  process.stdout.write('   â€¢ SETUP_GUIDE.md         (Complete guide)');
  process.stdout.write('   â€¢ SETUP_GUIA_PT.md       (Portuguese guide)');
  process.stdout.write('   â€¢ VERCEL_QUICK_START.md  (Vercel deployment)');

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  log.error(err.message);
  rl.close();
  process.exit(1);
});


