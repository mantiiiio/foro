import test from "node:test";
import assert from "node:assert/strict";
import {
  compareTopicsAlphabetically,
  normalizeTopicSearchText,
  searchTopicsByTitle
} from "../board-search.js";

const topic = (id, title, lr = 0, ts = 0) => ({ id, t: title, lr, ts });

test("normaliza mayúsculas, tildes, puntuación y espacios", () => {
  assert.equal(normalizeTopicSearchText("  CÓMO   INSTALAR WinRAR!? "), "como instalar winrar");
});

test("ordena los temas por título usando el alfabeto español", () => {
  const topics = [
    topic("z", "Zelda"),
    topic("n-tilde", "Ñandú"),
    topic("n", "Naranja"),
    topic("a", "Álgebra")
  ];
  assert.deepEqual(
    [...topics].sort(compareTopicsAlphabetically).map(item => item.id),
    ["a", "n", "n-tilde", "z"]
  );
});

test("sin búsqueda devuelve todos los temas en orden alfabético y no modifica el array original", () => {
  const topics = [topic("z", "Zelda"), topic("a", "Árbol"), topic("c", "Café")];
  const originalIds = topics.map(item => item.id);
  assert.deepEqual(searchTopicsByTitle(topics, "   ").map(item => item.id), ["a", "c", "z"]);
  assert.deepEqual(topics.map(item => item.id), originalIds);
});

test("encuentra títulos ignorando mayúsculas y tildes", () => {
  const topics = [
    topic("one", "Guía para instalar CaféOS"),
    topic("two", "Configuración de Windows"),
    topic("three", "Cafetería retro")
  ];
  assert.deepEqual(searchTopicsByTitle(topics, "cafeos").map(item => item.id), ["one"]);
  assert.deepEqual(searchTopicsByTitle(topics, "CAFÉ").map(item => item.id), ["one", "three"]);
});

test("prioriza coincidencia exacta, prefijo y frase antes de coincidencias por palabras", () => {
  const topics = [
    topic("words", "Cómo arreglar WinRAR parche"),
    topic("contains", "Guía del parche WinRAR"),
    topic("prefix", "Parche WinRAR actualizado"),
    topic("exact", "Parche WinRAR")
  ];
  assert.deepEqual(
    searchTopicsByTitle(topics, "parche winrar").map(item => item.id),
    ["exact", "prefix", "contains", "words"]
  );
});

test("si varias coincidencias tienen la misma relevancia, muestra primero la más reciente", () => {
  const topics = [
    topic("old", "Guía de WinRAR", 10),
    topic("new", "Instalar WinRAR", 30),
    topic("middle", "Tutorial WinRAR", 20)
  ];
  assert.deepEqual(searchTopicsByTitle(topics, "winrar").map(item => item.id), ["new", "middle", "old"]);
});

test("una búsqueda de varias palabras encuentra el título aunque se escriban en otro orden", () => {
  const topics = [
    topic("one", "Parche para WinRAR"),
    topic("two", "WinRAR: guía de instalación"),
    topic("three", "Parche de Windows")
  ];
  assert.deepEqual(searchTopicsByTitle(topics, "winrar parche").map(item => item.id), ["one"]);
});
