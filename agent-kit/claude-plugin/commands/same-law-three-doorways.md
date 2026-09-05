---
description: Prove one tool gives the same execution_hash in-page, at the edge, and under a zk receipt.
---

# Same law, three doorways

You are on an AINumbers node page. Prove that this tool gives the same answer no matter which door you use.

1. List the tools this page registers via WebMCP. Note the tool name.
2. Run that tool IN THE PAGE with the page's own synthetic sample (use the declared inputSchema; do not invent fields). Record the verdict and the execution_hash. Confirm the DevTools Network tab shows zero requests during the call.
3. Call the SAME tool name on mcp.ainumbers.co with the identical inputs. Record its execution_hash.
4. Call verify_execution_hash on the remote artifact. Then compare the two hashes character by character and state whether they are equal.
5. Fetch this node's entry from https://ainumbers.co/chaingraph/chaingraph.json. Report compute_proof.system, receiptFormat, and journal.kernel_digest, and confirm the kernel_digest equals the sha256-source image_id in compute_images.
6. Flip one byte in the signature field of the sample and re-run in the page. Report the new verdict and show the hash changed.
7. Call build_session_receipt with the two matching hashes in call order. Record session_receipt_root.
8. Call anchor_hash on anchor.ainumbers.co with session_receipt_root using the OpenTimestamps authority. Return the anchor receipt.
9. Give me the ledger_url from the remote run, and a one-paragraph statement a regulator could read: which code ran (kernel_digest), where (three doorways), what it decided, and where the timestamp lives.

---

Finish by stating the execution_hash you received and the ledger link a human can verify it at.
