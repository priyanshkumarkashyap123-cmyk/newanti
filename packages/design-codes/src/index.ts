import { designCodes, type DesignCodeId, type DesignCodeRecord } from "./data/designCodes";

export type { DesignCodeId, DesignCodeRecord } from "./data/designCodes";
export { designCodes };

export function getDesignCode(id: DesignCodeId): DesignCodeRecord {
  const record = designCodes[id];
  if (!record) {
    throw new Error(`Unknown design code: ${id}`);
  }
  return record;
}

export function requireFactor(id: DesignCodeId, key: keyof DesignCodeRecord["partialSafety"]): number {
  const record = getDesignCode(id);
  const value = record.partialSafety[key];
  if (value === undefined) {
    throw new Error(`Factor ${String(key)} not defined for code ${id}`);
  }
  return value;
}
