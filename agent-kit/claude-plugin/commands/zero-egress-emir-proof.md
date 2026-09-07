---
description: Run four EMIR Refit validators inside the browser tab, pack and anchor only the hashes, and hand a supervisor the re-verification recipe.
---

# Regulatory proof without the data leaving the browser

You are a trade-reporting agent at an EU counterparty. The trade report is confidential: it must not leave this machine. Prove readiness anyway.

1. Take the synthetic EMIR Refit auth.030 sample from the art-158 page. Do NOT paste it into any remote call at any point.
2. On each page, invoke the WebMCP-registered tool in the page with that sample:
   - art-154 check_emir_uti_completeness
   - art-155 validate_emir_upi
   - art-157 validate_emir_lifecycle_event
   - art-158 run_emir_reporting_fit
   Record each verdict and execution_hash. Confirm zero network requests during each call.
3. Call verify_execution_hash on mcp.ainumbers.co for each artifact, sending ONLY the artifact (policy_parameters + output_payload as emitted by the page). State whether every recompute matches.
4. Call build_evidence_pack with the four hashes, labelled by node, plus the four kernel_digest values from chaingraph.json.
5. Call anchor_batch on anchor.ainumbers.co with the four hashes and the pack digest. Use two authorities: Sigstore TSA and OpenTimestamps.
6. Build the ledger fragment link for the art-158 artifact and open it. Report the verify chips.
7. Write the cover note for the trade repository: which checks ran, on which kernel versions, that the report content never left the workstation, and how a supervisor re-verifies with no access to us (ledger link + anchor receipt + kernel_digest).

---

Finish by stating the execution_hash you received and the ledger link a human can verify it at.
