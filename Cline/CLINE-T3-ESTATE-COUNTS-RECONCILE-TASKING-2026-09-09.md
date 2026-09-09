# CLINE-T3 — Estate count reconciliation (live census of record)

- **Status:** PROPOSED · 2026-09-09 · dispatcher: ZCode/GLM sweep · executor: Cline
- **Deliverable:** `C:\dev\Claude\Projects\AINumbers\research\ESTATE-COUNTS-RECONCILE-2026-09-09.md` (+ raw counts JSON)
- **Scope guard:** report only. No edits to `repo/`, `board/`, or site sources.
- **Queue note:** run this one FIRST — its baseline is cited by T1/T4/T5.

## Claim under test (a set of mutually conflicting published counts)

No single document reconciles these; several are stale and all are quote-risk if a
third-party directory or the whitepaper cites the wrong one:

| Count | Where published | As-of |
|---|---|---|
| 697 tools live (640 nodes + 16 widgets + utilities); 369 chains | `research/WEBMCP-AGENT-SHOWCASE-PROMPTS-2026-09-05.md:15,247` | 2026-09-05 |
| 535 browser tools · 584 manifests · 606 mcp.live · 351-352 chains · zk 545/550 · hubs 50 | `STATE.md:7,14` (closed by `repo/scripts/counts.mjs`) | 2026-08-05 |
| 79 manifest entries · 71 browser tools; frozen sha256s; "~121 sites" listed at webmcpdirectory.com | `research/WEBMCP-DIRECTORY-DOSSIER-2026-09.md:8-10,17` | 2026-09-05-era, now contradicted by 96 |
| 96 pages registered in `.well-known/webmcp.json`; 62 publish an `"unknown"`-typed property | `research/WEBMCP-LIVE-STATE-FINDINGS-2026-09-09.md:69-78` | 2026-09-09 |
| "site advertises 590 browser tools / 369 chains / 718 MCP tools" | site copy observed 2026-09-09 (locate the serving page) | ? |
| 481 mapping-incomplete (40/134/294/13) vs 465 in the later report | `research/WEBMCP-TRIAGE-2026-09.json` vs `WEBMCP-WRAPPER-PARSE-REPORT-2026-09.md` | drift |

## Task

1. Derive today's numbers from primary sources, each with a reproduction command:
   - fetch live `https://ainumbers.co/.well-known/webmcp.json` → count registrations,
     typed vs `"unknown"` properties;
   - fetch the live vendored chaingraph (the site-served `chaingraph.json`) → count
     nodes, chains, kernels;
   - call MCP `tools/list` on `https://mcp.ainumbers.co/mcp` → count tools, categorize
     (node tools vs widgets vs utility tools);
   - fetch the worker's directory/manifests surfaces → count manifests.
2. Fetch and quote each published number above at its source (file:line or URL).
3. Produce the reconciliation table: metric | published value | source | derived-today
   value | verdict (CURRENT / STALE / CONTRADICTED / UNLOCATABLE).
4. For the "590/369/718" site copy: locate the page that serves it and check whether
   the three numbers match any derivable reality; flag for copy correction if not.
5. Recommend which single number set should become the SSOT for external quoting, and
   what board row would freeze it (proposal only — do not edit board or STATE.md).

## Done when

- Every row of the table has a derived-today value with a runnable reproduction command.
- Every published number is adjudicated CURRENT / STALE / CONTRADICTED with quoted
  sources.
- The report names one recommended SSOT count set.
