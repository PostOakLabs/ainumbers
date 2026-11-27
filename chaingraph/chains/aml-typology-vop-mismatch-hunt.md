# AML Typology VoP Mismatch Hunt

Score a synthetic transaction graph against AML typologies, then run a separate SEPA IBAN-name match batch over payee records the caller selects from the flagged accounts, and close with a session receipt. Each run computes from its own declared inputs, and each run hash is cited in the session receipt.

- Page: https://ainumbers.co/chaingraph/chains/aml-typology-vop-mismatch-hunt.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/aml-typology-vop-mismatch-hunt.md

## Workflow chain: AML Typology VoP Mismatch Hunt

Score a synthetic transaction graph against AML typologies, then run a separate SEPA IBAN-name match batch over payee records the caller selects from the flagged accounts, and close with a session receipt. Each run computes from its own declared inputs, and each run hash is cited in the session receipt.

Domain: Financial Crime & KYC

### Steps

1. art-10-amla-transaction-typology-risk-scorer
   Typology risk scores per transaction with per-typology hit counts, plus flagged accounts and clusters from a synthetic transaction graph. Stage 1 of 3. Its execution hash is cited in the session receipt.
2. art-11-vop-batch-match-rate-analyser
   Batch IBAN-name match, close-match and no-match counts with the match rate at the declared strictness, over payee records the caller selects from the flagged accounts. Stage 2 of 3. Its execution hash is cited in the session receipt.
3. cry-05-agent-action-audit-trail-aggregator
   Session receipt: one SHA-256 Merkle root over the ordered execution hashes of the runs above, with per-leaf inclusion proofs. Terminal stage. This step aggregates hashes and carries no compute proof of its own.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A batch of SEPA payees is in front of us. Which records fall into the no-match band when the match threshold is raised to 0.95?
Run the AINumbers MCP tool `run_chain` with {"chain":"aml-typology-vop-mismatch-hunt"} and read `art-11-vop-batch-match-rate-analyser.match_rate_pct`.
Re-run with `inputs` for `art-11-vop-batch-match-rate-analyser`, reusing the values that result echoed, with `match_threshold` set to 0.95. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/aml-typology-vop-mismatch-hunt.html
