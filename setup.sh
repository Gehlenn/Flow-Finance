#!/bin/bash

# Flow Finance — Setup Wizard
# This script helps you configure environment variables

echo "🚀 Flow Finance — Configuration Setup Wizard"
echo "=============================================="
echo ""

# Create .env.local if doesn't exist
if [ ! -f .env.local ]; then
    cp .env.local.example .env.local
    echo "✅ Created .env.local from template"
else
    echo "ℹ️  .env.local already exists"
fi

echo ""
echo "📝 Configure your environment variables:"
echo ""

# OpenAI Setup
echo "1️⃣  OPENAI_API_KEY"
echo "   Get it from: https://platform.openai.com/api/keys"
read -p "   Enter your OpenAI API Key (sk-proj-...): " openai_key
if [ ! -z "$openai_key" ]; then
    sed -i "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$openai_key|" .env.local
    echo "   ✅ OpenAI API Key saved"
fi

echo ""
echo "2️⃣  Firebase Configuration"
echo "   Get from: https://console.firebase.google.com → Project Settings"
read -p "   Enter FIREBASE_PROJECT_ID (komodo-flow): " firebase_project
if [ ! -z "$firebase_project" ]; then
    sed -i "s|FIREBASE_PROJECT_ID=.*|FIREBASE_PROJECT_ID=$firebase_project|" .env.local
fi

read -p "   Enter FIREBASE_CLIENT_EMAIL: " firebase_email
if [ ! -z "$firebase_email" ]; then
    sed -i "s|FIREBASE_CLIENT_EMAIL=.*|FIREBASE_CLIENT_EMAIL=$firebase_email|" .env.local
fi

echo ""
echo "3️⃣  Backend URL (for production)"
read -p "   Enter VITE_API_PROD_URL (https://...): " backend_url
if [ ! -z "$backend_url" ]; then
    sed -i "s|VITE_API_PROD_URL=.*|VITE_API_PROD_URL=$backend_url|" .env.local
    echo "   ✅ Backend URL saved"
fi

echo ""
echo "✅ Configuration saved to .env.local"
echo ""
echo "🔗 Next: Link your Vercel account by running:"
echo "   vercel link"
echo ""
echo "📚 Full guide: Read SETUP_GUIDE.md"