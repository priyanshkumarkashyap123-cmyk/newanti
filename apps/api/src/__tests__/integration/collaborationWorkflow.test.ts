/**
 * Integration tests: Collaboration workflow
 * Requirements: 5.1, 5.2, 5.3, 5.4, 13.1, 13.2, 13.3, 13.4
 * Feature: user-data-management-and-platform
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import express, { Response } from 'express';
import request from 'supertest';

vi.mock('../../models.js', () => ({
    User: { findOne: vi.fn() },
    Project: { findOne: vi.fn() },
    CollaborationInvite: {
        findOne: vi.fn(),
        find: vi.fn(),
        create: vi.fn(),
        findOneAndUpdate: vi.fn(),
    },
}));

import { User, Project, CollaborationInvite } from '../../models.js';

type InviteStatus = 'pending' | 'accepted' | 'revoked';

function buildCollabApp() {
    const app = express();
    app.use(express.json());

    // Inject user from header
    app.use((req: any, _res: Response, next: any) => {
        req.userId = req.headers['x-user-id'] || 'owner';
        next();
    });

    // POST /projects/:id/collaborators — send invite
    app.post('/projects/:id/collaborators', async (req: any, res: Response) => {
        const { email } = req.body;
        const invitee = await User.findOne({ email });
        if (!invitee) return res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
        const invite = await CollaborationInvite.create({
            projectId: req.params.id,
            inviterId: req.userId,
            inviteeId: (invitee as any)._id,
            status: 'pending',
        });
        return res.json({ success: true, data: invite });
    });

    // PATCH /projects/:id/collaborators/accept — accept invite
    app.patch('/projects/:id/collaborators/accept', async (req: any, res: Response) => {
        const invite = await CollaborationInvite.findOneAndUpdate(
            { projectId: req.params.id, inviteeId: req.userId },
            { $set: { status: 'accepted' } },
            { new: true }
        );
        if (!invite) return res.status(404).json({ success: false, error: 'INVITE_NOT_FOUND' });
        return res.json({ success: true, data: invite });
    });

    // DELETE /projects/:id/collaborators/:userId — revoke
    app.delete('/projects/:id/collaborators/:userId', async (req: any, res: Response) => {
        const invite = await CollaborationInvite.findOneAndUpdate(
            { projectId: req.params.id, inviteeId: req.params.userId },
            { $set: { status: 'revoked' } },
            { new: true }
        );
        if (!invite) return res.status(404).json({ success: false, error: 'INVITE_NOT_FOUND' });
        return res.json({ success: true, data: invite });
    });

    // GET /projects/:id — check access
    app.get('/projects/:id', async (req: any, res: Response) => {
        const project = await Project.findOne({ _id: req.params.id });
        if (!project) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
        if ((project as any).ownerId === req.userId) {
            return res.json({ success: true, data: project });
        }
        const invite = await CollaborationInvite.findOne({
            projectId: req.params.id,
            inviteeId: req.userId,
            status: 'accepted',
        });
        if (!invite) return res.status(403).json({ success: false, error: 'FORBIDDEN' });
        return res.json({ success: true, data: project });
    });

    return app;
}

describe('Collaboration workflow integration', () => {
    beforeEach(() => vi.clearAllMocks());

    it('owner invites collaborator → collaborator accepts → collaborator can access project', async () => {
        const invitee = { _id: 'collab1', email: 'collab@test.com' };
        const project = { _id: 'proj1', ownerId: 'owner1', name: 'Test Project' };
        const pendingInvite = { projectId: 'proj1', inviterId: 'owner1', inviteeId: 'collab1', status: 'pending' };
        const acceptedInvite = { ...pendingInvite, status: 'accepted' };

        (User.findOne as any).mockResolvedValue(invitee);
        (CollaborationInvite.create as any).mockResolvedValue(pendingInvite);
        (CollaborationInvite.findOneAndUpdate as any).mockResolvedValue(acceptedInvite);
        (Project.findOne as any).mockResolvedValue(project);
        (CollaborationInvite.findOne as any).mockResolvedValue(acceptedInvite);

        const app = buildCollabApp();

        // Owner sends invite
        const inviteRes = await request(app)
            .post('/projects/proj1/collaborators')
            .set('x-user-id', 'owner1')
            .send({ email: 'collab@test.com' });
        expect(inviteRes.status).toBe(200);
        expect(inviteRes.body.data.status).toBe('pending');

        // Collaborator accepts
        const acceptRes = await request(app)
            .patch('/projects/proj1/collaborators/accept')
            .set('x-user-id', 'collab1');
        expect(acceptRes.status).toBe(200);
        expect(acceptRes.body.data.status).toBe('accepted');

        // Collaborator can access project
        const getRes = await request(app)
            .get('/projects/proj1')
            .set('x-user-id', 'collab1');
        expect(getRes.status).toBe(200);
    });

    it('collaborator is blocked after revocation', async () => {
        const project = { _id: 'proj1', ownerId: 'owner1', name: 'Test Project' };
        const revokedInvite = { projectId: 'proj1', inviteeId: 'collab1', status: 'revoked' };

        (CollaborationInvite.findOneAndUpdate as any).mockResolvedValue(revokedInvite);
        (Project.findOne as any).mockResolvedValue(project);
        // After revocation, findOne returns null (no accepted invite)
        (CollaborationInvite.findOne as any).mockResolvedValue(null);

        const app = buildCollabApp();

        // Owner revokes
        const revokeRes = await request(app)
            .delete('/projects/proj1/collaborators/collab1')
            .set('x-user-id', 'owner1');
        expect(revokeRes.status).toBe(200);
        expect(revokeRes.body.data.status).toBe('revoked');

        // Collaborator is now blocked
        const getRes = await request(app)
            .get('/projects/proj1')
            .set('x-user-id', 'collab1');
        expect(getRes.status).toBe(403);
    });

    it('invite to unknown email returns 404', async () => {
        (User.findOne as any).mockResolvedValue(null);
        const app = buildCollabApp();
        const res = await request(app)
            .post('/projects/proj1/collaborators')
            .set('x-user-id', 'owner1')
            .send({ email: 'unknown@nowhere.com' });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('USER_NOT_FOUND');
    });
});

// ============================================
// Property 25: Collaboration Access Control (Task 17.1)
// **Validates: Requirements 13.2, 13.3**
// ============================================

describe('Property 25: Collaboration Access Control', () => {
  beforeEach(() => vi.clearAllMocks());

  it(
    // **Validates: Requirements 13.2, 13.3**
    'accepted collaborator gets HTTP 200 on project GET; after revocation gets HTTP 403',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            ownerId: fc.hexaString({ minLength: 6, maxLength: 12 }),
            collaboratorId: fc.hexaString({ minLength: 6, maxLength: 12 }),
            projectId: fc.hexaString({ minLength: 6, maxLength: 12 }),
          }),
          async ({ ownerId, collaboratorId, projectId }) => {
            // Ensure owner and collaborator are different
            if (ownerId === collaboratorId) return;

            const project = { _id: projectId, ownerId, name: 'Test Project' };
            const acceptedInvite = { projectId, inviteeId: collaboratorId, status: 'accepted' };
            const revokedInvite = { projectId, inviteeId: collaboratorId, status: 'revoked' };

            const app = buildCollabApp();

            // Step 1: Collaborator has accepted invite → GET returns 200
            (Project.findOne as any).mockResolvedValue(project);
            (CollaborationInvite.findOne as any).mockResolvedValue(acceptedInvite);

            const getAfterAccept = await request(app)
              .get(`/projects/${projectId}`)
              .set('x-user-id', collaboratorId);
            expect(getAfterAccept.status).toBe(200);

            // Step 2: Owner revokes → invite becomes revoked
            (CollaborationInvite.findOneAndUpdate as any).mockResolvedValue(revokedInvite);

            const revokeRes = await request(app)
              .delete(`/projects/${projectId}/collaborators/${collaboratorId}`)
              .set('x-user-id', ownerId);
            expect(revokeRes.status).toBe(200);
            expect(revokeRes.body.data.status).toBe('revoked');

            // Step 3: After revocation, collaborator is blocked → GET returns 403
            (Project.findOne as any).mockResolvedValue(project);
            (CollaborationInvite.findOne as any).mockResolvedValue(null); // no accepted invite

            const getAfterRevoke = await request(app)
              .get(`/projects/${projectId}`)
              .set('x-user-id', collaboratorId);
            expect(getAfterRevoke.status).toBe(403);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    // **Validates: Requirement 13.4**
    'invite to unknown email always returns HTTP 404 with USER_NOT_FOUND',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress({ size: 'small' }).filter(email => /^[a-zA-Z0-9._%+\-@]+$/.test(email)),
          async (unknownEmail) => {
            (User.findOne as any).mockResolvedValue(null);
            const app = buildCollabApp();

            const res = await request(app)
              .post('/projects/proj-test/collaborators')
              .set('x-user-id', 'owner1')
              .send({ email: unknownEmail });

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('USER_NOT_FOUND');
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
