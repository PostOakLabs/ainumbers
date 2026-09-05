---
description: Run an agentic purchase under a signed Work Mandate and prove the policy governed every step.
---

# Agent buys under a signed policy, and proves the policy governed

Act as a procurement agent operating under a signed spend policy. Produce a receipt that proves the policy governed every step.

1. Call find_chain with "agent commerce conformance" and pick the chain named agent-commerce-conformance. Call build_chaingraph on it and list each step's required policy_parameters.
2. Draft a Work Mandate (OCG §22): principal "treasury-ops", agent "procurement-bot-01", scope limited to this chain, per-transaction cap 2,500 EUR, validity 24h from now. Call vc_issue to sign it, then show me the mandate_hash.
3. Call run_chain on agent-commerce-conformance with escalation_transport "resolve_handle", passing the signed mandate and synthetic inputs where a cart total of 3,100 EUR breaches the cap. Report per-step status, the composite execution_hash, and the escalation record with its record_hash and resolve handle.
4. Re-run with a 1,900 EUR cart. Report the composite hash and confirm no escalation.
5. For the compliant run, call verify_execution_hash on the composite artifact, then emit_chaingraph_artifact to get the in-toto link set. Confirm each link's materials equal the previous step's products.
6. Open the ledger_url for the compliant run. Report what the §21 gate replay shows and whether the §16 signature and mandate_hash check pass.
7. Now prove the counterparty would accept the agent: on https://ainumbers.co/chaingraph/art-129-webbotauth-signature-verifier.html, use the page's WebMCP tool to verify a WebBotAuth-signed request header for procurement-bot-01 (synthetic sample). Record the hash.
8. Call build_session_receipt over all hashes in order (mandate, both runs, identity check) and anchor the root with anchor_hash (FreeTSA RFC 3161). Return the session root, the anchor receipt, and a five-line summary: who authorised, what ran, where it breached, what a human still has to close out (the open resolve handle).

---

Finish by stating the execution_hash you received and the ledger link a human can verify it at.
