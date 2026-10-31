# Witness Cosignature Verifier

Verifies a C2SP tlog-checkpoint + witness-cosignature note (SPEC.md §20.2) offline: confirms the note's origin and root match a §20/§20.1 batch anchor's declared anchored_hash, then checks each pinned witness's cosignature against a k-of-n threshold. Supports both Ed25519 cosignature/v1 and ML-DSA-44 (the suite §20.2 names alongside it under the §PQC-1 reserved-extension discipline). Consumes a caller-supplied checkpoint note (e.g. from a c2sp.org/tlog-proof bundle), verify-side only, zero log operation, zero network fetch. Golden fixtures dogfood the tool's own output, including a tampered negative fixture that must fail. States only that ≥k pinned witnesses signed this root; does not establish log honesty, key ownership, or leaf inclusion (see art-280/art-279 and SPEC.md §20.1 for those checks).

- Page: https://ainumbers.co/chaingraph/art-424-witness-cosignature-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-424-witness-cosignature-verifier.md
- MCP tool: verify_witness_cosignatures (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- anchored_hash (any, required): type not evidenced by kernel source
- checkpoint_note (any, required): type not evidenced by kernel source
- consistency_proof (any, required): type not evidenced by kernel source
- log_origin (any, required): type not evidenced by kernel source
- mode (any, required): type not evidenced by kernel source
- new_checkpoint_note (any, required): type not evidenced by kernel source
- old_checkpoint_note (any, required): type not evidenced by kernel source
- threshold (any, required): type not evidenced by kernel source
- witness_keys (any, required): type not evidenced by kernel source

## Outputs

- __async (boolean, optional)
- anchored_hash (string, optional)
- checks (array, optional)
- log_origin (string, optional)
- mode (string, optional)
- not_proven (array, optional)
- parsed (object, optional)
- threshold (integer, optional)
- witness_keys (array, optional)

## Sample

```json
{
  "anchored_hash": "fb3a04aedb19b463bab1f89257fbf8509488ca8c22b04f21be3c34ab9f9b0f7f",
  "log_origin": "example.com/mldsa-log",
  "checkpoint_note": "example.com/mldsa-log\n1\n+zoErtsZtGO6sfiSV/v4UJSIyowisE8hvjw0q5+bD38=\n\n— example.com/mldsa-log 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\n— witness-ed25519-1 4c7zpQAAAABo53gATl0skabIPXzYhqm5sNdo+a/laUSXypqDs37O3csLDL2sqnH56KKuNcEN2g2I362LsKkEG6W49OJyL2eTIlvnDQ==\n",
  "witness_keys": [
    {
      "name": "example.com/mldsa-log",
      "algorithm": "ml-dsa-44",
      "public_key_b64": "6G1wv3uXd1yK2Nnxj0nniCZDVNaf8EwXTJ48qlPOGUUKQ3qi4kN/72RP3C97j9j4kZcFSOVG+S0DKdnpc5BI7585rHI85ADCu1tkphedlZJCP2Ac/PXyrpuudyRS/ztGyT+bkYgG8fwnfKbFmNRBL4OcBQhty0uwbYMPoj+i7Qm1ek8u98aE8NOTBz1B4XIEsFrTY+v265YIyiFyIupGIVSjn6V5RQMptrWDlNiM6Mr9Up+e2l1sTCiqFMlMbhquaNR5d2tgMd5poxoICdbkXSUxZiweOrNGkqN5OOAi2x5pYpKb6Br+bNMCCqxujk5v8DBpd/gC/v+Y35kzq8c4380Tsinm+lekKI1v1hsRBq+f5+M25wXF98Jpy/NeCG9ppD7cL/mHmWlHyN5qMEWwUg692RgqLO3b2UKOpkORhCBV8H2dZ4fqttrIyQF0OmZEfTdwj66sPQRvnO9G4Ymfc+B/B3JAndZwMfkaqfl2Qqzk0hUwEL4V8p4Pjuu4Aiu51rgmKJgIDFltaDDNMjzQ3mVkUcSd2bEpZrDrP9DKmG5iQ3K9lVnRHeQfck3iN3L0oqk20WhCqegFMZ4QT99cQSzkHI+Uqeut59GBZOrGywTic/McevkYaC/80o1Nc0ojgu808fnI7dW/+AiINnE89zUl6fy4qSZzSzeRPte1y5ZOVv7N1B5KZ704OPQihW7b0Rq/Y6wYmlF5fu9nH2LZ9V8cQwdjmcV7DwvlHFxaZkUWJiEwVmcu+T9JaYdzCvcOHNlyGs4OFpsdD5LpLj1az7lqgEE8zeY6tJIoeCht0jsEmt3N1PTuSPPKLJL0bK/yLKVQccy66HU7TlE1FxflJeZ6fAYM9xP0e4tL6Gh6w7QVCAS36MBHu9XJRRTYLqDoULpA18cv8RSy6W9ggBLl84rtpw55WegmWkjnsGr67MtmbqDshkPTHFDBk9jJPh6T32X0fENKtWdTSsCv5Orm9WHljG8ORBVauhghZ6T8AjlrCOaGClbgs9qkGEuTaKmQXkKZTdPRybcRPl/XiBhBl/PbecKyZnurKqJCKWA7EnNVhpxWgYBK0bMk1jXAR/bowANbkxzJDNgj/cWlprgDLqnbIWZwkx+mpme7h+WBYyo3VSkxtsnojuE6sIVavITEr+e9JtGsSsdOQ/PbC9V8j56dsXPzpzSI1vudpAq/oughlgQcU4ISxYYv+wIKGfoFHieTWoBqTJcRDCL3oKQhrcBfnrYXyWHDoJTjHtP41aqLYBZ8RciYl6c5GEw/r2EYgWyIsBUiMe2xa0k6Lxy74GuDVsURGQHivJROst/+MV5voqJ9n6zw9lZyUNo4swg1ncTvxrm7oDOBemKAmwAnUDgFjz2a552tbY7yQXKHdNNMrJjiR50Jbov7xsUdXYZx7blm6U0LWZmzjVcAj0K155hpZqIvu4YxeDJDvfCvh+3AAQx2yhBVCxCuK61LUCGkEa+PM8LAPksLmnV9rRZcFDWm65o2qvcgmh2YMuEQgCxly/WB1cyDwRCD1AuqAsusGKNTcbEVRCWVLyWlDhMvAVhQnjX6q3bwkR6TL9XNIR5B3+qhvxxvI0zjijsg0H6VuERcQZa9U7wCT65Yxj49Ep5j05BwToTbs1/d5SgdBeTCZeSMaCPQ0p5cEglzWT9azpYNuxTiCtpUqTkVCPBQtxGeA6nKIlD+fyw5uQA9ev7WsiYreVAmfGJ/8Hqnn+2yHiutxSG3jJUi8UBqqyAAAQ=="
    },
    {
      "name": "witness-ed25519-1",
      "algorithm": "ed25519",
      "public_key_b64": "xWH6n2Q/5cYBE8zp2ygv3iueXKX8a2/A0WebsznJ9y8="
    }
  ],
  "threshold": 2
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_witness_cosignatures` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
