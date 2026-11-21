import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const opening = '<script type="module">';
const closing = "</script>";
assert.ok(html.includes(opening), "No se encontró el script principal.");
const script = html.split(opening, 2)[1].split(closing, 1)[0];

test("Firebase no reconfigura persistencia local al abrir o iniciar sesión", () => {
  assert.doesNotMatch(script, /\bsetPersistence\s*\(/);
  assert.doesNotMatch(script, /\bbrowserLocalPersistence\b/);
  assert.match(script, /auth\.authStateReady\(\)/);
  assert.match(script, /await ensureGuestSession\(\)/);
});

test("detectar una versión nueva no recarga automáticamente la pestaña", () => {
  const start = script.indexOf("async function checkForNewBuild(){");
  assert.notEqual(start, -1, "No se encontró checkForNewBuild().");
  const end = script.indexOf("\nsetTimeout(checkForNewBuild", start);
  assert.notEqual(end, -1, "No se encontró el final del verificador.");
  const checker = script.slice(start, end);
  assert.match(checker, /showUpdateAvailable\(\)/);
  assert.doesNotMatch(checker, /location\.reload\s*\(/);
});

test("la actualización manual guarda el borrador del tema antes de recargar", () => {
  assert.match(script, /saveTopicDraftForRoute\(activeRouteKey\)/);
  assert.match(script, /Actualizar ahora/);
  assert.match(script, /Recarga solo cuando termines/);
});
