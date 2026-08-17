# Rulesets are code

`main-ci-anchor.json` IS the ruleset `main-ci-anchor` (id `20721322`,
target: `main`). Edit it via a normal PR — `../workflows/ruleset-apply.yml`
diffs the file against the live ruleset on every push to `main` that
touches this directory, and PUTs the file when they differ. A weekly
`ruleset-drift-gate.yml` run catches the other direction: a hand-PUT that
bypassed this file.

**Never run `gh api -X PUT .../rulesets/...` by hand again.** If the live
ruleset needs to change, change this file and open a PR.

The file omits GitHub's read-only response fields (`id`, `source`,
`source_type`, `created_at`, `updated_at`, `node_id`, `_links`,
`current_user_can_bypass`) — those aren't valid PUT input and would just
be echoed back. `scripts/ruleset-diff.mjs` normalizes both the file and a
live fetch (strips those fields, sorts arrays) before comparing, so field
order and array order never cause a false diff.
