# AML Lookback Closure Cycle

Three-step closure cycle over a BSA/AML consent-order or self-identified lookback: the re-screened population, the resulting disposition sampling frame, and the caller's own per-sampled-item disposition records (filed/no-SAR/escalated, with rationale). Step 1 reconciles the re-screening extract's completeness against the declared population, excluding any period with no preserved list snapshot as unverifiable rather than screening it against today's list. Step 2 builds a deterministic disposition sampling frame and reviewer workload allocation over the verifiable population. Step 3 rolls up disposition-coverage against the sample frame's declared size, disposition-rationale-presence on every filed/no-SAR item, and a population-to-sample tie-out between steps 1 and 2's declared population sizes, into a closed §27.4 gate value. A hold or escalate outcome routes the cycle to the BSA Officer as reviewer before the lookback is treated as settled; a completed lookback, including an auto_pass rollup, still requires a separate §27 approval record naming the BSA Officer or designated compliance role as approver; automation never substitutes for that named sign-off. Customer id, alert id, and transaction reference are §25-salted throughout (sha256-salted@1 commitment strings only; no plaintext identifier ever enters the chain). This bundle is the institution's own evidence of its lookback closure basis, not a supervisory determination.

- Page: https://ainumbers.co/chaingraph/chains/aml-lookback-closure-cycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/aml-lookback-closure-cycle.md

## Workflow chain: AML Lookback Closure Cycle

Three-step closure cycle over a BSA/AML consent-order or self-identified lookback: the re-screened population, the resulting disposition sampling frame, and the caller's own per-sampled-item disposition records (filed/no-SAR/escalated, with rationale). Step 1 reconciles the re-screening extract's completeness against the declared population, excluding any period with no preserved list snapshot as unverifiable rather than screening it against today's list. Step 2 builds a deterministic disposition sampling frame and reviewer workload allocation over the verifiable population. Step 3 rolls up disposition-coverage against the sample frame's declared size, disposition-rationale-presence on every filed/no-SAR item, and a population-to-sample tie-out between steps 1 and 2's declared population sizes, into a closed §27.4 gate value. A hold or escalate outcome routes the cycle to the BSA Officer as reviewer before the lookback is treated as settled; a completed lookback, including an auto_pass rollup, still requires a separate §27 approval record naming the BSA Officer or designated compliance role as approver; automation never substitutes for that named sign-off. Customer id, alert id, and transaction reference are §25-salted throughout (sha256-salted@1 commitment strings only; no plaintext identifier ever enters the chain). This bundle is the institution's own evidence of its lookback closure basis, not a supervisory determination.

Domain: Financial Crime & KYC

### Steps

1. art-470-lookback-completeness-reconciler
   verifiable_source_count, verifiable_extract_count, and unverifiable_periods (excluded from re-screen scope) feed the disposition sampling frame's population definition; population size also feeds the rollup's population-to-sample tie-out
2. art-471-disposition-sampling-frame
   reviewer_workload allocation and the sample frame's declared population size feed the disposition rollup kernel, alongside the caller's per-sampled-item disposition records
3. art-534-aml-lookback-disposition-rollup
   Disposition-coverage, disposition-rationale-presence, and population-to-sample tie-out roll up into a closed §27.4 gate_policy value that closes the lookback's evidence bundle. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
