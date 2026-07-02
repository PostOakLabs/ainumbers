// _sdjwt-core.bundle.mjs — VENDORED single-file ESM bundle of @sd-jwt/core v0.20.0
// (OpenWallet Foundation sd-jwt-js, https://github.com/openwallet-foundation/sd-jwt-js, Apache-2.0)
// + its sole dependency @owf/identity-common v0.1.0-alpha-20260422101556. Bundled with esbuild
// (--bundle --format=esm --platform=neutral) from the npm-published packages; nothing is fetched at
// runtime (CONTRACT: zero network, no CDN). Consumed by exporters/sdjwt.mjs — the OCG Standard §13.12
// SD-JWT selective-disclosure export profile (RFC 9901). Runtime-agnostic: crypto (signer/verifier/
// hasher/saltGenerator) is injected by the caller; this bundle contains NO key material and does NO I/O.
// Audit note (2026-07-02, recorded in the v0.7 delta): no formal third-party audit of sd-jwt-js found;
// the surface is small (salted SHA-256 disclosure digests + JWS) — re-check audit status on upgrade.
// DO NOT EDIT BY HAND — regenerate with esbuild from the pinned npm versions above.
// node_modules/@owf/identity-common/dist/index.mjs
var IdentityException = class IdentityException2 extends Error {
  constructor(message, details) {
    super(message);
    Object.setPrototypeOf(this, IdentityException2.prototype);
    this.name = "IdentityException";
    this.details = details;
  }
  getFullMessage() {
    return `${this.name}: ${this.message} ${this.details ? `- ${JSON.stringify(this.details)}` : ""}`;
  }
};
var IdentityCommonException = class IdentityCommonException2 extends IdentityException {
  constructor(message, details) {
    super(message, details);
    Object.setPrototypeOf(this, IdentityCommonException2.prototype);
    this.name = "IdentityCommonException";
  }
};
var BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var bytesToBase64 = (bytes) => {
  let result = "";
  let i;
  for (i = 0; i < bytes.length - 2; i += 3) {
    const chunk = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
    result += BASE64_CHARS[chunk >> 18 & 63];
    result += BASE64_CHARS[chunk >> 12 & 63];
    result += BASE64_CHARS[chunk >> 6 & 63];
    result += BASE64_CHARS[chunk & 63];
  }
  if (i < bytes.length) {
    const chunk = bytes[i] << 16 | (i + 1 < bytes.length ? bytes[i + 1] << 8 : 0);
    result += BASE64_CHARS[chunk >> 18 & 63];
    result += BASE64_CHARS[chunk >> 12 & 63];
    result += i + 1 < bytes.length ? BASE64_CHARS[chunk >> 6 & 63] : "=";
    result += "=";
  }
  return result;
};
var base64ToBytes = (base64) => {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new IdentityCommonException("Invalid base64 string: contains invalid characters");
  const cleanBase64 = base64.replace(/=/g, "");
  const length = cleanBase64.length;
  const bytes = new Uint8Array(length * 3 >> 2);
  let byteIndex = 0;
  for (let i = 0; i < length; i += 4) {
    const a = BASE64_CHARS.indexOf(cleanBase64[i]);
    const b = BASE64_CHARS.indexOf(cleanBase64[i + 1]);
    const c = i + 2 < length ? BASE64_CHARS.indexOf(cleanBase64[i + 2]) : 0;
    const d = i + 3 < length ? BASE64_CHARS.indexOf(cleanBase64[i + 3]) : 0;
    bytes[byteIndex++] = a << 2 | b >> 4;
    if (i + 2 < length) bytes[byteIndex++] = (b & 15) << 4 | c >> 2;
    if (i + 3 < length) bytes[byteIndex++] = (c & 3) << 6 | d;
  }
  return bytes;
};
var bytesToBase64Url = (bytes) => {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};
var base64UrlToBytes = (base64url) => {
  if (!/^[A-Za-z0-9_-]*$/.test(base64url)) throw new IdentityCommonException("Invalid base64url string: contains invalid characters");
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return base64ToBytes(base64);
};
var stringToBytes = (str) => {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let codePoint = str.charCodeAt(i);
    if (codePoint >= 55296 && codePoint <= 56319 && i + 1 < str.length) {
      const low = str.charCodeAt(i + 1);
      if (low >= 56320 && low <= 57343) {
        codePoint = 65536 + (codePoint - 55296 << 10) + (low - 56320);
        i++;
      }
    }
    if (codePoint < 128) bytes.push(codePoint);
    else if (codePoint < 2048) {
      bytes.push(192 | codePoint >> 6);
      bytes.push(128 | codePoint & 63);
    } else if (codePoint < 65536) {
      bytes.push(224 | codePoint >> 12);
      bytes.push(128 | codePoint >> 6 & 63);
      bytes.push(128 | codePoint & 63);
    } else {
      bytes.push(240 | codePoint >> 18);
      bytes.push(128 | codePoint >> 12 & 63);
      bytes.push(128 | codePoint >> 6 & 63);
      bytes.push(128 | codePoint & 63);
    }
  }
  return new Uint8Array(bytes);
};
var bytesToString = (bytes) => {
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i++];
    if (byte1 < 128) result += String.fromCharCode(byte1);
    else if (byte1 < 224) {
      const byte2 = bytes[i++];
      result += String.fromCharCode((byte1 & 31) << 6 | byte2 & 63);
    } else if (byte1 < 240) {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      result += String.fromCharCode((byte1 & 15) << 12 | (byte2 & 63) << 6 | byte3 & 63);
    } else {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      const byte4 = bytes[i++];
      const codePoint = (byte1 & 7) << 18 | (byte2 & 63) << 12 | (byte3 & 63) << 6 | byte4 & 63;
      const surrogate1 = 55296 + (codePoint - 65536 >> 10);
      const surrogate2 = 56320 + (codePoint - 65536 & 1023);
      result += String.fromCharCode(surrogate1, surrogate2);
    }
  }
  return result;
};
var base64urlEncode = (input) => bytesToBase64Url(stringToBytes(input));
var base64urlDecode = (input) => bytesToString(base64UrlToBytes(input));
var uint8ArrayToBase64Url = bytesToBase64Url;
var base64UrlToUint8Array = base64UrlToBytes;

