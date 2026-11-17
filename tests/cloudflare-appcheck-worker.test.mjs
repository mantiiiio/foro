import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  createVerify,
  generateKeyPairSync,
  webcrypto
} from "node:crypto";
import worker from "../cloudflare/appcheck-turnstile-worker.js";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true
  });
}

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const OAUTH_URL = "https://oauth2.googleapis.com/token";
const APP_CHECK_URL =
  "https://firebaseappcheck.googleapis.com/v1/projects/foro-66dd5/apps/1:228134558657:web:3c41529373384e9f582d40:exchangeCustomToken";
const ORIGIN = "https://mantipobres.web.app";
const EMAIL = "mantipobres-app-check@foro-66dd5.iam.gserviceaccount.com";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});

const env = {
  TURNSTILE_SITE_KEY: "0x4AAAA-test-site-key",
  TURNSTILE_SECRET_KEY: "0x4AAAA-test-secret",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: EMAIL,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: privateKey
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function decodeJwt(token) {
  const parts = token.split(".");
  assert.equal(parts.length, 3, "JWT debe tener tres partes");

  const verify = createVerify("RSA-SHA256");
  verify.update(parts[0] + "." + parts[1]);
  verify.end();

  assert.equal(
    verify.verify(publicKey, Buffer.from(parts[2], "base64url")),
    true,
    "la firma RS256 debe verificarse con la clave pública de la cuenta de servicio"
  );

  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

function request(path, { method = "GET", body, origin = ORIGIN } = {}) {
  return new Request("https://worker.example" + path, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

test("GET /config publica la sitekey y nunca devuelve secretos", async () => {
  const response = await worker.fetch(request("/config"), env);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.siteKey, env.TURNSTILE_SITE_KEY);
  assert.equal("secret" in data, false);
  assert.equal("privateKey" in data, false);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(response.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate");
});

test("rechaza orígenes no autorizados antes de hacer peticiones externas", async () => {
  let externalCalls = 0;
  globalThis.fetch = async () => {
    externalCalls += 1;
    throw new Error("No se esperaba una llamada externa.");
  };

  const response = await worker.fetch(
    request("/config", { origin: "https://sitio-ajeno.example" }),
    env
  );

  assert.equal(response.status, 403);
  assert.equal(externalCalls, 0);
});

test("rechaza una prueba Turnstile inválida", async () => {
  let exchangeCalled = false;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), SITEVERIFY_URL);
    return Response.json({
      success: false,
      "error-codes": ["invalid-input-response"]
    });
  };

  const response = await worker.fetch(
    request("/token", {
      method: "POST",
      body: { turnstileToken: "invalid-token" }
    }),
    env
  );

  assert.equal(response.status, 403);
  assert.equal(exchangeCalled, false);
});

test("valida Turnstile y solicita a Firebase un App Check token auténtico", async () => {
  const externalCalls = [];
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    externalCalls.push(target);

    if (target === SITEVERIFY_URL) {
      const form = new URLSearchParams(options.body);
      assert.equal(form.get("secret"), env.TURNSTILE_SECRET_KEY);
      assert.equal(form.get("response"), "valid-turnstile-proof");

      return Response.json({
        success: true,
        hostname: "mantipobres.web.app",
        action: "app_check"
      });
    }

    if (target === OAUTH_URL) {
      const form = new URLSearchParams(options.body);
      assert.equal(
        form.get("grant_type"),
        "urn:ietf:params:oauth:grant-type:jwt-bearer"
      );

      const assertion = decodeJwt(form.get("assertion"));
      assert.equal(assertion.iss, EMAIL);
      assert.equal(assertion.aud, OAUTH_URL);
      assert.equal(
        assertion.scope,
        "https://www.googleapis.com/auth/cloud-platform"
      );

      return Response.json({
        access_token: "test-google-access-token",
        expires_in: 3600
      });
    }

    if (target === APP_CHECK_URL) {
      assert.equal(
        options.headers.Authorization,
        "Bearer test-google-access-token"
      );

      const body = JSON.parse(options.body);
      const claims = decodeJwt(body.customToken);

      assert.equal(claims.iss, EMAIL);
      assert.equal(claims.sub, EMAIL);
      assert.equal(claims.app_id, "1:228134558657:web:3c41529373384e9f582d40");
      assert.equal(
        claims.aud,
        "https://firebaseappcheck.googleapis.com/google.firebase.appcheck.v1.TokenExchangeService"
      );
      assert.ok(claims.exp > claims.iat);
      assert.ok(claims.exp - claims.iat <= 300);

      return Response.json({
        token: "firebase-issued-app-check-token",
        ttl: "3600s"
      });
    }

    throw new Error("URL externa inesperada: " + target);
  };

  const response = await worker.fetch(
    request("/token", {
      method: "POST",
      body: { turnstileToken: "valid-turnstile-proof" }
    }),
    env
  );

  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.token, "firebase-issued-app-check-token");
  assert.equal(data.ttlMillis, 3_600_000);
  assert.deepEqual(externalCalls, [SITEVERIFY_URL, OAUTH_URL, APP_CHECK_URL]);
});

test("rechaza hostname o acción Turnstile que no corresponden al foro", async () => {
  globalThis.fetch = async () => Response.json({
    success: true,
    hostname: "sitio-ajeno.example",
    action: "login"
  });

  const response = await worker.fetch(
    request("/token", {
      method: "POST",
      body: { turnstileToken: "proof-from-another-site" }
    }),
    env
  );

  assert.equal(response.status, 403);
});
