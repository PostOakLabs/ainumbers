# CRE DON signer-set snapshots

Dated, versioned artifacts written by [`../cre-signerset-snapshot.mjs`](../cre-signerset-snapshot.mjs)
(`CRE-SIGNERSET-1`). Each file is a snapshot of a Chainlink CRE DON's
authorized signer set as read from the `CapabilitiesRegistry` contract at a
specific block, plus a `rePinBy` date.

**Placement note:** these live beside the script, not under `chaingraph/`,
because this is not node/kernel work — no `execution_hash`, no
compute-proof, no hash-neutral doctrine applies to this artifact shape. A
future OCG node (`CRE-NODE-1`) that verifies CRE reports will read one of
these files by path; it is a plain data dependency, not a kernel.

## Fetch / consume boundary

- **This directory's contents are read-only inputs to other tools.** Nothing
  that reads a file here is permitted to call the network itself —
  `CONTRACT.md` requires every shipped tool and OCG node to make zero
  network calls. Only `cre-signerset-snapshot.mjs`, run manually/out-of-band
  by an operator, is allowed to touch the chain.
- A snapshot proves the signer set as of `chain.blockNumber` — nothing more.
  It does **not** prove the set is current: DON operators can rotate signing
  keys via routine OCR/OCR3 config updates at any time after the snapshot
  was taken. A consumer MUST refuse to trust a snapshot past its `rePinBy`
  date rather than silently keep using it (that refusal is `CRE-NODE-1`
  scope — this tool only supplies the date that makes it possible).

## Regenerating a snapshot

```
node scripts/cre-signerset-snapshot.mjs \
  --don-name "<don name>" \
  --registry-address 0x<CapabilitiesRegistry address, verified independently> \
  --rpc-url https://<your RPC endpoint> \
  [--repin-days 30] [--out scripts/cre-signer-snapshots/<file>.json]
```

**There is no default `--registry-address`.** As of 2026-08-06, the public
`WorkflowRegistry` contract on Ethereum Mainnet
(`0x4Ac54353FA4Fa961AfcC5ec4B118596d3305E7e5`) has no `CapabilitiesRegistry`
pointer set (`getCapabilitiesRegistry()` returns the zero address — checked
live via `--discover-registry`, see the tool's header comment). Do not carry
forward a guessed address; verify the correct `CapabilitiesRegistry` address
independently before running a real snapshot.

`example-don.example.json` in this directory is a **synthetic fixture**
(same shape the tool emits, not a real DON) kept only to document the
artifact shape at a glance.
