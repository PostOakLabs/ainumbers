# Treasury Account Lifecycle (eBAM)

Gated two-step chain for TMS account lifecycle straight-through processing. Step 1 validates the CGI-MP eBAM 2023 acmt state machine (acmt.007/010/011/017/019) and detects orphan messages. Gate on /acmt_state: OPENING_CONFIRMED -> Step 2 (IHB interest pool onboarding for the new account). All other states (CLOSURE_CONFIRMED, MODIFICATION_CONFIRMED, PENDING, INVALID) -> END. Automates TMS account lifecycle STP with automatic pool interest setup for newly confirmed accounts. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/treasury-account-lifecycle-ebam.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/treasury-account-lifecycle-ebam.md

## Workflow chain: Treasury Account Lifecycle (eBAM)

Gated two-step chain for TMS account lifecycle straight-through processing. Step 1 validates the CGI-MP eBAM 2023 acmt state machine (acmt.007/010/011/017/019) and detects orphan messages. Gate on /acmt_state: OPENING_CONFIRMED -> Step 2 (IHB interest pool onboarding for the new account). All other states (CLOSURE_CONFIRMED, MODIFICATION_CONFIRMED, PENDING, INVALID) -> END. Automates TMS account lifecycle STP with automatic pool interest setup for newly confirmed accounts. ZERO PII BY CONSTRUCTION.

Domain: Corporate Treasury & FX

### Steps

1. art-262-validate-ebam-acmt-flow
   CGI-MP eBAM 2023 acmt state machine validation. Orphan detection. Emits acmt_state (OPENING_CONFIRMED/CLOSURE_CONFIRMED/MODIFICATION_CONFIRMED/PENDING/INVALID). GATE: OPENING_CONFIRMED -> art-260. All others -> END.
2. art-260-allocate-ihb-interest
   IHB pool interest allocation for newly confirmed account. OECD TP arm's-length rate, ACT/360. Per-member interest schedule. Only reached for OPENING_CONFIRMED accounts entering the notional pool. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our correspondent account maintenance messages went out overnight. Did any report arrive without the request that authorised it?
Run the AINumbers MCP tool `run_chain` with {"chain":"treasury-account-lifecycle-ebam"} and read `art-262-validate-ebam-acmt-flow.is_valid`.
Re-run with `inputs` for `art-262-validate-ebam-acmt-flow`, reusing the values that result echoed, with `acmt_messages` changed so one report arrives with no matching request. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/treasury-account-lifecycle-ebam.html
