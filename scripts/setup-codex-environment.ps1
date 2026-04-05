param(
    [switch]$SkipClone,
    [switch]$SkipNpm,
    [switch]$SkipGlobalWrites
)

$ErrorActionPreference = "Stop"

$UserProfilePath = $env:USERPROFILE
$CodexHome = Join-Path $UserProfilePath ".codex"
$CodexSkills = Join-Path $CodexHome "skills"
$CodexConfig = Join-Path $CodexHome "config.toml"
$TempRoot = Join-Path $env:TEMP "codex-setup"

$repoTargets = @(
    @{ Name = "superpowers"; Url = "https://github.com/obra/superpowers.git"; TempDir = "superpowers"; Type = "junction"; SourceSubdir = "skills"; DestDir = Join-Path $UserProfilePath ".agents\skills\superpowers" },
    @{ Name = "context7"; Url = "https://github.com/upstash/context7.git"; TempDir = "context7"; Type = "manual-context7" },
    @{ Name = "obsidian-skills"; Url = "https://github.com/kepano/obsidian-skills.git"; TempDir = "obsidian-skills"; Type = "copy-skills"; SourceSubdir = "skills" },
    @{ Name = "marketingskills"; Url = "https://github.com/coreyhaines31/marketingskills.git"; TempDir = "marketingskills"; Type = "copy-skills"; SourceSubdir = "skills" },
    @{ Name = "gstack"; Url = "https://github.com/garrytan/gstack.git"; TempDir = "gstack"; Type = "gstack" }
)

function Ensure-Dir {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}

function Clone-Or-RefreshRepo {
    param(
        [string]$Url,
        [string]$Path
    )

    if (Test-Path $Path) {
        Write-Host "Repo exists: $Path"
        return
    }

    git clone --depth 1 $Url $Path
}

function Copy-SkillDirectories {
    param(
        [string]$SourceRoot,
        [string]$DestinationRoot
    )

    Ensure-Dir $DestinationRoot

    Get-ChildItem $SourceRoot -Directory | ForEach-Object {
        $target = Join-Path $DestinationRoot $_.Name
        if (Test-Path $target) {
            Remove-Item -Recurse -Force $target
        }
        Copy-Item -Recurse -Force $_.FullName $target
    }
}

function Ensure-N8nMcpConfig {
    param([string]$ConfigPath)

    Ensure-Dir (Split-Path $ConfigPath -Parent)
    if (-not (Test-Path $ConfigPath)) {
        Set-Content -Path $ConfigPath -Value ""
    }

    $content = Get-Content $ConfigPath -Raw
    if ($content -match "\[mcp_servers\.n8n\]") {
        Write-Host "n8n MCP config already present"
        return
    }

    $block = @"

[mcp_servers.n8n]
args = ["n8n-mcp"]
command = "npx"
env = { "MCP_MODE" = "stdio", "LOG_LEVEL" = "error", "DISABLE_CONSOLE_OUTPUT" = "true" }
"@

    Add-Content -Path $ConfigPath -Value $block
}

function Ensure-CodexMemorySkill {
    param([string]$DestinationRoot)

    $skillRoot = Join-Path $DestinationRoot "codex-memory"
    $references = Join-Path $skillRoot "references"
    Ensure-Dir $references

    @'
---
name: codex-memory
description: Practical persistent-memory workflow for Codex using gstack learnings plus GSD threads and notes. Use when the user asks to remember decisions, recover context from prior sessions, capture durable project knowledge, or build a Claude-Mem-like workflow in Codex.
---

# Codex Memory

Use this skill as a practical replacement for automatic session memory in Codex.

It combines three layers:

1. `gstack-learn`
2. `gsd-thread`
3. `gsd-note`

Preferred order:

1. Inspect `.planning/threads/` if present
2. Consult `gstack-learn` for prior patterns
3. Use `gsd-note` for quick capture

Storage conventions:

- GSD threads: `.planning/threads/`
- gstack learnings: `~/.gstack/projects/<slug>/learnings.jsonl`

Use this as the practical Codex replacement for Claude-Mem-style persistence.
'@ | Set-Content -Path (Join-Path $skillRoot "SKILL.md") -Encoding UTF8

    @'
# Codex Memory Usage

- `note` = do not lose this
- `thread` = resume this later
- `learning` = remember this next time
'@ | Set-Content -Path (Join-Path $references "USAGE.md") -Encoding UTF8
}

