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

.PARAMETER Bump
    Semver part to bump before deploying: patch (default), minor, major, or none.
    Each bump commits package.json and creates a vX.Y.Z tag so the deploy can be reverted.

.PARAMETER AllowDirty
    Allow deploying with uncommitted changes. The version tag will not match what ships.

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
    [ValidateSet('patch', 'minor', 'major', 'none')]
    [string]$Bump = 'patch',
    [switch]$AllowDirty
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

    $taggedVersion = $null
    if ($Bump -ne 'none') {
        Write-Step "Versioning"
        $isRepo = (git rev-parse --is-inside-work-tree 2>$null) -eq 'true'
        if (-not $isRepo) {
            throw "Not a git repository, so this deploy could not be tagged. Use -Bump none to deploy without a revert point."
        }

        # A tag only makes a deploy revertible if the deployed code is actually committed.
        $dirty = git status --porcelain
        if ($dirty -and -not $AllowDirty) {
            Write-Host ($dirty | Out-String) -ForegroundColor Yellow
            throw "Uncommitted changes present. Commit them first so the version tag matches what ships, or pass -AllowDirty."
        }

        npm version $Bump --no-git-tag-version | Out-Null
        Assert-LastExitCode "npm version"

        $taggedVersion = (Get-Content (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json).version
        git add package.json package-lock.json 2>$null
        git commit -m "release: v$taggedVersion" | Out-Null
        git tag -a "v$taggedVersion" -m "Release v$taggedVersion" | Out-Null
        Write-Host "Tagged v$taggedVersion" -ForegroundColor Green
    }

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
    if ($taggedVersion) {
        Write-Host "Version:  v$taggedVersion" -ForegroundColor Green
        Write-Host "Revert:   git checkout v$taggedVersion; .\deploy.ps1 -Bump none" -ForegroundColor DarkGray
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
