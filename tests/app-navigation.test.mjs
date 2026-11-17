import test from "node:test";
import assert from "node:assert/strict";
import { resolveInternalAppPath } from "../app-navigation.js";

const ORIGIN = "https://mantipobres.web.app";

test("acepta la portada y las rutas internas del foro", () => {
  assert.equal(resolveInternalAppPath("/", ORIGIN), "/");
  assert.equal(resolveInternalAppPath("/b/proyecto", ORIGIN), "/b/proyecto");
  assert.equal(resolveInternalAppPath("/t/tema-123", ORIGIN), "/t/tema-123");
  assert.equal(resolveInternalAppPath("/u/usuario", ORIGIN), "/u/usuario");
  assert.equal(resolveInternalAppPath("/out", ORIGIN), "/out");
});

test("acepta enlaces absolutos del mismo origen y conserva query y fragmento", () => {
  assert.equal(
    resolveInternalAppPath("https://mantipobres.web.app/b/gen?q=retro#ultimo", ORIGIN),
    "/b/gen?q=retro#ultimo"
  );
});

test("normaliza barras finales e index.html", () => {
  assert.equal(resolveInternalAppPath("/b/gen///", ORIGIN), "/b/gen");
  assert.equal(resolveInternalAppPath("/index.html", ORIGIN), "/");
});

test("rechaza dominios externos y otros esquemas", () => {
  assert.equal(resolveInternalAppPath("https://example.com/b/gen", ORIGIN), null);
  assert.equal(resolveInternalAppPath("javascript:alert(1)", ORIGIN), null);
  assert.equal(resolveInternalAppPath("mailto:test@example.com", ORIGIN), null);
});

test("no intercepta archivos estáticos ni rutas desconocidas", () => {
  assert.equal(resolveInternalAppPath("/board-search.js", ORIGIN), null);
  assert.equal(resolveInternalAppPath("/sitemap.xml", ORIGIN), null);
  assert.equal(resolveInternalAppPath("/ruta-inventada", ORIGIN), null);
});

test("maneja URLs inválidas sin lanzar excepciones", () => {
  assert.equal(resolveInternalAppPath("http://[", ORIGIN), null);
  assert.equal(resolveInternalAppPath("", ORIGIN), null);
});
