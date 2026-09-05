---
description: Validate a C2PA manifest and AI Act Art. 50 marking in the page, replay the content-credential chain remotely, and anchor the disclosure manifest to Bitcoin.
---

# Is this asset real, AI-marked, and provably timestamped?

A marketing team is about to publish an AI-generated product image with a C2PA manifest. Decide if it can ship, and give them proof.

1. On https://ainumbers.co/chaingraph/art-123-c2pa-manifest-validator.html, run the WebMCP tool with the page's synthetic manifest. Record verdict + execution_hash.
2. On art-126, run check_ai_act_art50_marking with the same manifest's assertion set. On art-127, run verify_dual_layer_disclosure. Record both hashes.
3. Call run_chain on content-credential-verification (art-123 > art-124 > art-125) remotely with the same synthetic manifest. Compare the art-123 step hash to your in-page hash from step 1 and state whether they are identical.
4. Call build_disclosure_manifest over the five artifacts. Then call verify_disclosure_inclusion for the art-126 artifact and show the inclusion path.
5. Call anchor_hash with the disclosure manifest root on OpenTimestamps. Then call upgrade_ots_proof and report whether the proof is still pending or already Bitcoin-attested (pending is expected within the first hours; say so).
6. Build the ledger link for the composite chain artifact. Open it and report the §17 kernel identity and §18 compute proof lines.
7. Write the publish decision: ship / do not ship, the Art. 50 findings, and a verification recipe a journalist could follow without contacting us (ledger link, OTS proof, kernel digest).

---

Finish by stating the execution_hash you received and the ledger link a human can verify it at.
