import { z } from "zod";

const nonArrayObjectSchema = z
  .object({})
  .passthrough()
  .refine((value) => value !== null && !Array.isArray(value), {
    message: "Expected a non-array JSON object",
  });

const designLeafResultSchema = z.object({
  passed: z.boolean(),
  utilization: z.number().finite().nonnegative(),
  message: z.string(),
}).passthrough();

const designEnvelopeSchema = z
  .object({
    success: z.boolean().optional(),
    result: z.unknown().optional(),
    passed: z.boolean().optional(),
    utilization: z.number().optional(),
    message: z.string().optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const leafCheck = designLeafResultSchema.safeParse(value);
    if (leafCheck.success) {
      return;
    }

    if (value.result && typeof value.result === "object" && !Array.isArray(value.result)) {
      const nestedLeaf = designLeafResultSchema.safeParse(value.result);
      if (nestedLeaf.success) {
        return;
      }
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Expected design payload with passed/utilization/message (top-level or nested in result)",
    });
  });

const analysisEnvelopeSchema = z
  .object({})
  .passthrough()
  .superRefine((value, ctx) => {
    const hasSuccessFlag = typeof value.success === "boolean";
    const hasKnownResultKey = [
      "results",
      "displacements",
      "memberForces",
      "reactions",
      "eigenvalues",
      "modeShapes",
      "timeHistory",
      "responseSpectrum",
    ].some((key) => key in value);

    if (!hasSuccessFlag && !hasKnownResultKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Expected analysis payload with success flag or known analysis result keys",
      });
    }
  });

function buildFailureReason(contextLabel: string, parsedError: z.ZodError): string {
  const reason = parsedError.issues.map((i) => i.message).join(", ");
  return `${contextLabel} upstream payload contract mismatch: ${reason}`;
}

/**
 * Runtime guard for upstream proxy responses.
 * Ensures Node gateway only forwards object-shaped payloads for critical routes.
 */
export function assertProxyObjectPayload(
  payload: unknown,
  contextLabel: string,
): { ok: true } | { ok: false; reason: string } {
  const parsed = nonArrayObjectSchema.safeParse(payload);
  if (parsed.success) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: buildFailureReason(contextLabel, parsed.error),
  };
}

export function assertDesignPayload(
  payload: unknown,
  contextLabel: string,
): { ok: true } | { ok: false; reason: string } {
  const parsed = designEnvelopeSchema.safeParse(payload);
  if (parsed.success) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: buildFailureReason(contextLabel, parsed.error),
  };
}

export function assertAnalysisPayload(
  payload: unknown,
  contextLabel: string,
): { ok: true } | { ok: false; reason: string } {
  const parsed = analysisEnvelopeSchema.safeParse(payload);
  if (parsed.success) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: buildFailureReason(contextLabel, parsed.error),
  };
}
