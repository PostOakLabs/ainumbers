---
description: Run a CECL workflow on a loopback-only Helm daemon, hit the consent-tier boundary at evidence export, and cross-check the kernel against the public worker.
---

# Air-gapped control plane: the agent runs it, the human releases it, the bundle verifies without us

You are connected to a local Helm daemon at 127.0.0.1:4173. Run a CECL allowance workflow end to end, prove it, and get the evidence out the only way the daemon allows.

1. Call catalog.search with "cecl". Pick the quarterly allowance pack. Call workflow.describe and workflow.manifest_get; list the nodes, the gates, and the manifest digest.
2. Call workflow.dry_run on it (declare the io.modelcontextprotocol/tasks extension). Poll tasks/get until status is completed. Report the execution_hash.
3. Call workflow.run on the same pack. Poll to completion. Report the execution_hash and whether it equals the dry run's.
4. Call artifact.get and then artifact.verify on the real run. Report the per-step digests and the replay verdict.
5. Attempt evidence.export with no ticket. Quote the error verbatim. Then tell me exactly what the human at the Helm UI has to do to mint a consent ticket, and wait for me to paste it.
6. Once I paste the ticket, call evidence.export with it. Save the digest-level record.
7. Cross-check the law: find the same kernel on mcp.ainumbers.co (find_tool "CECL allowance"), call it with the pack's sample inputs, and compare the kernel_digest and execution_hash to the Helm run. State whether the local daemon and the public worker agree.
8. Call anchor_hash on the Helm run's execution_hash (Sigstore TSA). Return the receipt.
9. Write the handover: what ran locally, what never left the machine, where the human consent sat in the flow, and how an auditor verifies the bundle offline with `helmd verify <bundle> --keys <publicKeys.json>` and no network.

---

Finish by stating the execution_hash you received and the ledger link a human can verify it at.
