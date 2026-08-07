// decoder.mjs — hand-written proto3 wire-format decoder for sdk.v1.ReportResponse (see ./sdk.proto),
// the CRE report envelope carrying `rawReport` + `reportContext` (docs.chain.link/cre/reference/sdk/core-ts
// Report.parse() params of the same names). Implements ONLY the public, license-free protobuf wire spec
// (https://protobuf.dev/programming-guides/encoding/ — tag = (field_number<<3)|wire_type, LEB128 varints,
// length-delimited = varint length + bytes) against the MIT-licensed field/type list in ./sdk.proto.
// `rawReport` and `reportContext` are extracted as OPAQUE bytes, exactly as sdk.proto types them (`bytes`) —
// this decoder does NOT interpret their internal layout (e.g. the TS SDK's documented "109-byte metadata
// header" inside rawReport). That internal layout is not published under an MIT/permissive license anywhere
// this row could find; deriving it would mean reading the BUSL-1.1 @chainlink/cre-sdk source, which SO
// CRE-PROTOS-1 forbids. Zero npm/runtime dependency (SO #10). Node 18+.

const WIRE_VARINT = 0, WIRE_I64 = 1, WIRE_LEN = 2, WIRE_I32 = 5;

function readVarint(buf, pos) {
  let result = 0n, shift = 0n;
  while (true) {
    if (pos >= buf.length) throw new Error('decodeReportResponse: truncated varint');
    const b = buf[pos++];
    result |= BigInt(b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7n;
  }
  return [result, pos];
}

function readTag(buf, pos) {
  const [v, next] = readVarint(buf, pos);
  const fieldNo = Number(v >> 3n);
  const wireType = Number(v & 0x7n);
  return [fieldNo, wireType, next];
}

function readLenDelim(buf, pos) {
  const [lenBig, afterLen] = readVarint(buf, pos);
  const len = Number(lenBig);
  const end = afterLen + len;
  if (end > buf.length) throw new Error('decodeReportResponse: length-delimited field overruns buffer');
  return [buf.subarray(afterLen, end), end];
}

function skipField(buf, pos, wireType) {
  if (wireType === WIRE_VARINT) return readVarint(buf, pos)[1];
  if (wireType === WIRE_I64) return pos + 8;
  if (wireType === WIRE_LEN) return readLenDelim(buf, pos)[1];
  if (wireType === WIRE_I32) return pos + 4;
  throw new Error(`decodeReportResponse: unsupported wire type ${wireType}`);
}

/** Decode sdk.v1.AttributedSignature: { signature: bytes=1, signer_id: uint32=2 }. */
export function decodeAttributedSignature(bytes) {
  let pos = 0;
  let signature = null, signerId = null;
  while (pos < bytes.length) {
    const [fieldNo, wireType, next] = readTag(bytes, pos);
    pos = next;
    if (fieldNo === 1 && wireType === WIRE_LEN) { const [v, p] = readLenDelim(bytes, pos); signature = v; pos = p; }
    else if (fieldNo === 2 && wireType === WIRE_VARINT) { const [v, p] = readVarint(bytes, pos); signerId = Number(v); pos = p; }
    else pos = skipField(bytes, pos, wireType);
  }
  if (!signature || signerId === null) throw new Error('decodeAttributedSignature: missing signature or signer_id');
  return { signature, signerId };
}

/**
 * Decode sdk.v1.ReportResponse (cre/sdk/v1beta/sdk.proto):
 *   config_digest:1 bytes, seq_nr:2 uint64, report_context:3 bytes, raw_report:4 bytes,
 *   sigs:5 repeated AttributedSignature.
 * @param {Uint8Array} bytes
 * @returns {{configDigest: Uint8Array, seqNr: bigint, reportContext: Uint8Array, rawReport: Uint8Array, sigs: {signature: Uint8Array, signerId: number}[]}}
 */
export function decodeReportResponse(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('decodeReportResponse: expected Uint8Array');
  let pos = 0;
  let configDigest = null, seqNr = null, reportContext = null, rawReport = null;
  const sigs = [];
  while (pos < bytes.length) {
    const [fieldNo, wireType, next] = readTag(bytes, pos);
    pos = next;
    if (fieldNo === 1 && wireType === WIRE_LEN) { const [v, p] = readLenDelim(bytes, pos); configDigest = v; pos = p; }
    else if (fieldNo === 2 && wireType === WIRE_VARINT) { const [v, p] = readVarint(bytes, pos); seqNr = v; pos = p; }
    else if (fieldNo === 3 && wireType === WIRE_LEN) { const [v, p] = readLenDelim(bytes, pos); reportContext = v; pos = p; }
    else if (fieldNo === 4 && wireType === WIRE_LEN) { const [v, p] = readLenDelim(bytes, pos); rawReport = v; pos = p; }
    else if (fieldNo === 5 && wireType === WIRE_LEN) { const [v, p] = readLenDelim(bytes, pos); sigs.push(decodeAttributedSignature(v)); pos = p; }
    else pos = skipField(bytes, pos, wireType);
  }
  if (!configDigest || seqNr === null || !reportContext || !rawReport) {
    throw new Error('decodeReportResponse: missing required field (config_digest/seq_nr/report_context/raw_report)');
  }
  return { configDigest, seqNr, reportContext, rawReport, sigs };
}

export function hexOf(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function bytesFromHex(hex) {
  if (hex.length % 2 !== 0) throw new Error('bytesFromHex: odd-length hex string');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
