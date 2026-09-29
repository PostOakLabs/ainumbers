# PUBLIC-ESTATE-TRIAGE-1 — Memorial for Independent Verification

**Date:** 2026-09-28 (final merges 2026-09-29T00:15Z) · **Operator:** collectrix session, user-directed (Tim rulings via popup Q&A) · **Scope:** all 16 public PostOakLabs repos + collectrix profile
**Status of record at write time:** 22 PRs merged across 15 public repos, 1 PR open (ainumbers-mcp-apps #420, deliberately parked), zero red CI introduced, zero post-merge surprises found across two full verification passes.

**Purpose.** Another session must be able to (a) re-verify every load-bearing claim below with the exact commands in §7, (b) understand which claims were adversarially attacked and what survived, (c) execute the open items without re-deriving context. Nothing in this file is a board WU; all work was user-directed.

---

## 1. Rulings of record (user decisions, popup-confirmed — do not re-litigate)

| # | Ruling | Date | Effect |
|---|---|---|---|
| R1 | License policy: **code MIT + content CC BY 4.0** (OCS three-file pattern) | 2026-09-28 | License stream PRs; ainumbers #2121, newtripoli #3, postoaklabs #7 merged. mcp-apps verified already compliant (LICENSE + data/LICENSE.md). |
| R2 | Naming: **keep both, define once** — standard formal name OpenChainGraph; ChainGraph is the surfaces' short name | 2026-09-28 | One-line gloss in ainumbers + chaingraph READMEs. Full rename rejected. |
| R3 | Counts policy: **CI-gate README/server.json numbers** derived from SSOT files | 2026-09-28 | NOT YET BUILT. Plan + doctrine constraints in §6.3. |
| R4 | Merge routing: automerge label only on **active repos with machinery** (ainumbers, ainumbers-helm, ainumbers-mcp-apps); repos without `automerge-label.yml` get **manual merge clicks**; dormant-repo PRs held pending explicit go | 2026-09-28 | Executed; see §2. |
| R5 | Visuals: anchor + helm GIFs ordered; newtripoli terminal GIF declined | 2026-09-28 | anchor-suite #58, helm #277 merged. |
| R6 | ainumbers workbench GIF: scrollbar-free re-capture ordered after user rejected v1 capture | 2026-09-29 | #2126 merged. Scrollbar suppression pipeline recorded in §5.6. |
| R7 | Before any counts-gate build-out: adversarial review of merge plan first | 2026-09-28 | Delivered; findings in §5. |

## 2. PR ledger (22 merged, 1 open)

Merged via `automerge` label (machinery: App-token `automerge-label.yml`): ainumbers #2118 (README hygiene), #2119 (workbench GIF v1), #2121 (license split), #2126 (workbench GIF v2 scrollbar-free); ainumbers-helm #276 (README dead links), #277 (control-plane GIF); ainumbers-mcp-apps #421 (widget GIF re-time). 7 label-landings total.

Merged by user click (repos without automerge machinery, verified green first): apexlogics #128, apexlogics-mcp-worker #32, ocs-mcp-worker #9, OCS #108, anchor-suite #58, .github #4, address-forge #2, a2a-iso-gateway #1, newtripoli #2, newtripoli #3 (license), newtripoli-mcp-worker #2, postoaklabs #6, postoaklabs #7 (license). 13 clicks.

Merged by user click (machinery exists, judgment-call PRs): chaingraph #7 (README two-axes + adoption ladder), chaingraph #8 (landing-page remap to SPEC 0.8.13). 2 clicks.

OPEN (deliberately parked): **ainumbers-mcp-apps #420** — server.json derived from counts SSOT via `sync-registry.mjs --write` (530/561 → 725/1188, v0.4.10→0.4.11), package.json license ISC→MIT, README-SPEC.md bannered as frozen 2026-06-06 snapshot. **Park reason:** merging fires `registry-drift-schedule.yml` (cron `0 */6 * * *`, verified) red + tracking issue until `mcp-publisher.exe publish` runs. Publish-day runbook in §6.1. Do NOT label automerge before publish is imminent.

## 3. Verified end-state (each claim re-checkable via §7 commands)

1. ainumbers main GIF `docs/chaingraph-workbench-demo.gif` = **319,671 bytes** (#2126 capture; v1 was 366,034; original 1,456,113). Alt text unchanged and still accurate.
2. chaingraph main `index.html`: **"Five Tests" count = 0**; §-ref census = only valid 0.8.13 sections (§1 §4 §5 §7 §13.11 §15 §16 §18 §18.4). chaingraph #7 + #8 both merged.
3. ainumbers main README: no `rce-round3-proof-a` residue; conformance ref cites §18.4 ladder + §15 gates (SPEC.md has no §3; verified at 0.8.13).
4. License detection flipped as designed: newtripoli = **MIT License** (was CC-BY), postoaklabs = CC-BY-4.0, ainumbers = MIT. SPEC §26 `ocg-control-plane@1` is NORMATIVE (line ~2128) — helm README now cites it.
5. Post-merge CI: every CI-bearing repo green on its merge commit. The single "failure" in recent history (a2a-iso-gateway CI, run 24892516443) is from **2026-04-24**, pre-existing, not ours.
6. Live smoke (post-deploy): omegacentauri.me / apexlogics.org / newtripoli.xyz / postoaklabs.com / anchor.ainumbers.co all 200; MCP endpoints 406/405 on bare GET = correct content-negotiation posture (200 with proper Accept, verified).
7. Org profile live: MCP-4 badge, 4-suite table, grouped repository directory (16 repos).
8. ocs-mcp-worker server.json = 35 tools/42 chains (manifest SSOT truth); newtripoli-mcp-worker README = 18 tools/9 chains (manifest truth); apexlogics pair reconciled at **17 of 36 zk-proven** (data/proof-fixtures.json is SSOT; vendored chaingraph.json marks 17 ready / 12 deferred).
9. drift-exposed hardcounts that REMAIN (accepted, SSOT pointers in place): apexlogics-mcp-worker "17 of 36", ocs-mcp-worker server.json (hand-fixed, no gate), org profile 513/517 (dated, gate-backed upstream).

## 4. Adversarial record (what was attacked, what fell)

Passes: (P1) self-review of recommendations before execution; (P2) pre-merge compatibility sweep (gates/consumers/SSOTs/auto-merge); (P3) per-PR hostile review of the 3 held PRs; (P4) this memorial's re-verification of load-bearing facts.

Findings that CORRECTED my own work (another session should know I err and self-correct):
- F1. "GIFs committed yesterday" was a shallow-clone artifact; true age: added 2026-07-09, never regenerated. User's "dated" instinct was literally correct.
- F2. GIF static-hold criticism overstated: terminal holds are correct technique; the defects were hold duration (60%+ of loop), illegible hash, 3.4fps scroll.
- F3. ainumbers "license contradiction" reframed: intended dual licensing missing its file split. R1 resolves.
- F4. I introduced a duplicate `manifest.json` tree line in newtripoli README (caught in P2, fixed in-PR).
- F5. My ladder wording said "signature proof"; SPEC §16 is "Proof Binding". Fixed in #2118/#7 to §18.4's own phrasing.
- F6. Two newtripoli chain blurbs were initially paraphrased-from-memory; corrected against the manifest SSOT. Rule that held: **never write a claim without reading the SSOT field it rests on.**

Findings that BLOCKED or REDIRECTED execution (would have caused breakage/red):
- F7. OCS copy-hallmarks gate scans README.md with a bold/em-dash ratchet and OCS has NO PR-side CI — a stale `**29**` would have gone red post-merge. Proven green locally (`node scripts/check-copy-hallmarks.mjs` → "207 baselined file(s) within budget") before the user clicked merge.
- F8. Automerge machinery audit: only ainumbers, ainumbers-helm, ainumbers-mcp-apps have `automerge-label.yml` (`if: github.event.label.name == 'automerge'`, draft/fork guarded). Labels elsewhere are inert; 4 PRs therefore routed to manual clicks. Zero auto-merge exposure existed at any point.
- F9. mcp-apps `registry-drift-schedule.yml` fires red every 6h when committed server.json is ahead of the published registry → #420 parked on publish-day-only plan.
- F10. chaingraph index.html (mirror-owned) was v0.4-era throughout (Five Tests ×3, §5/§6/§7/§7.3/§7.4/§8/§8.3 dead refs, envelope sample at 0.1.0) — #7 would have left the repo internally inconsistent; #8 remapped every ref (final census all-valid; §13.11 VC profile verified still-extant).
- F11. ainumbers "branch inventory" gate polices KERNEL decision branches (AUTHORING-STANDARD §1 refused/represented rows), not git branches. A branch sweep has no gate interaction; sweep also valueless (GitHub keeps merged PR heads). DROPPED.
- F12. Scrollbar root cause: THREE nested document layers (workbench page → runner iframe → 4 per-step tool iframes). Stylesheet injection lost the specificity war against tool-page `!important` scrollbar rules; working method = inline `scrollbar-width:none !important` via `style.setProperty(...,'important')` on **every scrolling element** (`scrollHeight>clientHeight` or overflowY auto/scroll) in every nested document, re-applied before each screenshot, plus `html *::-webkit-scrollbar{width:0;height:0;display:none!important}` stylesheets. 40 elements swept per frame.
- F13. DISCLOSURE (no action needed): the execution_hash shown in workbench GIFs (1a96299a8bc6b0ddb2fc9aa7ab89793205448d4aae38a18f68b4f44a4cfb8a05) was reused as the digest stamped in anchor GIF #58 — Sigstore/DigiCert/FreeTSA hold real RFC 3161 receipts for it. Synthetic-input digest, existence-proof only, but the cross-linkage is permanent and intentional-disclosed in PR bodies.
- F14. helm GIF shows daemon **v2026.9.10** (repo/installer at 2026.9.26; `helmd doctor` says update available). If the helm GIF is re-captured, update the installed daemon first or the GIF ships stale software again.
- F15. address-forge sibling links `iso20022-token-bridge` / `mmf-token-sandbox` do not resolve publicly (removed in #2). If they are private repos, keep them unlinked.

## 5. Capture pipeline (reusable, proven)

Workbench/anchor/helm captures: IAB browser via control-browser skill, viewport 1280×860, PNG stages → ffmpeg crop → concat with per-stage durations → palettegen/paletteuse (bayer_scale=4) → GIF. Scrollbar-free variant per F12. Ainumbers push hooks run `preflight.mjs --quick` automatically; full 362-gate preflight was run manually for #2118/#2121/#2126-class changes (all green, exit 0). helm/anchor push hooks run their own gate suites (green).

## 6. Open items (owners + preconditions)

### 6.1 #420 publish-day runbook (user executes; session may label after)
```
merge #420 (UI or automerge label — red nag starts, expected)
cd mcp-apps-poc && git pull origin master
node scripts/sync-registry.mjs --write     # re-derives counts from data/counts.json, bumps version
git add server.json && git commit -m "chore: registry sync pre-publish" && git push origin master
.\mcp-publisher.exe publish                 # publishing is Tim-only per SO #8 flag-and-wait
```
Drift red clears on the next scheduled run after publish. If publish is >2 weeks out, leave #420 parked (zero cost).

### 6.2 Helm GIF re-capture (optional; blocked on R-F14)
Precondition: update installed daemon to 2026.9.26 (user machine). Then: `node bin/helmd.mjs start` (capture pairing URL from stdout log), pair browser tab via `#token=...&pair=...`, capture Home → #/choose → #/verify with deepHide sweep (§4/F12), dismiss version banner, assemble 3-frame GIF, PR to ainumbers-helm. Judgment-call PR → no automerge label without user eyeball.

### 6.3 Counts CI-gate build-out (agreed, unbuilt; doctrine constraints binding)
- Order: (1) mcp-apps `server.json`↔`data/counts.json` parity as a worker-preflight step (smallest; sync-registry dry-run diff = the check); (2) ainumbers README sentinels (extend `verify-counts.mjs` sentinel pattern to README slots); (3) template to OCS (`verify-counts.py`), workers, postoaklabs.
- Binding constraints: SO #34c — every new gate ships a RED-before-GREEN proof quoted in its PR body; SO #6 — main-only workflow changes need `workflow_dispatch` dry-run treatment; SO #8 — no new third-party Actions (plain node in existing workflows); counts live only inside sentinel/generator-owned slots (authoring-model change: free-text counts in READMEs go red by design; provide `--fix` paths per existing gate convention).
- Design guard from P2: README stays hand-edited prose + generated slots only; no new single-writer conflicts.

### 6.4 Declined/dropped (do not reopen without a new ruling)
Branch sweep (F11 — valueless). newtripoli CRT GIF (R5 declined). Full ChainGraph rename (R2). License stream beyond R1 scope (done). reposting "All rights reserved" on postoaklabs LIVE site footer — Tim legal-positioning call, flagged in #7 body, unchanged on site.

### 6.5 Scratch cleanup (session artifacts, safe to remove anytime)
`.claude/worktrees/pubreadme/*` (11 shallow clones), repo/.wt/pub-readme-1 + pub-gif-1 + pub-gif-2 + pub-license-1, mcp-apps-poc/.wt/pub-readme-1 + pub-gif-1, chaingraph-standard/.wt/pub-readme-1 + pub-index-1, dotgithub/.wt/pub-nav-1, helm/.wt/pub-readme-1 + pub-gif-1, anchor-suite/.wt/pub-gif-1. All branches merged; GitHub retains PR heads. Remote `pub-*` branches left in place (deletion unrequested).

## 7. Verification protocol (fresh session: run these, compare to §3)

```
gh pr view 420 -R PostOakLabs/ainumbers-mcp-apps --json state,mergeStateStatus   # expect OPEN (or MERGED if publish day happened)
gh api repos/PostOakLabs/ainumbers/contents/docs/chaingraph-workbench-demo.gif --jq .size    # expect 319671
gh api repos/PostOakLabs/chaingraph/contents/index.html --jq .content | base64 -d | grep -c "Five Tests"   # expect 0
gh api repos/PostOakLabs/newtripoli --jq .license.name                            # expect "MIT License"
gh api repos/PostOakLabs/OCS/contents/README.md --jq .content | base64 -d | grep -o "across .*29.* tools"   # expect hit
gh api repos/PostOakLabs/apexlogics-mcp-worker/contents/README.md --jq .content | base64 -d | grep -o "17 of 36"   # expect hit
for r in OCS:main ocs-mcp-worker:master apexlogics:main apexlogics-mcp-worker:master anchor-suite:main newtripoli:main newtripoli-mcp-worker:main postoaklabs:main address-forge:main a2a-iso-gateway:main; do
  repo=PostOakLabs/${r%%:*}; br=${r##*:}
  gh run list -R $repo --branch $br --limit 1 --json conclusion --jq ".[0].conclusion"   # expect success (a2a: success; its April failure is F-history)
done
curl -s -o /dev/null -w "%{http_code}" https://mcp.newtripoli.xyz/mcp -H "Accept: application/json, text/event-stream"   # expect 200
```
Discrepancy handling: any miss → check whether a NEWER ruling superseded this memorial before "fixing" — the estate moves fast (counts moved twice during this engagement: 722/1186 → 725/1188 on the same day).

## 8. Session provenance

Session model performed: full-fleet review (17 public repos + profile, all cloned locally then removed), user triage via popups ×3, two adversarial passes, 22 PRs authored (all README/docs/GIF/license-only; zero kernel, zero chaingraph.json, zero workflow, zero derived-artifact edits — verified by diff scope at each commit), 2 automerge routings corrected mid-flight (F7/F8), all scratch clones removed except those listed in §6.5. Workspace commit: this file only, explicit pathspec, per CLAUDE.md workflow. `.claude/settings.json` pre-existing modification intentionally untouched.

---

## 9. ADDENDUM 2026-09-29 — REGISTRY-PARITY-1 built (first counts-gate landed as PR)

Rulings R8–R10 (popup-confirmed 2026-09-29): R8 publish expected within a day or two; R9 landing shape = **absorb** (#420 merged into the gate PR; #420 CLOSED as absorbed — do not reopen); R10 publish-day division: session runs merge→`sync-registry --write`→commit→push, **Tim runs only `mcp-publisher.exe publish`** (SO #8).

**Delivered:** open PR **ainumbers-mcp-apps #426** (branch `counts-gate-parity-1`, stacked on #420's `pub-readme-hygiene-1`): `--check` mode in `scripts/sync-registry.mjs` (hermetic: exits before the live fetch; description-only — version stays `--check-drift`'s job), gate entry in `scripts/preflight.mjs`, matching step in `ci.yml` Validate job. SO #34c red-before-green proof quoted in the PR body. CI-verified: run 36608051545 **success**, gate line "✅ registry-parity … matches the counts SSOT (725 MCP tools / 1188 catalog tools)" executed in the cloud; zizmor pass ×2 on the ci.yml edit. SO #6 dissolved by ci.yml's `pull_request` trigger (not main-only). No automerge label — workflow change awaits Tim's review/merge.

**Publish-day runbook (updated):** Tim reviews+merges #426 → session: `node scripts/sync-registry.mjs --write`, commit, push → Tim: `mcp-publisher.exe publish` → session verifies registry serves the new version + drift red clears on next scheduled run.

**Scratch cleanup executed:** all 12 `.wt/pub-*` worktrees + `.claude/worktrees/pubreadme/` clones removed (verified 0 remaining). Remote `pub-*` branches still exist (deletion unrequested).

**Behavior change live after merge:** PRs moving `data/counts.json` must run `sync-registry.mjs --write` (patch bump) or the pre-push hook blocks with the fix command printed — the intended ratchet; drift nag stays red until publish per the bump→publish flow.

**Still open:** helm GIF redo (blocked on daemon update to 2026.9.26), anchor GIF redo (optional), README sentinels + OCS/worker/postoaklabs gate rollout (template = #426), remote branch sweep (declined unless wanted).
