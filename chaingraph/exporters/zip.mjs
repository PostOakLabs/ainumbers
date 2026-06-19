// exporters/zip.mjs — minimal STORE-only ZIP writer + CRC32.
// Dependency-free and Workers-safe (no Node zlib). Produces deterministic,
// uncompressed (.xlsx is a ZIP) archives so the same artifact yields byte-stable
// output (OCG Standard §13.2 conformance rule 5). Compression method 0 (stored).
//
// Not a general ZIP library — just enough to emit valid OOXML packages.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const enc = (s) => new TextEncoder().encode(s);

function u16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
function u32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }

/**
 * zipStore(files) -> Uint8Array
 * @param {{name:string, data:Uint8Array}[]} files
 * Deterministic: fixed DOS date/time (0) so byte output is stable per input.
 */
export function zipStore(files) {
  const parts = [];        // body byte arrays (local headers + data)
  const central = [];      // central directory byte arrays
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc(f.name);
    const data = f.data;
    const crc = crc32(data);
    const size = data.length;

    // Local file header (sig 0x04034b50)
    const lfh = [
      ...u32(0x04034b50),
      ...u16(20),          // version needed
      ...u16(0),           // flags
      ...u16(0),           // method = 0 (store)
      ...u16(0), ...u16(0),// mod time, mod date (fixed for determinism)
      ...u32(crc),
      ...u32(size),        // compressed size
      ...u32(size),        // uncompressed size
      ...u16(nameBytes.length),
      ...u16(0),           // extra len
    ];
    const lfhBytes = new Uint8Array(lfh);
    parts.push(lfhBytes, nameBytes, data);

    // Central directory header (sig 0x02014b50)
    const cdh = [
      ...u32(0x02014b50),
      ...u16(20), ...u16(20),
      ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc),
      ...u32(size), ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(0),           // external attrs
      ...u32(offset),      // local header offset
    ];
    central.push(new Uint8Array(cdh), nameBytes);

    offset += lfhBytes.length + nameBytes.length + data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) centralSize += c.length;

  const eocd = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(centralSize),
    ...u32(centralStart),
    ...u16(0),
  ]);

  // Concatenate everything
  let total = centralStart + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of parts)   { out.set(b, p); p += b.length; }
  for (const c of central) { out.set(c, p); p += c.length; }
  out.set(eocd, p);
  return out;
}
