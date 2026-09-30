# MCP-LITE-PROFILE MEMORIAL — 2026-09-30 (Tim-directed session; proxy + config swap + worker PR #430 + token triage)

**Maintainer:** Post Oak Labs · **Authority:** Tim by chat to the ORCH-tick session (2026-09-30 ~01:30–17:40Z) · **Status:** PR open, NOT merged · **PR:** https://github.com/PostOakLabs/ainumbers-mcp-apps/pull/430

This memorial is the single reference for three coupled workstreams from one session. Read it before touching: the ZCode MCP config, `scripts/ainumbers-lite-proxy*`, the automation cadences, `data/mcp/static/tools-list-lite.sse.txt`, or before merging PR #430.

## 1. Token-budget triage (why several cadences changed)

Weekly plan burned 19% in ~12h post-reset. Measured cause: ~45 automation launches/12h across 20 registered automations + a continuously-looping ORCH seat + 16 builders; the "documents everywhere" hypothesis was mostly wrong (files on disk cost nothing) except one case. Changed (all Tim-approved via popups unless noted):

- `live-smoke` hourly-title/every-2h → **every 6h at :15** (CronUpdate; SSOT header updated).
- `glm-verifier-seat` every 2h → **every 4h at :10** (SSOT header updated).
- `farm-watch` every 2h → **every 4h at :20** (SSOT header updated).
- `Shadow Kickoff` cadence KEPT 2h; `board/reference/SHADOW-SESSION-KICKOFF-3.md` §3 log archived: 298 pre-09-26 entries → `SHADOW-SESSION-KICKOFF-3-ARCHIVE.md` (byte-verified zero loss; main 378KB → 87KB; boot read ~90K → ~22K tokens). Appends continue at EOF as before.
- `farm-orch` every 2h → **every 6h at :32** — **judgment call, Tim's popup went unanswered**; title records this; one CronUpdate reverts.
- **NOT triaged (deliberately):** `orch-autoboot` (hourly; Tim: skip for now), `7f-seat` (12h), the 7 dailies, 6 weeklies.

Incident of record: the first CronUpdate hit farm-watch's id instead of live-smoke's (misread ids); caught from the echoed runCount, farm-watch restored byte-identical, live-smoke then changed correctly. Verify ids against the echoed `prompt`/runCount on every CronUpdate.

## 2. Local lite proxy + ZCode config swap (done, live, validated)

- `scripts/ainumbers-lite-proxy.mjs` — stdio MCP server exposing ONLY find_tool/describe_tool/call_tool/list_ainumbers_tools (~466-token payload vs ~100-150K for the full 722-tool catalog), relaying everything else by name to `https://mcp.ainumbers.co/mcp`. Tests: `scripts/ainumbers-lite-proxy.test.mjs` (11 live checks) + `scripts/ainumbers-lite-proxy.mocktest.mjs` (9 mock checks: session forwarding, 404→re-init→retry, no-session servers, remote-down resilience). All green.
- **Both** ZCode scopes swapped to the proxy 2026-09-30: `C:/Users/Disco/.zcode/cli/config.json` AND `<root>/.zcode/config.json` → `{"type":"stdio","command":"C:/Program Files/nodejs/node.exe","args":[".../ainumbers-lite-proxy.mjs"]}`. Shape verified against ZCode's own bundle zod schema. Pre-swap backups: `config.json.bak-20260930` beside each file. Claude-format files (`.claude/settings.local.json`, `~/.claude.json`) were never MCP registrations — do not "fix" them.
- Overnight validation: 22/22 MCP connects OK, zero MCP-attributable errors; a 7f-seat session logged `registeredToolCount: 6` (was ~722). ~2-3M tokens/day saved at then-current launch rates.
- **Restore full catalog (any scope, one line):** `{"type":"remote","url":"https://mcp.ainumbers.co/mcp"}`. Full instructions: `board/automations/AINUMBERS-MCP-LITE-SETUP.md`.
- **Tim ruling:** leave the catalog-in-every-session problem SOLVED but do not market anything (see §4). A future session must NOT re-add the full catalog "to be safe" without reading this memorial.
- Retirement path: once PR #430 merges and smokes, the estate can point the config entry at `https://mcp.ainumbers.co/mcp?profile=lite` and retire the local proxy (keep the tests; they document the transport).

## 3. PR #430 — server-side `?profile=lite` (OPEN; merge = deploy)

`PostOakLabs/ainumbers-mcp-apps` PR #430, branch `MCP-LITE-PROFILE-1`, base `master` (repo head 98e2053 v0.4.12). `?profile=lite` on the SAME `/mcp` endpoint serves `data/mcp/static/tools-list-lite.sse.txt` — a GENERATED 4-tool discovery template (find_tool, describe_tool, call_tool, list_ainumbers_tools; 5,591B vs 1,875,668B full = 335×), filtered from the same captured registration array by `scripts/precompute-discovery.mjs` (nothing hand-typed; interpolated counts ride along per A5.3).

