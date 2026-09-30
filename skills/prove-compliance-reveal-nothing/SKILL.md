---
name: prove-compliance-reveal-nothing
description: "Prove a transaction passes sanctions and travel-rule predicates without disclosing the transaction. Use when you are walking a role through a full scenario and want the evidence captured at each step. Written for the privacy cryptographer audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "prove-compliance-reveal-nothing"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Prove compliance without revealing the transfers

Prove a transaction passes sanctions and travel-rule predicates without disclosing the transaction.

## Prompt

Prove a transfer batch passes travel-rule and sanctions predicates while revealing as little as possible.

1. Call validate_private_inputs to learn which fields of validate_tfr_travel_rule_batch are declared private under the §25 ocg-private-input profile. Quote the list.
2. Build a synthetic 5-transfer batch. Call generate_zk_compliance_proof with predicate_type set to the travel-rule completeness predicate and the batch as private data; record the proof and the public statement. Confirm the public statement contains no originator or beneficiary fields.
3. Call validate_tfr_travel_rule_batch on the same batch and confirm its verdict matches the proof's statement. Record both execution_hashes.
4. Call aggregate_ownership_50pct on a synthetic ownership graph with one 50%-rule hit; then sdjwt_issue a credential asserting only "sanctions_predicate: PASS" and sdjwt_present it with every other claim withheld. Show the presentation and which claims are disclosed.
5. Call validate_canton_selective_disclosure with a synthetic DvP where each party sees only its leg; confirm the attestation reconciles without either party's full view.
6. Call verify_merkle_batch on the batch's audit root and one inclusion proof.
7. build_session_receipt over every hash; give me the ledger link. Then list, precisely, what a verifier of that receipt learns about the underlying transfers (it should be: the predicates, the hashes, nothing else) and what they would need to trust.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.
GPU note: the generate_zk_compliance_proof tool computes in your browser, so the MCP endpoint returns no execution_hash; export the Policy Mandate artifact the page produces and pass that full artifact to verify_execution_hash as claimed_hash.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
