# Regulatory Change Operationalisation

A four-stage regulatory change operationalisation workflow over caller-declared change and obligation data. Step 1 builds the 12-month regulatory change calendar, the effort and impact matrix and the change register for the declared institution type, jurisdiction and product scope (tool 318). Step 2 scores the obligations register for owner, control and evidence coverage and returns one verdict, COVERED or GAPS_FOUND, naming every obligation that still lacks an owner or evidence (art-691). Step 3 maps the obligation set onto the compliance control book as a control heatmap, a maturity score and a Policy Mandate control register (tool 158). Step 4 sweeps the dated compliance records into OVERDUE, DUE_SOON, SCHEDULED and DONE bands under the declared weekend and holiday roll rules, so a change programme that still has unowned obligations or already-missed dates is visible rather than implied. Each step computes from its own declared inputs; the order is analytical, not a statutory sequence.

- Page: https://ainumbers.co/chaingraph/chains/regulatory-change-operationalisation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/regulatory-change-operationalisation.md

## Workflow chain: Regulatory Change Operationalisation

A four-stage regulatory change operationalisation workflow over caller-declared change and obligation data. Step 1 builds the 12-month regulatory change calendar, the effort and impact matrix and the change register for the declared institution type, jurisdiction and product scope (tool 318). Step 2 scores the obligations register for owner, control and evidence coverage and returns one verdict, COVERED or GAPS_FOUND, naming every obligation that still lacks an owner or evidence (art-691). Step 3 maps the obligation set onto the compliance control book as a control heatmap, a maturity score and a Policy Mandate control register (tool 158). Step 4 sweeps the dated compliance records into OVERDUE, DUE_SOON, SCHEDULED and DONE bands under the declared weekend and holiday roll rules, so a change programme that still has unowned obligations or already-missed dates is visible rather than implied. Each step computes from its own declared inputs; the order is analytical, not a statutory sequence.

Domain: Audit & Assurance

### Steps

1. 318-regulatory-change-impact-assessor
   Builds the 12-month regulatory change calendar, the effort and impact matrix and the change register for the declared institution type, jurisdiction and product scope; step 2 then scores the obligations register for owner, control and evidence coverage. Stage 1 of 4.
2. art-691-regulatory-obligations-register
   Scores the declared obligations register for owner assignment, control linkage and evidence coverage, returning one verdict of COVERED or GAPS_FOUND and naming every obligation that still lacks an owner or evidence; step 3 then maps the obligation set onto the compliance control book. Stage 2 of 4.
3. 158-fintech-compliance-control-mapper
   Maps the declared obligations onto the compliance control book across the declared regimes, producing the control heatmap, the maturity score and the Policy Mandate control register; step 4 then sweeps the dated compliance records for what is already overdue. Stage 3 of 4.
4. art-588-docket-deadline-sweep
   Sweeps the declared dated records against the caller-declared weekend and holiday roll rules, banding each record OVERDUE, DUE_SOON, SCHEDULED or DONE so a change programme with already-missed dates is visible rather than implied. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A rule lands next quarter. Which of its obligations still have no owner or evidence, and which dates are already overdue?
Run the AINumbers MCP tool `run_chain` with {"chain":"regulatory-change-operationalisation"} and read `art-691-regulatory-obligations-register.overall_determination`.
Re-run with `inputs` for `art-691-regulatory-obligations-register`, reusing the values that result echoed, with `input_parameters` changed so assign an owner and at least one evidence reference to every obligation in the register. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/regulatory-change-operationalisation.html
