// c2sp-tlog-verify.mjs — shared C2SP transparency-log verification primitives.
// Sibling to _hash.mjs: ONE canonical implementation of checkpoint (signed-note)
// parsing/framing, tlog-cosignature message construction, and RFC 6962
// inclusion-proof verification, imported (never duplicated) by every C2SP-based
// log verifier in this repo. Extracted per C2SP-TLOG-VERIFY-MODULE-1 from two
// independent hand-rolled parsers in register-sigsum.mjs and register-rekor.mjs
// — SIGSUM-NAMED-POLICY-1 found a real bug in one of them (witness key_hash
// read from a nonexistent field) that this shared module removes the room for.
//
// Specs implemented (C2SP, https://github.com/C2SP/C2SP):
//   tlog-checkpoint.md   — checkpoint = signed-note with origin/size/root lines
//   signed-note.md       — note framing + "— <name> <base64(keyHint(4)+sig)>" lines
//   tlog-cosignature.md  — "cosignature/v1\ntime <ts>\n<checkpoint>" cosigned message
//   (RFC 6962 §2.1.3.2)  — 0x00/0x01-prefixed leaf/interior hashing + inclusion walk
//
// Leaf serialization, submission/registration, and trust-policy CONTENT are
// deliberately NOT here (BUILD-SPEC §2) — those stay per-log.
//
// CHAINPOINT GUARD (SO #0): every function below is a pure function of its
// arguments. Zero fetch/network calls anywhere in this file's call graph —
// every byte and every trust key is the caller's to supply.
//
// Runs unchanged in Node 18+, Workers, and browsers (globalThis.crypto.subtle,
// atob/btoa — no Buffer, no node:crypto import) so a future browser tool
// (C2SP-TLOG-VERIFY-TOOL-1, BUILD-SPEC §4) can import this file directly.

// ---------------------------------------------------------------------------
// Byte helpers (Uint8Array-based — no Buffer, browser-safe).
// ---------------------------------------------------------------------------

export function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

export function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function concatBytes(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ---------------------------------------------------------------------------
// RFC 6962 §2.1 Merkle primitives — 0x00-prefixed leaf, 0x01-prefixed interior.
// Identical algorithm both callers implemented independently before this row.
// ---------------------------------------------------------------------------

export async function sha256(...parts) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', concatBytes(parts));
  return new Uint8Array(digest);
}

export async function hashLeafNode(data) { return sha256(new Uint8Array([0x00]), data); }
export async function hashInteriorNode(left, right) { return sha256(new Uint8Array([0x01]), left, right); }

// RFC 6962 §2.1.3.2 inclusion-proof verification, iterative form (mirrors
// sigsum-go's merkle.VerifyInclusion: isOdd(fn) => left sibling on path;
// fn<sn => right sibling on path). `size` = tree size (leaf count), `index` =
// 0-based leaf index, `path` = bottom-up sibling hashes (the standard C2SP/
// RFC 6962 audit-path ordering both Sigsum and Rekor/Trillian emit).
export async function verifyInclusion({ leaf, index, size, root, path }) {
  let r = leaf;
  let fn = index;
  let p = path;
  for (let sn = size - 1; sn > 0; fn = Math.floor(fn / 2), sn = Math.floor(sn / 2)) {
    const isOdd = (fn & 1) === 1;
    if (isOdd) {
      if (!p.length) return false;
      r = await hashInteriorNode(p[0], r);
      p = p.slice(1);
    } else if (fn < sn) {
      if (!p.length) return false;
      r = await hashInteriorNode(r, p[0]);
      p = p.slice(1);
    }
  }
  return bytesEqual(r, root);
}

