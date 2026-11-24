# AI Agent Incident Across Regimes

A four-stage review of one caller-declared agent incident across three regulatory regimes. Step 1 applies the DORA major-incident numeric criteria to the declared impact figures and reports a major or non-major classification with the reporting clock a major finding starts (art-467). Step 2 then scores the declared disruption, affected-user and loss figures against the NIS2 significance criteria and reports a significance verdict (art-144). Step 3 then starts the clock obligations for the regimes the caller declares applicable from one determination timestamp (art-428). Step 4 then validates the declared agent audit-trail records and returns a conformance result (art-237). Each step computes from its own declared inputs; the order is a review sequence, not a statutory one, and the chain determines no reporting obligation.

- Page: https://ainumbers.co/chaingraph/chains/ai-agent-incident-multi-regime.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-agent-incident-multi-regime.md

## Workflow chain: AI Agent Incident Across Regimes

A four-stage review of one caller-declared agent incident across three regulatory regimes. Step 1 applies the DORA major-incident numeric criteria to the declared impact figures and reports a major or non-major classification with the reporting clock a major finding starts (art-467). Step 2 then scores the declared disruption, affected-user and loss figures against the NIS2 significance criteria and reports a significance verdict (art-144). Step 3 then starts the clock obligations for the regimes the caller declares applicable from one determination timestamp (art-428). Step 4 then validates the declared agent audit-trail records and returns a conformance result (art-237). Each step computes from its own declared inputs; the order is a review sequence, not a statutory one, and the chain determines no reporting obligation.

Domain: AI & Agent Governance

### Steps

1. art-467-dora-incident-classifier
   Applies the DORA Art. 18 numeric criteria over clients affected, duration, geographical spread, data losses, economic impact, critical services and reputational impact to the declared figures and reports a major or non-major classification with the reporting clock a major finding starts; step 2 then scores the same incident against the NIS2 significance criteria. Stage 1 of 4.
2. art-144-nis2-incident-significance-scorer
   Scores the declared disruption, affected-user and loss figures against the NIS2 significance criteria and reports a significance verdict with the authorities it names; step 3 then starts the clock obligations for the regimes the caller declares applicable. Stage 2 of 4.
3. art-428-cyber-incident-clock
   Starts the clock obligations for the regimes the caller declares applicable from one hash-anchored determination timestamp, giving each obligation its own attestation slot and stable obligation id; step 4 then validates the declared agent audit-trail records. Stage 3 of 4.
4. art-237-validate-agent-audit-trail
   Validates the declared agent audit-trail records, checking required fields, chain-link format, signature presence and enum conformance, and returns a conformance result with a completeness score. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: An agent outage disrupted service for four hours and hit 5,000 users. Does the NIS2 scorer call the incident significant, and do reporting clocks start?
Run the AINumbers MCP tool `run_chain` with {"chain":"ai-agent-incident-multi-regime"} and read `art-144-nis2-incident-significance-scorer.significance_verdict`.
Re-run with `inputs` for `art-144-nis2-incident-significance-scorer`, reusing the values that result echoed, with `service_disruption_hours` set to 0.5. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ai-agent-incident-multi-regime.html