function Install-Context7Skills {
    param(
        [string]$RepoRoot,
        [string]$DestinationRoot
    )

    Ensure-Dir $DestinationRoot
    foreach ($name in @("find-docs", "context7-cli")) {
        $source = Join-Path $RepoRoot "skills\$name"
        if (-not (Test-Path $source)) {
            Write-Warning "Skipping missing Context7 skill source: $source"
            continue
        }
        $target = Join-Path $DestinationRoot $name
        if (Test-Path $target) {
            Remove-Item -Recurse -Force $target
        }
        Copy-Item -Recurse -Force $source $target
    }
}

function Install-Gstack {
    param(
        [string]$RepoRoot,
        [string]$DestinationRoot
    )

    $gstackRepo = Join-Path $UserProfilePath ".gstack\repos\gstack"
    Ensure-Dir (Split-Path $gstackRepo -Parent)

    if (-not (Test-Path $gstackRepo)) {
        Copy-Item -Recurse -Force $RepoRoot $gstackRepo
    }

    if (-not $SkipNpm) {
        Push-Location $gstackRepo
        try {
            & bun install
            & bun run build
        }
        finally {
            Pop-Location
        }
    }

    Ensure-Dir $DestinationRoot

    $runtimeRoot = Join-Path $DestinationRoot "gstack"
    if (Test-Path $runtimeRoot) {
        Remove-Item -Recurse -Force $runtimeRoot
    }

    New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $runtimeRoot "browse") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $runtimeRoot "review") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $runtimeRoot "gstack-upgrade") | Out-Null

    Copy-Item (Join-Path $gstackRepo ".agents\skills\gstack\SKILL.md") (Join-Path $runtimeRoot "SKILL.md") -Force
    Copy-Item (Join-Path $gstackRepo "ETHOS.md") (Join-Path $runtimeRoot "ETHOS.md") -Force
    Copy-Item -Recurse -Force (Join-Path $gstackRepo "bin") (Join-Path $runtimeRoot "bin")
    Copy-Item -Recurse -Force (Join-Path $gstackRepo "browse\bin") (Join-Path $runtimeRoot "browse\bin")
    Copy-Item -Recurse -Force (Join-Path $gstackRepo "browse\dist") (Join-Path $runtimeRoot "browse\dist")
    Copy-Item (Join-Path $gstackRepo ".agents\skills\gstack-upgrade\SKILL.md") (Join-Path $runtimeRoot "gstack-upgrade\SKILL.md") -Force

    foreach ($file in @("checklist.md", "design-checklist.md", "greptile-triage.md", "TODOS-format.md")) {
        Copy-Item (Join-Path $gstackRepo "review\$file") (Join-Path $runtimeRoot "review\$file") -Force
    }

    Get-ChildItem (Join-Path $gstackRepo ".agents\skills") -Directory | Where-Object { $_.Name -like "gstack-*" } | ForEach-Object {
        $target = Join-Path $DestinationRoot $_.Name
        if (Test-Path $target) {
            Remove-Item -Recurse -Force $target
        }
        Copy-Item -Recurse -Force $_.FullName $target
    }

    $nodeModulesTarget = Join-Path $runtimeRoot "node_modules"
    if (Test-Path $nodeModulesTarget) {
        Remove-Item -Recurse -Force $nodeModulesTarget
    }
    cmd /c mklink /J "$nodeModulesTarget" "$gstackRepo\node_modules" | Out-Null

    $filesToPatch = @(
        (Join-Path $DestinationRoot "gstack-review\SKILL.md"),
        (Join-Path $runtimeRoot "review\design-checklist.md"),
        (Join-Path $runtimeRoot "review\greptile-triage.md")
    )

    foreach ($file in $filesToPatch) {
        if (-not (Test-Path $file)) {
            Write-Warning "Skipping missing gstack patch target: $file"
            continue
        }
        $text = [System.IO.File]::ReadAllText($file)
        $text = $text.Replace('~/.claude/plans', '~/.codex/plans')
        $text = $text.Replace('~/.claude/skills/gstack/bin/gstack-diff-scope', '~/.codex/skills/gstack/bin/gstack-diff-scope')
        $text = $text.Replace('~/.claude/skills/gstack/browse/bin/remote-slug', '~/.codex/skills/gstack/browse/bin/remote-slug')
        [System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))
    }
}

