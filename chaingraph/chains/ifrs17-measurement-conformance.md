# IFRS 17 Measurement Conformance

Classify insurance contracts to GMM/VFA/PAA measurement model from coverage period and direct-participating features (art-177) -> validate CSM roll-forward mechanics and flag onerous contracts where computed closing CSM is negative (art-178) -> check risk-adjustment disclosure technique, confidence level, and onerous-contract loss-component recognition (art-179). Full IFRS 17 measurement conformance pipeline. IFRS 17 live Jan 1 2023; mandatory for all IFRS reporters.

- Page: https://ainumbers.co/chaingraph/chains/ifrs17-measurement-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ifrs17-measurement-conformance.md

## Workflow chain: IFRS 17 Measurement Conformance

Classify insurance contracts to GMM/VFA/PAA measurement model from coverage period and direct-participating features (art-177) -> validate CSM roll-forward mechanics and flag onerous contracts where computed closing CSM is negative (art-178) -> check risk-adjustment disclosure technique, confidence level, and onerous-contract loss-component recognition (art-179). Full IFRS 17 measurement conformance pipeline. IFRS 17 live Jan 1 2023; mandatory for all IFRS reporters.

Domain: Insurance & Reinsurance

### Steps

1. art-177-ifrs17-measurement-model-classifier
   Measurement model classification feeds CSM roll-forward validator
2. art-178-ifrs17-csm-rollforward-validator
   CSM roll-forward verdict feeds risk-adjustment checker
3. art-179-ifrs17-risk-adjustment-checker
   Exports risk-adjustment validity and onerous-contract flags with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
