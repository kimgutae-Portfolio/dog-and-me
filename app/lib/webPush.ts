import { importJWK, SignJWT } from "jose";

export type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type WebPushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

type WebPushError = Error & { statusCode?: number };

const encoder = new TextEncoder();

function decodeBase64Url(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function concatBytes(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function hmac(keyBytes: Uint8Array, data: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number) {
  const blocks: Uint8Array[] = [];
  let previous = new Uint8Array();
  for (let index = 1; blocks.reduce((total, block) => total + block.length, 0) < length; index += 1) {
    previous = await hmac(prk, concatBytes(previous, info, new Uint8Array([index])));
    blocks.push(previous);
  }
  return concatBytes(...blocks).slice(0, length);
}

function uint32BigEndian(value: number) {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

async function createVapidToken(endpoint: URL, config: WebPushConfig) {
  const publicKey = decodeBase64Url(config.publicKey);
  if (publicKey.length !== 65 || publicKey[0] !== 4) throw new Error("invalid_vapid_public_key");
  const jwk = {
    kty: "EC" as const,
    crv: "P-256" as const,
    d: config.privateKey,
    x: encodeBase64Url(publicKey.slice(1, 33)),
    y: encodeBase64Url(publicKey.slice(33, 65)),
  };
  const signingKey = await importJWK(jwk, "ES256");
  return new SignJWT({
    aud: endpoint.origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: config.subject,
  })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .sign(signingKey);
}

async function encryptPayload(subscription: WebPushSubscription, payload: string) {
  const clientPublicKeyBytes = decodeBase64Url(subscription.keys.p256dh);
  const authSecret = decodeBase64Url(subscription.keys.auth);
  if (clientPublicKeyBytes.length !== 65 || authSecret.length === 0) throw new Error("invalid_push_subscription_keys");

  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientPublicKey }, ephemeral.privateKey, 256),
  );
  const ephemeralPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));

  const authPrk = await hmac(authSecret, sharedSecret);
  const keyInfo = concatBytes(encoder.encode("WebPush: info\0"), clientPublicKeyBytes, ephemeralPublicKey);
  const ikm = await hkdfExpand(authPrk, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentPrk = await hmac(salt, ikm);
  const contentKey = await hkdfExpand(contentPrk, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(contentPrk, encoder.encode("Content-Encoding: nonce\0"), 12);
  const aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const plaintext = concatBytes(encoder.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, plaintext),
  );
  const header = concatBytes(salt, uint32BigEndian(4096), new Uint8Array([ephemeralPublicKey.length]), ephemeralPublicKey);
  return concatBytes(header, ciphertext);
}

export async function sendWebPushNotification(
  subscription: WebPushSubscription,
  payload: string,
  config: WebPushConfig,
) {
  const endpoint = new URL(subscription.endpoint);
  const [token, body] = await Promise.all([
    createVapidToken(endpoint, config),
    encryptPayload(subscription, payload),
  ]);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${token}, k=${config.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body,
  });
  if (!response.ok) {
    const error: WebPushError = new Error(`push_failed_${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
}
