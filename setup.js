#!/usr/bin/env node

/**
 * Flow Finance — Interactive Setup Wizard
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
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warning: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  title: (msg) => console.log(`\n🚀 ${msg}\n`),
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
  log.title('1️⃣  OPENAI API KEY CONFIGURATION');
  console.log('Get your key from: https://platform.openai.com/api/keys\n');

  const openaiKey = await question('Enter your OpenAI API Key (sk-proj-...): ');
  if (openaiKey.trim()) {
    envContent = envContent.replace(
      /OPENAI_API_KEY=.*/,
      `OPENAI_API_KEY=${openaiKey.trim()}`
    );
    log.success('OpenAI API Key saved');
  }

  // 2. Firebase Setup
  log.title('2️⃣  FIREBASE CONFIGURATION');
  console.log('Get from: https://console.firebase.google.com → Project Settings → Service Accounts\n');

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
  log.title('3️⃣  BACKEND CONFIGURATION');
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
  log.title('✅ SETUP COMPLETE - NEXT STEPS');
  
  console.log('📝 Configuration saved to .env.local\n');
  
  console.log('🔗 Link Vercel Account:');
  console.log('   1. npm install -g vercel');
  console.log('   2. vercel login');
  console.log('   3. vercel link\n');

  console.log('🚀 Deploy:');
  console.log('   1. npm run build          (Test locally)');
  console.log('   2. npm run deploy:preview (Test deployment)');
  console.log('   3. npm run deploy         (Production)\n');

  console.log('📚 Documentation:');
  console.log('   • SETUP_GUIDE.md         (Complete guide)');
  console.log('   • SETUP_GUIA_PT.md       (Portuguese guide)');
  console.log('   • VERCEL_QUICK_START.md  (Vercel deployment)');

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  log.error(err.message);
  rl.close();
  process.exit(1);
});