- Execution is NOT scoped: `tools/call` untouched; call_tool relays by name behind its fail-closed read-only allowlist. Fail-soft: missing/broken/SPA-garbage lite asset → falls back to the FULL template (prefix-verified; availability choice, not approval boundary). Memo keys profile-aware (`tools\0lite`) in getStaticListTemplate AND the buildListPage index — lite/full pagination state cannot collide.
- Gates: `check-worker-invariants` (f) asserts lite file exists, parses, exactly the 4 names in registration order, byte-identical per entry to the full list; `smoke-mcp` gains a `lite-profile` phase (one paced request, post-deploy proof). CI validate PASSED on the PR; local push ran the 52-gate worker preflight (4 site-dependent gates skipped — local `repo/` checkout stale; CI backstops them).
- **Boundary record:** lite scopes tools/list ONLY. `resources/list` (184KB) + `prompts/list` (51KB) remain full — separate MCP primitives, not the catalog tax. A lite client's total discovery pull is ~240KB, not ~6KB. Boundary comment on the PR.
- Known wart: `initialize.instructions`/`server/discover` still carry full-catalog text ("page 1 is 75 of 722 tools") to lite clients. Cosmetic; lite-aware instructions = follow-up only if the profile gets real users.
- **Reviews:** robustness review (url scoping proven in-scope — the /mcp route guard uses the same variable; SPA-fallback 200-garbage found and fixed) + product-surface review (boundary above; tracking claim conditional — see §4). PR self-review comment on record.

### Merge-order coupling (READ BEFORE MERGING EITHER PR)

Open PR **#429** (`vendor: refresh from site X402-UNITS-FIXTURE-1`, art-596) touches the SAME vendored `data/`. A vendor bump moves interpolated counts inside tool descriptions (e.g. "722 tools" → 723), so **whoever merges second owes a `node scripts/precompute-discovery.mjs` re-run + commit** — invariant (f) will FAIL CI otherwise. This is the gate working, not a defect. Recommendation on record: merge #430 first (fully tested), then rebase #429 + re-run precompute. Every future vendor PR owes the precompute re-run too — the lite file is a first-class vendored artifact now.

### Deploy + post-merge protocol (A4.4/A4.5)

Merge on master = gated deploy (validate → deploy → smoke). After merge: confirm Actions green, smoke passed INCLUDING the new `lite-profile` phase, and `/mcp?profile=lite` returns the 4-tool list before considering it done. Rollback = one `git revert` through the same workflow; every lite failure mode degrades to the full template.

## 4. Standing rulings from this session (binding on future sessions)

1. **No marketing of the lite surface.** Tim: AINumbers needs to demonstrate ORGANIC activity; no new URL/link may be advertised. The profile is a query param on the canonical endpoint — never promote it in public docs, registry listings, server-card, or changelogs. Commit ceiling for this work: a PR/merge on GitHub, nothing wider.
2. **Tracking:** profile usage is countable from persisted invocation logs by URL param (verify query strings appear in the dashboard); fallback = add the profile token to the ANALYTICS `mcp_tool_calls` datapoint (2-line follow-up, deliberately not in #430).
3. **ZCode MCP config:** leave the stdio-proxy swap in place; do not restore the remote without reading §2. Do not add per-session MCP workarounds — ZCode has none (config-scoped only; verified against zcode.cjs).
4. **Worker repo direct PRs vs board rows:** Tim-directed worker changes may ride as direct PRs (this one) with memorial + channel-FYI instead of retroactive board rows — a retro row with no builder receipts pollutes claimed/done. The channel FYI (7F-TO-ORCH, one line) is the coordination surface for merge-order coupling with seat-owned work.
5. **Verification protocol for a fresh session:** `node scripts/ainumbers-lite-proxy.test.mjs && node scripts/ainumbers-lite-proxy.mocktest.mjs` (proxy), `node scripts/check-worker-invariants.mjs` (lite artifact), `gh pr checks 430 --repo PostOakLabs/ainumbers-mcp-apps` (CI), automation cadences via CronList against §1's table, backups listed in §2.

## 5. Open items

- [ ] Merge #430 (Tim/7F call; merge-order coupling with #429 above).
- [ ] Post-merge: estate migration to `?profile=lite` + retire local proxy (§2 retirement path).
- [ ] CONTRACT §2 or mcp-apps-poc README line documenting the param (A5.4 follow-up).
- [ ] Optional: profile token in ANALYTICS datapoint; lite-aware instructions string.
- [ ] Untriaged automations: orch-autoboot (hourly — biggest single remaining launch cost), 7f-seat, dailies, weeklies.
- [ ] `.wt/` 613-worktree cleanup (disk hygiene; zero token impact) during a pipeline-dry window.
