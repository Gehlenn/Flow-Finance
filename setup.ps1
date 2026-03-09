# Flow Finance — Setup Wizard (Windows)
# This script helps you configure environment variables

Write-Host "🚀 Flow Finance — Configuration Setup Wizard" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Create .env.local if doesn't exist
if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.local.example" ".env.local"
    Write-Host "✅ Created .env.local from template" -ForegroundColor Green
} else {
    Write-Host "ℹ️  .env.local already exists" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📝 Configure your environment variables:" -ForegroundColor Cyan
Write-Host ""

# Read .env.local content
$envContent = Get-Content ".env.local" -Raw

# OpenAI Setup
Write-Host "1️⃣  OPENAI API KEY" -ForegroundColor Yellow
Write-Host "   Get it from: https://platform.openai.com/api/keys"
$openai_key = Read-Host "   Enter your OpenAI API Key (sk-proj-...)"
if ($openai_key) {
    $envContent = $envContent -replace 'OPENAI_API_KEY=.*', "OPENAI_API_KEY=$openai_key"
    Write-Host "   ✅ OpenAI API Key saved" -ForegroundColor Green
}

Write-Host ""
Write-Host "2️⃣  FIREBASE CONFIGURATION" -ForegroundColor Yellow
Write-Host "   Get from: https://console.firebase.google.com → Project Settings"

$firebase_project = Read-Host "   Enter FIREBASE_PROJECT_ID (default: komodo-flow)"
if ($firebase_project) {
    $envContent = $envContent -replace 'FIREBASE_PROJECT_ID=.*', "FIREBASE_PROJECT_ID=$firebase_project"
}

$firebase_email = Read-Host "   Enter FIREBASE_CLIENT_EMAIL"
if ($firebase_email) {
    $envContent = $envContent -replace 'FIREBASE_CLIENT_EMAIL=.*', "FIREBASE_CLIENT_EMAIL=$firebase_email"
}

Write-Host ""
Write-Host "3️⃣  BACKEND URL (for production)" -ForegroundColor Yellow
$backend_url = Read-Host "   Enter VITE_API_PROD_URL (https://your-backend.com)"
if ($backend_url) {
    $envContent = $envContent -replace 'VITE_API_PROD_URL=.*', "VITE_API_PROD_URL=$backend_url"
    Write-Host "   ✅ Backend URL saved" -ForegroundColor Green
}

# Save .env.local
$envContent | Set-Content ".env.local"

Write-Host ""
Write-Host "✅ Configuration saved to .env.local" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Install Vercel CLI:     npm install -g vercel" -ForegroundColor White
Write-Host "   2. Login to Vercel:        vercel login" -ForegroundColor White
Write-Host "   3. Link your project:      vercel link" -ForegroundColor White
Write-Host "   4. Deploy to preview:      npm run deploy:preview" -ForegroundColor White
Write-Host "   5. Deploy to production:   npm run deploy" -ForegroundColor White
Write-Host ""
Write-Host "📚 Full guide: Read SETUP_GUIDE.md" -ForegroundColor Yellow