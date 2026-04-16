#!/usr/bin/env powershell
# Instalacao de Skills e MCPs para VS Code Copilot
# Data: 15 Abril 2026

Write-Host "=== Instalacao de Skills e MCPs para VS Code ===" -ForegroundColor Cyan

# 1. COPIAR SKILLS PARA VS CODE USER PROMPTS
$vscodePrompts = Join-Path $env:APPDATA 'Code\User\prompts'
if (-not (Test-Path $vscodePrompts)) {
    New-Item -ItemType Directory -Path $vscodePrompts -Force | Out-Null
    Write-Host "Criado diretorio: $vscodePrompts" -ForegroundColor Green
}

Write-Host "Sincronizando skills para VS Code..."

robocopy 'c:\Users\Danie\.codex\skills' $vscodePrompts /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
Write-Host "Skills sincronizadas com sucesso" -ForegroundColor Green

# 2. VALIDAR RTK
$rtkPath = 'C:\Users\Danie\AppData\Local\Programs\rtk'
if (Test-Path $rtkPath) {
    Write-Host "RTK validado em: $rtkPath" -ForegroundColor Green
} else {
    Write-Host "AVISO: RTK nao encontrado. Baixe em: https://github.com/rtk-ai/rtk/releases" -ForegroundColor Yellow
}

# 3. INSTALAR GRAPHIFY
Write-Host "Instalando Graphify..."
$graphifyPath = 'E:\app e jogos criados\obsidian-vault\plugins\graphify'
if (-not (Test-Path $graphifyPath)) {
    New-Item -ItemType Directory -Path $graphifyPath -Force | Out-Null
}
try {
    git clone --depth 1 https://github.com/safishamsi/graphify.git $graphifyPath *>$null
    Write-Host "Graphify instalado" -ForegroundColor Green
} catch {
    Write-Host "Erro ao instalar Graphify (continuar mesmo assim)" -ForegroundColor Yellow
}

# 4. LISTAR MARKETING SKILLS
Write-Host "Instalando Marketing Skills via NPX..."
try {
    npx skills add https://github.com/agentskills-io/marketing-skills.git
    Write-Host "Marketing Skills adicionadas" -ForegroundColor Green
} catch {
    Write-Host "Marketing Skills nao foi possivel instalar agora, tente: npx skills add https://github.com/agentskills-io/marketing-skills.git" -ForegroundColor Yellow
}

Write-Host "`n=== Instalacao Concluida ===" -ForegroundColor Cyan
Write-Host "Proximos passos:`n1. Reinicie VS Code`n2. Abra Obsidian e habilite Graphify`n3. Teste /gsd-do para verificar carregamento" -ForegroundColor Yellow
