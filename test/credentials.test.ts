import { describe, it, expect } from "vitest";
import {
  encryptPrivateKey,
  decryptPrivateKey,
  validatePEM,
  isPKCS1Format,
  isPKCS8Format,
  normalizePEM,
} from "../src/enable-banking/credentials";

const TEST_PKCS8_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD5Z7z9tKxLdmGI
X2DA03VSU1JTppN9kC7XDGjlFHJ9fcVUcmd9Pv8rpOKwDlzX90lmplYTHIQ6wPoa
ic4B7P14vUm+3g4fE7kJB8PRZ39mZ0QcZ7Zeu9CCa7ud0ytXBfDQy5sNOBxV6C5l
lWbKQyV/MSpqs/KKBjJvigJnnMkJkIqlNrUvnEs1G0myMT1Gjxzc7OWRXfjQoMNx
gkc+AjPhPp4ONvYybai+cdLVrKrvoxClTJUwOOaJDH/ZR4Q/CebjI4VM+Bgw8naE
ItLFC+Stoy226rB4fqM5RxItN8WZSeWki9Q3xtQlf6bslWdyh1LPoxlDEznnlPTL
YC2N0pMJAgMBAAECggEACkdCEMcawCfmbFk46q10RPKp3ohrhOXVpldstb8mWkFe
CeVGmlDnsXfjvztyTFS0vdIeUz6OPQEhtYkHGEl45zpO0RrD5Hg6vJJpOaatJ45b
LlwAVi5hkRRpSJ9wpm8YXfR8JPryYQB29AkIkc6bW57uN3RHyzQm7TWX9IbvupD5
cAwoAa7wygiojkQf3ycU22B4aiFHj07W5wiZAypB6VoC/+Kxbu0qXcxaYT76vHy1
Mvb40qxCYGDzhQ6Yf3wgkQVGOxBfTyfm92aaFsaZxl2D7AgqZbG76uFusmmU5Fy1
z/8OnNUG1JboBEztnQSCqs9QlTSX2+CeZOziP8N/wQKBgQD9H1MSiD2/7uWfdqWs
P0PLZsFZ21tfTT7eR/MF0bHzM5L8GO6x1q9fiL/F//wpZV98toiwrV7qk9dZ7D6K
BkuIeuDZQK8F/RBaDfJQUkxoAMDeKBAMuRHTuIU2nN5DUUJk5MqKpUO0EDiuIWLp
lVpQXgM7lCsUWeoIykfdmEdkQQKBgQD8PZh3aXHb4PMbL9WITke0IsO9y3vqy0wr
bt7VlM7gf2xOqhyyAyJu484QzmeJKVo/yJkwVicrWUG3d1Ny5drbvsch+Yg4n4Ol
sTKtwKF1l+vMKLpNINzMmeavkC5acRvIMll6BHoU7FHlwhFQRB+Rd2VrBCkIO3rp
ZL72OF3cyQKBgCkx8ekwNyyHiuN7AdeYrEXsQUeIhcRq4/J1Lz4hNJ7qI9/XhvF2
iTA5J0zoLnfmQbYgVvq6HJp82S2PX1ZDVAOwS+vPtSx6VTDy2B7uZfT/OmRtjL8l
V5tninaq7RlzniShf700zGH/ydm9IUX2wq4VvtzxbllvkMFBepS79dKBAoGANoHQ
+qzsj8kyf4N8rzHLSN/iUJcyNfCsiw4wVRMNCXI/o1gbT1RiEnhjxTn1Iayv9eyR
PeLAIBvvmYfNnpyRCL9XJL5Zc3L07c821lk0CsdDiyCZ8aTSUdxH/1Q20BB1InPO
5hElmHPg1rdzKlcuQy772X5Sp5bC3sCIi4husBECgYEA2GDXhMJXwe9ofocuDFrq
J55OAx7s7r5uY2YJssv2ttzGlhEkkTvlhDDwIfDPdIm3jXCXVp5Wfa7s7rGJjJAE
DhDwtDSWygRhCPMzi0y0dzR7tzfInYW8VW722D1mZ2w5rNGFkqjkmbTYzDIEj/84
sp2zACbZZjZ2qZdLihnQ2lE=
-----END PRIVATE KEY-----`;

const TEST_AUTH_SECRET = "test-secret-password-12345";

describe("PEM Format Detection", () => {
  it("should detect PKCS8 format", () => {
    expect(isPKCS8Format(TEST_PKCS8_KEY)).toBe(true);
    expect(isPKCS1Format(TEST_PKCS8_KEY)).toBe(false);
  });

  it("should detect PKCS1 format from header", () => {
    const pkcs1Header = "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----";
    expect(isPKCS1Format(pkcs1Header)).toBe(true);
    expect(isPKCS8Format(pkcs1Header)).toBe(false);
  });

  it("should handle whitespace in PEM", () => {
    const keyWithSpaces = `  ${TEST_PKCS8_KEY}  `;
    expect(isPKCS8Format(keyWithSpaces)).toBe(true);
  });
});

describe("PEM Validation", () => {
  it("should validate a valid PKCS8 key", async () => {
    const result = await validatePEM(TEST_PKCS8_KEY);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject invalid PEM data", async () => {
    const result = await validatePEM("not a valid pem key");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should reject corrupted PEM", async () => {
    const corrupted = TEST_PKCS8_KEY.replace("MIIEv", "XXXXX");
    const result = await validatePEM(corrupted);
    expect(result.valid).toBe(false);
  });

  it("should reject empty PEM content", async () => {
    const emptyPem = "-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----";
    const result = await validatePEM(emptyPem);
    expect(result.valid).toBe(false);
  });
});

describe("PEM Normalization", () => {
  it("should keep PKCS8 unchanged", async () => {
    const normalized = await normalizePEM(TEST_PKCS8_KEY);
    expect(normalized).toContain("BEGIN PRIVATE KEY");
    expect(normalized).toContain("END PRIVATE KEY");
    expect(normalized).not.toContain("RSA");
  });

  it("should throw for invalid PEM", async () => {
    await expect(normalizePEM("invalid")).rejects.toThrow();
  });

  it("should handle PEM with extra whitespace", async () => {
    const keyWithWhitespace = `\n\n${TEST_PKCS8_KEY}\n\n`;
    const normalized = await normalizePEM(keyWithWhitespace);
    expect(normalized).toContain("BEGIN PRIVATE KEY");
  });
});

describe("Private Key Encryption/Decryption", () => {
  it("should encrypt and decrypt a private key", async () => {
    const { encrypted, iv, salt } = await encryptPrivateKey(
      TEST_PKCS8_KEY,
      TEST_AUTH_SECRET
    );

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe("");
    expect(iv).toBeDefined();
    expect(salt).toBeDefined();

    const decrypted = await decryptPrivateKey(
      encrypted,
      iv,
      salt,
      TEST_AUTH_SECRET
    );

    expect(decrypted).toBe(TEST_PKCS8_KEY);
  });

  it("should produce different ciphertext for same key with different salts", async () => {
    const result1 = await encryptPrivateKey(TEST_PKCS8_KEY, TEST_AUTH_SECRET);
    const result2 = await encryptPrivateKey(TEST_PKCS8_KEY, TEST_AUTH_SECRET);

    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.salt).not.toBe(result2.salt);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it("should fail decryption with wrong secret", async () => {
    const { encrypted, iv, salt } = await encryptPrivateKey(
      TEST_PKCS8_KEY,
      TEST_AUTH_SECRET
    );

    await expect(
      decryptPrivateKey(encrypted, iv, salt, "wrong-secret")
    ).rejects.toThrow();
  });

  it("should fail decryption with wrong IV", async () => {
    const { encrypted, salt } = await encryptPrivateKey(
      TEST_PKCS8_KEY,
      TEST_AUTH_SECRET
    );

    const wrongIv = btoa("wrongivvalue1");

    await expect(
      decryptPrivateKey(encrypted, wrongIv, salt, TEST_AUTH_SECRET)
    ).rejects.toThrow();
  });

  it("should handle large keys", async () => {
    const largeKey = TEST_PKCS8_KEY.repeat(3);
    
    const { encrypted, iv, salt } = await encryptPrivateKey(
      largeKey,
      TEST_AUTH_SECRET
    );

    const decrypted = await decryptPrivateKey(
      encrypted,
      iv,
      salt,
      TEST_AUTH_SECRET
    );

    expect(decrypted).toBe(largeKey);
  });
});

describe("Encryption with Different Auth Secrets", () => {
  it("should produce different ciphertext with different secrets", async () => {
    const result1 = await encryptPrivateKey(TEST_PKCS8_KEY, "secret-one");
    const result2 = await encryptPrivateKey(TEST_PKCS8_KEY, "secret-two");

    const decrypted1 = await decryptPrivateKey(
      result1.encrypted,
      result1.iv,
      result1.salt,
      "secret-one"
    );
    const decrypted2 = await decryptPrivateKey(
      result2.encrypted,
      result2.iv,
      result2.salt,
      "secret-two"
    );

    expect(decrypted1).toBe(TEST_PKCS8_KEY);
    expect(decrypted2).toBe(TEST_PKCS8_KEY);
  });

  it("should handle empty-ish secrets (but not recommended)", async () => {
    const { encrypted, iv, salt } = await encryptPrivateKey(
      TEST_PKCS8_KEY,
      "a"
    );

    const decrypted = await decryptPrivateKey(encrypted, iv, salt, "a");
    expect(decrypted).toBe(TEST_PKCS8_KEY);
  });
});
