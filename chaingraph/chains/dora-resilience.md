# DORA Operational Resilience Chain

Classify ICT incidents → model ICT concentration risk → simulate cascade failure propagation → build ICT TPP register → assess TLPT scope and design resilience tests → track NCA submission and score full DORA readiness. End-to-end DORA Article 5-30 operational resilience journey.

- Page: https://ainumbers.co/chaingraph/chains/dora-resilience.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/dora-resilience.md

## Workflow chain: DORA Operational Resilience Chain

Classify ICT incidents → model ICT concentration risk → simulate cascade failure propagation → build ICT TPP register → assess TLPT scope and design resilience tests → track NCA submission and score full DORA readiness. End-to-end DORA Article 5-30 operational resilience journey.

Domain: DORA / NIS2 / ICT Resilience

### Steps

1. 303-dora-incident-classification-engine
   incident_class,reporting_deadlines feed Stage 2 concentration risk
2. rbe-11-dora-incident-classifier
   incident_severity,rts_criteria_flags,compound_major_check feed Stage 2 concentration modelling
3. 306-dora-ict-concentration-risk-modeller
   hhi_index,spof_flags,ctpp_exposure feed Stage 3 ICT cascade simulation
4. pnr-01-dora-ict-cascade-simulator
   cascade_probability,breach_time_p95,affected_nodes feed Stage 4 TPP register
5. 358-dora-ict-tpp-register-builder
   tpp_register_json,critical_providers,ctpp_flagged feed Stage 5 TLPT scope
6. 359-dora-tlpt-scope-assessor
   tlpt_in_scope,testing_frequency,threat_led_required feed Stage 5 resilience design
7. 304-dora-resilience-testing-designer
   test_plan,scenario_library,bcp_test_schedule feed Stage 6 NCA submission
8. 308-dora-nca-submission-tracker
   submission_status,deadline_compliance feed Stage 6 readiness score
9. art-29-dora-readiness-diagnostic
   readiness_score,remediation_roadmap - Exports DORA resilience mandate - final stage. GATE: grade='F' escalates to human review (OCG §22.8), mirroring dora-escalation-demo's proven shape on the same kernel.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
