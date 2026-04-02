/**
 * Report Template Routes — Proxies to Python backend
 *
 * CANONICAL OWNER: Python (Report templates, org-scoped templates)
 * This file is a THIN PROXY. No template logic runs in Node.js.
 */

import express, { Router, Request, Response } from "express";
import { pythonProxy } from "../../services/serviceProxy.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { asyncHandler, HttpError } from "../../utils/asyncHandler.js";
import { logger } from "../../utils/logger.js";
import { assertProxyObjectPayload } from "../../utils/proxyContracts.js";

const router: Router = express.Router();

function getRequestId(req: Request, res: Response): string | undefined {
    const rid = res.locals.requestId || req.get("x-request-id");
    return typeof rid === "string" && rid.length > 0 ? rid : undefined;
}

// All report template routes require authentication
router.use(requireAuth());

// ============================================
// Helper: Forward to Python and handle response
// ============================================

async function forwardToPython(
    pythonPath: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    body: unknown,
    req: Request,
    res: Response,
    label: string,
    timeoutMs = 30_000,
): Promise<void> {
    try {
        const requestId = getRequestId(req, res);
        const result = await pythonProxy(method, pythonPath, body, undefined, timeoutMs, requestId);
        if (result.success) {
            const guard = assertProxyObjectPayload(result.data, `ReportTemplates/${label}`);
            if (!guard.ok) {
                logger.error({ reason: guard.reason, requestId }, `[ReportTemplates/${label}] Invalid upstream payload`);
                res.status(502).json({
                    success: false,
                    error: "Invalid report template payload from upstream service",
                    code: "UPSTREAM_CONTRACT_ERROR",
                    requestId,
                });
                return;
            }

            res.json(result.data);
        } else {
            logger.error({ err: result.error }, `[ReportTemplates/${label}] Python API error`);
            res.status(result.status || 500).json({
                success: false,
                error: result.error || `${label} failed`,
                service: "python",
            });
        }
    } catch (error) {
        logger.error({ err: error }, `[ReportTemplates/${label}] Error`);
        res.status(500).json({
            success: false,
            error: `${label} failed`,
        });
    }
}

// ============================================
// Routes
// ============================================

// GET /reports/templates/org/:orgId
router.get("/org/:orgId/templates", asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params["orgId"];
    const actorUserId = req.query["actor_user_id"];
    if (!orgId) throw new HttpError(400, "Missing orgId");
    if (!actorUserId || typeof actorUserId !== "string") {
        throw new HttpError(400, "Missing actor_user_id");
    }

    const path = `/reports/orgs/${encodeURIComponent(orgId)}/templates?actor_user_id=${encodeURIComponent(actorUserId)}`;
    await forwardToPython(path, "GET", undefined, req, res, "ListTemplates");
}));

// POST /reports/templates/org/:orgId
router.post("/org/:orgId/templates", asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params["orgId"];
    if (!orgId) throw new HttpError(400, "Missing orgId");

    await forwardToPython(
        `/reports/orgs/${encodeURIComponent(orgId)}/templates`,
        "POST",
        req.body,
        req,
        res,
        "CreateTemplate",
    );
}));

// GET /reports/templates/org/:orgId/:templateId
router.get("/org/:orgId/templates/:templateId", asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params["orgId"];
    const templateId = req.params["templateId"];
    const actorUserId = req.query["actor_user_id"];
    if (!orgId || !templateId) throw new HttpError(400, "Missing orgId or templateId");
    if (!actorUserId || typeof actorUserId !== "string") {
        throw new HttpError(400, "Missing actor_user_id");
    }

    const path = `/reports/orgs/${encodeURIComponent(orgId)}/templates/${encodeURIComponent(templateId)}?actor_user_id=${encodeURIComponent(actorUserId)}`;
    await forwardToPython(path, "GET", undefined, req, res, "GetTemplate");
}));

// PUT /reports/templates/org/:orgId/:templateId
router.put("/org/:orgId/templates/:templateId", asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params["orgId"];
    const templateId = req.params["templateId"];
    if (!orgId || !templateId) throw new HttpError(400, "Missing orgId or templateId");

    await forwardToPython(
        `/reports/orgs/${encodeURIComponent(orgId)}/templates/${encodeURIComponent(templateId)}`,
        "PUT",
        req.body,
        req,
        res,
        "UpdateTemplate",
    );
}));

// DELETE /reports/templates/org/:orgId/:templateId
router.delete("/org/:orgId/templates/:templateId", asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params["orgId"];
    const templateId = req.params["templateId"];
    const actorUserId = req.query["actor_user_id"];
    const actorRole = req.query["actor_role"];
    if (!orgId || !templateId) throw new HttpError(400, "Missing orgId or templateId");
    if (!actorUserId || typeof actorUserId !== "string") {
        throw new HttpError(400, "Missing actor_user_id");
    }

    const params = new URLSearchParams();
    params.set("actor_user_id", actorUserId as string);
    if (actorRole && typeof actorRole === "string") params.set("actor_role", actorRole);

    const path = `/reports/orgs/${encodeURIComponent(orgId)}/templates/${encodeURIComponent(templateId)}?${params.toString()}`;
    await forwardToPython(path, "DELETE", undefined, req, res, "DeleteTemplate");
}));

export default router;