function Normalize-GsdAgentPaths {
    param([string]$AgentsRoot)

    if (-not (Test-Path $AgentsRoot)) {
        Write-Warning "Skipping path normalization because agents root does not exist: $AgentsRoot"
        return
    }

    Get-ChildItem $AgentsRoot -File | Where-Object { $_.Extension -in @(".md", ".toml") } | ForEach-Object {
        $text = [System.IO.File]::ReadAllText($_.FullName)
        $updated = $text.Replace('.claude/skills/', '.codex/skills/')
        $updated = $updated.Replace('~/.claude/hooks/', '~/.codex/hooks/')
        $updated = $updated.Replace('~/.claude/get-shit-done', '~/.codex/get-shit-done')
        $updated = $updated.Replace('configDir = ~/.claude', 'configDir = ~/.codex')
        if ($updated -ne $text) {
            [System.IO.File]::WriteAllText($_.FullName, $updated, [System.Text.UTF8Encoding]::new($false))
        }
    }
}

Ensure-Dir $TempRoot
Ensure-Dir $CodexSkills

if (-not $SkipClone) {
    foreach ($repo in $repoTargets) {
        Clone-Or-RefreshRepo -Url $repo.Url -Path (Join-Path $TempRoot $repo.TempDir)
    }
}

if (-not $SkipGlobalWrites) {
    # Manual/global skill installs
    Install-Context7Skills -RepoRoot (Join-Path $TempRoot "context7") -DestinationRoot $CodexSkills
    Copy-SkillDirectories -SourceRoot (Join-Path $TempRoot "obsidian-skills\skills") -DestinationRoot $CodexSkills
    Copy-SkillDirectories -SourceRoot (Join-Path $TempRoot "marketingskills\skills") -DestinationRoot $CodexSkills
    Ensure-CodexMemorySkill -DestinationRoot $CodexSkills

    # Official installers
    if (-not $SkipNpm) {
        npx uipro-cli@latest init --ai codex --offline
        npx get-shit-done-cc@latest --codex --global
    }

    Ensure-N8nMcpConfig -ConfigPath $CodexConfig
    Install-Gstack -RepoRoot (Join-Path $TempRoot "gstack") -DestinationRoot $CodexSkills
    Normalize-GsdAgentPaths -AgentsRoot (Join-Path $CodexHome "agents")

    # superpowers Windows install convention
    $superpowersRepo = Join-Path $UserProfilePath ".codex\superpowers"
    if (-not (Test-Path $superpowersRepo)) {
        Copy-Item -Recurse -Force (Join-Path $TempRoot "superpowers") $superpowersRepo
    }
    Ensure-Dir (Join-Path $UserProfilePath ".agents\skills")
    $superpowersJunction = Join-Path $UserProfilePath ".agents\skills\superpowers"
    if (-not (Test-Path $superpowersJunction)) {
        cmd /c mklink /J "$superpowersJunction" "$superpowersRepo\skills" | Out-Null
    }
}

Write-Host "Codex environment setup script completed."
