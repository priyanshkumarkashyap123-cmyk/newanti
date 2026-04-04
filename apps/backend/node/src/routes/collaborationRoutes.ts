/**
 * collaborationRoutes.ts - Project Collaboration Endpoints
 *
 * Handles invite lifecycle: send, list, accept, revoke.
 * All routes require authentication. POST requires the 'collaboration' feature flag.
 *
 * Routes:
 *   POST   /projects/:id/collaborators          - Send invite (owner only)
 *   GET    /projects/:id/collaborators          - List collaborators (owner only)
 *   PATCH  /projects/:id/collaborators/accept   - Accept invite (invitee only)
 *   DELETE /projects/:id/collaborators/:userId  - Revoke access (owner only)
 */

import express, { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, getAuth } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/requireFeature.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User, Project, CollaborationInvite } from '../models/index.js';
import { validateBody, collaborationInviteSchema } from '../middleware/validation.js';

const router: Router = express.Router({ mergeParams: true });

const authRequired = requireAuth();

// ============================================
// Helpers
// ============================================

const USE_CLERK = process.env['USE_CLERK'] === 'true';

async function resolveUserByClerkId(clerkId: string) {
  if (USE_CLERK) {
    return User.findOne({ clerkId }).lean();
  }
  if (mongoose.Types.ObjectId.isValid(clerkId)) {
    return User.findById(clerkId).lean();
  }
  return null;
}

function errorEnvelope(code: string, message: string) {
  return { error: { code, message } };
}

// ============================================
// POST /projects/:id/collaborators — Send invite (owner only)
// ============================================

router.post(
  '/',
  authRequired,
  requireFeature('collaboration'),
  validateBody(collaborationInviteSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    const projectId = req.params['id'];
    const { email } = req.body as { email?: string };

    if (!userId) {
      return res.status(401).json(errorEnvelope('UNAUTHORIZED', 'Authentication required.'));
    }

    if (!email) {
      return res.status(400).json(errorEnvelope('BAD_REQUEST', 'Email is required.'));
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json(errorEnvelope('BAD_REQUEST', 'Invalid project ID.'));
    }

    // Resolve the requesting user
    const inviter = await resolveUserByClerkId(userId);
    if (!inviter) {
      return res.status(401).json(errorEnvelope('UNAUTHORIZED', 'User not found.'));
    }

    // Verify ownership
    const project = await Project.findOne({ _id: projectId, owner: inviter._id }).lean();
    if (!project) {
      return res.status(403).json(errorEnvelope('FORBIDDEN', 'Only the project owner can send invites.'));
    }

    // Look up invitee by email
    const invitee = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    if (!invitee) {
      return res.status(404).json(errorEnvelope('USER_NOT_FOUND', 'No account found for that email address.'));
    }

    // Prevent self-invite
    if (String(invitee._id) === String(inviter._id)) {
      return res.status(400).json(errorEnvelope('BAD_REQUEST', 'You cannot invite yourself.'));
    }

    // Create invite (handle duplicate gracefully)
    try {
      const invite = await CollaborationInvite.create({
        projectId: project._id,
        inviterId: inviter._id,
        inviterClerkId: userId,
        inviteeId: invitee._id,
        inviteeClerkId: (invitee as { clerkId?: string }).clerkId ?? String(invitee._id),
        inviteeEmail: invitee.email,
        status: 'pending',
        accessLevel: 'write',
      });

      return res.status(201).json({ invite });
    } catch (err) {
      // Duplicate key — already invited
      const code = (err as { code?: number }).code;
      if (code === 11000) {
        const existing = await CollaborationInvite.findOne({
          projectId: project._id,
          inviteeId: invitee._id,
        }).lean();
        return res.status(200).json({ invite: existing, alreadyInvited: true });
      }
      throw err;
    }
  }),
);

// ============================================
// GET /projects/:id/collaborators — List collaborators (owner only)
// ============================================

router.get(
  '/',
  authRequired,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    const projectId = req.params['id'];

    if (!userId) {
      return res.status(401).json(errorEnvelope('UNAUTHORIZED', 'Authentication required.'));
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json(errorEnvelope('BAD_REQUEST', 'Invalid project ID.'));
    }

    const owner = await resolveUserByClerkId(userId);
    if (!owner) {
      return res.status(401).json(errorEnvelope('UNAUTHORIZED', 'User not found.'));
    }

    const project = await Project.findOne({ _id: projectId, owner: owner._id }).lean();
    if (!project) {
      return res.status(403).json(errorEnvelope('FORBIDDEN', 'Only the project owner can list collaborators.'));
    }

    const invites = await CollaborationInvite.find({ projectId })
      .populate('inviteeId', 'email displayName clerkId')
      .lean();

    return res.status(200).json({ collaborators: invites });
  }),
);

// ============================================
// PATCH /projects/:id/collaborators/accept — Accept invite (invitee only)
// ============================================

router.patch(
  '/accept',
  authRequired,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    const projectId = req.params['id'];

    if (!userId) {
      return res.status(401).json(errorEnvelope('UNAUTHORIZED', 'Authentication required.'));
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json(errorEnvelope('BAD_REQUEST', 'Invalid project ID.'));
    }

    // Find the invite where this user is the invitee
    const invite = await CollaborationInvite.findOne({
      projectId,
      inviteeClerkId: userId,
      status: 'pending',
    });

    if (!invite) {
      return res.status(404).json(errorEnvelope('NOT_FOUND', 'No pending invite found for this project.'));
    }

    // Update invite status
    invite.status = 'accepted';
    await invite.save();

    // Add invitee to project.collaborators array
    await Project.findByIdAndUpdate(projectId, {
      $addToSet: { collaborators: invite.inviteeId },
    });

    return res.status(200).json({ invite });
  }),
);

// ============================================
// DELETE /projects/:id/collaborators/:userId — Revoke access (owner only)
// ============================================

router.delete(
  '/:collaboratorId',
  authRequired,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    const projectId = req.params['id'];
    const collaboratorId = req.params['collaboratorId'];

    if (!userId) {
      return res.status(401).json(errorEnvelope('UNAUTHORIZED', 'Authentication required.'));
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json(errorEnvelope('BAD_REQUEST', 'Invalid project ID.'));
    }

    const owner = await resolveUserByClerkId(userId);
    if (!owner) {
      return res.status(401).json(errorEnvelope('UNAUTHORIZED', 'User not found.'));
    }

    // Verify ownership
    const project = await Project.findOne({ _id: projectId, owner: owner._id }).lean();
    if (!project) {
      return res.status(403).json(errorEnvelope('FORBIDDEN', 'Only the project owner can revoke access.'));
    }

    // Find the collaborator user — collaboratorId may be a DB _id or clerkId
    let inviteeQuery: Record<string, unknown>;
    if (mongoose.Types.ObjectId.isValid(collaboratorId)) {
      inviteeQuery = { projectId, inviteeId: collaboratorId };
    } else {
      inviteeQuery = { projectId, inviteeClerkId: collaboratorId };
    }

    const invite = await CollaborationInvite.findOne(inviteeQuery);
    if (!invite) {
      return res.status(404).json(errorEnvelope('NOT_FOUND', 'Collaborator not found for this project.'));
    }

    // Update invite status to revoked
    invite.status = 'revoked';
    await invite.save();

    // Remove from project.collaborators array
    await Project.findByIdAndUpdate(projectId, {
      $pull: { collaborators: invite.inviteeId },
    });

    return res.status(200).json({ revoked: true, inviteeId: invite.inviteeId });
  }),
);

export default router;
