const spanishTitleCollator = new Intl.Collator("es", {
  sensitivity: "base",
  numeric: true
});

export function normalizeTopicSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function compareTopicsAlphabetically(a, b) {
  const byTitle = spanishTitleCollator.compare(String(a?.t ?? ""), String(b?.t ?? ""));
  if (byTitle) return byTitle;
  return String(a?.id ?? "").localeCompare(String(b?.id ?? ""), "es", { numeric: true });
}

// Sin búsqueda: alfabético. Con búsqueda: coincidencia más precisa y, en empate,
// actividad reciente; nunca se fuerza el orden alfabético en los resultados.
export function searchTopicsByTitle(topics, rawQuery) {
  const query = normalizeTopicSearchText(rawQuery);
  if (!query) return [...topics].sort(compareTopicsAlphabetically);

  const terms = query.split(" ").filter(Boolean);
  return topics
    .map((topic, originalIndex) => {
      const title = normalizeTopicSearchText(topic?.t);
      if (!title || !terms.every(term => title.includes(term))) return null;

      const score = title === query
        ? 0
        : title.startsWith(query)
          ? 1
          : title.includes(query)
            ? 2
            : 3;

      return { topic, originalIndex, score };
    })
    .filter(Boolean)
    .sort((a, b) =>
      a.score - b.score
      || (Number(b.topic?.lr) || 0) - (Number(a.topic?.lr) || 0)
      || (Number(b.topic?.ts) || 0) - (Number(a.topic?.ts) || 0)
      || a.originalIndex - b.originalIndex
    )
    .map(result => result.topic);
}
