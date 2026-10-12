function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

function isPKCS1Format(pem: string): boolean {
  return pem.includes("-----BEGIN RSA PRIVATE KEY-----");
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

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  let keyData: Uint8Array;

  if (isPKCS1Format(pem)) {
    const pkcs1Data = pemToArrayBuffer(pem);
    keyData = wrapPKCS1InPKCS8(new Uint8Array(pkcs1Data));
  } else {
    keyData = new Uint8Array(pemToArrayBuffer(pem));
  }

  return await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
}

export interface JWTPayload {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

export async function signJWT(
  payload: JWTPayload,
  privateKeyPem: string
): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const encodedHeader = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = base64UrlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}

export function createJWTPayload(
  appId: string,
  audience: string = "enablebanking.com"
): JWTPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: `enablebanking.com/api/${appId}`,
    aud: audience,
    iat: now,
    exp: now + 3600,
  };
}
