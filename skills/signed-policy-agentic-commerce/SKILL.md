---
name: signed-policy-agentic-commerce
description: "Run an agentic commerce chain under a signed Work Mandate, trip the escalation gate on purpose, and replay the gates on the ledger. Use when you want one run that shows the same tool returning the same answer through every AINumbers doorway. Written for the agentic commerce audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "signed-policy-agentic-commerce"
  verify_surface: "https://ledger.ainumbers.co/ https://ainumbers.co/chaingraph/art-129-webbotauth-signature-verifier.html https://anchor.ainumbers.co/mcp"
  version: "8770e0e5aba5"
---

# An agent buys under a signed policy and proves the policy governed

Run an agentic commerce chain under a signed Work Mandate, trip the escalation gate on purpose, and replay the gates on the ledger.

## Prompt

Act as a procurement agent operating under a signed spend policy. Produce a receipt that proves the policy governed every step. Every server call goes to https://mcp.ainumbers.co/mcp.

The Work Mandate below is synthetic and its signing key comes from a published test seed, so anyone can re-derive the key and re-sign the mandate: take the SHA-256 digest of the ASCII string ainumbers-showcase-mandate-test-key as the 32-byte Ed25519 seed, which yields did:key:z6MknHY2vWeuwJBynEVZEzqfNFuQhBKKUDEyPMdT3Ly9ZVCm. Send the mandate exactly as written, because a single changed byte invalidates the signature. It is valid from 27 September 2026 to 27 September 2028.

MANDATE = {"chaingraph_version":"0.4.0","mandate_type":"work_mandate","tool_id":"work-mandate","generated_at":"2026-09-27T00:00:00Z","policy_parameters":{},"output_payload":{"mandate_type":"work_mandate","scope":{"tool_ids":[],"chains":["agent-commerce-conformance","escalation-sla-supervised-autonomy-receipt"]},"conditions":[],"escalation_triggers":[],"validity":{"not_before":"2026-09-27T00:00:00Z","not_after":"2028-09-27T00:00:00Z"},"principal":{"id":"did:key:z6MknHY2vWeuwJBynEVZEzqfNFuQhBKKUDEyPMdT3Ly9ZVCm"}},"execution_hash":"3c4509eea7acc8c8298cb155ad4ca2a931c2fa4296b57d1cc89d01a92ba1f1cc","audit_signature":{"proof":{"type":"DataIntegrityProof","cryptosuite":"eddsa-jcs-2022","verificationMethod":"did:key:z6MknHY2vWeuwJBynEVZEzqfNFuQhBKKUDEyPMdT3Ly9ZVCm","proofPurpose":"assertionMethod","created":"2026-09-27T00:00:00Z","proofValue":"zfvEY9FAuQLwwMeGqp7a8vpj68aMnYFsRuLrZMfGsfWqLWoC2LZpT7h91qdXoSxjMCckGaZqg3wmVikgMDPZR9o1"}}}

1. Call find_chain with "agent commerce conformance" and pick the entry whose chain_name is agent-commerce-conformance. List its four steps from that result and say which ones are callable server-side.
2. Call run_chain with chain agent-commerce-conformance, compute "server" and no mandate. Report every step's execution_hash and the composite execution_hash. This is the baseline nobody authorised.
3. Call run_chain again on the same chain with compute "server" and mandate MANDATE. Report every step's execution_hash and the composite. Then explain the difference: run_chain verifies the §16 eddsa-jcs-2022 signature, takes mandate_hash from the mandate's own execution_hash, and folds that hash into each step's policy_parameters and into the composite preimage under §22.5 conditional presence. The run without a mandate stays byte-identical to the pre-binding baseline, so the two composites differing is the proof that a policy was in force.
4. Recompute the mandated composite yourself. Call verify_execution_hash with policy_parameters taken from that run's composite_artifact.policy_parameters, with output_payload built as { chain, steps } from the same artifact's output_payload, and with claimed_hash set to the composite execution_hash. Leave step_compliance_flags out of output_payload, because §22.8.2 adjacent metadata sits outside the hash preimage. Confirm valid is true and that mandate_hash is one of the policy_parameters you just hashed. Then repeat the step 3 call unchanged and confirm the composite and dedupe.input_hash come back identical.
5. Call run_chain with chain escalation-sla-supervised-autonomy-receipt, compute "server", the same MANDATE and escalation_transport "resolve_handle". This chain carries a §21 gate on art-67. Report the run status, the gate decision with the value it read, which step was skipped, and the escalation record with its record_hash. Confirm the record carries the same mandate_hash as the step receipts, so the open item names the policy it was opened under.
6. Change one character inside MANDATE's scope, such as the last letter of the first chain name, and call run_chain on agent-commerce-conformance again. Quote the error verbatim and say at which point the run stopped.
7. Open the ledger_url from the mandated commerce run in step 3. Report what the §21 gate replay shows and whether the §16 signature check and the mandate_hash binding pass in the browser.
8. Now show the counterparty would accept the agent: on https://ainumbers.co/chaingraph/art-129-webbotauth-signature-verifier.html, use the page's WebMCP tool on the page's own synthetic sample to verify a WebBotAuth signed request header. Record the execution_hash and confirm DevTools shows no request leaving the tab.
9. Call build_session_receipt over four hashes in call order: the unmandated composite, the mandated composite, the escalated chain's composite, and the in-page identity hash. Anchor the root with anchor_hash on https://anchor.ainumbers.co/mcp using the FreeTSA RFC 3161 authority. Return the session root, the anchor receipt, and a five-line summary covering who authorised the work, which code ran, where the gate halted it, the mandate hash that binds all of it, and what a person still has to close out through the open resolve handle. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Arguments

| name | required | what it is |
| --- | --- | --- |
| `chain_id` | no | Chain to run, default agent-commerce-conformance |
| `per_transaction_cap` | no | Work Mandate per-transaction cap in EUR, default 2500 |
| `breach_cart_total` | no | Cart total that breaches the cap in the escalated run, default 3100 |

### Verify what came back

- https://ledger.ainumbers.co/
- https://ainumbers.co/chaingraph/art-129-webbotauth-signature-verifier.html
- https://anchor.ainumbers.co/mcp
