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
