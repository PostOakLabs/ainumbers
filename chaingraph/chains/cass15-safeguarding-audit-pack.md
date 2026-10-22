# CASS 15 Safeguarding Audit Pack

Three-step safeguarding audit pack for a UK payment or e-money firm under CASS 15. Step 1 classifies each declared funds stream's safeguarding method and records whether the asserted method is coherent on the supplied facts (art-500). Step 2 reconciles the safeguarding requirement against the resource components for the same as-of date, returning a covered, tolerance or shortfall verdict with the gap in minor units (art-499). Step 3 assembles the auditor's evidence pack over the classification and the reconciliation result, itemising each evidence element with its supporting figures (art-501). Each step computes from its own declared inputs; the order is analytical, not a statutory sequence.

- Page: https://ainumbers.co/chaingraph/chains/cass15-safeguarding-audit-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cass15-safeguarding-audit-pack.md

## Workflow chain: CASS 15 Safeguarding Audit Pack

Three-step safeguarding audit pack for a UK payment or e-money firm under CASS 15. Step 1 classifies each declared funds stream's safeguarding method and records whether the asserted method is coherent on the supplied facts (art-500). Step 2 reconciles the safeguarding requirement against the resource components for the same as-of date, returning a covered, tolerance or shortfall verdict with the gap in minor units (art-499). Step 3 assembles the auditor's evidence pack over the classification and the reconciliation result, itemising each evidence element with its supporting figures (art-501). Each step computes from its own declared inputs; the order is analytical, not a statutory sequence.

Domain: BaaS & Embedded Finance

### Steps

1. art-500-classify-safeguarding-method
   Classifies each declared funds stream's safeguarding method and records whether the asserted method is coherent on the supplied facts, returning a per-stream classification with an overall coherence verdict. Stage 1 of 3. Step 2 then reconciles the safeguarding requirement against the resource components for the same as-of date.
2. art-499-check-safeguarding-reconciliation
   Reconciles the safeguarding requirement against the resource components for the declared as-of date, returning a covered, tolerance or shortfall verdict with the residual gap in minor units. Stage 2 of 3. Step 3 then assembles the auditor's evidence pack over that reconciliation.
3. art-501-build-safeguarding-audit-evidence
   Assembles the auditor's evidence pack over the declared classification and reconciliation inputs, itemising each evidence element with its supporting figures and overall pack status. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Month-end safeguarding reconciliation shows a small gap. Is it within tolerance, or a shortfall the auditor has to see?
Run the AINumbers MCP tool `run_chain` with {"chain":"cass15-safeguarding-audit-pack"} and read `art-499-check-safeguarding-reconciliation.verdict`.
Re-run with `inputs` for `art-499-check-safeguarding-reconciliation`, reusing the values that result echoed, with `safeguarding_requirement_minor_units` set to 48260000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/cass15-safeguarding-audit-pack.html
