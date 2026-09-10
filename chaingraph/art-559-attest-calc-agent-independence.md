# Calculation-Agent Independence Attestation

Receipts the organizational-independence claim a parametric trigger's neutrality depends on: that the entity whose kernel computed a specific art-251/art-252/art-309 execution_hash declares no controlling or compensating relationship with a named interested party (cedant, sponsor, reinsurer, or other) to the outcome that trigger determines. Self-declared attestation only - exactly like art-373's declared inputs and art-306's self-asserted reputation field - it attests that independence was DECLARED, never that it was verified against an external corporate registry. A counterparty party_id is plaintext by default; a caller may instead supply it as a sha256-salted@1 commitment (SPEC.md §25) to withhold the identifier while still binding the attestation to it. Not a determination of independence and not a legal or regulatory finding - a citable record of what was declared, and to which specific trigger computation. Distinct from art-306, which scores AI-agent execution-evidence completeness for underwriter pricing and produces no independence claim. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-559-attest-calc-agent-independence.html
- Markdown twin: https://ainumbers.co/chaingraph/art-559-attest-calc-agent-independence.md
- MCP tool: attest_calc_agent_independence (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- calc_agent_id (string, optional)
- interested_parties (array, optional)
- relationship_declaration (string, optional)
- disclosure_note (string, optional)
- trigger_ref (object, optional)

## Outputs

- calc_agent_id (string, optional)
- interested_parties (array, optional)
- relationship_declaration (string,null, optional)
- disclosure_note (string,null, optional)
- trigger_ref (object, optional)
- independence_asserted (boolean, optional)
- rejected_inputs (array, optional)
- note (string, optional)

## Sample

```json
{
  "calc_agent_id": "did:web:calcagent-example.test",
  "interested_parties": [
    {
      "party_role": "cedant",
      "party_id": "cedant-example-co"
    },
    {
      "party_role": "sponsor",
      "party_id": "sponsor-example-spv"
    }
  ],
  "relationship_declaration": "none",
  "trigger_ref": {
    "execution_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "tool_id": "art-251-compute-parametric-trigger-payout"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `attest_calc_agent_independence` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
