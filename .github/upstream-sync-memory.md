# Upstream Sync — Decision Memory

Persistent notes from prior `outsourc-e/hermes-workspace` syncs into the
**Vorbium Workspace frontend** fork. Each section: date + upstream HEAD
short + decisions. Appended at the END of each successful auto-sync.

---

## 2026-04-19 — baseline (manual fusion + automation setup)

Initial automation. Prior fusion state: branch
`fusion/upstream-sync-2026-04-19` HEAD `dc016b6`. Merged 8 upstream
commits since prior sync (a7c1501, 77c429e, 11b8b69, d9d6cae, 086ce41,
21eda0e, 86989c9, ad014cf), then cherry-picked `086ce41` adapted for
dual-home reading.

**Decisions encoded in current state:**
- Conflict resolution: 3 conflicted files resolved manually:
  - `src/routes/api/models.ts`: kept ours (Vorbium auth-store +
    multi-provider proxy), then cherry-picked `086ce41` adapted to read
    `~/.vorbium/models.json` first with `~/.hermes/` fallback.
    `getAuthStoreModels()` kept as additional discovery layer.
  - `src/screens/chat/components/chat-composer.tsx`: kept ours
    (~150-line Vorbium provider proxy with Nous Portal always-show,
    multi-provider parallel fetch, local-providers merge). Upstream's
    simplification to single `/api/models` discarded.
  - `src/server/profiles-browser.ts`: combined — `getVorbiumRoot()`
    preserved from ours, adopted upstream's "always insert default
    profile, flag active when active" logic (fix `77c429e`).
- Brand audit clean post-merge: no Hermes UI strings outside allowed
  contracts (HERMES_* env vars, NousResearch refs, `/api/hermes-proxy`
  backend route name kept).

**Repo structure:**
- `origin` = `NicholasJacob1990/hermes-workspace` (push here — this fork
  is dedicated to Vorbium since the migration of personal Hermes to
  `hermes-workspace-personal`)
- `upstream` = `outsourc-e/hermes-workspace` (sync FROM here)

**Sister Hermes pessoal fork:**
`NicholasJacob1990/hermes-workspace-personal` — same upstream source
but without Vorbium rebrand. Reads `~/.hermes/` paths.

**Pending tasks (NOT covered by this workflow):**
- TypeScript type-check post-merge — manual verification needed since
  workspace doesn't have a CI lint workflow yet.

**No prior auto-sync runs yet — first cron will populate this file.**
