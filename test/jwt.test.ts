import { describe, it, expect } from "vitest";
import { signJWT, createJWTPayload } from "../src/enable-banking/jwt";

const TEST_PKCS8_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
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

describe("JWT Signing", () => {
  it("should create a valid JWT payload with correct iss and aud for Enable Banking", () => {
    const appId = "test-app-id";
    const payload = createJWTPayload(appId);

    expect(payload.iss).toBe("enablebanking.com");
    expect(payload.aud).toBe("api.enablebanking.com");
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
    expect(payload.exp).toBeGreaterThan(payload.iat);
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it("should sign JWT and produce three parts", async () => {
    const payload = createJWTPayload("test-app");
    const jwt = await signJWT(payload, TEST_PKCS8_PRIVATE_KEY);

    const parts = jwt.split(".");
    expect(parts.length).toBe(3);
  });

  it("should produce consistent header without kid when not provided", async () => {
    const payload = createJWTPayload("test-app");
    const jwt = await signJWT(payload, TEST_PKCS8_PRIVATE_KEY);

    const [headerB64] = jwt.split(".");
    let base64 = headerB64.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const header = JSON.parse(atob(base64));

    expect(header.alg).toBe("RS256");
    expect(header.typ).toBe("JWT");
    expect(header.kid).toBeUndefined();
  });

  it("should include kid in header when provided", async () => {
    const appId = "my-app-id";
    const payload = createJWTPayload(appId);
    const jwt = await signJWT(payload, TEST_PKCS8_PRIVATE_KEY, appId);

    const [headerB64] = jwt.split(".");
    let base64 = headerB64.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const header = JSON.parse(atob(base64));

    expect(header.alg).toBe("RS256");
    expect(header.typ).toBe("JWT");
    expect(header.kid).toBe(appId);
  });

  it("should include correct Enable Banking claims in JWT", async () => {
    const appId = "my-test-app";
    const payload = createJWTPayload(appId);
    const jwt = await signJWT(payload, TEST_PKCS8_PRIVATE_KEY, appId);

    const [, payloadB64] = jwt.split(".");
    let base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const decodedPayload = JSON.parse(atob(base64));

    expect(decodedPayload.iss).toBe("enablebanking.com");
    expect(decodedPayload.aud).toBe("api.enablebanking.com");
  });

  it("should produce different signatures for different payloads", async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload1 = {
      iss: "enablebanking.com",
      aud: "api.enablebanking.com",
      iat: now,
      exp: now + 3600,
      sub: "user1"
    };
    const payload2 = {
      iss: "enablebanking.com",
      aud: "api.enablebanking.com",
      iat: now,
      exp: now + 3600,
      sub: "user2"
    };

    const jwt1 = await signJWT(payload1, TEST_PKCS8_PRIVATE_KEY);
    const jwt2 = await signJWT(payload2, TEST_PKCS8_PRIVATE_KEY);

    const sig1 = jwt1.split(".")[2];
    const sig2 = jwt2.split(".")[2];

    expect(sig1).not.toBe(sig2);
  });
});

describe("JWT Payload Timing", () => {
  it("should set iat to current timestamp", () => {
    const before = Math.floor(Date.now() / 1000);
    const payload = createJWTPayload("test");
    const after = Math.floor(Date.now() / 1000);

    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after);
  });

  it("should set exp to 1 hour after iat", () => {
    const payload = createJWTPayload("test");
    expect(payload.exp - payload.iat).toBe(3600);
  });
});
