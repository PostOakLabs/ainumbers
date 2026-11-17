/**
 * scripts/lib/webmcp-snapshot.mjs: shared by sign-webmcp-snapshot.mjs (writer) and
 * check-webmcp-signed-snapshot.mjs (verifier) so both derive per-tool hashes from the
 * SAME source: buildDirectoryEntries() in gen-webmcp-registrations.mjs, i.e. the live
 * registration set the /.well-known/webmcp.json manifest is emitted from.
 */
import { createHash } from 'node:crypto';
import { jcsStringify } from '../../chaingraph/kernels/_hash.mjs';
import { buildDirectoryEntries } from '../gen-webmcp-registrations.mjs';

/** Protected-header typ: distinct from the agent card's 'JOSE' (key-separation law). */
export const SNAPSHOT_TYP = 'webmcp-snapshot+jws';
export const SNAPSHOT_SCHEMA = 'ainumbers-webmcp-signed-snapshot-v1';
export const SNAPSHOT_REL = '.well-known/webmcp-signed.json';

/**
 * WEBMCP-SIGNED-EXPIRY-1: every snapshot declares `expires` (generated_at + 30 days)
 * and a strictly-increasing integer `version` (previous published value + 1, so the
 * counter never depends on wall-clock alone). A verifier rejects an expired snapshot
 * and one whose version is lower than the highest it has already seen this session —
 * an attacker who serves a frozen or rolled-back old snapshot no longer passes.
 * The renew window is how close to expiry main's freshness gate
 * (check-webmcp-snapshot-fresh.mjs) starts failing, so the expiry cannot lapse silently.
 */
export const SNAPSHOT_TTL_DAYS = 30;
export const SNAPSHOT_RENEW_WINDOW_DAYS = 7;
const DAY_MS = 86400000;

/** ISO-8601 expiry for a snapshot generated at `generatedMs`. */
export function expiryFrom(generatedMs) {
  return new Date(generatedMs + SNAPSHOT_TTL_DAYS * DAY_MS).toISOString();
}

/**
 * Next `version` from the PREVIOUS PUBLISHED snapshot. Absent/legacy previous → 1
 * (first expiry-bearing publish). A previous snapshot that carries a malformed
 * version throws: silently minting a low version would publish a rollback-able one.
 */
export function nextSnapshotVersion(prevSnap) {
  if (!prevSnap || typeof prevSnap !== 'object' || prevSnap.version === undefined) return 1;
  if (!Number.isInteger(prevSnap.version) || prevSnap.version < 1)
    throw new Error(`previous published snapshot carries a malformed version (${JSON.stringify(prevSnap.version)}); refusing to derive the next one`);
  return prevSnap.version + 1;
}

/**
 * Expiry/version enforcement shared by the snapshot check (CLI gate) and any other
 * verifier. LEGACY TOLERANCE: a validly signed snapshot with NEITHER field predates
 * this row and is accepted (the committed one on main is exactly that until its
 * next local re-sign); carrying exactly ONE of the two is malformed (the signer
 * always writes both, and the detached signature covers them, so a mixed snapshot
 * is a broken signer, not an old file).
 * `highestSeen` is the caller's session floor (in-memory; no storage anywhere).
 * Returns { ok, why?, legacy?, seenVersion } — `seenVersion` is what the caller
 * folds into its floor, ONLY after a successful verify.
 */
export function evaluateSnapshotFreshness(snap, { now = Date.now(), highestSeen = 0 } = {}) {
  const hasExpires = typeof snap?.expires === 'string';
  const hasVersion = snap?.version !== undefined;
  if (hasExpires !== hasVersion)
    return { ok: false, why: 'expires and version MUST be present together (mixed legacy/new-format snapshot)' };
  if (!hasExpires)
    return { ok: true, legacy: true, seenVersion: highestSeen };
  const exp = Date.parse(snap.expires);
  if (Number.isNaN(exp))
    return { ok: false, why: `expires is not an ISO-8601 time (${JSON.stringify(snap.expires)})` };
  if (!Number.isInteger(snap.version) || snap.version < 1)
    return { ok: false, why: `version is not a positive integer (${JSON.stringify(snap.version)})` };
  if (now > exp)
    return { ok: false, why: `snapshot expired at ${snap.expires} (verifier ran at ${new Date(now).toISOString()})` };
  if (snap.version < highestSeen)
    return { ok: false, why: `rolled-back version ${snap.version} is lower than the highest already seen this session (${highestSeen})` };
  return { ok: true, seenVersion: Math.max(highestSeen, snap.version) };
}

/** Session version floor: in-memory only (CONTRACT §0 forbids client storage). */
export function createVersionFloor(start = 0) {
  let floor = Number.isInteger(start) && start >= 0 ? start : 0;
  return {
    get: () => floor,
    see: (v) => { if (Number.isInteger(v) && v > floor) floor = v; },
  };
}

const sha256Hex = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

/** Per-tool hash rows, sorted by name (deterministic). */
export function buildSnapshotTools(repoRoot) {
  return buildDirectoryEntries(repoRoot)
    .map((e) => ({
      name: e.name,
      description_sha256: e.description_sha256,
      input_schema_sha256: e.input_schema_sha256,
      annotations_sha256: sha256Hex(jcsStringify(e.annotations)),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
