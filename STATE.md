# STATE — current snapshot (regenerate at session end if you shipped)

**⚠ LIVE SSOT = `ORCHESTRATOR-BOARD.md` 🔴 CURRENT STATE block + `board/` dirs. Full shipped record = `ORCHESTRATOR-BOARD-DONE.md`. This file is a pointer + warnings, NOT a ledger — trust the board over any detail here.**

## Load-bearing "never quote, re-derive" warnings (each caused a real misdiagnosis)
- **Counts** (nodes/gpu:false/chains/MCP tools/catalog/widgets): RE-DERIVE from SSOT `origin/master:mcp-apps-poc/data/counts.json` live. Graph moved 405→418 in one session; any number written here goes stale the moment an `ASSEMBLE-LAND` runs. Last seen 2026-07-19: 418 nodes · 403 gpu:false · 308 chains · 458 MCP tools · 553 catalog · 16 widgets — **do not cite as authority.**
- **§18 coverage:** NEVER quote a number — run `node scripts/check-compute-proof-coverage.mjs`. Failure signal = `proven` going DOWN or gate RED; a rising `deferred` count during a build wave is EXPECTED (new nodes ship deferred per STANDING ORDER #6). Denominator moves, proven doesn't. Deferred drained by `ZK-PROVE-WAVE`; §18.6(b) gap owned by `DEFER-REASON-1`.
- **Next free art-NN:** re-derive at dispatch `node scripts/board-next.mjs` §4 — never from here. art-310–312 RETIRED, do not reuse. `board-lint.mjs` watches duplicate reservations (`ARTREG-RECONCILE-1` owns reconcile).
- **For any green gate, ask what it does NOT look at** (07-14 theme: every real bug hid behind a passing gate whose scope excluded the failure).

## Active program pointers
- **HELM (2nd product)** — local-first control plane, repo `PostOakLabs/ainumbers-helm` (`main`, local `helm/`, THIRD repo never mix remotes). Specs `HELM-PHASE1/2/3-BUILD-SPEC.md`. v0.1.0 RELEASED 07-23; front-end daemon-served + quickstart live; Phase 3 staged. Detail in memory `project-ainumbers-helm-*`.
- **BANKING OCG** — 3-wave reg-reporting build, spec `BANKING-OCG-BUILD-SPEC.md`, WUs `BANK-*`. Memory `project-ainumbers-banking-ocg-program`.
- Staged batches (07-16 brainstorm) + queue detail live in memory `project-ainumbers-consolidated-queue` + `project-ainumbers-brainstorm-2026-07-16` — not restated here.
- `DECISION-LEDGER-DISCARDED.md` (root, living doc) — check BEFORE proposing anything new.

## Live endpoints
- ainumbers.co (site, DreamHost, repo main) · mcp.ainumbers.co/mcp (compute, worker master) · anchor.ainumbers.co/mcp (evidence, 7 tools) · ledger.ainumbers.co (v1.2)

## Deadlines
- MCP spec final 2026-07-28 · EU AI Act Art-50 transparency 2026-08-02 (Annex III high-risk deferred to Dec 2 2027) · Fedwire/CHIPS/Swift structured-address 2026-11-16 · UST clearing cash Dec 2026

## Ops guardrails
- **Workers free cap 100k req/day account-wide** (current ~2.85k = 35x headroom); over-cap = MCP DOWN until UTC midnight. $5 Workers Paid removes cap if launch expects >50k/day.
- spec_version 0.8.7 LIVE · schema frozen v0.4 · artifacts emit 0.4.0.
- Self-merge allow-rules set in all 3 projects' `.claude/settings.json`; sessions never self-grant permissions or merge other sessions' PRs — permission changes = hand Tim exact JSON.
- Cloudflare housekeeping COMPLETE 07-11 (AI-crawler unblock, HSTS/SPF/DMARC, stats archiver on private `ainumbers-internal`) — detail in memory `project-ainumbers-cloudflare-housekeeping-2026-07-11`.

## Open Tim actions
- N2 Web-Bot-Auth bypass empirical verify · `mcp-publisher publish` re-sync (PUBLISH-REFRESH-2) · in-toto#567 maintainer-side · worktree/CSP-stray cleanup call · Gurgaon outreach AFTER Vouch-Protocol borrows land.
