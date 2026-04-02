export function safeAbsMax(values: number[] | undefined, fallback: number): number {
  if (!values || values.length === 0) return fallback;
  const maxValue = Math.max(...values.map((value) => Math.abs(value)));
  return Number.isFinite(maxValue) && maxValue > 0 ? maxValue : fallback;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}
