# Beacon-Seeded Fair-Sampling Deriver

Derives a deterministic, offline-replayable audit sample by HMAC-DRBG (SHA-256) seeded from a caller-pasted public randomness beacon pulse (drand quicknet or NISTIR-8213) combined with an item-manifest hash committed before the pulse round. Emits the selected item indices plus a full per-draw derivation transcript (seed, per-draw HMAC output, candidate index, accept/reject) so an examiner re-derives the identical sample offline from the transcript alone. Verdict DERIVED, or INDETERMINATE when inputs are missing or malformed. The beacon pulse, its round and its randomness are caller-declared inputs: the kernel performs SHA-256/HMAC math only, never fetches a pulse and never verifies the pulse's BLS signature, so a sample is only as trustworthy as the pulse the caller supplied. Committing the item-manifest hash before the pulse round is what makes the selection cherry-pick-proof, and the page teaches that ordering. Extends the assurance and workpaper family; cross-links the shipped art-471 disposition-sampling-frame rather than duplicating it.

- Page: https://ainumbers.co/chaingraph/art-583-beacon-seeded-fair-sampling-deriver.html
- Markdown twin: https://ainumbers.co/chaingraph/art-583-beacon-seeded-fair-sampling-deriver.md
- MCP tool: derive_beacon_fair_sample (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- algorithm_id (unknown, required)
- beacon_randomness (unknown, required)
- beacon_round (unknown, required)
- beacon_source (unknown, required)
- item_count (unknown, required): Count
- item_manifest_hash (unknown, required)
- sample_size (unknown, required)

## Outputs

- algorithm_id (string, optional)
- beacon_randomness (string, optional)
- beacon_round (string, optional)
- beacon_source (string, optional)
- derivation_transcript (array, optional)
- draws_used (integer, optional)
- item_count (integer, optional)
- item_manifest_hash (string, optional)
- sample_size (integer, optional)
- seed_hex (string, optional)
- selected_indices (array, optional)
- verdict (string, optional)

## Sample

```json
{
  "beacon_source": "drand_quicknet",
  "beacon_round": "4321000",
  "beacon_randomness": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85",
  "item_manifest_hash": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "item_count": 250,
  "sample_size": 10,
  "algorithm_id": "hmac-drbg-sha256-v1"
}
```

## Verify

Run the sample policy_parameters through MCP tool `derive_beacon_fair_sample` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
