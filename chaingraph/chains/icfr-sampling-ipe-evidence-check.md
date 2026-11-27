# ICFR Sampling IPE Evidence Check

Check a SOX 404 / ICFR control test in three stages, plus a session receipt. First, size an attribute sample from caller-declared confidence level, tolerable deviation rate and expected deviation rate, using the standard zero-EDR Poisson attribute-sampling formula with an expansion factor for nonzero EDR, with deterministic interval sampling over the caller-declared population hash so any auditor can replay the same sample (ART-458). Then verify Information-Produced-by-Entity completeness and accuracy for the control test, reconciling a caller-declared source-extract hash, row count and control total against the same facts for the report built from it (ART-460). Then compose the control-test evidence artifact, reconciling a caller-declared attribute sample against a per-item pass/fail test-result set into one test-conclusion record: sample coverage, exception count against a caller-set tolerable-deviation threshold, and a conclusion of operating effectively, exception noted or incomplete, with reviewer sign-off held as a human gate (ART-461). Finally, a session receipt aggregating the run's execution hashes (CRY-05). Each stage uses its own caller-supplied inputs; no stage's output is an input to another stage, and the order is the testing cycle order: plan the sample, prove the data, then conclude on the test. This is a new chain under its own slug; the existing icfr-control-test-cycle chain, which contains art-461 alone, is left untouched. Findings are arithmetic findings, never audit opinions. Not legal advice.

- Page: https://ainumbers.co/chaingraph/chains/icfr-sampling-ipe-evidence-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/icfr-sampling-ipe-evidence-check.md

## Workflow chain: ICFR Sampling IPE Evidence Check

Check a SOX 404 / ICFR control test in three stages, plus a session receipt. First, size an attribute sample from caller-declared confidence level, tolerable deviation rate and expected deviation rate, using the standard zero-EDR Poisson attribute-sampling formula with an expansion factor for nonzero EDR, with deterministic interval sampling over the caller-declared population hash so any auditor can replay the same sample (ART-458). Then verify Information-Produced-by-Entity completeness and accuracy for the control test, reconciling a caller-declared source-extract hash, row count and control total against the same facts for the report built from it (ART-460). Then compose the control-test evidence artifact, reconciling a caller-declared attribute sample against a per-item pass/fail test-result set into one test-conclusion record: sample coverage, exception count against a caller-set tolerable-deviation threshold, and a conclusion of operating effectively, exception noted or incomplete, with reviewer sign-off held as a human gate (ART-461). Finally, a session receipt aggregating the run's execution hashes (CRY-05). Each stage uses its own caller-supplied inputs; no stage's output is an input to another stage, and the order is the testing cycle order: plan the sample, prove the data, then conclude on the test. This is a new chain under its own slug; the existing icfr-control-test-cycle chain, which contains art-461 alone, is left untouched. Findings are arithmetic findings, never audit opinions. Not legal advice.

Domain: SOX 404 / ICFR

### Steps

1. art-458-attribute-sampling-plan
   Sizes an attribute sample from caller-declared confidence level, tolerable deviation rate and expected deviation rate, with deterministic interval sampling over the caller-declared population hash; reframes to a full census when the plan is statistically indefensible
2. art-460-ipe-integrity-verifier
   Verifies Information-Produced-by-Entity completeness and accuracy for the control test, reconciling a caller-declared source-extract hash, row count and control total against the same facts for the report built from it, within a caller-set rounding tolerance
3. art-461-control-test-evidence-composer
   Composes the control-test evidence artifact, reconciling a caller-declared attribute sample against a per-item pass/fail test-result set into one test-conclusion record, with reviewer sign-off held as a human gate
4. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: How large a sample do we need to test this control, given our tolerable deviation rate?
Run the AINumbers MCP tool `run_chain` with {"chain":"icfr-sampling-ipe-evidence-check"} and read `art-458-attribute-sampling-plan.sample_size`.
Re-run with `inputs` for `art-458-attribute-sampling-plan`, reusing the values that result echoed, with `population_size` set to 2000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/icfr-sampling-ipe-evidence-check.html
