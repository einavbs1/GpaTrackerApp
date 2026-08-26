<#
.SYNOPSIS
    Portable release script: bumps the version, updates changelog.json, commits and tags.
    Drop this into any git repo. It does not deploy - run your deploy step afterwards,
    or pass -Run to have it execute build/deploy commands for you.

.DESCRIPTION
    Workflow:
      1. While working, add notes to the "pending" array in changelog.json
         and set "nextBump" to minor or major.
      2. Commit your own work yourself. This script never commits your changes.
      3. Run .\release.ps1
         -> steps the version, moves pending into releases[newVersion],
            commits ONLY the version/changelog files, and tags vX.Y.Z

    The commit looks like:
        feat: bump version to 2.4.0

        - First changelog entry
        - Second changelog entry

.PARAMETER Bump
    One-off override: major, minor, patch or none. Normally read from changelog.nextBump.

.PARAMETER VersionFile
    Optional file holding the canonical version. Defaults to package.json when present.
    Pass "changelog.json" for non-Node repos.

.PARAMETER AllowDirty
    Skip the clean-tree requirement. The tag will not match what ships - use sparingly.

.PARAMETER Run
    Commands to execute after a successful release, e.g. -Run 'npm run build','firebase deploy'

.EXAMPLE
    .\release.ps1
    .\release.ps1 -Bump major
    .\release.ps1 -Run 'npm run build','firebase deploy --only hosting'
#>
[CmdletBinding()]
param(
    [ValidateSet('major', 'minor', 'patch', 'none')]
    [string]$Bump,
    [string]$VersionFile,
    [switch]$AllowDirty,
    [string[]]$Run
)

$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-LastExitCode {
    param([string]$What)
    if ($LASTEXITCODE -ne 0) { throw "$What failed with exit code $LASTEXITCODE." }
}

# Numeric increment on purpose: string concatenation turns 2.1.9 into 2.1.91.
function Step-Version {
    param([string]$Current, [string]$Part)

    if ($Current -notmatch '^\d+\.\d+\.\d+$') {
        throw "Version '$Current' is not in X.Y.Z form."
    }

    $p = $Current.Split('.')
    $major = [int]$p[0]; $minor = [int]$p[1]; $patch = [int]$p[2]

    switch ($Part) {
        'major' { return "$($major + 1).0.0" }
        'minor' { return "$major.$($minor + 1).0" }
        'patch' { return "$major.$minor.$($patch + 1)" }
    }
    throw "Unknown bump part '$Part'."
}

Push-Location $PSScriptRoot
try {
    if ((git rev-parse --is-inside-work-tree 2>$null) -ne 'true') {
        throw "Not a git repository."
    }

    $changelogPath = Join-Path $PSScriptRoot 'changelog.json'
    if (-not (Test-Path $changelogPath)) {
        $seed = [ordered]@{ nextBump = 'minor'; pending = @(); releases = [ordered]@{} }
        $seed | ConvertTo-Json -Depth 8 | Set-Content $changelogPath -Encoding UTF8
        Write-Host "Created changelog.json" -ForegroundColor Yellow
    }
    $changelog = Get-Content $changelogPath -Raw | ConvertFrom-Json

    $packagePath = Join-Path $PSScriptRoot 'package.json'
    $usePackageJson = -not $VersionFile -and (Test-Path $packagePath)
    if ($VersionFile) { $usePackageJson = (Split-Path $VersionFile -Leaf) -eq 'package.json' }

    $currentVersion =
        if ($usePackageJson) { (Get-Content $packagePath -Raw | ConvertFrom-Json).version }
        elseif ($changelog.PSObject.Properties.Name -contains 'version') { $changelog.version }
        else { '0.0.0' }

    # A tag only makes a release revertible if the shipped code is already committed.
    $dirty = git status --porcelain
    if ($dirty -and -not $AllowDirty) {
        Write-Host ($dirty | Out-String) -ForegroundColor Yellow
        throw "Uncommitted changes present. Commit your work first, then run this script."
    }

    $effectiveBump = if ($Bump) { $Bump } else { $changelog.nextBump }
    if (-not $effectiveBump) { $effectiveBump = 'minor' }

    if ($effectiveBump -eq 'none') {
        Write-Host "nextBump is 'none'; nothing to release at v$currentVersion." -ForegroundColor DarkGray
        $newVersion = $currentVersion
    }
    else {
        Write-Step "Releasing"
        $releaseNotes = @($changelog.pending)
        if ($releaseNotes.Count -eq 0) {
            Write-Host "changelog.json 'pending' is empty; recording a placeholder." -ForegroundColor Yellow
            $releaseNotes = @("No changelog entries recorded for this release.")
        }

        $newVersion = Step-Version -Current $currentVersion -Part $effectiveBump
        Write-Host "v$currentVersion -> v$newVersion ($effectiveBump)" -ForegroundColor Green

        $tracked = @($changelogPath)
        if ($usePackageJson) {
            npm version $newVersion --no-git-tag-version --allow-same-version | Out-Null
            Assert-LastExitCode "npm version"
            $tracked += $packagePath
            $lock = Join-Path $PSScriptRoot 'package-lock.json'
            if (Test-Path $lock) { $tracked += $lock }
        }
        else {
            $changelog | Add-Member -NotePropertyName version -NotePropertyValue $newVersion -Force
        }

        $entry = [ordered]@{
            date    = (Get-Date -Format 'yyyy-MM-dd')
            type    = $effectiveBump
            changes = $releaseNotes
        }
        $releases = [ordered]@{ $newVersion = $entry }
        foreach ($property in $changelog.releases.PSObject.Properties) {
            $releases[$property.Name] = $property.Value
        }
        $changelog.releases = [pscustomobject]$releases
        $changelog.pending = @()
        $changelog | ConvertTo-Json -Depth 8 | Set-Content $changelogPath -Encoding UTF8

        $commitArgs = @('commit', '-m', "feat: bump version to $newVersion")
        $commitArgs += '-m'
        $commitArgs += (($releaseNotes | ForEach-Object { "- $_" }) -join "`n")

        git add $tracked
        Assert-LastExitCode "git add"
        git @commitArgs | Out-Null
        Assert-LastExitCode "git commit"
        git tag -a "v$newVersion" -m "Release v$newVersion" | Out-Null
        Assert-LastExitCode "git tag"

        Write-Host "Committed and tagged v$newVersion" -ForegroundColor Green
    }

    foreach ($command in $Run) {
        Write-Step $command
        Invoke-Expression $command
        Assert-LastExitCode $command
    }

    Write-Host ""
    Write-Host "Version: v$newVersion" -ForegroundColor Green
    Write-Host "Revert:  git checkout v$newVersion" -ForegroundColor DarkGray
}
catch {
    Write-Host ""
    Write-Host "Release aborted: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
