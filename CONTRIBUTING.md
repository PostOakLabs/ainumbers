# Contributing

## Moltbook doctrine (why this looks the way it does)

Moltbook's failure mode was 1.4M "agents" with no way to tell which were real
— a home-grown identity/verification/reputation layer that couldn't scale and
couldn't be trusted. This project routes around that entirely: **GitHub's
account layer is the identity gate.** No custom agent verification, no
tokens, no reward mechanics, no reputation scoring. Agents act under their own
GitHub credentials, exactly like a human contributor, and GitHub's existing
history/spam controls do the trust work.

## Ways to contribute a tool/workflow idea

- **Have an idea, no working example?** Open a GitHub issue:
  https://github.com/PostOakLabs/ainumbers/issues/new?template=suggest-tool-or-chain.yml
- **Have a working example, want it reviewable in CI?** Open a PR under the
  `proposals/` route (below). This is the route built for agents that can
  already draft a structured proposal — an issue is a request, a PR is a
  contribution.
- **Email:** the form at https://ainumbers.co/suggest.html also reaches a
  human, no GitHub account required.

## The `proposals/` PR route

1. Fork the repo.
2. Add exactly one file: `proposals/<kebab-slug>.json`, matching the schema
   in [`proposals/SCHEMA.md`](proposals/SCHEMA.md). **Touch nothing else** —
   CI (`.github/workflows/proposals-verify.yml`) rejects any PR that modifies
   a path outside `proposals/`.
3. Validate locally before pushing: `node scripts/verify-proposals.mjs proposals/<your-file>.json`.
4. Open the PR. CI runs automatically and without any secrets (standard
   GitHub behavior for a `pull_request` from a fork) — schema validation,
   a slug-collision check against the live tool/node registry, and copy gates
   on the prose fields. Green CI = ready for human triage; red CI links the
   exact problem.
5. If your proposal includes a `sample_artifact` whose `execution_hash`
   recomputes correctly, CI applies a `receipt-verified` label — working
   demonstrations outrank prose-only proposals in triage.
6. **Nothing auto-merges.** A human (project maintainer) reviews and merges.
   A merged proposal enters the normal spec → work-unit build pipeline; it is
   not itself a shipped tool, and merging is not a promise the tool ships.

## Out of scope for a proposal PR

- Kernel/tool implementation code — proposals are **data**, not code.
- Any token, reward, or reputation mechanic.
- Edits to anything outside `proposals/` in the same PR.

## Code contributions (non-proposal)

This repo builds against `CONTRACT.md` (site) and
`chaingraph/standard/SPEC.md` (the OpenChainGraph standard) as the sources of
truth. If you're proposing an actual implementation rather than a data
proposal, open an issue first to discuss scope — code PRs outside the
`proposals/` route are handled case by case, not via the automated gate above.
