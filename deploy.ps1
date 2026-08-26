<#
.SYNOPSIS
    Builds the app, then deploys Firebase Hosting and Firestore security rules.

.PARAMETER Project
    Firebase project id. Defaults to the "default" entry in .firebaserc.

.PARAMETER Install
    Force `npm install` before building.

.PARAMETER TypeCheck
    Run `tsc --noEmit` and abort on errors. Off by default because `npm run build`
    (vite) does not type-check and the repo has pre-existing type errors.

.PARAMETER Open
    Open the live site in the default browser after a successful deploy.

.PARAMETER SkipRules
    Deploy hosting only, leaving the live Firestore security rules untouched.

.PARAMETER SkipVerify
    Skip the post-deploy check that the live site is serving the assets just built.

.PARAMETER AllowDirty
    Deploy even with uncommitted changes. The build will be marked +dirty in the footer
    and cannot be reproduced from git.

.PARAMETER Bump
    One-off override of the bump type for this run. Normally you do not pass this:
    the bump is read from "nextBump" in changelog.json.

.NOTES
    Release flow: put your notes in changelog.json "pending", set "nextBump"
    (minor or major), commit your work, then just run .\deploy.ps1

.EXAMPLE
    .\deploy.ps1 -Open
#>
[CmdletBinding()]
param(
    [string]$Project,
    [switch]$Install,
    [switch]$TypeCheck,
    [switch]$Open,
    [switch]$SkipRules,
    [switch]$SkipVerify,
    [switch]$AllowDirty,
    [ValidateSet('minor', 'major', 'patch', 'none')]
    [string]$Bump
)

$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-LastExitCode {
    param([string]$What)
    if ($LASTEXITCODE -ne 0) {
        throw "$What failed with exit code $LASTEXITCODE."
    }
}

# The SPA rewrite answers a missing asset with 200 + index.html, so status code alone proves nothing.
function Test-LiveAsset {
    param([string]$AssetUrl)

    try {
        $response = Invoke-WebRequest -Uri $AssetUrl -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
    }
    catch {
        return 'unreachable'
    }

    if ([string]$response.Headers['Content-Type'] -like 'text/html*') {
        return 'stale'
    }

    return 'ok'
}

function Step-Version {
    param([string]$Current, [string]$Part)

    $parts = $Current.Split('.')
    $major = [int]$parts[0]; $minor = [int]$parts[1]; $patch = [int]$parts[2]

    switch ($Part) {
        'major' { return "$($major + 1).0.0" }
        'minor' { return "$major.$($minor + 1).0" }
        'patch' { return "$major.$minor.$($patch + 1)" }
    }
    throw "Unknown bump part '$Part'. Use major, minor, patch or none."
}

# Moves changelog.pending into releases[version], then resets pending for the next cycle.
function Update-Changelog {
    param([string]$Version, [string]$Part)

    $entry = [ordered]@{
        date    = (Get-Date -Format 'yyyy-MM-dd')
        type    = $Part
        changes = @($changelog.pending)
    }

    if ($entry.changes.Count -eq 0) {
        $entry.changes = @("No changelog entries recorded for this release.")
        Write-Host "changelog.json 'pending' was empty; recorded a placeholder." -ForegroundColor Yellow
    }

    $releases = [ordered]@{ $Version = $entry }
    foreach ($property in $changelog.releases.PSObject.Properties) {
        $releases[$property.Name] = $property.Value
    }

    $changelog.releases = [pscustomobject]$releases
    $changelog.pending = @()
    $changelog | ConvertTo-Json -Depth 8 | Set-Content $changelogPath -Encoding UTF8
}

