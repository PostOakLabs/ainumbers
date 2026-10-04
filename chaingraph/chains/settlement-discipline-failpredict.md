# Settlement-Fail Prediction Pipeline

SSI conformance check (ART-80) -> fail-probability scoring on anonymized features (ART-79) -> Merkle integrity over the scored batch (cry-04). Ranks pending trades for pre-settlement intervention; targets the ~30%-of-fails SSI root cause. No PII - features are band-level.

- Page: https://ainumbers.co/chaingraph/chains/settlement-discipline-failpredict.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/settlement-discipline-failpredict.md

## Workflow chain: Settlement-Fail Prediction Pipeline

SSI conformance check (ART-80) -> fail-probability scoring on anonymized features (ART-79) -> Merkle integrity over the scored batch (cry-04). Ranks pending trades for pre-settlement intervention; targets the ~30%-of-fails SSI root cause. No PII - features are band-level.

Domain: Settlement Discipline

### Steps

1. art-80-ssi-conformance-checker
   SSI match-rate + flags (H1) feed the predictor
2. art-79-settlement-fail-predictor
   ranked fail-risk list (H2) feeds the verifier
3. cry-04-merkle-batch-verifier
   Exports composite fail-prediction artifact with Merkle-root execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The overnight desk queued a trade with a missing SSI and a breached matching deadline. Will that trade settle, and what drives the call?
Run the AINumbers MCP tool `run_chain` with {"chain":"settlement-discipline-failpredict"} and read `art-79-settlement-fail-predictor.batch_fail_rate_estimate`.
Re-run with `inputs` for `art-79-settlement-fail-predictor`, reusing the values that result echoed, with `trades` changed so one trade whose SSI is missing and whose deadline is breached. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/settlement-discipline-failpredict.html
