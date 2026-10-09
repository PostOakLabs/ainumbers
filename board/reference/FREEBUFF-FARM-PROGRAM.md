# FREEBUFF FARM PROGRAM — freebuff CLI on the estate (memorialized 2026-10-05, Tim-directed)

Status: OPERATIONAL, STANDALONE. freebuff CLI 0.2.16 installed and logged in on all five farm
laptops (hp, ps/prostar, nitro, aspire, msi) plus the Omen. NOT a farm lane: nothing in
`scripts/farm-worker-template.ps1`, no bus-repo wiring, no worker changes — freebuff is a
manually-invoked terminal agent on each machine. Any future row that promotes it into a lane
starts from §5, not from scratch.

## 1. What freebuff is

Free AI coding agent (npm package `freebuff`), a rebrand of Codebuff (CodebuffAI — the launcher
still speaks codebuff.com and the engine is at `codebuff.com` release origins; both
codebuff.com and freebuff.com are the allowed download hosts). Funded by text ads, no paid tier
needed. Current free-plan model: **Solar 4** (2026-10-05; Tim: "it's been good" — DECENT MODEL,
EXPLICITLY FLAGGED as a candidate if a future lane ever wants it, e.g. as a hermes/opencode-style
rotation entry through whatever harness can drive it; re-check the free-plan menu at that time —
the free set churns, cf. the Nous free-period death of 2026-09-20 and the opencode catalog
drift of 2026-10-05).

## 2. Install facts (identical pattern per machine)

- `npm install -g freebuff@latest` — additive only; landed 0.2.16 everywhere ("added 7 packages").
- The npm package is a thin launcher (~3.7 MB); on first `freebuff` invocation it downloads a
  ~46 MB platform engine (`freebuff.exe`) into `<home>\.config\manicode\` — that download ALREADY
  WORKED from every farm laptop with no hosts-file workaround, unlike the workbuddy lane
  (www.codebuddy.ai is fleet-DNS-blackholed; codebuff.com/freebuff.com are not).
- npm global prefix differs by machine (hp/ps: `%APPDATA%\npm`; nitro/aspire: hermes-managed
  node at `%LOCALAPPDATA%\hermes\node`; msi: same under `C:\Users\admin`) — the machine's own
  prefix, already on PATH. Never assume one shared path.
- Engine state dir per machine: `<home>\.config\manicode\` (analytics-id.json, settings.json,
  credentials.json, freebuff.exe, projects\). The Omen also has a Freebuff desktop app
  (`%APPDATA%\freebuff`, `~/.config/freebuff-desktop`) — separate surface, untouched by the CLI.

## 3. Auth mechanics (the two lessons that cost us a round-trip)

- On successful browser login the engine writes **`<home>\.config\manicode\credentials.json`**
  (~340 bytes). It is NOT `auth.json` — grepping the binary for "auth.json" misleads; verify
  logins by `credentials.json` mtime, never by log text.
- `freebuff login` prints `https://freebuff.com/login?auth_code=<TOKEN>`, then polls and **times
  out after ~10 minutes** ("Login timed out. Please try again."). The URL must be clicked while
  the minting process is still alive — clicking an expired code silently does nothing on the
  laptop side. Login completes from ANY browser (no laptop-side browser needed); each machine
  signs in with ITS OWN gmail/github account (per-machine separation, workbuddy precedent —
  never share one account across machines).
- The CLI is a stdin-waiting process: over SSH, a child started via PowerShell `Start-Process`
  DIES when the ssh session disconnects. The reliable detachment pattern is a one-shot scheduled
  task: `schtasks /Create /TN freebuff-login /TR "cmd /c <freebuff.cmd> login > <log> 2>&1" /SC
  ONCE /ST 23:59 /F` then `schtasks /Run /TN freebuff-login`; read the log ~20 s later for the
  auth_code. Cleanup after login: `schtasks /Delete /TN freebuff-login /F` + delete the log
  (done 2026-10-05 on all five; verified).
- Rollback / reinstall: `npm install -g freebuff@0.2.16` (or any pinned version); login state
  lives in `.config\manicode` and survives package reinstalls. Omen also keeps
  `state.json.pre-cli-update-2026-10-05` from its 0.0.167→0.2.16 update (paranoia backup, state
  was byte-identical after).

## 4. SSH reference for the estate lanes

Aliases (`~/.ssh/config` on the Omen): `nitro`, `prostar` (= ps), `hp`, `aspire`, `msi`;
`BatchMode=yes -o ConnectTimeout=8`; stderr carries a harmless "post-quantum key exchange"
warning. Full program: `board/reference/SSH-FLEET-PROGRAM.md`. Beware: `ps` is NOT an alias
(only `prostar`); `ssh ps` fails with "Could not resolve hostname".

## 5. Open items / future-row hooks

1. **Solar 4 as a lane model**: flagged by Tim 2026-10-05 as decent. If a lane wants it, first
   establish the harness (freebuff has no documented headless/`-p` scripting surface in 0.2.16 —
   `--print` exists in the engine strings but the CLI wrapper rejects it; probe the engine's
   argv before promising a lane), then a normal rotation row (probe READY on every machine,
   golden re-pin, sha-prechecked PUTs — the 2026-10-05 FARM-WATCH-FLEET-SWEEP-1 pattern).
