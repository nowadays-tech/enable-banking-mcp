import type { Env, StoredCredentials } from "../types";

const KV_CREDENTIALS_KEY = "enable_banking_credentials";

function base64Encode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveEncryptionKey(
  authSecret: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authSecret),
    "HKDF",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      salt,
      info: encoder.encode("enable-banking-credentials"),
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptPrivateKey(
  privateKey: string,
  authSecret: string
): Promise<{ encrypted: string; iv: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(authSecret, salt);

  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(privateKey)
  );

  return {
    encrypted: base64Encode(encrypted),
    iv: base64Encode(iv),
    salt: base64Encode(salt),
  };
}

export async function decryptPrivateKey(
  encrypted: string,
  iv: string,
  salt: string,
  authSecret: string
): Promise<string> {
  const key = await deriveEncryptionKey(authSecret, base64Decode(salt));

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64Decode(iv) },
    key,
    base64Decode(encrypted)
  );

  return new TextDecoder().decode(decrypted);
}

export function isPKCS1Format(pem: string): boolean {
  return pem.includes("-----BEGIN RSA PRIVATE KEY-----");
}

export function isPKCS8Format(pem: string): boolean {
  return pem.includes("-----BEGIN PRIVATE KEY-----");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const lines = pem
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s/g, "");
  const binary = atob(lines);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToPem(buffer: ArrayBuffer, type: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----`;
}

export async function convertPKCS1ToPKCS8(pkcs1Pem: string): Promise<string> {
  const pkcs1Data = pemToArrayBuffer(pkcs1Pem);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    wrapPKCS1InPKCS8(new Uint8Array(pkcs1Data)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"]
  );

  const pkcs8Data = await crypto.subtle.exportKey("pkcs8", key) as ArrayBuffer;
  return arrayBufferToPem(pkcs8Data, "PRIVATE KEY");
}

function wrapPKCS1InPKCS8(pkcs1: Uint8Array): Uint8Array {
  const rsaOID = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x01, 0x05, 0x00,
  ]);

  const octetStringTag = 0x04;
  const sequenceTag = 0x30;

  function encodeLength(length: number): Uint8Array {
    if (length < 128) {
      return new Uint8Array([length]);
    } else if (length < 256) {
      return new Uint8Array([0x81, length]);
    } else if (length < 65536) {
      return new Uint8Array([0x82, (length >> 8) & 0xff, length & 0xff]);
    } else {
      return new Uint8Array([
        0x83,
        (length >> 16) & 0xff,
        (length >> 8) & 0xff,
        length & 0xff,
      ]);
    }
  }

  const octetStringLength = encodeLength(pkcs1.length);
  const octetString = new Uint8Array(1 + octetStringLength.length + pkcs1.length);
  octetString[0] = octetStringTag;
  octetString.set(octetStringLength, 1);
  octetString.set(pkcs1, 1 + octetStringLength.length);

  const version = new Uint8Array([0x02, 0x01, 0x00]);

  const innerLength = version.length + rsaOID.length + octetString.length;
  const innerLengthEncoded = encodeLength(innerLength);

  const result = new Uint8Array(1 + innerLengthEncoded.length + innerLength);
  result[0] = sequenceTag;
  result.set(innerLengthEncoded, 1);
  let offset = 1 + innerLengthEncoded.length;
  result.set(version, offset);
  offset += version.length;
  result.set(rsaOID, offset);
  offset += rsaOID.length;
  result.set(octetString, offset);

  return result;
}

export async function normalizePEM(pem: string): Promise<string> {
  const trimmed = pem.trim();

  if (isPKCS8Format(trimmed)) {
    return trimmed;
  }

  if (isPKCS1Format(trimmed)) {
    return await convertPKCS1ToPKCS8(trimmed);
  }

  throw new Error(
    "Invalid PEM format. Expected PKCS#8 (BEGIN PRIVATE KEY) or PKCS#1 (BEGIN RSA PRIVATE KEY)"
  );
}

export async function validatePEM(pem: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const normalizedPem = await normalizePEM(pem);
    const keyData = pemToArrayBuffer(normalizedPem);

    await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Failed to parse private key",
    };
  }
}

export async function storeCredentials(
  kv: KVNamespace,
  appId: string,
  privateKey: string,
  authSecret: string
): Promise<void> {
  const normalizedKey = await normalizePEM(privateKey);
  const { encrypted, iv, salt } = await encryptPrivateKey(normalizedKey, authSecret);

  const credentials: StoredCredentials = {
    appId,
    encryptedPrivateKey: encrypted,
    iv,
    salt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await kv.put(KV_CREDENTIALS_KEY, JSON.stringify(credentials));
}

export async function getStoredCredentials(
  kv: KVNamespace,
  authSecret: string
): Promise<{ appId: string; privateKey: string } | null> {
  const data = await kv.get(KV_CREDENTIALS_KEY, "json");
  if (!data) return null;

  const stored = data as StoredCredentials;
  const privateKey = await decryptPrivateKey(
    stored.encryptedPrivateKey,
    stored.iv,
    stored.salt,
    authSecret
  );

  return { appId: stored.appId, privateKey };
}

export async function hasStoredCredentials(kv: KVNamespace): Promise<boolean> {
  const data = await kv.get(KV_CREDENTIALS_KEY);
  return data !== null;
}

export async function getStoredCredentialsMetadata(
  kv: KVNamespace
): Promise<{ appId: string; createdAt: string; updatedAt: string } | null> {
  const data = await kv.get(KV_CREDENTIALS_KEY, "json");
  if (!data) return null;

  const stored = data as StoredCredentials;
  return {
    appId: stored.appId,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

export async function deleteStoredCredentials(kv: KVNamespace): Promise<void> {
  await kv.delete(KV_CREDENTIALS_KEY);
}

export async function getEffectiveCredentials(
  env: Env
): Promise<{ appId: string; privateKey: string } | null> {
  if (env.ENABLE_BANKING_APP_ID && env.ENABLE_BANKING_PRIVATE_KEY) {
    return {
      appId: env.ENABLE_BANKING_APP_ID,
      privateKey: env.ENABLE_BANKING_PRIVATE_KEY,
    };
  }

  return await getStoredCredentials(env.BANKING_KV, env.AUTH_SECRET);
}

export function hasEnvCredentials(env: Env): boolean {
  return !!(env.ENABLE_BANKING_APP_ID && env.ENABLE_BANKING_PRIVATE_KEY);
}
