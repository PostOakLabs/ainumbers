# ORSA Readiness Pack

Deterministic ORSA readiness arithmetic over caller-declared synthetic inputs, checked against the duties inserted into Solvency II by Directive (EU) 2025/2. From a declared required scenario set, a declared scenario run set, and a declared liquidity-plan documentation flag, it computes: scenarios_missing as the required set minus the run set, preserving declared order; liquidity_plan as DOCUMENTED or MISSING; and an overall verdict of READY only when nothing is missing and the plan is documented, else NOT_READY. Optional declared capital-contingency and board sign-off references are echoed into the trace verbatim, never defaulted. Documentary anchor, outside the hashed preimage: transposition deadline 30 January 2027. No undertaking, no risk inventory store, no scenario engine, no supervisor, no network, no clock: every scenario, flag, and reference is a caller-declared input, never fetched or inferred. This is a readiness checker, NOT legal advice, NOT a materiality assessment, NOT a determination that any undertaking's ORSA satisfies the directive, and NOT a supervisory submission: nothing is filed anywhere. An absent or malformed scenario list or flag resolves to a fail-closed payload naming each rejected input, never a silently repaired assessment. Set and flag arithmetic over declared strings and booleans; it computes no numbers and cites no external standard beyond the directive articles recorded in its kernel source.

- Page: https://ainumbers.co/tools/679-orsa-readiness-pack.html
- Markdown twin: https://ainumbers.co/tools/679-orsa-readiness-pack.md
- MCP tool: compute_orsa_readiness_pack (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "scenarios_required": [
    "orderly_transition",
    "disorderly_transition"
  ],
  "scenarios_run": [
    "orderly_transition"
  ],
  "liquidity_plan_documented": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_orsa_readiness_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
