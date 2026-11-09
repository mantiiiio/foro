/**
 * MantiPobres — ImageKit upload-auth Worker
 *
 * Deploy this file as a Cloudflare Worker. Configure these secrets:
 *   FIREBASE_WEB_API_KEY
 *   IMAGEKIT_PUBLIC_KEY
 *   IMAGEKIT_PRIVATE_KEY
 *
 * Never put IMAGEKIT_PRIVATE_KEY in index.html or GitHub.
 */
const ALLOWED_ORIGINS = new Set([
  "https://mantipobres.web.app",
  "https://foro-66dd5.web.app",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
]);

function json(data, status, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

async function createSignature(privateKey, token, expire) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(privateKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(token + String(expire))
  );
  return Array.from(new Uint8Array(signature), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origen no autorizado." }, 403, "");
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/auth" || request.method !== "POST") {
      return json({ error: "Ruta no encontrada." }, 404, origin);
    }

    if (!env.FIREBASE_WEB_API_KEY || !env.IMAGEKIT_PUBLIC_KEY || !env.IMAGEKIT_PRIVATE_KEY) {
      return json({ error: "El Worker no tiene todas sus variables secretas configuradas." }, 500, origin);
    }

    const authorization = request.headers.get("Authorization") || "";
    const idTokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
    if (!idTokenMatch) {
      return json({ error: "Inicia sesión con una cuenta verificada." }, 401, origin);
    }

    try {
      // Firebase valida la firma, la vigencia y el proyecto del ID token.
      const firebaseResponse = await fetch(
        "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" +
          encodeURIComponent(env.FIREBASE_WEB_API_KEY),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: idTokenMatch[1] })
        }
      );

      if (!firebaseResponse.ok) {
        return json({ error: "La sesión de Firebase no es válida o ha vencido." }, 401, origin);
      }

      const account = await firebaseResponse.json();
      const user = account.users && account.users[0];

      if (!user || user.disabled || user.emailVerified !== true || !user.email) {
        return json({ error: "Solo las cuentas registradas con correo verificado pueden subir archivos." }, 403, origin);
      }

      const token = crypto.randomUUID();
      // ImageKit requires an expiry less than one hour in the future.
      const expire = Math.floor(Date.now() / 1000) + 30 * 60;
      const signature = await createSignature(env.IMAGEKIT_PRIVATE_KEY, token, expire);

      return json({
        token,
        expire,
        signature,
        publicKey: env.IMAGEKIT_PUBLIC_KEY
      }, 200, origin);
    } catch (error) {
      return json({ error: "No se pudo validar la cuenta para subir archivos." }, 500, origin);
    }
  }
};
