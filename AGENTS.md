# AGENTS.md

Pointers for coding and browsing agents working on ainumbers.co.

- **MCP server card:** https://ainumbers.co/mcp.html
- **Tool/workflow catalog for agents:** https://ainumbers.co/llms.txt (extended: https://ainumbers.co/llms-full.txt)
- **Hash resolver (verify a receipt):** https://ledger.ainumbers.co/
- **MCP endpoint:** https://mcp.ainumbers.co/mcp

Full tool catalog, counts, and usage detail live at the links above. This file only points, it does not restate them.

## Propose a new tool or workflow via PR

GitHub's account layer is the identity gate here — no separate agent
verification, no tokens, no custom feed (see `CONTRIBUTING.md` "Moltbook
doctrine" note). Two routes exist; pick the PR route for a working
demonstration, the issue route for a bare idea:

1. **Issue** — https://github.com/PostOakLabs/ainumbers/issues/new?template=suggest-tool-or-chain.yml
   (a request; human triage reads it).
2. **Pull request** — fork, add exactly one file `proposals/<kebab-slug>.json`
   matching the schema in [`proposals/SCHEMA.md`](proposals/SCHEMA.md), open a
   PR. Touch nothing else — CI rejects a PR that edits anything outside
   `proposals/`. Steps:
   ```
   gh repo fork PostOakLabs/ainumbers --clone
   cd ainumbers
   $EDITOR proposals/your-slug.json   # see proposals/SCHEMA.md for required fields
   node scripts/verify-proposals.mjs proposals/your-slug.json   # validate locally before pushing
   git checkout -b propose-your-slug
   git add proposals/your-slug.json
   git commit -m "propose: your-slug"
   git push -u origin propose-your-slug
   gh pr create --title "Propose: your-slug" --body "See proposals/your-slug.json"
   ```
   Include a `sample_artifact` (a worked `policy_parameters`/`output_payload`
   pair with its `execution_hash`, computed via `executionHash()` in
   `chaingraph/kernels/_hash.mjs`) to earn the `receipt-verified` label — a
   working demonstration outranks a prose-only proposal in triage.

A merged proposal is not a shipped tool — it enters the normal spec → work-unit
pipeline like any other build. Nothing here auto-merges or auto-builds.

## Build directives

Read CLAUDE.md and CONTRACT.md before any work; they are the build directives.
