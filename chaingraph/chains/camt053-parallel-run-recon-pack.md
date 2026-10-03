# camt.053 Parallel-Run Recon Pack

Evidence pack for a bank-statement parallel run, where a treasury receives the same period twice: once as a Swift MT9xx statement it maps itself, and once as the bank's native camt.053. Stage 1 maps the MT leg to a camt-shaped object with a fidelity report and the 60F + sum(61) = 62F balance check. Stage 2 classifies the native camt.053 leg by BkTxCd and checks the OPBD + sum(movements) = CLBD balance equation. Stage 3 takes declared record counts and control totals for both legs and checks count completeness, value completeness against a declared tolerance, and aggregate-versus-partition consistency. Both legs are DECLARED inputs: the pack reads no bank connection and fetches no statement, so it evidences whether the two legs agree, never that either leg is correct. A run that cannot establish agreement reports that as its own state rather than defaulting to a pass.

- Page: https://ainumbers.co/chaingraph/chains/camt053-parallel-run-recon-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/camt053-parallel-run-recon-pack.md

## Workflow chain: camt.053 Parallel-Run Recon Pack

Evidence pack for a bank-statement parallel run, where a treasury receives the same period twice: once as a Swift MT9xx statement it maps itself, and once as the bank's native camt.053. Stage 1 maps the MT leg to a camt-shaped object with a fidelity report and the 60F + sum(61) = 62F balance check. Stage 2 classifies the native camt.053 leg by BkTxCd and checks the OPBD + sum(movements) = CLBD balance equation. Stage 3 takes declared record counts and control totals for both legs and checks count completeness, value completeness against a declared tolerance, and aggregate-versus-partition consistency. Both legs are DECLARED inputs: the pack reads no bank connection and fetches no statement, so it evidences whether the two legs agree, never that either leg is correct. A run that cannot establish agreement reports that as its own state rather than defaulting to a pass.

Domain: Corporate Treasury & FX

### Steps

1. art-563-mt9xx-camt-statement-migration-mapper
   Stage 1, the MT-derived leg. A pasted MT900/910/940/942/950 statement or notification mapped to a camt.052/053/054-shaped JSON object, with a fidelity report covering truncation findings, unmappable tags, and the 60F + sum(61) = 62F balance-consistency check.
2. art-258-parse-camt053-reconciliation
   Stage 2, the bank-native leg. The camt.053 statement the bank sent for the same account and period, classified by Domain, Family and SubFamily per the CGI-MP usage guide, with the OPBD + sum(movements) = CLBD balance equation checked and a structured-remittance match rate scored.
3. art-519-payment-data-migration-completeness
   Stage 3, the both-legs agreement check. Declared per-partition record counts and control totals for the two legs, checked for count completeness, value completeness within a declared tolerance, and aggregate-versus-partition consistency, so a grand total that reconciles while a partition underneath does not is reported rather than passed. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Parallel run week: does the migrated camt.053 statement reconcile against our ledger closing balance, or is there a variance to chase?
Run the AINumbers MCP tool `run_chain` with {"chain":"camt053-parallel-run-recon-pack"} and read `art-258-parse-camt053-reconciliation.reconciliation_status`.
Re-run with `inputs` for `art-258-parse-camt053-reconciliation`, reusing the values that result echoed, with `closing_balance` set to 10600. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/camt053-parallel-run-recon-pack.html