// RFC 6962 §2.1.2 consistency-proof verification (SUBPROOF/PROOF construction,
// verifier form — mirrors the reference algorithm in the Certificate
// Transparency python client and golang.org/x/mod/sumdb/tlog.CheckTree):
// confirms `newRoot` (tree of size `newSize`) is an append-only extension of
// `oldRoot` (tree of size `oldSize`) without trusting either root's provenance
// — both are recomputed by the caller from tile bytes, per REGISTRY-TILES-
// BUILD-SPEC.md §2.3. Added per REGISTRY-CONSISTENCY-VERIFY-BUILD-1 — the gate
// §2.3 requires cannot exist without it (SPEC §20.1: no second Merkle impl).
export async function verifyConsistency({ oldSize, newSize, oldRoot, newRoot, proof }) {
  if (!Number.isInteger(oldSize) || !Number.isInteger(newSize) || oldSize < 0 || newSize < oldSize) return false;
  if (oldSize === newSize) return proof.length === 0 && bytesEqual(oldRoot, newRoot);
  if (oldSize === 0) return proof.length === 0; // empty tree is consistent with anything, no root to check

  const p = proof.slice();
  let node = oldSize - 1;
  let lastNode = newSize - 1;
  while (node % 2 === 1) {
    node = Math.floor(node / 2);
    lastNode = Math.floor(lastNode / 2);
  }

  let oldHash, newHash;
  if (node > 0) {
    if (p.length === 0) return false;
    oldHash = newHash = p.shift();
  } else {
    oldHash = newHash = oldRoot;
  }

  while (node > 0) {
    if (node % 2 === 1) {
      if (p.length === 0) return false;
      const h = p.shift();
      oldHash = await hashInteriorNode(h, oldHash);
      newHash = await hashInteriorNode(h, newHash);
    } else if (node < lastNode) {
      if (p.length === 0) return false;
      const h = p.shift();
      newHash = await hashInteriorNode(newHash, h);
    }
    node = Math.floor(node / 2);
    lastNode = Math.floor(lastNode / 2);
  }

  if (!bytesEqual(oldHash, oldRoot)) return false;

  while (lastNode > 0) {
    if (p.length === 0) return false;
    const h = p.shift();
    newHash = await hashInteriorNode(newHash, h);
    lastNode = Math.floor(lastNode / 2);
  }

  return bytesEqual(newHash, newRoot) && p.length === 0;
}

// ---------------------------------------------------------------------------
// tlog-checkpoint.md — checkpoint framing: "<origin>\n<size>\n<root-b64>\n"
// plus optional extension lines, all per signed-note.md's note body grammar.
// ---------------------------------------------------------------------------

export function formatCheckpoint(origin, size, rootHash, extensionLines = []) {
  const rootB64 = bytesToBase64(rootHash);
  const ext = extensionLines.length ? extensionLines.map((l) => `${l}\n`).join('') : '';
  return `${origin}\n${size}\n${rootB64}\n${ext}`;
}

// signed-note.md: a note is "<text body>\n\n— <name> <base64(sig)>\n..." where
// each signature's base64 payload is keyHint(4 bytes) || raw-signature-bytes.
// tlog-checkpoint.md's checkpoint IS a note whose text body is the origin/
// size/root(/extension) lines above. Returns the note body fields plus every
// cosignature line found, each split into its 4-byte key-ID hint and the
// remaining (algorithm-specific — Ed25519 raw, ECDSA DER, etc.) signature
// bytes; the caller verifies the signature with whatever algorithm its log
// uses, this function only implements the wire FRAMING (C2SP-TLOG-VERIFY-
// MODULE-1's "signed-note parsing" export).
export function parseSignedNote(text) {
  const lines = text.split('\n');
  if (lines.length < 4) throw new Error('signed-note: too few lines for a checkpoint (need origin/size/root + blank + signature)');
  const origin = lines[0];
  const size = Number(lines[1]);
  if (!Number.isInteger(size) || size < 0) throw new Error(`signed-note: malformed size line: ${lines[1]}`);
  const rootHash = base64ToBytes(lines[2]);

  // Extension lines run until the blank separator line (signed-note.md: the
  // note body is text lines, blank line, then "— name sig" signature lines).
  let i = 3;
  const extensionLines = [];
  while (i < lines.length && lines[i] !== '') { extensionLines.push(lines[i]); i++; }
  if (i >= lines.length) throw new Error('signed-note: no blank separator before signature block');
  const noteText = lines.slice(0, i).join('\n') + '\n'; // exact bytes every signature covers

  const cosignatures = [];
  for (let k = i + 1; k < lines.length; k++) {
    const line = lines[k];
    if (!line) continue;
    if (!line.startsWith('— ')) continue; // U+2014 EM DASH per signed-note.md
    const parts = line.split(' ');
    const name = parts[1];
    const sigBytes = base64ToBytes(parts[2]);
    if (sigBytes.length < 4) throw new Error(`signed-note: cosignature for ${name} too short to hold a 4-byte key hint`);
    cosignatures.push({
      name,
      keyIdHex: bytesToHex(sigBytes.subarray(0, 4)),
      sigBytes: sigBytes.subarray(4),
    });
  }

  return { origin, size, rootHash, extensionLines, noteText, cosignatures };
}

// tlog-cosignature.md: the message a witness actually signs over a checkpoint.
export function toCosignedData(origin, size, rootHash, timestamp, namespace = 'cosignature/v1') {
  return `${namespace}\ntime ${timestamp}\n${formatCheckpoint(origin, size, rootHash)}`;
}
