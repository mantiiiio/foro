/**
 * MantiPobres — Cloudflare Worker para Firebase App Check con Turnstile.
 *
 * Endpoints:
 *   GET  /config  -> publica únicamente la sitekey de Turnstile.
 *   POST /token   -> valida Turnstile y solicita un token real de Firebase App Check.
 *
 * Variables públicas del Worker:
 *   TURNSTILE_SITE_KEY
 *
 * Secrets del Worker (NUNCA subirlos a GitHub):
 *   TURNSTILE_SECRET_KEY
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *
 * La cuenta de servicio debe tener únicamente firebaseappcheck.tokens.mint.
 * No se genera un token App Check localmente: Firebase lo emite mediante
 * exchangeCustomToken después de validar el JWT firmado de la cuenta de servicio.
 */

const PROJECT_ID = "foro-66dd5";
const FIREBASE_APP_ID = "1:228134558657:web:3c41529373384e9f582d40";

const APP_CHECK_CUSTOM_TOKEN_AUDIENCE =
  "https://firebaseappcheck.googleapis.com/google.firebase.appcheck.v1.TokenExchangeService";
const GOOGLE_OAUTH_AUDIENCE = "https://oauth2.googleapis.com/token";
const GOOGLE_OAUTH_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const GOOGLE_OAUTH_URL = "https://oauth2.googleapis.com/token";
const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const ALLOWED_HOSTNAMES = new Set([
  "mantipobres.web.app",
  "foro-66dd5.web.app",
  "foro-66dd5.firebaseapp.com"
]);

const ALLOWED_ORIGINS = new Set([
  "https://mantipobres.web.app",
  "https://foro-66dd5.web.app",
  "https://foro-66dd5.firebaseapp.com"
]);

const encoder = new TextEncoder();
let importedSigningKeyPromise = null;
let googleAccessTokenCache = "";
let googleAccessTokenExpiresAt = 0;
let googleAccessTokenPromise = null;

function json(data, status, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "Vary": "Origin"
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }

  return new Response(JSON.stringify(data), { status, headers });
}

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getSigningKey(env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error("Missing signing credential.");
  }

  if (!importedSigningKeyPromise) {
    const pem = String(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
      .replace(/\\n/g, "\n")
      .trim();
    const match = pem.match(
      /-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/
    );

    if (!match) {
      throw new Error("Invalid signing credential.");
    }

    const binary = atob(match[1].replace(/\s/g, ""));
    const der = Uint8Array.from(binary, character => character.charCodeAt(0));

    importedSigningKeyPromise = crypto.subtle.importKey(
      "pkcs8",
      der.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    ).catch(error => {
      importedSigningKeyPromise = null;
      throw error;
    });
  }

  return importedSigningKeyPromise;
}

async function signJwt(payload, env) {
  const header = base64UrlEncode(JSON.stringify({
    alg: "RS256",
    typ: "JWT"
  }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = header + "." + body;

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    await getSigningKey(env),
    encoder.encode(unsignedToken)
  );

  return unsignedToken + "." + base64UrlEncode(new Uint8Array(signature));
}

async function getGoogleAccessToken(env) {
  if (
    googleAccessTokenCache &&
    googleAccessTokenExpiresAt > Date.now() + 60_000
  ) {
    return googleAccessTokenCache;
  }

  if (googleAccessTokenPromise) {
    return googleAccessTokenPromise;
  }

  googleAccessTokenPromise = (async () => {
    const email = String(env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "");
    if (!/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(email)) {
      throw new Error("Invalid service account identity.");
    }

    const now = Math.floor(Date.now() / 1000);
    const assertion = await signJwt({
      iss: email,
      scope: GOOGLE_OAUTH_SCOPE,
      aud: GOOGLE_OAUTH_AUDIENCE,
      iat: now,
      exp: now + 3600
    }, env);

    const form = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    });

    const response = await fetch(GOOGLE_OAUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });

    const result = await response.json().catch(() => null);
    if (
      !response.ok ||
      typeof result?.access_token !== "string" ||
      !Number.isFinite(Number(result.expires_in))
    ) {
      throw new Error("Google OAuth token exchange failed.");
    }

    googleAccessTokenCache = result.access_token;
    googleAccessTokenExpiresAt =
      Date.now() + Math.max(60, Number(result.expires_in) - 60) * 1000;

    return googleAccessTokenCache;
  })().finally(() => {
    googleAccessTokenPromise = null;
  });

  return googleAccessTokenPromise;
}

