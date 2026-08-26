# Release & Versioning Rule

How versions are bumped, changelogged, committed and tagged — and how to set the same
thing up in another repo on another machine.

## The goal

Every deploy must be **revertible**. That means three things have to stay in sync:

1. The version number in the app.
2. A git tag pointing at the exact commit that produced it.
3. A human-readable list of what changed in that version.

If any one of those drifts, "roll back to the version before this broke" stops working.

## The rule

- **Every release bumps `minor` or `major`.** Patch is not used.
  - `minor` — features, UI changes, fixes
  - `major` — breaking changes, redesigns
- **The bump type lives in a file, not in a command flag.** You run one command with no
  arguments; the file decides what happens.
- **The script never commits your work.** It refuses to run on a dirty tree. The only
  commit it makes contains the version and changelog files.
- **The release commit is formatted as:**

  ```
  feat: bump version to 2.4.0

  - First changelog entry
  - Second changelog entry
  ```

## Your workflow

```
1. While working, add notes to "pending" in changelog.json
   and set "nextBump" to minor or major.

2. Commit your own work.
       git add -A
       git commit -m "feat: whatever you did"

3. Release.
       .\release.ps1

4. Revert at any time.
       git checkout v2.3.0
```

## The four pieces

### 1. `changelog.json` — the control file

This is both the config and the history. It lives in the repo root.

```json
{
  "nextBump": "minor",
  "pending": [
    "Something you changed",
    "Something else you changed"
  ],
  "releases": {
    "2.3.0": {
      "date": "2026-08-26",
      "type": "minor",
      "changes": ["Older release notes"]
    }
  }
}
```

| Field | Purpose |
| --- | --- |
| `nextBump` | `major`, `minor`, `patch` or `none`. Drives the next release. Reset to `minor` after each release if you want that as the default. |
| `pending` | Notes you write as you work. Moved into `releases` on release, then emptied. |
| `releases` | Newest first. Each entry has `date`, `type`, `changes`. |

### 2. `release.ps1` — the script

Copy this file into any repo root. That is the entire install.

```powershell
.\release.ps1                                         # bump per changelog.nextBump
.\release.ps1 -Bump major                             # one-off override
.\release.ps1 -Run 'npm run build','firebase deploy'  # optional post-release commands
.\release.ps1 -AllowDirty                             # escape hatch, see warnings below
```

What it does, in order:

1. Verifies it is inside a git repo.
2. Creates `changelog.json` if missing.
3. Reads the current version from `package.json`, or from `changelog.json` for non-Node repos.
4. **Refuses to continue if `git status --porcelain` is non-empty.**
5. Computes the next version numerically.
6. Moves `pending` into `releases[newVersion]` with today's date, then empties `pending`.
7. Stages only the version/changelog files, commits with the format above, tags `vX.Y.Z`.
8. Runs anything passed via `-Run`.

### 3. Version visible in the app (recommended)

A tag is only useful if you can tell which version is running. Inject the version and
commit hash at build time and show them in a footer.

For a Vite project, in `vite.config.ts`:

```ts
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

function git(command: string): string {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const commit = git("git rev-parse --short HEAD") || "unknown";
const buildRef = git("git status --porcelain") ? `${commit}+dirty` : commit;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_COMMIT__: JSON.stringify(buildRef),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString())
  }
});
```

Declare them in a `.d.ts`:

```ts
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
declare const __BUILD_DATE__: string;
```

Render on **every** screen, including loading and login states:

```
v2.4.0 · a1b2c3d · 2026-08-26
```

**The `+dirty` suffix is the important part.** If the live site shows
`a1b2c3d+dirty`, someone deployed uncommitted code and that build **cannot be
reproduced from git**. Treat it as a red flag.

### 4. The dirty-tree gate

This is the rule that makes the rest trustworthy:

```powershell
$dirty = git status --porcelain
if ($dirty -and -not $AllowDirty) {
    throw "Uncommitted changes present. Commit your work first."
}
```

A tag only makes a release revertible if the shipped code is committed. Tagging a dirty
tree produces a version that does not match what actually shipped.

## Porting to another repo

1. Copy `release.ps1` into the repo root.
2. Run `.\release.ps1` once — it creates `changelog.json` for you.
3. Optional: add the build-time version injection from section 3.
4. Optional: wire your build and deploy into `-Run`, or call them yourself afterwards.

What is project-agnostic (works anywhere unchanged):

- Version stepping
- Changelog rotation
- Commit format
- Tagging
- Dirty-tree gate

What differs per project:

- Where the version lives (`package.json` vs `changelog.json`)
- Build and deploy commands

### Non-Node repos

`release.ps1` uses `npm version` only when `package.json` exists. Otherwise it stores the
version inside `changelog.json` as a top-level `version` field. Nothing else changes, so
the same script works for Python, Go, or static sites.

## Gotchas worth knowing

These were all real bugs hit while building this.

**Increment versions numerically, not as strings.**
`"2.1." + (9 + 1)` gives `2.1.10` only if you parse the parts as integers first.
Naive string handling produces `2.1.91`.

**Capture the changelog notes before clearing them.**
The commit body comes from `pending`, but the changelog update empties `pending`. Read it
into a variable first or the body silently ends up blank:

```powershell
$releaseNotes = @($changelog.pending)   # BEFORE the changelog is rewritten
```

**Build a multi-paragraph commit with two `-m` flags.**
Git treats the first as the subject and the second as the body, inserting the blank line:

```powershell
git commit -m "feat: bump version to $v" -m ($notes -join "`n")
```

**Ignore deploy caches.**
Tools like Firebase rewrite cache files on every deploy (`.firebase/hosting.*.cache`). If
those are tracked, the tree is permanently dirty and the gate blocks you forever. Add them
to `.gitignore` and `git rm --cached` them once.

**Verify the deploy actually published.**
If your host has an SPA rewrite (`** -> /index.html`), a missing asset returns `200` with
HTML instead of a `404`. A stale deploy then looks fine. Check the `Content-Type` of a
freshly built asset, not the status code.

## Reverting

```powershell
git checkout v2.3.0      # the version you want back
.\release.ps1 -Bump none # rebuild and redeploy without creating a new version
```

Or, with the deploy wrapper:

```powershell
git checkout v2.3.0
.\deploy.ps1
```
