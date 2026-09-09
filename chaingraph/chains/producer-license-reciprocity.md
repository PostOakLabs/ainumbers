# Producer License Reciprocity

Linear one-step chain checking NAIC producer license reciprocity for non-resident filing across target states. Identifies non-standard states (CA, FL, NJ, NY, HI, MN, WI) requiring independent filing, background checks, or state exams outside the standard reciprocity path. Per NAIC MDL-218 and NIPR Reciprocity Matrix 2024. State codes and LOA enum inputs only. Zero PII by construction.

- Page: https://ainumbers.co/chaingraph/chains/producer-license-reciprocity.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/producer-license-reciprocity.md

## Workflow chain: Producer License Reciprocity

Linear one-step chain checking NAIC producer license reciprocity for non-resident filing across target states. Identifies non-standard states (CA, FL, NJ, NY, HI, MN, WI) requiring independent filing, background checks, or state exams outside the standard reciprocity path. Per NAIC MDL-218 and NIPR Reciprocity Matrix 2024. State codes and LOA enum inputs only. Zero PII by construction.

Domain: Financial Crime & KYC

### Steps

1. art-267-check-producer-license-reciprocity
   NAIC reciprocity check: all_reciprocal (bool), non_standard_states[], coverage_by_target[] with per-state reciprocal flag and LOA gaps. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
