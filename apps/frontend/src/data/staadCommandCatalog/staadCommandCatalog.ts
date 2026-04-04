// Compatibility shim: re-export builder functions. Original implementation was
// moved to `builder.ts` for clearer separation of concerns.
export {
  buildStaadCommandCatalog as getStaadCommandCatalog,
  getStaadCommandStats,
  getStaadCommandCatalogCsv,
  getToolStatus,
} from './builder';
