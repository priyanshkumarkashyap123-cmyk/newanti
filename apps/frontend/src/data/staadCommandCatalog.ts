// Compatibility re-export: the concrete implementation now lives in
// `data/staadCommandCatalog/builder.ts` and is re-exposed via the
// namespaced `staadCommandCatalog` shim. Keep this barrel so existing
// imports remain valid.
export * from './staadCommandCatalog/staadCommandCatalog';