Push-Location $PSScriptRoot
try {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm was not found on PATH. Install Node.js and try again."
    }

    if (-not $Project) {
        $rcPath = Join-Path $PSScriptRoot '.firebaserc'
        if (Test-Path $rcPath) {
            $Project = (Get-Content $rcPath -Raw | ConvertFrom-Json).projects.default
        }
    }
    if (-not $Project) {
        throw "No Firebase project resolved. Pass -Project <project-id> or add one to .firebaserc."
    }

    $site = (Get-Content (Join-Path $PSScriptRoot 'firebase.json') -Raw | ConvertFrom-Json).hosting.site
    Write-Host "Project: $Project" -ForegroundColor DarkGray
    Write-Host "Site:    $site" -ForegroundColor DarkGray

    $changelogPath = Join-Path $PSScriptRoot 'changelog.json'
    if (-not (Test-Path $changelogPath)) {
        throw "changelog.json not found. It holds nextBump and the release history."
    }
    $changelog = Get-Content $changelogPath -Raw | ConvertFrom-Json

    if ($Install -or -not (Test-Path (Join-Path $PSScriptRoot 'node_modules'))) {
        Write-Step "Installing dependencies"
        npm install
        Assert-LastExitCode "npm install"
    }

    if ($TypeCheck) {
        Write-Step "Type-checking"
        npx tsc --noEmit -p tsconfig.json
        Assert-LastExitCode "Type check"
    }

    $version = (Get-Content (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json).version
    $headTag = $null

    Write-Step "Releasing"
    if ((git rev-parse --is-inside-work-tree 2>$null) -ne 'true') {
        Write-Host "Not a git repository; this deploy has no revert point." -ForegroundColor Yellow
    }
    else {
        # A version is only revertible if the shipped code is committed and tagged.
        $dirty = git status --porcelain
        if ($dirty -and -not $AllowDirty) {
            Write-Host ($dirty | Out-String) -ForegroundColor Yellow
            throw "Uncommitted changes present. Commit your work first, then run .\deploy.ps1 again."
        }

        $effectiveBump = if ($Bump) { $Bump } else { $changelog.nextBump }
        if (-not $effectiveBump) { $effectiveBump = 'minor' }

        if ($dirty) {
            Write-Host "Dirty tree: skipping the version bump." -ForegroundColor Yellow
        }
        elseif ($effectiveBump -eq 'none') {
            Write-Host "nextBump is 'none'; redeploying v$version unchanged." -ForegroundColor DarkGray
        }
        else {
            $version = Step-Version -Current $version -Part $effectiveBump
            Write-Host "Releasing v$version ($effectiveBump)" -ForegroundColor Green

            npm version $version --no-git-tag-version --allow-same-version | Out-Null
            Assert-LastExitCode "npm version"

            Update-Changelog -Version $version -Part $effectiveBump

            git add package.json package-lock.json changelog.json
            git commit -m "release: v$version" | Out-Null
            Assert-LastExitCode "git commit"
            git tag -a "v$version" -m "Release v$version" | Out-Null
            Assert-LastExitCode "git tag"
        }

        $headTag = (git tag --points-at HEAD | Select-Object -First 1)
        if ($dirty) {
            Write-Host "Deploying a DIRTY tree. The footer will show +dirty and this build cannot be reproduced from git." -ForegroundColor Yellow
        }
        elseif (-not $headTag) {
            Write-Host "HEAD is not tagged, so there is no named revert point for this deploy." -ForegroundColor Yellow
        }
        else {
            Write-Host "Revert point: $headTag" -ForegroundColor Green
        }
    }
    Write-Host "Version: v$version" -ForegroundColor DarkGray

    Write-Step "Building production bundle"
    npm run build
    Assert-LastExitCode "Build"

    $distPath = Join-Path $PSScriptRoot 'dist'
    if (-not (Test-Path (Join-Path $distPath 'index.html'))) {
        throw "Build finished but dist/index.html is missing. Nothing to deploy."
    }

    Write-Step "Deploying to Firebase"
    $targets = @('hosting')
    if (-not $SkipRules) {
        $rulesPath = Join-Path $PSScriptRoot 'firestore.rules'
        if (Test-Path $rulesPath) {
            $targets += 'firestore:rules'
        }
        else {
            Write-Host "firestore.rules not found; deploying hosting only." -ForegroundColor Yellow
        }
    }

    $only = $targets -join ','
    Write-Host "Targets: $only" -ForegroundColor DarkGray
    npx -y firebase-tools@latest deploy --only $only --project $Project
    Assert-LastExitCode "Firebase deploy"

    $url = "https://$site.web.app"

    if (-not $SkipVerify) {
        Write-Step "Verifying the live site serves this build"
        $localHtml = Get-Content (Join-Path $distPath 'index.html') -Raw
        $expectedAssets = [regex]::Matches($localHtml, '/assets/[A-Za-z0-9._-]+') |
            ForEach-Object { $_.Value } |
            Select-Object -Unique

        $stale = @()
        $unreachable = @()

        foreach ($asset in $expectedAssets) {
            $result = Test-LiveAsset -AssetUrl "$url$asset"
            switch ($result) {
                'stale' { $stale += $asset; Write-Host "  STALE  $asset" -ForegroundColor Red }
                'unreachable' { $unreachable += $asset; Write-Host "  ?      $asset" -ForegroundColor Yellow }
                default { Write-Host "  ok     $asset" -ForegroundColor DarkGray }
            }
        }

        if ($stale.Count -gt 0) {
            throw "The live site returned HTML for $($stale -join ', ') instead of the asset, so it is not serving this build."
        }

        if ($unreachable.Count -gt 0) {
            Write-Host "Could not reach the site from this machine (proxy or network); verify manually." -ForegroundColor Yellow
        }
        else {
            Write-Host "Live site is serving this build." -ForegroundColor Green
        }
    }

    Write-Host ""
    Write-Host "Deployed: $url" -ForegroundColor Green
    Write-Host "Version:  v$version" -ForegroundColor Green
    if ($headTag) {
        Write-Host "Revert:   git checkout $headTag; .\deploy.ps1" -ForegroundColor DarkGray
    }

    if ($Open) {
        Start-Process $url
    }
}
catch {
    Write-Host ""
    Write-Host "Deploy aborted: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
