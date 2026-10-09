# FREEBUFF-FARM-LANE-DEPLOY-1 — FreeBuff desktop-orchestrator lane on the five farm laptops (2026-10-09, Tim-directed: "straight to the 5 laptops")

## What this row is
Extend the Omen's FreeBuff desktop lane (FREEBUFF-LANE-RUNBOOK.md, guarded by
`FreeBuff/dispatcher/freebuff-dispatch.mjs`) to hp, ps(prostar), nitro, aspire, msi.
Safety design verified 2026-10-09 (see FREEBUFF-FARM-PROGRAM.md §5.5): five guard legs in
source (HALT-first, 20-min quiescence, clone-cleanliness, estate-canonicalizer hash
re-verification, cap 6/day, ONE fixed pointer prompt), orchestrator binds 127.0.0.1 only,
per-machine accounts, tasks are pre-authored public-repo work only. Do NOT weaken any guard;
do NOT compose prompts; do NOT raise the cap.

## Facts established 2026-10-09 (verified, cite these)
- CLI headless: dead in ALL versions (monorepo cli-args.ts); @codebuff/sdk = PAID API key
  (HALT 2026-09-10T18:23Z "SDK run returned error: Payment Required" — the SDK-REBUILD-SPEC
  path is dead, do not resume it).
- Desktop app NOT installed on any of the five (`Test-Path ...\Programs\@codebufffreebuff-desktop\FreeBuff.exe`
  = False x5 via SSH 10-09); CLI credentials.json survive on all five.
- Interactive console session at probe time: hp Active, msi Active; prostar/nitro/aspire
  headless (quser empty) — GUI launch there needs an interactive session; the app can be
  installed anyway and launched at next logon (Task Scheduler ONLOGON trigger).
- CSRF launch-token guard (x-freebuff-launch-id) has a SUPPORTED env path in the current
  orchestrator.js: `ENV_LAUNCH_ID = process.env.FREEBUFF_LAUNCH_ID?.trim() || null`.
  Launch the app with FREEBUFF_LAUNCH_ID=<random> in its environment; the dispatcher then
  sends the same value as the header. This is the app's own configuration surface — never
  scrape or spoof an in-memory token.
- Orchestrator port is EPHEMERAL (listen(0, 127.0.0.1)); the dispatcher's liveApi() already
  reads the announced port from %APPDATA%\freebuff\logs (last `listening on http://127.0.0.1:<p>` wins).
- Installer: https://freebuff.com/api/desktop/download/windows (Electron NSIS; silent = /S;
  per-user target %LOCALAPPDATA%\Programs\@codebufffreebuff-desktop).
- Work folder per laptop: clone the private repo PostOakLabs/ainumbers-freebuff
  (00-README.md ground rules + tasks 01..nn; repos/ gitignored). Laptops' gh is authed
  (farm workers push with it).

## Per-machine procedure (repeat x5; hp first as pilot)
1. SSH install: download the installer to %TEMP%, run `freebuff-setup.exe /S`, wait for
   `%LOCALAPPDATA%\Programs\@codebufffreebuff-desktop\FreeBuff.exe` to exist.
2. Clone the work folder: `gh repo clone PostOakLabs/ainumbers-freebuff C:\dev\Claude\Projects\FreeBuff`
   (per-machine clone; repos/ dir is created by tasks, stays gitignored).
3. Dispatcher: copy `freebuff-dispatch.mjs` VERBATIM (no edits — port discovery, guards,
   fixed PROMPT all travel as-is), fix only the two machine-local constants (FB path is
   identical; the log path and INBOX path are per-machine). Create dispatcher/state.json
   fresh `{date:"",count:0,threadId:null,lastVerifiedVectorCount:0}`. Do NOT copy HALT,
   the .bak HALTs, SDK-REBUILD-SPEC, or the sdk variant script.
4. Launch: Task Scheduler ONLOGON task that starts the desktop app with
   FREEBUFF_LAUNCH_ID=<32-hex> in its environment (schedule a small cmd that `set` + start,
   or a scheduled-task .env wrapper), then starts the dispatcher every 30 min.
   On hp/msi (active session) start the app immediately for setup.
