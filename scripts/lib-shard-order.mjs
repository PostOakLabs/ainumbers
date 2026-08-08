// scripts/lib-shard-order.mjs — pure set-diff helpers shared by
// assemble-chaingraph.mjs to catch a shard file and its
// chaingraph.meta.json `order.*` entry drifting apart in either direction.
// CHAINORDER-GATE-1: PACKS-ASSEMBLE-LAND-2 found two chain shards merged to
// main and absent from order.chains, so the assembler never picked them up
// — every gate stayed green because nothing enumerated shard files on disk
// against the order list. No side effects, no filesystem access, so this is
// testable without touching a real chaingraph/ tree (see
// lib-shard-order.test.mjs).

// Shard file present on disk whose id/name is missing from order.* — the
// PACKS-MUNI-1 / PACKS-SEC16-1 case: merged, valid, silently unassembled.
export function findUnlistedShards(onDiskIds, orderIds) {
  const known = new Set(orderIds)
  return onDiskIds.filter((id) => !known.has(id))
}

// Reverse: an id/name listed in order.* with no shard file behind it — an
// orphan entry (typo, a shard deleted without removing its order line,
// etc). Assembly cannot proceed without this file, so this is always fatal.
export function findOrphanOrderEntries(orderIds, onDiskIds) {
  const onDisk = new Set(onDiskIds)
  return orderIds.filter((id) => !onDisk.has(id))
}
