# Script de Instalação de Skills e MCPs para VS Code Copilot
# Data: 15 Abril 2026

`$ErrorActionPreference = 'Stop'

Write-Host "=== Instalacao de Skills e MCPs para VS Code ===" -ForegroundColor Cyan

# 1. OBSIDIAN SKILLS (ja foi feito, apenas log)
Write-Host "`n[√] Obsidian Skills ja sincronizadas" -ForegroundColor Green

# 2. INSTALAR MARKETING SKILLS
Write-Host "`n[7] Instalando Marketing Skills..." -ForegroundColor Yellow
npx skills add https://github.com/agentskills-io/marketing-skills.git
Write-Host "[√] Marketing Skills instaladas" -ForegroundColor Green

# 3. COPIAR TODAS AS SKILLS PARA VS CODE USER PROMPTS
`$skillSources = @(
    'c:\Users\Danie\.codex\skills',
    'c:\Users\Danie\.claude\skills',
    'c:\Users\Danie\.agents\skills'
)

`$vscodeUserPrompts = `$env:VSCODE_USER_PROMPTS_FOLDER
if (-not `$vscodeUserPrompts) {
    `$vscodeUserPrompts = Join-Path `$env:APPDATA 'Code\User\prompts'
}

if (-not (Test-Path `$vscodeUserPrompts)) {
    New-Item -ItemType Directory -Path `$vscodeUserPrompts -Force | Out-Null
}

Write-Host "`n[7] Sincronizando skills para `$vscodeUserPrompts..." -ForegroundColor Yellow

`$skillsToSync = @(
    'gsd-do', 'gsd-plan-phase', 'gsd-execute-phase', 'gsd-check-todos',
    'gstack-ship', 'gstack-qa', 'gstack-review', 'gstack-investigate',
    'ui-ux-pro-max', 'codigo-validado',
    'obsidian-cli', 'json-canvas', 'obsidian-markdown',
    'claude-mem', 'n8n-mcp', 'context7'
)

foreach (`$skill in `$skillsToSync) {
    foreach (`$src in `$skillSources) {
        `$skillPath = Join-Path `$src `$skill
        if (Test-Path `$skillPath) {
            Copy-Item -Path `$skillPath -Destination `$vscodeUserPrompts -Recurse -Force | Out-Null
            Write-Host "  √ `$skill sincronizada" -ForegroundColor Green
            break
        }
    }
}

Write-Host "[√] Skills sincronizadas para VS Code" -ForegroundColor Green

# 4. RTK - Validar Instalacao
Write-Host "`n[7] Validando RTK (token optimizer)..." -ForegroundColor Yellow
`$rtkPath = 'C:\Users\Danie\AppData\Local\Programs\rtk'
if (Test-Path `$rtkPath) {
    Write-Host "[√] RTK ja instalado em `$rtkPath" -ForegroundColor Green
} else {
    Write-Host "[!] RTK nao encontrado. Baixe do: https://github.com/rtk-ai/rtk/releases" -ForegroundColor Yellow
}

# 5. GRAPHIFY - Instalar para Obsidian
Write-Host "`n[7] Instalando Graphify..." -ForegroundColor Yellow
`$graphifyPath = 'E:\app e jogos criados\obsidian-vault\plugins\graphify'
if (-not (Test-Path `$graphifyPath)) {
    New-Item -ItemType Directory -Path `$graphifyPath -Force | Out-Null
}
git clone --depth 1 https://github.com/safishamsi/graphify.git `$graphifyPath 2>&1 | Out-Null
Write-Host "[√] Graphify instalado" -ForegroundColor Green

Write-Host "`n=== Instalacao Concluida ===" -ForegroundColor Cyan
Write-Host "`nProximo passo: Reinicie VS Code para carregar todas as skills" -ForegroundColor Yellow
