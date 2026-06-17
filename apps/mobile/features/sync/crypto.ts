import { gcm } from "@noble/ciphers/aes";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";

// 同步信封解密：必须与桌面端 settings_service.rs 的 encrypt_blob 逐字节一致，否则读不了桌面产出的快照。
// 布局：base64( magic(6) | salt(16) | nonce(12) | ciphertext+tag )
//   - 密钥：PBKDF2-HMAC-SHA256(password, salt, 600000) → 32 字节
//   - AES-256-GCM，nonce 12 字节，无 AAD，密文尾部含 16 字节认证标签
const MAGIC_SYNC = "RCSYN1";
const MAGIC_LEN = 6;
const SALT_LEN = 16;
const NONCE_LEN = 12;
const KEY_LEN = 32;
const GCM_TAG_LEN = 16;
const PBKDF2_ROUNDS = 600_000;

const B64_LOOKUP = (() => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < chars.length; i++) table[chars.charCodeAt(i)] = i;
  return table;
})();

/** 标准 base64（含 `+/` 与 `=` 填充）解码为字节。 */
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[\r\n\s]/g, "");
  const len = clean.length;
  const pad = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const outLen = Math.floor((len * 3) / 4) - pad;
  const out = new Uint8Array(outLen);
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_LOOKUP[clean.charCodeAt(i)];
    const c1 = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const c2 = clean.charCodeAt(i + 2) === 61 ? 0 : B64_LOOKUP[clean.charCodeAt(i + 2)];
    const c3 = clean.charCodeAt(i + 3) === 61 ? 0 : B64_LOOKUP[clean.charCodeAt(i + 3)];
    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (o < outLen) out[o++] = (triple >> 16) & 0xff;
    if (o < outLen) out[o++] = (triple >> 8) & 0xff;
    if (o < outLen) out[o++] = triple & 0xff;
  }
  return out;
}

const utf8Encoder = new TextEncoder();

// 手写 UTF-8 解码：不依赖 TextDecoder（Hermes 上并非全平台可用），正确处理中文与 emoji（含代理对）。
function bytesToUtf8(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk: number[] = [];
  let i = 0;
  const len = bytes.length;
  while (i < len) {
    const b0 = bytes[i++];
    let code: number;
    if (b0 < 0x80) {
      code = b0;
    } else if (b0 >= 0xc0 && b0 < 0xe0) {
      code = ((b0 & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if (b0 >= 0xe0 && b0 < 0xf0) {
      code = ((b0 & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else {
      const cp =
        (((b0 & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)) -
        0x10000;
      chunk.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      if (chunk.length >= 8192) {
        parts.push(String.fromCharCode(...chunk));
        chunk = [];
      }
      continue;
    }
    chunk.push(code);
    if (chunk.length >= 8192) {
      parts.push(String.fromCharCode(...chunk));
      chunk = [];
    }
  }
  if (chunk.length) parts.push(String.fromCharCode(...chunk));
  return parts.join("");
}

/** 解密同步信封，返回明文字节；密码错误或文件损坏会抛出。 */
export function decryptSyncBlob(b64Data: string, password: string): Uint8Array {
  const blob = base64ToBytes(b64Data.trim());
  if (blob.length < MAGIC_LEN + SALT_LEN + NONCE_LEN + GCM_TAG_LEN) {
    throw new Error("同步文件损坏或不完整");
  }
  for (let i = 0; i < MAGIC_LEN; i++) {
    if (blob[i] !== MAGIC_SYNC.charCodeAt(i)) throw new Error("不是小妍同步文件");
  }
  const salt = blob.subarray(MAGIC_LEN, MAGIC_LEN + SALT_LEN);
  const nonce = blob.subarray(MAGIC_LEN + SALT_LEN, MAGIC_LEN + SALT_LEN + NONCE_LEN);
  const cipherText = blob.subarray(MAGIC_LEN + SALT_LEN + NONCE_LEN);
  const key = pbkdf2(sha256, utf8Encoder.encode(password), salt, { c: PBKDF2_ROUNDS, dkLen: KEY_LEN });
  return gcm(key, nonce).decrypt(cipherText);
}

/** 解密并解析为 JSON。密码错误时 GCM 校验失败抛错。 */
export function decryptSyncJson<T>(b64Data: string, password: string): T {
  return JSON.parse(bytesToUtf8(decryptSyncBlob(b64Data, password))) as T;
}
