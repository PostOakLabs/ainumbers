# Beacon-Seeded Fair-Sampling Deriver V2

Derives a deterministic, offline-replayable audit sample, version 2 of the beacon-seeded fair-sampling family, from a caller-pasted public randomness beacon pulse (drand quicknet or NISTIR-8213) and an item-manifest hash committed before the pulse round, over the same HMAC-DRBG (SHA-256) stream as version 1 (art-583). Version 2 fixes three version 1 defects in a new node rather than editing the proven original: a threshold-rejection reduction replaces the raw modulo so index selection is exactly unbiased; a partial Fisher-Yates walk over an index array consumes exactly sample_size accepted draws with no draw cap, so full samples succeed at any population up to the 1,000,000-item ceiling (version 1's draw cap failed near-full samples above roughly 12,000 items); and both hex inputs are validated as exactly 64 lowercase hex characters, with a structured refusal otherwise. The ceiling commits to a 4 MB index array at maximum population. The emitted per-draw transcript is capped at 50 entries and carries full draws_used and rejection counts, so the artifact stays bounded while the walk remains fully reconstructible offline from the declared inputs alone. The beacon pulse is caller-declared: this kernel does SHA-256/HMAC math only, never fetches a pulse and never verifies its signature. The version 1 node stays untouched and replayable for every receipt already issued against it; new runs should use this node.

- Page: https://ainumbers.co/chaingraph/art-774-beacon-seeded-fair-sampling-v2.html
- Markdown twin: https://ainumbers.co/chaingraph/art-774-beacon-seeded-fair-sampling-v2.md
- MCP tool: derive_beacon_fair_sample_v2 (endpoint https://mcp.ainumbers.co/mcp)

## Page-side pulse signature verification

The web page carries an optional verification layer that the kernel does not have: paste the round's drand signature (48-byte compressed G1, 96 lowercase hex characters, from any drand API or relay) and the page verifies it offline against the pinned drand quicknet group public key using vendored `@noble/curves` BLS12-381 code (MIT, @noble/curves@1.9.7 with @noble/hashes@1.8.0, inlined verbatim; no CDN and no network call). The check hashes the round number (8-byte big-endian) with SHA-256, hashes that onto the G1 curve with the RFC 9380 DST `BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_`, and verifies the BLS signature. Only after the signature verifies does the page derive `randomness = SHA-256(signature)` (drand's own definition) and compare it with the declared `beacon_randomness`, and the signed round with the declared `beacon_round`, reporting VERIFIED, MISMATCH (naming the field), or INVALID SIGNATURE. A pasted randomness value without a signature is refused; it is never evidence on its own. The page also renders the round's wall-clock time (genesis_time 1692803367 plus (round - 1) times the 3-second period) so a reviewer can check the pulse postdates the manifest commitment. This layer proves drand's League of Entropy group signed the round; the residual risk is predictability if a threshold of drand operators collude, not bias (drand's documentation: the network's output is "publicly verifiable, unbiased and unpredictable"). The verification is page-side only: it never enters the artifact, the policy_parameters, or the execution hash, and the derivation itself is unchanged.

## Inputs

- beacon_source (string, required): The public randomness beacon family the pulse came from.
- beacon_round (string, required): The pulse round identifier, exactly as published.
- beacon_randomness (string, required): The pulse's declared randomness value: exactly 64 lowercase hex characters (0-9, a-f), no prefix.
- item_manifest_hash (string, required): Hash of the item manifest committed BEFORE the pulse round: exactly 64 lowercase hex characters (0-9, a-f), without a sha256: prefix.
- item_count (integer, required): Population size. The ceiling commits to a 4 MB index array at maximum.
- sample_size (integer, required): Number of items to select; cannot exceed item_count. 0 or missing is a refusal.
- algorithm_id (string, required): The algorithm id this kernel implements.

## Outputs

- verdict (string, optional)
- reasons (array, optional)
- beacon_source (string,null, optional)
- beacon_round (string,null, optional)
- beacon_randomness (string,null, optional)
- item_manifest_hash (string,null, optional)
- item_count (integer,null, optional)
- sample_size (integer,null, optional)
- algorithm_id (string,null, optional)
- seed_hex (string, optional)
- selected_indices (array, optional)
- draws_used (integer, optional)
- reduction_rejects (integer, optional)
- derivation_transcript (array, optional)
- transcript_truncated (boolean, optional)
- manual_review_required (boolean, optional)

## Sample

```json
{
  "beacon_source": "drand_quicknet",
  "beacon_round": "4321000",
  "beacon_randomness": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "item_manifest_hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "item_count": 10,
  "sample_size": 10,
  "algorithm_id": "hmac-drbg-sha256-v2"
}
```

## Verify

Run the sample policy_parameters through MCP tool `derive_beacon_fair_sample_v2` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
