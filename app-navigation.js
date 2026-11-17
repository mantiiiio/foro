const APP_ROUTES = new Set([
  "b",
  "t",
  "n",
  "u",
  "search",
  "login",
  "reg",
  "faq",
  "setup",
  "out",
  "staff"
]);

/**
 * Devuelve una URL interna que puede manejar el router de MantiPobres.
 * Los recursos estáticos y los enlaces externos quedan fuera del router.
 */
export function resolveInternalAppPath(href, origin) {
  try {
    const value=String(href||"").trim();
    if(!value)return null;
    const base = new URL(origin);
    const target = new URL(value, base);

    if (target.origin !== base.origin) return null;
    if (target.protocol !== "http:" && target.protocol !== "https:") return null;

    let path = target.pathname || "/";
    while (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    if (path !== "/" && path !== "/index.html") {
      const firstSegment = path.slice(1).split("/")[0];
      if (!APP_ROUTES.has(firstSegment)) return null;
    }

    if (path === "/index.html") path = "/";
    return path + target.search + target.hash;
  } catch {
    return null;
  }
}