// node_modules/@sd-jwt/core/dist/index.mjs
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var SD_SEPARATOR = "~";
var SD_LIST_KEY = "...";
var SD_DIGEST = "_sd";
var SD_DECOY = "_sd_decoy";
var KB_JWT_TYP = "kb+jwt";
var IANA_HASH_ALGORITHMS = [
  "sha-256",
  "sha-256-128",
  "sha-256-120",
  "sha-256-96",
  "sha-256-64",
  "sha-256-32",
  "sha-384",
  "sha-512",
  "sha3-224",
  "sha3-256",
  "sha3-384",
  "sha3-512",
  "blake2s-256",
  "blake2b-256",
  "blake2b-512",
  "k12-256",
  "k12-512"
];
var SDJWTException = class _SDJWTException extends Error {
  constructor(message, details) {
    super(message);
    Object.setPrototypeOf(this, _SDJWTException.prototype);
    this.name = "SDJWTException";
    this.details = details;
  }
  getFullMessage() {
    return `${this.name}: ${this.message} ${this.details ? `- ${JSON.stringify(this.details)}` : ""}`;
  }
};
function ensureError(value) {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  return new Error(String(value));
}
var utf8Decoder = new TextDecoder("utf-8", { fatal: true });
var decodeBase64urlJsonStrict = (encoded, errorMessage) => {
  try {
    const bytes = base64UrlToUint8Array(encoded);
    const decoded = utf8Decoder.decode(bytes);
    return JSON.parse(decoded);
  } catch (e) {
    throw new SDJWTException(errorMessage);
  }
};
var Disclosure = class _Disclosure {
  constructor(data, _meta) {
    this._digest = _meta == null ? void 0 : _meta.digest;
    this._encoded = _meta == null ? void 0 : _meta.encoded;
    if (data.length === 2) {
      this.salt = data[0];
      this.value = data[1];
      return;
    }
    if (data.length === 3) {
      this.salt = data[0];
      this.key = data[1];
      this.value = data[2];
      return;
    }
    throw new SDJWTException("Invalid disclosure data");
  }
  // We need to digest of the original encoded data.
  // After decode process, we use JSON.stringify to encode the data.
  // This can be different from the original encoded data.
  static fromEncode(s, hash) {
    return __async(this, null, function* () {
      const { hasher, alg } = hash;
      const digest = yield hasher(s, alg);
      const digestStr = uint8ArrayToBase64Url(digest);
      const item = decodeBase64urlJsonStrict(
        s,
        "Invalid disclosure data"
      );
      return _Disclosure.fromArray(item, { digest: digestStr, encoded: s });
    });
  }
  static fromEncodeSync(s, hash) {
    const { hasher, alg } = hash;
    const digest = hasher(s, alg);
    const digestStr = uint8ArrayToBase64Url(digest);
    const item = decodeBase64urlJsonStrict(
      s,
      "Invalid disclosure data"
    );
    return _Disclosure.fromArray(item, { digest: digestStr, encoded: s });
  }
  static fromArray(item, _meta) {
    return new _Disclosure(item, _meta);
  }
  encode() {
    if (!this._encoded) {
      this._encoded = base64urlEncode(JSON.stringify(this.decode()));
    }
    return this._encoded;
  }
  decode() {
    return this.key ? [this.salt, this.key, this.value] : [this.salt, this.value];
  }
  digest(hash) {
    return __async(this, null, function* () {
      const { hasher, alg } = hash;
      if (!this._digest) {
        const hash2 = yield hasher(this.encode(), alg);
        this._digest = uint8ArrayToBase64Url(hash2);
      }
      return this._digest;
    });
  }
  digestSync(hash) {
    const { hasher, alg } = hash;
    if (!this._digest) {
      const hash2 = hasher(this.encode(), alg);
      this._digest = uint8ArrayToBase64Url(hash2);
    }
    return this._digest;
  }
};
var decodeJwt = (jwt) => {
  const { 0: header, 1: payload, 2: signature, length } = jwt.split(".");
  if (length !== 3) {
    throw new SDJWTException("Invalid JWT as input");
  }
  return {
    header: decodeBase64urlJsonStrict(header, "Invalid JWT as input"),
    payload: decodeBase64urlJsonStrict(payload, "Invalid JWT as input"),
    signature
  };
};
var splitSdJwt = (sdjwt) => {
  const [encodedJwt, ...encodedDisclosures] = sdjwt.split(SD_SEPARATOR);
  if (encodedDisclosures.length === 0) {
    return {
      jwt: encodedJwt,
      disclosures: []
    };
  }
  const encodedKeyBindingJwt = encodedDisclosures.pop();
  return {
    jwt: encodedJwt,
    disclosures: encodedDisclosures,
    kbJwt: encodedKeyBindingJwt || void 0
  };
};
var decodeSdJwt = (sdjwt, hasher) => __async(null, null, function* () {
  const [encodedJwt, ...encodedDisclosures] = sdjwt.split(SD_SEPARATOR);
  const jwt = decodeJwt(encodedJwt);
  if (encodedDisclosures.length === 0) {
    return {
      jwt,
      disclosures: []
    };
  }
  const encodedKeyBindingJwt = encodedDisclosures.pop();
  const kbJwt = encodedKeyBindingJwt ? decodeJwt(encodedKeyBindingJwt) : void 0;
  const { _sd_alg } = getSDAlgAndPayload(jwt.payload);
  const disclosures = yield Promise.all(
    encodedDisclosures.map(
      (ed) => Disclosure.fromEncode(ed, { alg: _sd_alg, hasher })
    )
  );
  return {
    jwt,
    disclosures,
    kbJwt
  };
});
var decodeSdJwtSync = (sdjwt, hasher) => {
  const [encodedJwt, ...encodedDisclosures] = sdjwt.split(SD_SEPARATOR);
  const jwt = decodeJwt(encodedJwt);
  if (encodedDisclosures.length === 0) {
    return {
      jwt,
      disclosures: []
    };
  }
  const encodedKeyBindingJwt = encodedDisclosures.pop();
  const kbJwt = encodedKeyBindingJwt ? decodeJwt(encodedKeyBindingJwt) : void 0;
  const { _sd_alg } = getSDAlgAndPayload(jwt.payload);
  const disclosures = encodedDisclosures.map(
    (ed) => Disclosure.fromEncodeSync(ed, { alg: _sd_alg, hasher })
  );
  return {
    jwt,
    disclosures,
    kbJwt
  };
};
var getClaims = (rawPayload, disclosures, hasher) => __async(null, null, function* () {
  const { unpackedObj } = yield unpack(rawPayload, disclosures, hasher);
  return unpackedObj;
});
var getClaimsSync = (rawPayload, disclosures, hasher) => {
  const { unpackedObj } = unpackSync(rawPayload, disclosures, hasher);
  return unpackedObj;
};
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var unpackArray = (arr, map, prefix = "", seenDigests) => {
  const keys = {};
  const unpackedArray = [];
  arr.forEach((item, idx) => {
    if (isRecord(item)) {
      const hash = item[SD_LIST_KEY];
      if (typeof hash === "string") {
        if (seenDigests) {
          if (seenDigests.has(hash)) {
            throw new SDJWTException(
              "Duplicate digest found in SD-JWT payload"
            );
          }
          seenDigests.add(hash);
        }
        const disclosed = map[hash];
        if (disclosed) {
          const presentKey = prefix ? `${prefix}.${idx}` : `${idx}`;
          keys[presentKey] = hash;
          const { unpackedObj, disclosureKeymap: disclosureKeys } = unpackObjInternal(disclosed.value, map, presentKey, seenDigests);
          unpackedArray.push(unpackedObj);
          Object.assign(keys, disclosureKeys);
        }
      } else {
        const newKey = prefix ? `${prefix}.${idx}` : `${idx}`;
        const { unpackedObj, disclosureKeymap: disclosureKeys } = unpackObjInternal(item, map, newKey, seenDigests);
        unpackedArray.push(unpackedObj);
        Object.assign(keys, disclosureKeys);
      }
    } else if (Array.isArray(item)) {
      const newKey = prefix ? `${prefix}.${idx}` : `${idx}`;
      const { unpackedObj, disclosureKeymap: disclosureKeys } = unpackObjInternal(item, map, newKey, seenDigests);
      unpackedArray.push(unpackedObj);
      Object.assign(keys, disclosureKeys);
    } else {
      unpackedArray.push(item);
    }
  });
  return { unpackedObj: unpackedArray, disclosureKeymap: keys };
};
var unpackObj = (obj, map) => {
  const copiedObj = JSON.parse(JSON.stringify(obj));
  const seenDigests = /* @__PURE__ */ new Set();
  const result = unpackObjInternal(copiedObj, map, "", seenDigests);
  const mapDigests = Object.keys(map);
  const unusedDigests = mapDigests.filter((d) => !seenDigests.has(d));
  if (unusedDigests.length > 0) {
    throw new SDJWTException("Unreferenced disclosure(s) detected in SD-JWT");
  }
  return result;
};
var unpackObjInternal = (obj, map, prefix = "", seenDigests) => {
  const keys = {};
  if (typeof obj === "object" && obj !== null) {
    if (Array.isArray(obj)) {
      return unpackArray(obj, map, prefix, seenDigests);
    }
    const record = obj;
    for (const key in record) {
      if (key !== SD_DIGEST && key !== SD_LIST_KEY && typeof record[key] === "object") {
        const newKey = prefix ? `${prefix}.${key}` : key;
        const { unpackedObj: unpackedObj2, disclosureKeymap: disclosureKeys } = unpackObjInternal(record[key], map, newKey, seenDigests);
        record[key] = unpackedObj2;
        Object.assign(keys, disclosureKeys);
      }
    }
    const _a = record, { _sd } = _a, payload = __objRest(_a, ["_sd"]);
    const claims = {};
    if (_sd) {
      for (const hash of _sd) {
        if (seenDigests) {
          if (seenDigests.has(hash)) {
            throw new SDJWTException(
              "Duplicate digest found in SD-JWT payload"
            );
          }
          seenDigests.add(hash);
        }
        const disclosed = map[hash];
        if (disclosed == null ? void 0 : disclosed.key) {
          if (disclosed.key in payload) {
            throw new SDJWTException(
              `Disclosed claim name "${disclosed.key}" conflicts with existing payload key`
            );
          }
          const presentKey = prefix ? `${prefix}.${disclosed.key}` : disclosed.key;
          keys[presentKey] = hash;
          const { unpackedObj: unpackedObj2, disclosureKeymap: disclosureKeys } = unpackObjInternal(disclosed.value, map, presentKey, seenDigests);
          claims[disclosed.key] = unpackedObj2;
          Object.assign(keys, disclosureKeys);
        }
      }
    }
    const unpackedObj = Object.assign(payload, claims);
    return { unpackedObj, disclosureKeymap: keys };
  }
  return { unpackedObj: obj, disclosureKeymap: keys };
};
var createHashMapping = (disclosures, hash) => __async(null, null, function* () {
  const map = {};
  for (let i = 0; i < disclosures.length; i++) {
    const disclosure = disclosures[i];
    const digest = yield disclosure.digest(hash);
    map[digest] = disclosure;
  }
  return map;
});
var createHashMappingSync = (disclosures, hash) => {
  const map = {};
  for (let i = 0; i < disclosures.length; i++) {
    const disclosure = disclosures[i];
    const digest = disclosure.digestSync(hash);
    map[digest] = disclosure;
  }
  return map;
};
var getSDAlgAndPayload = (SdJwtPayload) => {
  const _a = SdJwtPayload, { _sd_alg } = _a, payload = __objRest(_a, ["_sd_alg"]);
  if (typeof _sd_alg !== "string") {
    return { _sd_alg: "sha-256", payload };
  }
  if (!IANA_HASH_ALGORITHMS.includes(
    _sd_alg
  )) {
    throw new SDJWTException(`Invalid _sd_alg: ${_sd_alg}`);
  }
  return { _sd_alg, payload };
};
var unpack = (SdJwtPayload, disclosures, hasher) => __async(null, null, function* () {
  const { _sd_alg, payload } = getSDAlgAndPayload(SdJwtPayload);
  const hash = { hasher, alg: _sd_alg };
  const map = yield createHashMapping(disclosures, hash);
  return unpackObj(payload, map);
});
var unpackSync = (SdJwtPayload, disclosures, hasher) => {
  const { _sd_alg, payload } = getSDAlgAndPayload(SdJwtPayload);
  const hash = { hasher, alg: _sd_alg };
  const map = createHashMappingSync(disclosures, hash);
  return unpackObj(payload, map);
};
var FlattenJSON = class _FlattenJSON {
  constructor(data) {
    this.disclosures = data.disclosures;
    this.kb_jwt = data.kb_jwt;
    this.payload = data.jwtData.payload;
    this.signature = data.jwtData.signature;
    this.protected = data.jwtData.protected;
  }
  static fromEncode(encodedSdJwt) {
    const { jwt, disclosures, kbJwt } = splitSdJwt(encodedSdJwt);
    const { 0: protectedHeader, 1: payload, 2: signature } = jwt.split(".");
    if (!protectedHeader || !payload || !signature) {
      throw new SDJWTException("Invalid JWT");
    }
    return new _FlattenJSON({
      jwtData: {
        protected: protectedHeader,
        payload,
        signature
      },
      disclosures,
      kb_jwt: kbJwt
    });
  }
  static fromSerialized(json) {
    return new _FlattenJSON({
      jwtData: {
        protected: json.protected,
        payload: json.payload,
        signature: json.signature
      },
      disclosures: json.header.disclosures,
      kb_jwt: json.header.kb_jwt
    });
  }
  toJson() {
    return {
      payload: this.payload,
      signature: this.signature,
      protected: this.protected,
      header: {
        disclosures: this.disclosures,
        kb_jwt: this.kb_jwt
      }
    };
  }
  toEncoded() {
    var _a;
    const data = [];
    const jwt = `${this.protected}.${this.payload}.${this.signature}`;
    data.push(jwt);
    if (this.disclosures && this.disclosures.length > 0) {
      const disclosures = this.disclosures.join(SD_SEPARATOR);
      data.push(disclosures);
    }
    const kb_jwt = (_a = this.kb_jwt) != null ? _a : "";
    data.push(kb_jwt);
    return data.join(SD_SEPARATOR);
  }
};
var GeneralJSON = class _GeneralJSON {
  constructor(data) {
    this.payload = data.payload;
    this.disclosures = data.disclosures;
    this.kb_jwt = data.kb_jwt;
    this.signatures = data.signatures;
  }
  static fromEncode(encodedSdJwt) {
    const { jwt, disclosures, kbJwt } = splitSdJwt(encodedSdJwt);
    const { 0: protectedHeader, 1: payload, 2: signature } = jwt.split(".");
    if (!protectedHeader || !payload || !signature) {
      throw new SDJWTException("Invalid JWT");
    }
    return new _GeneralJSON({
      payload,
      disclosures,
      kb_jwt: kbJwt,
      signatures: [
        {
          protected: protectedHeader,
          signature
        }
      ]
    });
  }
  static fromSerialized(json) {
    var _a, _b, _c;
    if (!json.signatures[0]) {
      throw new SDJWTException("Invalid JSON");
    }
    const disclosures = (_b = (_a = json.signatures[0].header) == null ? void 0 : _a.disclosures) != null ? _b : [];
    const kb_jwt = (_c = json.signatures[0].header) == null ? void 0 : _c.kb_jwt;
    return new _GeneralJSON({
      payload: json.payload,
      disclosures,
      kb_jwt,
      signatures: json.signatures.map((s) => {
        var _a2;
        return {
          protected: s.protected,
          signature: s.signature,
          kid: (_a2 = s.header) == null ? void 0 : _a2.kid
        };
      })
    });
  }
  toJson() {
    return {
      payload: this.payload,
      signatures: this.signatures.map((s, i) => {
        if (i !== 0) {
          return {
            header: {
              kid: s.kid
            },
            protected: s.protected,
            signature: s.signature
          };
        }
        return {
          header: {
            disclosures: this.disclosures,
            kid: s.kid,
            kb_jwt: this.kb_jwt
          },
          protected: s.protected,
          signature: s.signature
        };
      })
    };
  }
  toEncoded(index) {
    var _a;
    if (index < 0 || index >= this.signatures.length) {
      throw new SDJWTException("Index out of bounds");
    }
    const data = [];
    const { protected: protectedHeader, signature } = this.signatures[index];
    const jwt = `${protectedHeader}.${this.payload}.${signature}`;
    data.push(jwt);
    if (this.disclosures && this.disclosures.length > 0) {
      const disclosures = this.disclosures.join(SD_SEPARATOR);
      data.push(disclosures);
    }
    const kb = (_a = this.kb_jwt) != null ? _a : "";
    data.push(kb);
    return data.join(SD_SEPARATOR);
  }
  addSignature(protectedHeader, signer, kid) {
    return __async(this, null, function* () {
      const header = base64urlEncode(JSON.stringify(protectedHeader));
      const signature = yield signer(`${header}.${this.payload}`);
      this.signatures.push({
        protected: header,
        signature,
        kid
      });
    });
  }
};
var Jwt = class _Jwt {
  constructor(data) {
    this.header = data == null ? void 0 : data.header;
    this.payload = data == null ? void 0 : data.payload;
    this.signature = data == null ? void 0 : data.signature;
    this.encoded = data == null ? void 0 : data.encoded;
  }
  static decodeJWT(jwt) {
    return decodeJwt(jwt);
  }
  static fromEncode(encodedJwt) {
    const { header, payload, signature } = _Jwt.decodeJWT(
      encodedJwt
    );
    const jwt = new _Jwt({
      header,
      payload,
      signature,
      encoded: encodedJwt
    });
    return jwt;
  }
  setHeader(header) {
    this.header = header;
    this.encoded = void 0;
    return this;
  }
  setPayload(payload) {
    this.payload = payload;
    this.encoded = void 0;
    return this;
  }
  getUnsignedToken() {
    if (!this.header || !this.payload) {
      throw new SDJWTException("Serialize Error: Invalid JWT");
    }
    if (this.encoded) {
      const parts = this.encoded.split(".");
      if (parts.length !== 3) {
        throw new SDJWTException(`Invalid JWT format: ${this.encoded}`);
      }
      const unsignedToken = parts.slice(0, 2).join(".");
      return unsignedToken;
    }
    const header = base64urlEncode(JSON.stringify(this.header));
    const payload = base64urlEncode(JSON.stringify(this.payload));
    return `${header}.${payload}`;
  }
  sign(signer) {
    return __async(this, null, function* () {
      const data = this.getUnsignedToken();
      this.signature = yield signer(data);
      return this.encodeJwt();
    });
  }
  encodeJwt() {
    if (this.encoded) {
      return this.encoded;
    }
    if (!this.header || !this.payload || !this.signature) {
      throw new SDJWTException("Serialize Error: Invalid JWT");
    }
    const header = base64urlEncode(JSON.stringify(this.header));
    const payload = base64urlEncode(JSON.stringify(this.payload));
    const signature = this.signature;
    const compact = `${header}.${payload}.${signature}`;
    this.encoded = compact;
    return compact;
  }
  /**
   * Verify the JWT using the provided verifier function.
   * It checks the signature and validates the iat, nbf, and exp claims if they are present.
   * @param verifier
   * @param options - Options for verification, such as current date and skew seconds
   * @returns
   */
  verify(verifier, options) {
    return __async(this, null, function* () {
      var _a, _b, _c, _d;
      const skew = (options == null ? void 0 : options.skewSeconds) ? options.skewSeconds : 0;
      const currentDate = (_a = options == null ? void 0 : options.currentDate) != null ? _a : Math.floor(Date.now() / 1e3);
      const iat = (_b = this.payload) == null ? void 0 : _b.iat;
      const nbf = (_c = this.payload) == null ? void 0 : _c.nbf;
      const exp = (_d = this.payload) == null ? void 0 : _d.exp;
      if (typeof iat === "number" && iat - skew > currentDate) {
        throw new SDJWTException("Verify Error: JWT is not yet valid");
      }
      if (typeof nbf === "number" && nbf - skew > currentDate) {
        throw new SDJWTException("Verify Error: JWT is not yet valid");
      }
      if (typeof exp === "number" && exp + skew < currentDate) {
        throw new SDJWTException("Verify Error: JWT is expired");
      }
      if (!this.signature) {
        throw new SDJWTException("Verify Error: no signature in JWT");
      }
      const data = this.getUnsignedToken();
      const verified = yield verifier(data, this.signature, options);
      if (!verified) {
        throw new SDJWTException("Verify Error: Invalid JWT Signature");
      }
      return { payload: this.payload, header: this.header };
    });
  }
};
var KBJwt = class _KBJwt extends Jwt {
  // Checking the validity of the key binding jwt
  // the type unknown is not good, but we don't know at this point how to get the public key of the signer, this is defined in the kbVerifier
  verifyKB(values) {
    return __async(this, null, function* () {
      if (!this.header || !this.payload || !this.signature) {
        throw new SDJWTException("Verify Error: Invalid JWT");
      }
      if (!this.header.alg || this.header.alg === "none" || !this.header.typ || this.header.typ !== KB_JWT_TYP || !this.payload.iat || !this.payload.aud || !this.payload.nonce || // this is for backward compatibility with version 06
      !(this.payload.sd_hash || "_sd_hash" in this.payload && this.payload._sd_hash)) {
        throw new SDJWTException("Invalid Key Binding Jwt");
      }
      if (this.payload.nonce !== values.nonce) {
        throw new SDJWTException("Verify Error: Invalid Nonce");
      }
      yield this.verify(
        (data, sig) => values.verifier(data, sig, values.payload),
        values.options
      );
      return { payload: this.payload, header: this.header };
    });
  }
  // This function is for creating KBJwt object for verify properly
  static fromKBEncode(encodedJwt) {
    const { header, payload, signature } = Jwt.decodeJWT(
      encodedJwt
    );
    const jwt = new _KBJwt({
      header,
      payload,
      signature,
      encoded: encodedJwt
    });
    return jwt;
  }
};
var createDecoy = (hash, saltGenerator) => __async(null, null, function* () {
  const { hasher, alg } = hash;
  const salt = yield saltGenerator(16);
  const decoy = yield hasher(salt, alg);
  return uint8ArrayToBase64Url(decoy);
});
var presentableKeys = (rawPayload, disclosures, hasher) => __async(null, null, function* () {
  const { disclosureKeymap } = yield unpack(rawPayload, disclosures, hasher);
  return Object.keys(disclosureKeymap).sort();
});
var presentableKeysSync = (rawPayload, disclosures, hasher) => {
  const { disclosureKeymap } = unpackSync(rawPayload, disclosures, hasher);
  return Object.keys(disclosureKeymap).sort();
};
var present = (sdJwt, presentFrame, hasher) => __async(null, null, function* () {
  const { jwt, kbJwt } = splitSdJwt(sdJwt);
  const {
    jwt: { payload },
    disclosures
  } = yield decodeSdJwt(sdJwt, hasher);
  const { _sd_alg: alg } = getSDAlgAndPayload(payload);
  const hash = { alg, hasher };
  const keys = transformPresentationFrame(presentFrame);
  const hashmap = yield createHashMapping(disclosures, hash);
  const { disclosureKeymap } = yield unpack(payload, disclosures, hasher);
  const presentedDisclosures = keys.map((k) => hashmap[disclosureKeymap[k]]).filter((d) => d !== void 0);
  return [
    jwt,
    ...presentedDisclosures.map((d) => d.encode()),
    kbJwt != null ? kbJwt : ""
  ].join(SD_SEPARATOR);
});
var presentSync = (sdJwt, presentFrame, hasher) => {
  const { jwt, kbJwt } = splitSdJwt(sdJwt);
  const {
    jwt: { payload },
    disclosures
  } = decodeSdJwtSync(sdJwt, hasher);
  const { _sd_alg: alg } = getSDAlgAndPayload(payload);
  const hash = { alg, hasher };
  const keys = transformPresentationFrame(presentFrame);
  const hashmap = createHashMappingSync(disclosures, hash);
  const { disclosureKeymap } = unpackSync(payload, disclosures, hasher);
  const presentedDisclosures = keys.map((k) => hashmap[disclosureKeymap[k]]).filter((d) => d !== void 0);
  return [
    jwt,
    ...presentedDisclosures.map((d) => d.encode()),
    kbJwt != null ? kbJwt : ""
  ].join(SD_SEPARATOR);
};
var transformPresentationFrame = (obj, prefix = "") => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "boolean") {
      if (value) {
        acc.push(newPrefix);
      }
    } else if (typeof value === "object" && value !== null) {
      acc.push(
        newPrefix,
        ...transformPresentationFrame(
          value,
          newPrefix
        )
      );
    }
    return acc;
  }, []);
};
var createHashMappingForSerializedDisclosure = (disclosures) => {
  const map = {};
  for (let i = 0; i < disclosures.length; i++) {
    const disclosure = disclosures[i];
    const { digest, encoded, key, salt, value } = disclosure;
    map[digest] = Disclosure.fromArray(
      key ? [salt, key, value] : [salt, value],
      { digest, encoded }
    );
  }
  return map;
};
var selectDisclosures = (payload, disclosures, presentationFrame) => {
  if (disclosures.length === 0) {
    return [];
  }
  const hashmap = createHashMappingForSerializedDisclosure(disclosures);
  const { disclosureKeymap } = unpackObj(payload, hashmap);
  const keys = transformPresentationFrame(presentationFrame);
  const presentedDisclosures = keys.map((k) => hashmap[disclosureKeymap[k]]).filter((d) => d !== void 0);
  const selectedDisclosures = presentedDisclosures.map(
    (d) => {
      const { salt, key, value, _digest } = d;
      if (!_digest) {
        throw new SDJWTException(
          "Implementation error: _digest is not defined"
        );
      }
      return {
        digest: _digest,
        encoded: d.encode(),
        salt,
        key,
        value
      };
    }
  );
  return selectedDisclosures;
};
var SDJwt = class _SDJwt {
  constructor(data) {
    this.jwt = data == null ? void 0 : data.jwt;
    this.disclosures = data == null ? void 0 : data.disclosures;
    this.kbJwt = data == null ? void 0 : data.kbJwt;
  }
  static decodeSDJwt(sdjwt, hasher) {
    return __async(this, null, function* () {
      const [encodedJwt, ...encodedDisclosures] = sdjwt.split(SD_SEPARATOR);
      const jwt = Jwt.fromEncode(encodedJwt);
      if (!jwt.payload) {
        throw new Error("Payload is undefined on the JWT. Invalid state reached");
      }
      if (encodedDisclosures.length === 0) {
        return {
          jwt,
          disclosures: []
        };
      }
      const encodedKeyBindingJwt = encodedDisclosures.pop();
      const kbJwt = encodedKeyBindingJwt ? KBJwt.fromKBEncode(encodedKeyBindingJwt) : void 0;
      const { _sd_alg } = getSDAlgAndPayload(jwt.payload);
      const disclosures = yield Promise.all(
        encodedDisclosures.map(
          (ed) => Disclosure.fromEncode(ed, { alg: _sd_alg, hasher })
        )
      );
      return {
        jwt,
        disclosures,
        kbJwt
      };
    });
  }
  static extractJwt(encodedSdJwt) {
    return __async(this, null, function* () {
      const [encodedJwt, ..._encodedDisclosures] = encodedSdJwt.split(SD_SEPARATOR);
      return Jwt.fromEncode(encodedJwt);
    });
  }
  static fromEncode(encodedSdJwt, hasher) {
    return __async(this, null, function* () {
      const { jwt, disclosures, kbJwt } = yield _SDJwt.decodeSDJwt(encodedSdJwt, hasher);
      return new _SDJwt({
        jwt,
        disclosures,
        kbJwt
      });
    });
  }
  present(presentFrame, hasher) {
    return __async(this, null, function* () {
      const disclosures = yield this.getPresentDisclosures(presentFrame, hasher);
      const presentSDJwt = new _SDJwt({
        jwt: this.jwt,
        disclosures,
        kbJwt: this.kbJwt
      });
      return presentSDJwt.encodeSDJwt();
    });
  }
  getPresentDisclosures(presentFrame, hasher) {
    return __async(this, null, function* () {
      var _a;
      if (!((_a = this.jwt) == null ? void 0 : _a.payload) || !this.disclosures) {
        throw new SDJWTException("Invalid sd-jwt: jwt or disclosures is missing");
      }
      const { _sd_alg: alg } = getSDAlgAndPayload(this.jwt.payload);
      const hash = { alg, hasher };
      const hashmap = yield createHashMapping(this.disclosures, hash);
      const { disclosureKeymap } = yield unpack(
        this.jwt.payload,
        this.disclosures,
        hasher
      );
      const keys = presentFrame ? transformPresentationFrame(presentFrame) : yield this.presentableKeys(hasher);
      const disclosures = keys.map((k) => hashmap[disclosureKeymap[k]]).filter((d) => d !== void 0);
      return disclosures;
    });
  }
  encodeSDJwt() {
    const data = [];
    if (!this.jwt) {
      throw new SDJWTException("Invalid sd-jwt: jwt is missing");
    }
    const encodedJwt = this.jwt.encodeJwt();
    data.push(encodedJwt);
    if (this.disclosures && this.disclosures.length > 0) {
      const encodeddisclosures = this.disclosures.map((dc) => dc.encode()).join(SD_SEPARATOR);
      data.push(encodeddisclosures);
    }
    data.push(this.kbJwt ? this.kbJwt.encodeJwt() : "");
    return data.join(SD_SEPARATOR);
  }
  keys(hasher) {
    return __async(this, null, function* () {
      return listKeys(yield this.getClaims(hasher)).sort();
    });
  }
  presentableKeys(hasher) {
    return __async(this, null, function* () {
      var _a, _b;
      if (!((_a = this.jwt) == null ? void 0 : _a.payload) || !this.disclosures) {
        throw new SDJWTException("Invalid sd-jwt: jwt or disclosures is missing");
      }
      const { disclosureKeymap } = yield unpack(
        (_b = this.jwt) == null ? void 0 : _b.payload,
        this.disclosures,
        hasher
      );
      return Object.keys(disclosureKeymap).sort();
    });
  }
  getClaims(hasher) {
    return __async(this, null, function* () {
      var _a;
      if (!((_a = this.jwt) == null ? void 0 : _a.payload) || !this.disclosures) {
        throw new SDJWTException("Invalid sd-jwt: jwt or disclosures is missing");
      }
      const { unpackedObj } = yield unpack(
        this.jwt.payload,
        this.disclosures,
        hasher
      );
      return unpackedObj;
    });
  }
};
var listKeys = (obj, prefix = "") => {
  const keys = [];
  for (const key in obj) {
    if (obj[key] === void 0) continue;
    const newKey = prefix ? `${prefix}.${key}` : key;
    keys.push(newKey);
    const value = obj[key];
    if (value && typeof value === "object") {
      keys.push(...listKeys(value, newKey));
    }
  }
  return keys;
};
var pack = (claims, disclosureFrame, hash, saltGenerator) => __async(null, null, function* () {
  var _a, _b;
  if (!disclosureFrame) {
    return {
      packedClaims: claims,
      disclosures: []
    };
  }
  const sd = (_a = disclosureFrame[SD_DIGEST]) != null ? _a : [];
  const decoyCount = (_b = disclosureFrame[SD_DECOY]) != null ? _b : 0;
  if (Array.isArray(claims)) {
    const packedClaims2 = [];
    const disclosures2 = [];
    const recursivePackedClaims2 = {};
    for (const key in disclosureFrame) {
      if (key !== SD_DIGEST) {
        const idx = Number.parseInt(key, 10);
        const packed = yield pack(
          claims[idx],
          disclosureFrame[idx],
          hash,
          saltGenerator
        );
        recursivePackedClaims2[idx] = packed.packedClaims;
        disclosures2.push(...packed.disclosures);
      }
    }
    for (let i = 0; i < claims.length; i++) {
      const claim = recursivePackedClaims2[i] ? recursivePackedClaims2[i] : claims[i];
      if (sd.includes(i)) {
        const salt = yield saltGenerator(16);
        const disclosure = new Disclosure([salt, claim]);
        const digest = yield disclosure.digest(hash);
        packedClaims2.push({ [SD_LIST_KEY]: digest });
        disclosures2.push(disclosure);
      } else {
        packedClaims2.push(claim);
      }
    }
    for (let j = 0; j < decoyCount; j++) {
      const decoyDigest = yield createDecoy(hash, saltGenerator);
      packedClaims2.push({ [SD_LIST_KEY]: decoyDigest });
    }
    return { packedClaims: packedClaims2, disclosures: disclosures2 };
  }
  const packedClaims = {};
  const disclosures = [];
  const recursivePackedClaims = {};
  for (const key in disclosureFrame) {
    if (key !== SD_DIGEST) {
      const packed = yield pack(
        // @ts-expect-error
        claims[key],
        disclosureFrame[key],
        hash,
        saltGenerator
      );
      recursivePackedClaims[key] = packed.packedClaims;
      disclosures.push(...packed.disclosures);
    }
  }
  const _sd = [];
  for (const key in claims) {
    const claim = recursivePackedClaims[key] ? recursivePackedClaims[key] : claims[key];
    if (sd.includes(key)) {
      const salt = yield saltGenerator(16);
      const disclosure = new Disclosure([salt, key, claim]);
      const digest = yield disclosure.digest(hash);
      _sd.push(digest);
      disclosures.push(disclosure);
    } else {
      packedClaims[key] = claim;
    }
  }
  for (let j = 0; j < decoyCount; j++) {
    const decoyDigest = yield createDecoy(hash, saltGenerator);
    _sd.push(decoyDigest);
  }
  if (_sd.length > 0) {
    packedClaims[SD_DIGEST] = _sd.sort();
  }
  return { packedClaims, disclosures };
});
var _SDJwtInstance = class _SDJwtInstance2 {
  constructor(userConfig) {
    this.userConfig = {};
    if (userConfig) {
      if (userConfig.hashAlg && !IANA_HASH_ALGORITHMS.includes(userConfig.hashAlg)) {
        throw new SDJWTException(
          `Invalid hash algorithm: ${userConfig.hashAlg}`
        );
      }
      this.userConfig = userConfig;
    }
  }
  createKBJwt(options, sdHash) {
    return __async(this, null, function* () {
      if (!this.userConfig.kbSigner) {
        throw new SDJWTException("Key Binding Signer not found");
      }
      if (!this.userConfig.kbSignAlg) {
        throw new SDJWTException("Key Binding sign algorithm not specified");
      }
      const { payload } = options;
      const kbJwt = new KBJwt({
        header: {
          typ: KB_JWT_TYP,
          alg: this.userConfig.kbSignAlg
        },
        payload: __spreadProps(__spreadValues({}, payload), { sd_hash: sdHash })
      });
      yield kbJwt.sign(this.userConfig.kbSigner);
      return kbJwt;
    });
  }
  SignJwt(jwt) {
    return __async(this, null, function* () {
      if (!this.userConfig.signer) {
        throw new SDJWTException("Signer not found");
      }
      yield jwt.sign(this.userConfig.signer);
      return jwt;
    });
  }
  VerifyJwt(jwt, options) {
    return __async(this, null, function* () {
      if (!this.userConfig.verifier) {
        throw new SDJWTException("Verifier not found");
      }
      return jwt.verify(this.userConfig.verifier, options);
    });
  }
  issue(payload, disclosureFrame, options) {
    return __async(this, null, function* () {
      var _a, _b;
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      if (!this.userConfig.saltGenerator) {
        throw new SDJWTException("SaltGenerator not found");
      }
      if (!this.userConfig.signAlg) {
        throw new SDJWTException("sign alogrithm not specified");
      }
      this.validateReservedFields(payload);
      this.validateDisclosureFrame(disclosureFrame);
      const hasher = this.userConfig.hasher;
      const hashAlg = (_a = this.userConfig.hashAlg) != null ? _a : _SDJwtInstance2.DEFAULT_hashAlg;
      const { packedClaims, disclosures } = yield pack(
        payload,
        disclosureFrame,
        { hasher, alg: hashAlg },
        this.userConfig.saltGenerator
      );
      const alg = this.userConfig.signAlg;
      const OptionHeader = (_b = options == null ? void 0 : options.header) != null ? _b : {};
      const CustomHeader = this.userConfig.omitTyp ? OptionHeader : __spreadValues({ typ: this.type }, OptionHeader);
      const header = __spreadProps(__spreadValues({}, CustomHeader), { alg });
      const jwt = new Jwt({
        header,
        payload: __spreadProps(__spreadValues({}, packedClaims), {
          _sd_alg: disclosureFrame ? hashAlg : void 0
        })
      });
      yield this.SignJwt(jwt);
      const sdJwt = new SDJwt({
        jwt,
        disclosures
      });
      return sdJwt.encodeSDJwt();
    });
  }
  /**
   * Validates if the payload contains any reserved claim names. If so it will throw an error.
   * @param payload
   * @returns
   */
  validateReservedFields(payload) {
    const reservedFields = /* @__PURE__ */ new Set([SD_DIGEST, "_sd_alg", SD_DECOY]);
    const visit = (node) => {
      if (!node || typeof node !== "object") {
        return;
      }
      for (const [key, value] of Object.entries(
        node
      )) {
        if (reservedFields.has(key)) {
          throw new SDJWTException(
            `Reserved field name "${key}" is not allowed`
          );
        }
        visit(value);
      }
    };
    visit(payload);
  }
  validateDisclosureFrame(_disclosureFrame) {
    return;
  }
  present(encodedSDJwt, presentationFrame, options) {
    return __async(this, null, function* () {
      var _a;
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      const hasher = this.userConfig.hasher;
      const sdjwt = yield SDJwt.fromEncode(encodedSDJwt, hasher);
      if (!((_a = sdjwt.jwt) == null ? void 0 : _a.payload)) throw new SDJWTException("Payload not found");
      const presentSdJwtWithoutKb = yield sdjwt.present(
        presentationFrame,
        hasher
      );
      if (!(options == null ? void 0 : options.kb)) {
        return presentSdJwtWithoutKb;
      }
      const sdHashStr = yield this.calculateSDHash(
        presentSdJwtWithoutKb,
        sdjwt,
        hasher
      );
      sdjwt.kbJwt = yield this.createKBJwt(options.kb, sdHashStr);
      return sdjwt.present(presentationFrame, hasher);
    });
  }
  // This function is for verifying the SD JWT
  // If requiredClaimKeys is provided, it will check if the required claim keys are presentation in the SD JWT
  // If requireKeyBindings is true, it will check if the key binding JWT is presentation and verify it
  verify(encodedSDJwt, options) {
    return __async(this, null, function* () {
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      const hasher = this.userConfig.hasher;
      const sdjwt = yield SDJwt.fromEncode(encodedSDJwt, hasher);
      if (!sdjwt.jwt || !sdjwt.jwt.payload) {
        throw new SDJWTException("Invalid SD JWT");
      }
      const { payload, header } = yield this.validate(encodedSDJwt, options);
      if (options == null ? void 0 : options.requiredClaimKeys) {
        const keys = yield sdjwt.keys(hasher);
        const missingKeys = options.requiredClaimKeys.filter(
          (k) => !keys.includes(k)
        );
        if (missingKeys.length > 0) {
          throw new SDJWTException(
            `Missing required claim keys: ${missingKeys.join(", ")}`
          );
        }
      }
      if (!(options == null ? void 0 : options.keyBindingNonce)) {
        return { payload, header };
      }
      if (!sdjwt.kbJwt) {
        throw new SDJWTException("Key Binding JWT not exist");
      }
      if (!this.userConfig.kbVerifier) {
        throw new SDJWTException("Key Binding Verifier not found");
      }
      const kb = yield sdjwt.kbJwt.verifyKB({
        verifier: this.userConfig.kbVerifier,
        payload,
        nonce: options.keyBindingNonce,
        options
      });
      if (!kb) {
        throw new Error("signature is not valid");
      }
      const sdHashfromKb = kb.payload.sd_hash;
      const sdjwtWithoutKb = new SDJwt({
        jwt: sdjwt.jwt,
        disclosures: sdjwt.disclosures
      });
      const presentSdJwtWithoutKb = sdjwtWithoutKb.encodeSDJwt();
      const sdHashStr = yield this.calculateSDHash(
        presentSdJwtWithoutKb,
        sdjwt,
        hasher
      );
      if (sdHashStr !== sdHashfromKb) {
        throw new SDJWTException("Invalid sd_hash in Key Binding JWT");
      }
      return { payload, header, kb };
    });
  }
  /**
   * Safe verification that collects all errors instead of failing fast.
   * Returns a result object with either the verified data or an array of all errors.
   *
   * @param encodedSDJwt - The encoded SD-JWT to verify
   * @param options - Verification options
   * @returns A SafeVerifyResult containing either success data or collected errors
   */
  safeVerify(encodedSDJwt, options) {
    return __async(this, null, function* () {
      const errors = [];
      const addError = (code, message, details) => {
        errors.push({ code, message, details });
      };
      const exceptionToCode = (error) => {
        const message = error.message.toLowerCase();
        if (message.includes("hasher not found")) return "HASHER_NOT_FOUND";
        if (message.includes("verifier not found")) return "VERIFIER_NOT_FOUND";
        if (message.includes("invalid sd jwt") || message.includes("invalid jwt"))
          return "INVALID_SD_JWT";
        if (message.includes("not yet valid")) return "JWT_NOT_YET_VALID";
        if (message.includes("expired")) return "JWT_EXPIRED";
        if (message.includes("signature")) return "INVALID_JWT_SIGNATURE";
        if (message.includes("missing required claim"))
          return "MISSING_REQUIRED_CLAIMS";
        if (message.includes("key binding jwt not exist"))
          return "KEY_BINDING_JWT_MISSING";
        if (message.includes("key binding verifier not found"))
          return "KEY_BINDING_VERIFIER_NOT_FOUND";
        if (message.includes("sd_hash")) return "KEY_BINDING_SD_HASH_INVALID";
        return "UNKNOWN_ERROR";
      };
      if (!this.userConfig.hasher) {
        addError("HASHER_NOT_FOUND", "Hasher not found");
      }
      if (!this.userConfig.verifier) {
        addError("VERIFIER_NOT_FOUND", "Verifier not found");
      }
      if (errors.length > 0) {
        return { success: false, errors };
      }
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      const hasher = this.userConfig.hasher;
      let sdjwt;
      let payload;
      let header;
      try {
        sdjwt = yield SDJwt.fromEncode(encodedSDJwt, hasher);
        if (!sdjwt.jwt || !sdjwt.jwt.payload) {
          addError("INVALID_SD_JWT", "Invalid SD JWT: missing JWT or payload");
        }
      } catch (e) {
        const error = ensureError(e);
        addError(
          "INVALID_SD_JWT",
          `Failed to decode SD-JWT: ${error.message}`,
          error
        );
      }
      if (sdjwt == null ? void 0 : sdjwt.jwt) {
        try {
          const result = yield this.VerifyJwt(sdjwt.jwt, options);
          header = result.header;
          const claims = yield sdjwt.getClaims(hasher);
          payload = claims;
        } catch (e) {
          const error = ensureError(e);
          const code = exceptionToCode(error);
          addError(code, error.message, error);
        }
      }
      if (sdjwt && (options == null ? void 0 : options.requiredClaimKeys)) {
        try {
          const keys = yield sdjwt.keys(hasher);
          const missingKeys = options.requiredClaimKeys.filter(
            (k) => !keys.includes(k)
          );
          if (missingKeys.length > 0) {
            addError(
              "MISSING_REQUIRED_CLAIMS",
              `Missing required claim keys: ${missingKeys.join(", ")}`,
              { missingKeys }
            );
          }
        } catch (e) {
          const error = ensureError(e);
          addError(
            "UNKNOWN_ERROR",
            `Failed to check required claims: ${error.message}`,
            error
          );
        }
      }
      let kb;
      if ((options == null ? void 0 : options.keyBindingNonce) && sdjwt) {
        if (!sdjwt.kbJwt) {
          addError("KEY_BINDING_JWT_MISSING", "Key Binding JWT not exist");
        } else if (!this.userConfig.kbVerifier) {
          addError(
            "KEY_BINDING_VERIFIER_NOT_FOUND",
            "Key Binding Verifier not found"
          );
        } else if (payload) {
          try {
            const kbResult = yield sdjwt.kbJwt.verifyKB({
              verifier: this.userConfig.kbVerifier,
              payload,
              nonce: options.keyBindingNonce,
              options
            });
            if (!kbResult) {
              addError(
                "KEY_BINDING_SIGNATURE_INVALID",
                "Key binding signature is not valid"
              );
            } else {
              kb = kbResult;
              const sdjwtWithoutKb = new SDJwt({
                jwt: sdjwt.jwt,
                disclosures: sdjwt.disclosures
              });
              const presentSdJwtWithoutKb = sdjwtWithoutKb.encodeSDJwt();
              const sdHashStr = yield this.calculateSDHash(
                presentSdJwtWithoutKb,
                sdjwt,
                hasher
              );
              if (sdHashStr !== kbResult.payload.sd_hash) {
                addError(
                  "KEY_BINDING_SD_HASH_INVALID",
                  "Invalid sd_hash in Key Binding JWT",
                  {
                    expected: sdHashStr,
                    received: kbResult.payload.sd_hash
                  }
                );
              }
            }
          } catch (e) {
            const error = ensureError(e);
            addError(
              "KEY_BINDING_SIGNATURE_INVALID",
              `Key binding verification failed: ${error.message}`,
              error
            );
          }
        }
      }
      if (errors.length > 0) {
        return { success: false, errors };
      }
      return {
        success: true,
        data: {
          payload,
          header,
          kb
        }
      };
    });
  }
  calculateSDHash(presentSdJwtWithoutKb, sdjwt, hasher) {
    return __async(this, null, function* () {
      if (!sdjwt.jwt || !sdjwt.jwt.payload) {
        throw new SDJWTException("Invalid SD JWT");
      }
      const { _sd_alg } = getSDAlgAndPayload(sdjwt.jwt.payload);
      const sdHash = yield hasher(presentSdJwtWithoutKb, _sd_alg);
      const sdHashStr = uint8ArrayToBase64Url(sdHash);
      return sdHashStr;
    });
  }
  /**
   * This function is for validating the SD JWT
   * Checking signature, if provided the iat and exp when provided and return its the claims
   * @param encodedSDJwt
   * @param options
   * @returns
   */
  validate(encodedSDJwt, options) {
    return __async(this, null, function* () {
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      const hasher = this.userConfig.hasher;
      const sdjwt = yield SDJwt.fromEncode(encodedSDJwt, hasher);
      if (!sdjwt.jwt) {
        throw new SDJWTException("Invalid SD JWT");
      }
      const verifiedPayloads = yield this.VerifyJwt(sdjwt.jwt, options);
      const claims = yield sdjwt.getClaims(hasher);
      return { payload: claims, header: verifiedPayloads.header };
    });
  }
  config(newConfig) {
    this.userConfig = __spreadValues(__spreadValues({}, this.userConfig), newConfig);
  }
  encode(sdJwt) {
    return sdJwt.encodeSDJwt();
  }
  decode(endcodedSDJwt) {
    if (!this.userConfig.hasher) {
      throw new SDJWTException("Hasher not found");
    }
    return SDJwt.fromEncode(endcodedSDJwt, this.userConfig.hasher);
  }
  keys(endcodedSDJwt) {
    return __async(this, null, function* () {
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      const sdjwt = yield SDJwt.fromEncode(endcodedSDJwt, this.userConfig.hasher);
      return sdjwt.keys(this.userConfig.hasher);
    });
  }
  presentableKeys(endcodedSDJwt) {
    return __async(this, null, function* () {
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      const sdjwt = yield SDJwt.fromEncode(endcodedSDJwt, this.userConfig.hasher);
      return sdjwt.presentableKeys(this.userConfig.hasher);
    });
  }
  getClaims(endcodedSDJwt) {
    return __async(this, null, function* () {
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      const sdjwt = yield SDJwt.fromEncode(endcodedSDJwt, this.userConfig.hasher);
      return sdjwt.getClaims(this.userConfig.hasher);
    });
  }
  toFlattenJSON(endcodedSDJwt) {
    return FlattenJSON.fromEncode(endcodedSDJwt);
  }
  toGeneralJSON(endcodedSDJwt) {
    return GeneralJSON.fromEncode(endcodedSDJwt);
  }
};
_SDJwtInstance.DEFAULT_hashAlg = "sha-256";
var SDJwtInstance = _SDJwtInstance;
var SDJwtGeneralJSONInstance = class {
  constructor(userConfig) {
    this.userConfig = {};
    if (userConfig) {
      if (userConfig.hashAlg && !IANA_HASH_ALGORITHMS.includes(userConfig.hashAlg)) {
        throw new SDJWTException(
          `Invalid hash algorithm: ${userConfig.hashAlg}`
        );
      }
      this.userConfig = userConfig;
    }
  }
  createKBJwt(options, sdHash) {
    return __async(this, null, function* () {
      if (!this.userConfig.kbSigner) {
        throw new SDJWTException("Key Binding Signer not found");
      }
      if (!this.userConfig.kbSignAlg) {
        throw new SDJWTException("Key Binding sign algorithm not specified");
      }
      const { payload } = options;
      const kbJwt = new KBJwt({
        header: {
          typ: KB_JWT_TYP,
          alg: this.userConfig.kbSignAlg
        },
        payload: __spreadProps(__spreadValues({}, payload), { sd_hash: sdHash })
      });
      yield kbJwt.sign(this.userConfig.kbSigner);
      return kbJwt;
    });
  }
  encodeObj(obj) {
    return base64urlEncode(JSON.stringify(obj));
  }
  issue(payload, disclosureFrame, options) {
    return __async(this, null, function* () {
      var _a;
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      if (!this.userConfig.saltGenerator) {
        throw new SDJWTException("SaltGenerator not found");
      }
      this.validateReservedFields(payload);
      this.validateDisclosureFrame(disclosureFrame);
      const hasher = this.userConfig.hasher;
      const hashAlg = (_a = this.userConfig.hashAlg) != null ? _a : SDJwtInstance.DEFAULT_hashAlg;
      const { packedClaims, disclosures } = yield pack(
        payload,
        disclosureFrame,
        { hasher, alg: hashAlg },
        this.userConfig.saltGenerator
      );
      const encodedSDJwtPayload = this.encodeObj(__spreadProps(__spreadValues({}, packedClaims), {
        _sd_alg: disclosureFrame ? hashAlg : void 0
      }));
      const encodedDisclosures = disclosures.map(
        (disclosure) => disclosure.encode()
      );
      const signatures = yield Promise.all(
        options.sigs.map((s) => __async(this, null, function* () {
          const { signer, alg, kid, header } = s;
          const protectedHeader = __spreadValues({ typ: this.type, alg, kid }, header);
          const encodedProtectedHeader = this.encodeObj(protectedHeader);
          const signature = yield signer(
            `${encodedProtectedHeader}.${encodedSDJwtPayload}`
          );
          return {
            protected: encodedProtectedHeader,
            signature
          };
        }))
      );
      const generalJson = new GeneralJSON({
        payload: encodedSDJwtPayload,
        disclosures: encodedDisclosures,
        signatures
      });
      return generalJson;
    });
  }
  /**
   * Validates if the payload contains any reserved claim names. If so it will throw an error.
   * @param payload
   * @returns
   */
  validateReservedFields(payload) {
    const reservedFields = /* @__PURE__ */ new Set([SD_DIGEST, "_sd_alg", SD_DECOY]);
    const visit = (node) => {
      if (!node || typeof node !== "object") {
        return;
      }
      for (const [key, value] of Object.entries(
        node
      )) {
        if (reservedFields.has(key)) {
          throw new SDJWTException(
            `Reserved field name "${key}" is not allowed`
          );
        }
        visit(value);
      }
    };
    visit(payload);
  }
  validateDisclosureFrame(_disclosureFrame) {
    return;
  }
  present(generalJSON, presentationFrame, options) {
    return __async(this, null, function* () {
      var _a;
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      const hasher = this.userConfig.hasher;
      const encodedSDJwt = generalJSON.toEncoded(0);
      const sdjwt = yield SDJwt.fromEncode(encodedSDJwt, hasher);
      if (!((_a = sdjwt.jwt) == null ? void 0 : _a.payload)) throw new SDJWTException("Payload not found");
      const disclosures = yield sdjwt.getPresentDisclosures(
        presentationFrame,
        hasher
      );
      const encodedDisclosures = disclosures.map((d) => d.encode());
      const presentedGeneralJSON = new GeneralJSON({
        payload: generalJSON.payload,
        disclosures: encodedDisclosures,
        signatures: generalJSON.signatures
      });
      if (!(options == null ? void 0 : options.kb)) {
        return presentedGeneralJSON;
      }
      const presentSdJwtWithoutKb = yield sdjwt.present(
        presentationFrame,
        hasher
      );
      const sdHashStr = yield this.calculateSDHash(
        presentSdJwtWithoutKb,
        sdjwt,
        hasher
      );
      const kbJwt = yield this.createKBJwt(options.kb, sdHashStr);
      const encodedKbJwt = kbJwt.encodeJwt();
      presentedGeneralJSON.kb_jwt = encodedKbJwt;
      return presentedGeneralJSON;
    });
  }
  // This function is for verifying the SD JWT
  // If requiredClaimKeys is provided, it will check if the required claim keys are presentation in the SD JWT
  // If requireKeyBindings is true, it will check if the key binding JWT is presentation and verify it
  verify(generalJSON, options) {
    return __async(this, null, function* () {
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      const hasher = this.userConfig.hasher;
      const { payload, headers } = yield this.validate(generalJSON);
      const encodedSDJwt = generalJSON.toEncoded(0);
      const sdjwt = yield SDJwt.fromEncode(encodedSDJwt, hasher);
      if (!sdjwt.jwt || !sdjwt.jwt.payload) {
        throw new SDJWTException("Invalid SD JWT");
      }
      if (options == null ? void 0 : options.requiredClaimKeys) {
        const keys = yield sdjwt.keys(hasher);
        const missingKeys = options == null ? void 0 : options.requiredClaimKeys.filter(
          (k) => !keys.includes(k)
        );
        if (missingKeys.length > 0) {
          throw new SDJWTException(
            `Missing required claim keys: ${missingKeys.join(", ")}`
          );
        }
      }
      if (!(options == null ? void 0 : options.keyBindingNonce)) {
        return { payload, headers };
      }
      if (!sdjwt.kbJwt) {
        throw new SDJWTException("Key Binding JWT not exist");
      }
      if (!this.userConfig.kbVerifier) {
        throw new SDJWTException("Key Binding Verifier not found");
      }
      const kb = yield sdjwt.kbJwt.verifyKB({
        verifier: this.userConfig.kbVerifier,
        payload,
        nonce: options.keyBindingNonce,
        options
      });
      if (!kb) {
        throw new Error("signature is not valid");
      }
      const sdHashfromKb = kb.payload.sd_hash;
      const sdjwtWithoutKb = new SDJwt({
        jwt: sdjwt.jwt,
        disclosures: sdjwt.disclosures
      });
      const presentSdJwtWithoutKb = sdjwtWithoutKb.encodeSDJwt();
      const sdHashStr = yield this.calculateSDHash(
        presentSdJwtWithoutKb,
        sdjwt,
        hasher
      );
      if (sdHashStr !== sdHashfromKb) {
        throw new SDJWTException("Invalid sd_hash in Key Binding JWT");
      }
      return { payload, headers, kb };
    });
  }
  calculateSDHash(presentSdJwtWithoutKb, sdjwt, hasher) {
    return __async(this, null, function* () {
      if (!sdjwt.jwt || !sdjwt.jwt.payload) {
        throw new SDJWTException("Invalid SD JWT");
      }
      const { _sd_alg } = getSDAlgAndPayload(sdjwt.jwt.payload);
      const sdHash = yield hasher(presentSdJwtWithoutKb, _sd_alg);
      const sdHashStr = uint8ArrayToBase64Url(sdHash);
      return sdHashStr;
    });
  }
  // This function is for validating the SD JWT
  // Just checking signature and return its the claims
  validate(generalJSON) {
    return __async(this, null, function* () {
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      if (!this.userConfig.verifier) {
        throw new SDJWTException("Verifier not found");
      }
      const hasher = this.userConfig.hasher;
      const verifier = this.userConfig.verifier;
      const { payload, signatures } = generalJSON;
      const results = yield Promise.all(
        signatures.map((s) => __async(this, null, function* () {
          const { protected: encodedHeader, signature } = s;
          const verified2 = yield verifier(
            `${encodedHeader}.${payload}`,
            signature
          );
          const header = decodeBase64urlJsonStrict(encodedHeader, "Invalid JWT");
          return { verified: verified2, header };
        }))
      );
      const verified = results.every((r) => r.verified);
      if (!verified) {
        throw new SDJWTException("Signature is not valid");
      }
      const encodedSDJwt = generalJSON.toEncoded(0);
      const sdjwt = yield SDJwt.fromEncode(encodedSDJwt, hasher);
      if (!sdjwt.jwt) {
        throw new SDJWTException("Invalid SD JWT");
      }
      const claims = yield sdjwt.getClaims(hasher);
      return { payload: claims, headers: results.map((r) => r.header) };
    });
  }
  config(newConfig) {
    this.userConfig = __spreadValues(__spreadValues({}, this.userConfig), newConfig);
  }
  encode(sdJwt, index) {
    return sdJwt.toEncoded(index);
  }
  decode(endcodedSDJwt) {
    return GeneralJSON.fromEncode(endcodedSDJwt);
  }
  keys(generalSdjwt) {
    return __async(this, null, function* () {
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      const endcodedSDJwt = generalSdjwt.toEncoded(0);
      const sdjwt = yield SDJwt.fromEncode(endcodedSDJwt, this.userConfig.hasher);
      return sdjwt.keys(this.userConfig.hasher);
    });
  }
  presentableKeys(generalSdjwt) {
    return __async(this, null, function* () {
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      const endcodedSDJwt = generalSdjwt.toEncoded(0);
      const sdjwt = yield SDJwt.fromEncode(endcodedSDJwt, this.userConfig.hasher);
      return sdjwt.presentableKeys(this.userConfig.hasher);
    });
  }
  getClaims(generalSdjwt) {
    return __async(this, null, function* () {
      if (!this.userConfig.hasher) {
        throw new SDJWTException("Hasher not found");
      }
      const endcodedSDJwt = generalSdjwt.toEncoded(0);
      const sdjwt = yield SDJwt.fromEncode(endcodedSDJwt, this.userConfig.hasher);
      return sdjwt.getClaims(this.userConfig.hasher);
    });
  }
};
SDJwtGeneralJSONInstance.DEFAULT_hashAlg = "sha-256";
export {
  Disclosure,
  FlattenJSON,
  GeneralJSON,
  IANA_HASH_ALGORITHMS,
  Jwt,
  KBJwt,
  KB_JWT_TYP,
  SDJWTException,
  SDJwt,
  SDJwtGeneralJSONInstance,
  SDJwtInstance,
  SD_DECOY,
  SD_DIGEST,
  SD_LIST_KEY,
  SD_SEPARATOR,
  base64UrlToUint8Array,
  base64urlDecode,
  base64urlEncode,
  createDecoy,
  createHashMapping,
  createHashMappingForSerializedDisclosure,
  createHashMappingSync,
  decodeJwt,
  decodeSdJwt,
  decodeSdJwtSync,
  ensureError,
  getClaims,
  getClaimsSync,
  getSDAlgAndPayload,
  listKeys,
  pack,
  present,
  presentSync,
  presentableKeys,
  presentableKeysSync,
  selectDisclosures,
  splitSdJwt,
  transformPresentationFrame,
  uint8ArrayToBase64Url,
  unpack,
  unpackObj,
  unpackSync
};