5. FIRST LOGIN IS A HUMAN STEP: the desktop app OAuth (per-machine account, §3 of
   FREEBUFF-FARM-PROGRAM — login URL completes from ANY browser, ~10-min code TTL). Fetch
   `GET /api/auth/status` after first launch; when it reports unauthenticated, surface the
   login URL to Tim (5 URLs, one per machine, Tim's per-machine accounts) — then re-check
   authed.
6. Acceptance per machine: auth status authed; one guarded dispatcher cycle runs (dry:
   HALT file absent, quiescence respected); clone cleanliness check passes; the machine
   shows in dispatch.log as quiet-exit or DISPATCHED with count 1/6 — never a bare dispatch
   without the guard legs having run.

## Never (inherits the runbook + program doc)
Never raise CAP_PER_DAY; never compose a prompt; never mention dispatcher/ in anything the
agent can read; never intake FreeBuff output without the estate hash recompute; never share
one account across machines; never un-HALT without independently verifying the halt cause.

## Residual human steps after automation
- 5 desktop OAuth clicks (once per machine, Tim's per-machine accounts).
- prostar/nitro/aspire need an interactive logon session for the GUI app to run (install
  now, launch at next Tim logon; or Tim leaves them logged in as the farm already assumes
  for CLI lanes).

## Deployment log 2026-10-09 (what actually happened — proven mechanics)
- All five: desktop app installed (silent /S), work folder seeded (file copy — laptops'
  gh/git have NO working auth over SSH; plain `git clone` fails: GCM prompt script cannot
  run headless. Rule 2 says agents never git in this folder anyway; operator-side sync of
  the work folder = tar-over-ssh from the Omen, EXCLUDING .git/dispatcher/repos/out).
- Standalone orchestrator (app's bundled bun, NO GUI needed) on 127.0.0.1:55469 via
  scheduled task `freebuff-orch` (ONLOGON) running dispatcher\orch-start.cmd:
  FREEBUFF_LAUNCH_ID=<per-machine 32-hex, file: dispatcher\launch-id> + PORT=55469 +
  FREEBUFF_DESKTOP_STATE_PATH=C:\dev\Claude\Projects\FreeBuff\orch-state (own profile, GUI
  coexists) + **bun stdin MUST hit EOF (`< NUL`)** — the orchestrator reads its bootstrap
  (launchId + shell token) as ONE LINE FROM STDIN; stdin open = handshake hang = every
  request 401 "invalid launch id". With EOF, bootstrap=null and ENV_LAUNCH_ID (ours) wins.
  Verified /healthz {ok, launchId, pid, port} x5.
- hp: the FreeBuff GUI (from a test launch) auto-respawns its own orchestrator and
  superseded ours — GUI closed, its `freebuff-app-launch` task DELETED (hp only; the other
  four never had it). A stuck prior task-cmd instance blocks new runs of the same task
  (0x800710E0): kill the orphaned cmd before schtasks /Run.
- Dispatcher: farm variant `freebuff-dispatch-farm.mjs` (canonical Omen file untouched).
  Changes, all mechanical: (1) x-freebuff-launch-id header on ALL /api/ calls (the CSRF
  middleware covers GETs too), value read from dispatcher\launch-id; (2) API pinned to
  127.0.0.1:55469 — the APPDATA stderr log carries stale GUI-era announcements, log-based
  port discovery LIES, fail safe as unreachable→quiet-exit instead; (3) INBOX → machine-local
  dispatcher\ESCALATION.md (no AINumbers workspace on laptops); (4) dispatcher\repos\ and
  out\01\vectors\ must EXIST (readdirSync ENOENT crashes the clone-clean leg). Guard legs
  byte-identical otherwise. Tick: `freebuff-dispatch` every 30 min via run-dispatch.cmd.
- hp LIVE: authed (ainumbersgen@gmail.com, its own account), first guarded cycle 17:16Z ran
  HALT→auth→in-flight→quiescence and correctly deferred ("workspace active 0m ago"); the
  30-min tick takes it from here.
- ps/nitro/aspire/msi: fully deployed but **HALTed on purpose** — HALT reason "task partition
  pending". Auth for those machines was verified only by Tim's click, not polled (staggering
  concern: avoid synchronized account activity). Un-halt ONE machine at a time after the
  five-way task partition is decided; the dispatcher's own auth check fail-safes each first
  cycle anyway.