async function createFirebaseAppCheckToken(env) {
  const email = String(env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "");
  const now = Math.floor(Date.now() / 1000);

  // Firebase Admin SDK uses this same custom-token audience and claim structure.
  const [accessToken, customToken] = await Promise.all([
    getGoogleAccessToken(env),
    signJwt({
      iss: email,
      sub: email,
      app_id: FIREBASE_APP_ID,
      aud: APP_CHECK_CUSTOM_TOKEN_AUDIENCE,
      iat: now,
      exp: now + 300
    }, env)
  ]);

  const endpoint =
    "https://firebaseappcheck.googleapis.com/v1/projects/" +
    PROJECT_ID +
    "/apps/" +
    FIREBASE_APP_ID +
    ":exchangeCustomToken";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ customToken })
  });

  const result = await response.json().catch(() => null);
  const ttlSeconds = typeof result?.ttl === "string"
    ? Number(result.ttl.endsWith("s") ? result.ttl.slice(0, -1) : NaN)
    : NaN;

  if (
    !response.ok ||
    typeof result?.token !== "string" ||
    !Number.isFinite(ttlSeconds) ||
    ttlSeconds <= 0
  ) {
    throw new Error("Firebase App Check token exchange failed.");
  }

  return {
    token: result.token,
    ttlMillis: Math.floor(ttlSeconds * 1000)
  };
}

async function verifyTurnstileToken(token, env) {
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new Error("Turnstile is not configured.");
  }

  const form = new URLSearchParams({
    secret: String(env.TURNSTILE_SECRET_KEY),
    response: token
  });

  const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  if (!response.ok) {
    throw new Error("Turnstile validation is unavailable.");
  }

  const result = await response.json().catch(() => null);

  return Boolean(
    result?.success === true &&
    ALLOWED_HOSTNAMES.has(String(result.hostname || "").toLowerCase()) &&
    result.action === "app_check"
  );
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    // Origin is used only for CORS. Trust is established by Siteverify,
    // the returned hostname/action, and Firebase's token exchange.
    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origen no autorizado." }, 403, "");
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    const pathname = new URL(request.url).pathname;

    if (pathname === "/config" && request.method === "GET") {
      if (!env.TURNSTILE_SITE_KEY) {
        return json({ error: "El proveedor de verificación no está configurado." }, 503, origin);
      }

      return json({ siteKey: String(env.TURNSTILE_SITE_KEY) }, 200, origin);
    }

    if (pathname !== "/token") {
      return json({ error: "Ruta no encontrada." }, 404, origin);
    }

    if (request.method !== "POST") {
      return json({ error: "Método no permitido." }, 405, origin);
    }

    const contentType = request.headers.get("Content-Type") || "";
    const contentLength = Number(request.headers.get("Content-Length") || "0");

    if (!contentType.toLowerCase().startsWith("application/json")) {
      return json({ error: "Tipo de contenido no válido." }, 415, origin);
    }

    if (contentLength > 4096) {
      return json({ error: "Solicitud demasiado grande." }, 413, origin);
    }

    if (
      !env.TURNSTILE_SECRET_KEY ||
      !env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    ) {
      return json({ error: "El proveedor de verificación no está configurado." }, 503, origin);
    }

    try {
      const rawBody = await request.text();
      if (rawBody.length > 4096) {
        return json({ error: "Solicitud demasiado grande." }, 413, origin);
      }

      let body;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return json({ error: "JSON no válido." }, 400, origin);
      }

      const turnstileToken = body?.turnstileToken;
      if (
        typeof turnstileToken !== "string" ||
        turnstileToken.length < 1 ||
        turnstileToken.length > 2048
      ) {
        return json({ error: "Falta una prueba de Turnstile válida." }, 400, origin);
      }

      const valid = await verifyTurnstileToken(turnstileToken, env);
      if (!valid) {
        return json({ error: "La verificación de seguridad no fue válida." }, 403, origin);
      }

      const appCheckToken = await createFirebaseAppCheckToken(env);
      return json(appCheckToken, 200, origin);
    } catch {
      // No devolver claves, tokens de Google ni detalles internos al navegador.
      return json({ error: "No se pudo emitir el token de seguridad. Inténtalo de nuevo." }, 503, origin);
    }
  }
};