2. **Catalog/plan drift**: the opencode catalog churned within three weeks of its last sweep
   (only 2 of 7 patterns still resolved on nitro). Any lane adoption of freebuff should reuse
   the same sweep-and-probe discipline; free-plan model menus churn as fast.
3. **Version pin**: freebuff 0.2.16 everywhere as of 2026-10-05. The workbuddy lesson applies:
   an npm update that changes the credential storage format can silently break logins —
   re-verify `credentials.json` still validates after any freebuff update.
4. **CLI-surface re-probe on every version bump (added 2026-10-07)**: 0.2.16 and 0.2.22 both
   reject `--print`/`--yes`, and piped stdin just starts the fullscreen TUI (opentui on a
   non-TTY — the Task-Scheduler hang class); the `--print/--json/--quiet/--headless` strings
   inside the engine binary are embedded third-party tooling (bun flags, ripgrep flags,
   agent prompts), not wired CLI flags — upstream codebuff's scripting surface is the
   `@codebuff/sdk`, so a freebuff lane exists only when the rebrand ships a real one-shot
   mode or that SDK. Re-probe `freebuff --help` (grep for a print/one-shot flag) beside the
   §5.3 credentials check after any upgrade. AND: the launcher engine-updates the SHARED
   `~/.config/manicode` dir on ANY invocation, and an older wrapper accepts the newer
   engine (measured on the Omen 2026-10-07: a sandbox-invoked 0.2.22 launcher bumped the
   shared engine 0.2.16 → 0.2.22; credentials survived) — add a pure-file
   version-consistency read (package.json vs freebuff-metadata.json, never a launcher
   call) to the bump checklist, and never invoke a freebuff launcher casually on a pinned
   machine. Full mechanics: `KILO-FARM-PROGRAM.md` §5 (same day).
5. **2026-10-09 re-probe at 0.2.26 + Tim's lane directive (probe-first SOP)**: Tim directed
   "add freebuff cli to the rotation, but the SOP must first probe what the free model is —
   sometimes Solar 4, sometimes DeepSeek, sometimes something else." Wrapper updated 0.2.22 →
   0.2.26 and re-probed on the Omen (the one machine where a bump is allowed): `--help` is
   UNCHANGED in kind — `login` is still the only subcommand, no `-p`/`--print`/one-shot flag —
   so §5.4's verdict HOLDS at 0.2.26 and the CLI still CANNOT be a worker lane (every
   invocation is the fullscreen TUI = the Task-Scheduler hang class). New 10-09 lesson: on the
   0.2.26 wrapper even `freebuff -v` boots the engine download ("Starting Freebuff...") and
   bumped the shared Omen engine 0.2.22 → 0.2.26 (metadata read confirms; no lingering
   process; Omen CLI has no credentials.json — the desktop app is the logged-in surface
   there). Omen is the ONLY machine touched on 10-09; hp/ps/nitro/aspire/msi remain pinned,
   untouched. **THE LANE ROW, WHEN IT FIRES** (blocked on upstream shipping a one-shot mode or
   the SDK — re-probe `freebuff --help` on each version bump): the lane MUST be probe-first
   about the MODEL, because the free-plan pick churns (Tim: Solar 4 / DeepSeek / other).
   Probe order for "what is the current free model":
   (a) pure-file engine read — `grep -aoiE '"(solar|deepseek|glm|kimi|minimax)[a-z0-9. _-]{0,30}"'
   on `~/.config/manicode/freebuff.exe`; verified 10-09 the 0.2.26 engine embeds the menu:
   DeepSeek V4 Pro / V4.1 Flash / V4.1 Flash Fast, Solar Mini 4, Solar Pro 4, GLM 5.2,
   GLM 5.3 Flash, Kimi K3, MiniMax M3 (candidate set, not the active pick);
   (b) live source — the desktop orchestrator when the app is open
   (`GET http://127.0.0.1:55469/api/...`, routes re-derived per the lane runbook; probed
   10-09: unreachable, app closed — quiet exit, expected);
   (c) NEVER a hardcoded id in RotateModelsLiteral — the row resolves the model at
   lane-design/pool-refresh time from (a)+(b) and date-stamps the finding, exactly the
   catalog-churn discipline of §5.2. First harness question remains §5.1's: establish the
   headless argv BEFORE promising the lane. SCOPE (Tim 2026-10-09): the Omen is a TEST BENCH
   only, not part of the routine farm — the lane row, when it fires, targets the five farm
   laptops (hp, ps, nitro, aspire, msi) alone; the Omen is where wrapper bumps and surface
   re-probes happen first precisely because nothing routine runs there.

## 6. Channel provenance

ORCH-TO-7F.md 2026-10-05: FARM-WATCH nitro LANE-DEGRADED (14:20Z) → nitro rotation repair note
(15:0xZ) → fleet sweep note (15:40Z) → FREEBUFF-CLI-FARM-1 install note → completion note
(18:08Z). Workspace commits: 9ce961990 (FARM-WATCH-NITRO-ROTATE-1), c863297a2
(FARM-WATCH-FLEET-SWEEP-1), this memorial.
