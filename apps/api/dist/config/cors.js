import { env } from "./env.js";
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://beamlabultimate.tech",
  "https://www.beamlabultimate.tech",
  "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net"
];
const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, "").toLowerCase();
function getAllowedOrigins() {
  const configuredOrigins = (env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return Array.from(
    /* @__PURE__ */ new Set([
      env.FRONTEND_URL || "http://localhost:5173",
      ...DEFAULT_ORIGINS,
      ...configuredOrigins
    ])
  ).map(normalizeOrigin);
}
function isTrustedOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  const allowedSet = new Set(getAllowedOrigins());
  if (allowedSet.has(normalized)) return true;
  return normalized.endsWith(".beamlabultimate.tech");
}
export {
  DEFAULT_ORIGINS,
  getAllowedOrigins,
  isTrustedOrigin,
  normalizeOrigin
};
//# sourceMappingURL=cors.js.map
