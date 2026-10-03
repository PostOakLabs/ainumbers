# ICFR Control-Test Cycle

SOX 404 control-test evidence cycle - population, sample, and per-item test results reconcile into ONE test-conclusion artifact (coverage, exception count vs tolerable deviation, test conclusion). gate_status (review_required) and any deficiency candidate are recorded per the §27 Human Accountability vocabulary: the tester is the §27.1 preparer, every conclusion requires a reviewer sign-off, and deficiency severity classification is a separate reviewer approval record - both recorded now, enforced once HA-RETRO-1's runtime gating is wired to this chain. Quarter-end evidence bundles (§27.6) align to the §302 sub-certification cascade. Never a filed submission.

- Page: https://ainumbers.co/chaingraph/chains/icfr-control-test-cycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/icfr-control-test-cycle.md

## Workflow chain: ICFR Control-Test Cycle

SOX 404 control-test evidence cycle - population, sample, and per-item test results reconcile into ONE test-conclusion artifact (coverage, exception count vs tolerable deviation, test conclusion). gate_status (review_required) and any deficiency candidate are recorded per the §27 Human Accountability vocabulary: the tester is the §27.1 preparer, every conclusion requires a reviewer sign-off, and deficiency severity classification is a separate reviewer approval record - both recorded now, enforced once HA-RETRO-1's runtime gating is wired to this chain. Quarter-end evidence bundles (§27.6) align to the §302 sub-certification cascade. Never a filed submission.

Domain: SOX 404 / ICFR

### Steps

1. art-461-control-test-evidence-composer
   Reconciles the declared sample against per-item test results into sample coverage, exception count, and test_conclusion - final stage. Fixed review_required gate routes every conclusion to a §27.4 reviewer sign-off (recorded, not yet runtime-gated); an exception_count above the tolerable-deviation threshold flags a deficiency CANDIDATE for the reviewer's severity classification, never computed here.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The SOX test round just closed. Did the key control hold within the tolerable exceptions we declared?
Run the AINumbers MCP tool `run_chain` with {"chain":"icfr-control-test-cycle"} and read `art-461-control-test-evidence-composer.within_tolerance`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/icfr-control-test-cycle.html
