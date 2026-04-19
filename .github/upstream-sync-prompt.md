# Upstream Sync — Conflict Resolution Prompt

You are resolving a `git merge upstream/main` on the **Vorbium Workspace
frontend** fork (`NicholasJacob1990/hermes-workspace`). Upstream is
`outsourc-e/hermes-workspace`.

This repo applies a **Vorbium rebrand** on top of the workspace UI: brand
strings say "Vorbium", UI assets are vorbium-* (avatar, logo), backend
proxy points at `/api/vorbium-proxy/*` (was hermes-proxy), and paths
default to `~/.vorbium/` (with `~/.hermes/` fallback for migration).

## Your role

Conflicts are unstaged in the working tree. Your job:

1. Read `.github/upstream-sync-memory.md` for prior decisions.
2. Inspect each conflict via `git diff --name-only --diff-filter=U`.
3. Resolve per the rules below. Stage with `git add`.
4. Commit, append memory, exit.

## Hard limits — DO NOT proceed if exceeded

- More than 30 conflicted files
- More than 500 changed lines in a single file
- A conflict in a file you cannot classify per the rules below

If exceeded: leave markers, write `.github/last-sync-triage.md`, exit.

## Resolution rules (Vorbium Workspace context)

### Rule 1: pure cosmetic conflict → accept upstream
Whitespace, prettier reformat, quote style — accept upstream
(`git checkout --theirs`).

### Rule 2: upstream refactor with no Vorbium customization → accept upstream
HEAD has stock UI code, upstream extracts component or refactors hook →
accept upstream.

### Rule 3: HEAD has Vorbium-specific layer → keep ours, integrate
**Vorbium-specific layers to preserve:**
- **Brand assets**: `public/vorbium-*` files, `<title>Vorbium Engine</title>`,
  avatar references (`vorbium-avatar.webp`)
- **Voice integration WIP**: `src/lib/pipecat-voice.ts`,
  `src/lib/voice-settings-options.ts`, voice settings dialog tests,
  `src/server/vorbium-legacy.test.ts`
- **API proxy paths**: `/api/vorbium-proxy/*` (do NOT revert to
  `/api/hermes-proxy/*`)
- **Route handlers** with Vorbium discovery: `src/routes/api/models.ts`
  has hybrid (curated `~/.vorbium/models.json` + auth-store discovery
  + local providers); `src/routes/api/start-vorbium.ts`
- **Server helpers**: `getVorbiumRoot()` in `profiles-browser.ts` (NOT
  `getHermesRoot()`), `~/.vorbium/` paths everywhere with `.hermes` fallback
- **Settings UI**: `src/routes/settings/`, `settings-dialog.tsx`,
  `hermes-config.ts` — preserve Vorbium-specific options
- **Provider catalog**: `src/server/hermes-provider-catalog.{ts,test.ts}`
  has personal additions

For files where Vorbium has customization, prefer ours and integrate
upstream changes via Edit (not blanket --theirs).

### Rule 4: feature removed in upstream → accept removal, document
PR refs, deprecation notes — accept removal. Note in memory if a Vorbium
feature depended on the removed surface.

### Rule 5: signature change → adopt new, update callers
Component prop signatures or hook signatures changed → adopt new
signature, grep for callers in `src/`, update each.

### Rule 6: structural file (package.json, tsconfig, vite.config) → manual merge
Combine: Vorbium extras (voice deps, vorbium scripts) + upstream
additions (new packages, version bumps). Keep `name` field as-is
(do not rebrand). Preserve any Vorbium-specific build config.

### Rule 7: tests
- Upstream test additions → accept upstream
- Tests we added for Vorbium features (`*.voice.test.ts`,
  `vorbium-legacy.test.ts`, `hermes-provider-catalog.test.ts`,
  `*.vorbium.test.ts`) → keep ours
- Tests upstream removed → accept removal

### Rule 8: don't undo cherry-picks
Prior fusion already cherry-picked upstream `086ce41` (model picker
reads `models.json`) into `src/routes/api/models.ts` with adaptation
(dual `~/.vorbium/` + `~/.hermes/` reading). If upstream brings further
changes to that file, integrate them around the existing dual-home
reading — do NOT collapse back to single-home.

## After resolving

1. Sanity: no markers, `git diff --check` empty
2. `git add -A`
3. Commit (template below)
4. Append memory entry

### Commit template
```
fusion: merge upstream outsourc-e/hermes-workspace (<N> commits, <date>)

Auto-resolved by GitHub Actions + Claude.

Conflicts (<count>):
- <file>: <rule applied> — <decision>

Notes:
- <pattern observed>
```

### Memory append
```
## <date> — sync from <upstream HEAD short>

Decisions:
- <file>: <rule + rationale>

New rules learned:
- <if any>
```

## Tools available

`Read`, `Edit`, `Write`, `Grep`, `Glob`, `Bash(git:*)`. No installs, no
CI edits.
