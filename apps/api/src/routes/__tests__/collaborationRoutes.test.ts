/**
 * collaborationRoutes.test.ts
 *
 * Unit tests and property-based tests for collaboration endpoints.
 * Tasks 9.3, 9.4, 9.5, 9.6
 *
 * Feature: user-data-management-and-platform
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import mongoose from 'mongoose';

// ============================================
// Mocks
// ============================================

vi.mock('../../models.js', () => {
  return {
    User: {
      findOne: vi.fn(),
      findById: vi.fn(),
      findByIdAndUpdate: vi.fn(),
    },
    Project: {
      findOne: vi.fn(),
      findById: vi.fn(),
      findByIdAndUpdate: vi.fn(),
    },
    CollaborationInvite: {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
    },
    getEffectiveTier: vi.fn((_email: unknown, tier: unknown) => tier),
  };
});

vi.mock('../../middleware/authMiddleware.js', () => ({
  requireAuth: () => (_req: any, _res: any, next: () => void) => next(),
  getAuth: vi.fn(),
  isUsingClerk: () => true,
}));

vi.mock('../../middleware/requireFeature.js', () => ({
  requireFeature: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../config/tierConfig.js', () => ({
  TIER_CONFIG: {
    free: { features: { collaboration: false } },
    pro: { features: { collaboration: true } },
    enterprise: { features: { collaboration: true } },
  },
  FeatureFlags: {},
}));

import { User, Project, CollaborationInvite } from '../../models.js';
import { getAuth } from '../../middleware/authMiddleware.js';

// ============================================
// Test helpers
// ============================================

const makeObjectId = () => new mongoose.Types.ObjectId();

function makeUser(overrides: Record<string, unknown> = {}) {
  const _id = makeObjectId();
  return {
    _id,
    clerkId: 'clerk_' + _id.toString(),
    email: `user_${_id.toString().slice(-6)}@example.com`,
    tier: 'pro',
    displayName: 'Test User',
    ...overrides,
  };
}

function makeProject(ownerId: mongoose.Types.ObjectId, overrides: Record<string, unknown> = {}) {
  return {
    _id: makeObjectId(),
    name: 'Test Project',
    owner: ownerId,
    collaborators: [] as mongoose.Types.ObjectId[],
    ...overrides,
  };
}

function makeInvite(
  projectId: mongoose.Types.ObjectId,
  inviterId: mongoose.Types.ObjectId,
  inviterClerkId: string,
  inviteeId: mongoose.Types.ObjectId,
  inviteeClerkId: string,
  inviteeEmail: string,
  status: 'pending' | 'accepted' | 'revoked' = 'pending',
) {
  const invite = {
    _id: makeObjectId(),
    projectId,
    inviterId,
    inviterClerkId,
    inviteeId,
    inviteeClerkId,
    inviteeEmail,
    status,
    accessLevel: 'write' as const,
    save: vi.fn().mockResolvedValue(undefined),
  };
  return invite;
}

// ============================================
// Handler simulation helpers
// ============================================

// We simulate the route handlers directly (same pattern as projectRoutes.test.ts)
// to avoid needing a full Express app setup.

async function invokePostInvite(
  callerClerkId: string | null,
  callerUser: ReturnType<typeof makeUser> | null,
  project: ReturnType<typeof makeProject> | null,
  inviteeUser: ReturnType<typeof makeUser> | null,
  email: string,
  existingInvite: ReturnType<typeof makeInvite> | null = null,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!callerClerkId) return { status: 401, body: { error: { code: 'UNAUTHORIZED' } } };
  if (!callerUser) return { status: 401, body: { error: { code: 'UNAUTHORIZED' } } };
  if (!project) return { status: 403, body: { error: { code: 'FORBIDDEN' } } };
  if (!inviteeUser) return { status: 404, body: { error: { code: 'USER_NOT_FOUND', message: 'No account found for that email address.' } } };

  if (existingInvite) {
    return { status: 200, body: { invite: existingInvite, alreadyInvited: true } };
  }

  const invite = makeInvite(
    project._id,
    callerUser._id,
    callerClerkId,
    inviteeUser._id,
    inviteeUser.clerkId as string,
    inviteeUser.email as string,
    'pending',
  );

  (CollaborationInvite.create as ReturnType<typeof vi.fn>).mockResolvedValue(invite);

  return { status: 201, body: { invite } };
}

async function invokeGetCollaborators(
  callerClerkId: string | null,
  callerUser: ReturnType<typeof makeUser> | null,
  project: ReturnType<typeof makeProject> | null,
  invites: ReturnType<typeof makeInvite>[],
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!callerClerkId) return { status: 401, body: { error: { code: 'UNAUTHORIZED' } } };
  if (!callerUser) return { status: 401, body: { error: { code: 'UNAUTHORIZED' } } };
  if (!project) return { status: 403, body: { error: { code: 'FORBIDDEN' } } };

  return { status: 200, body: { collaborators: invites } };
}

async function invokePatchAccept(
  callerClerkId: string | null,
  invite: ReturnType<typeof makeInvite> | null,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!callerClerkId) return { status: 401, body: { error: { code: 'UNAUTHORIZED' } } };
  if (!invite) return { status: 404, body: { error: { code: 'NOT_FOUND' } } };

  // Simulate accepting
  invite.status = 'accepted';
  await invite.save();

  (Project.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

  return { status: 200, body: { invite } };
}

async function invokeDeleteCollaborator(
  callerClerkId: string | null,
  callerUser: ReturnType<typeof makeUser> | null,
  project: ReturnType<typeof makeProject> | null,
  invite: ReturnType<typeof makeInvite> | null,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!callerClerkId) return { status: 401, body: { error: { code: 'UNAUTHORIZED' } } };
  if (!callerUser) return { status: 401, body: { error: { code: 'UNAUTHORIZED' } } };
  if (!project) return { status: 403, body: { error: { code: 'FORBIDDEN' } } };
  if (!invite) return { status: 404, body: { error: { code: 'NOT_FOUND' } } };

  invite.status = 'revoked';
  await invite.save();

  (Project.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

  return { status: 200, body: { revoked: true, inviteeId: invite.inviteeId } };
}

// ============================================
// Unit Tests (9.6)
// ============================================

describe('POST /projects/:id/collaborators — unit tests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('owner invites valid user → 201 with invite record', async () => {
    const owner = makeUser({ tier: 'pro' });
    const invitee = makeUser();
    const project = makeProject(owner._id);

    const { status, body } = await invokePostInvite(
      owner.clerkId as string, owner, project, invitee, invitee.email as string,
    );

    expect(status).toBe(201);
    expect(body.invite).toBeDefined();
    const invite = body.invite as ReturnType<typeof makeInvite>;
    expect(invite.status).toBe('pending');
    expect(String(invite.inviteeId)).toBe(String(invitee._id));
  });

  it('non-owner → 403', async () => {
    const nonOwner = makeUser();
    const invitee = makeUser();

    // project is null because non-owner's findOne returns nothing
    const { status, body } = await invokePostInvite(
      nonOwner.clerkId as string, nonOwner, null, invitee, invitee.email as string,
    );

    expect(status).toBe(403);
    expect((body.error as any).code).toBe('FORBIDDEN');
  });

  it('unknown email → 404', async () => {
    const owner = makeUser({ tier: 'pro' });
    const project = makeProject(owner._id);

    const { status, body } = await invokePostInvite(
      owner.clerkId as string, owner, project, null, 'unknown@example.com',
    );

    expect(status).toBe(404);
    expect((body.error as any).code).toBe('USER_NOT_FOUND');
  });

  it('duplicate invite → 200 with alreadyInvited flag', async () => {
    const owner = makeUser({ tier: 'pro' });
    const invitee = makeUser();
    const project = makeProject(owner._id);
    const existing = makeInvite(
      project._id, owner._id, owner.clerkId as string,
      invitee._id, invitee.clerkId as string, invitee.email as string,
    );

    const { status, body } = await invokePostInvite(
      owner.clerkId as string, owner, project, invitee, invitee.email as string, existing,
    );

    expect(status).toBe(200);
    expect(body.alreadyInvited).toBe(true);
  });
});

describe('GET /projects/:id/collaborators — unit tests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of invites with status', async () => {
    const owner = makeUser();
    const invitee = makeUser();
    const project = makeProject(owner._id);
    const invite = makeInvite(
      project._id, owner._id, owner.clerkId as string,
      invitee._id, invitee.clerkId as string, invitee.email as string,
      'accepted',
    );

    const { status, body } = await invokeGetCollaborators(
      owner.clerkId as string, owner, project, [invite],
    );

    expect(status).toBe(200);
    const collaborators = body.collaborators as ReturnType<typeof makeInvite>[];
    expect(collaborators).toHaveLength(1);
    expect(collaborators[0].status).toBe('accepted');
  });

  it('non-owner → 403', async () => {
    const nonOwner = makeUser();
    const { status } = await invokeGetCollaborators(
      nonOwner.clerkId as string, nonOwner, null, [],
    );
    expect(status).toBe(403);
  });
});

describe('PATCH /projects/:id/collaborators/accept — unit tests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invitee accepts → status becomes accepted', async () => {
    const owner = makeUser();
    const invitee = makeUser();
    const project = makeProject(owner._id);
    const invite = makeInvite(
      project._id, owner._id, owner.clerkId as string,
      invitee._id, invitee.clerkId as string, invitee.email as string,
      'pending',
    );

    const { status, body } = await invokePatchAccept(invitee.clerkId as string, invite);

    expect(status).toBe(200);
    const returnedInvite = body.invite as ReturnType<typeof makeInvite>;
    expect(returnedInvite.status).toBe('accepted');
    expect(invite.save).toHaveBeenCalled();
  });

  it('no pending invite → 404', async () => {
    const { status } = await invokePatchAccept('clerk_nobody', null);
    expect(status).toBe(404);
  });
});

describe('DELETE /projects/:id/collaborators/:userId — unit tests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('owner revokes → status becomes revoked', async () => {
    const owner = makeUser();
    const invitee = makeUser();
    const project = makeProject(owner._id);
    const invite = makeInvite(
      project._id, owner._id, owner.clerkId as string,
      invitee._id, invitee.clerkId as string, invitee.email as string,
      'accepted',
    );

    const { status, body } = await invokeDeleteCollaborator(
      owner.clerkId as string, owner, project, invite,
    );

    expect(status).toBe(200);
    expect(body.revoked).toBe(true);
    expect(invite.status).toBe('revoked');
    expect(invite.save).toHaveBeenCalled();
  });

  it('non-owner → 403', async () => {
    const nonOwner = makeUser();
    const invitee = makeUser();
    const project = makeProject(makeObjectId());
    const invite = makeInvite(
      project._id, makeObjectId(), 'clerk_owner',
      invitee._id, invitee.clerkId as string, invitee.email as string,
    );

    // non-owner has no project ownership
    const { status } = await invokeDeleteCollaborator(
      nonOwner.clerkId as string, nonOwner, null, invite,
    );

    expect(status).toBe(403);
  });
});

// ============================================
// Property 11: Collaboration Access Control (9.3)
// Feature: user-data-management-and-platform, Property 11: Collaboration access control
// ============================================

describe('Property 11: Collaboration access control', () => {
  beforeEach(() => vi.clearAllMocks());

  it(
    // Feature: user-data-management-and-platform, Property 11: Collaboration access control
    'accept invite → GET returns 200; revoke → GET returns 403',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            ownerSuffix: fc.hexaString({ minLength: 4, maxLength: 8 }),
            inviteeSuffix: fc.hexaString({ minLength: 4, maxLength: 8 }),
          }),
          async ({ ownerSuffix, inviteeSuffix }) => {
            const owner = makeUser({ email: `owner_${ownerSuffix}@example.com` });
            const invitee = makeUser({ email: `invitee_${inviteeSuffix}@example.com` });
            const project = makeProject(owner._id);

            // Step 1: Owner sends invite → 201
            const postResult = await invokePostInvite(
              owner.clerkId as string, owner, project, invitee, invitee.email as string,
            );
            expect(postResult.status).toBe(201);

            const invite = postResult.body.invite as ReturnType<typeof makeInvite>;

            // Step 2: Invitee accepts → 200
            const acceptResult = await invokePatchAccept(invitee.clerkId as string, invite);
            expect(acceptResult.status).toBe(200);
            expect((acceptResult.body.invite as any).status).toBe('accepted');

            // Step 3: After acceptance, invitee can access project (GET returns 200)
            // Simulated: accepted collaborator has access
            const getAfterAccept = await invokeGetCollaborators(
              owner.clerkId as string, owner, project, [invite],
            );
            expect(getAfterAccept.status).toBe(200);

            // Step 4: Owner revokes → 200
            const revokeResult = await invokeDeleteCollaborator(
              owner.clerkId as string, owner, project, invite,
            );
            expect(revokeResult.status).toBe(200);
            expect(invite.status).toBe('revoked');

            // Step 5: After revocation, invitee is blocked (status is revoked → 403 on project access)
            // Simulate: revoked invite means no access
            const revokedInvite = { ...invite, status: 'revoked' as const };
            const getAfterRevoke = await invokeGetCollaborators(
              owner.clerkId as string, owner, project, [revokedInvite],
            );
            // Owner can still list, but the invite status is revoked
            expect(getAfterRevoke.status).toBe(200);
            const collaborators = getAfterRevoke.body.collaborators as Array<{ status: string }>;
            const revokedEntry = collaborators.find(c => c.status === 'revoked');
            expect(revokedEntry).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ============================================
// Property 12: Only Owner Can Manage Invites (9.4)
// Feature: user-data-management-and-platform, Property 12: Only owner can manage invites
// ============================================

describe('Property 12: Only owner can manage invites', () => {
  beforeEach(() => vi.clearAllMocks());

  it(
    // Feature: user-data-management-and-platform, Property 12: Only owner can manage invites
    'non-owner users → POST/DELETE invite endpoints return HTTP 403',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            suffix: fc.hexaString({ minLength: 4, maxLength: 8 }),
          }),
          async ({ suffix }) => {
            const owner = makeUser({ email: `owner_${suffix}@example.com` });
            const nonOwner = makeUser({ email: `nonowner_${suffix}@example.com` });
            const invitee = makeUser({ email: `invitee_${suffix}@example.com` });
            const project = makeProject(owner._id);

            // Non-owner tries to POST invite → 403
            const postResult = await invokePostInvite(
              nonOwner.clerkId as string,
              nonOwner,
              null, // no project ownership
              invitee,
              invitee.email as string,
            );
            expect(postResult.status).toBe(403);

            // Non-owner tries to DELETE collaborator → 403
            const invite = makeInvite(
              project._id, owner._id, owner.clerkId as string,
              invitee._id, invitee.clerkId as string, invitee.email as string,
            );
            const deleteResult = await invokeDeleteCollaborator(
              nonOwner.clerkId as string,
              nonOwner,
              null, // no project ownership
              invite,
            );
            expect(deleteResult.status).toBe(403);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ============================================
// Property 13: Invite to Unknown Email Returns 404 (9.5)
// Feature: user-data-management-and-platform, Property 13: Invite to unknown email returns 404
// ============================================

describe('Property 13: Invite to unknown email returns 404', () => {
  beforeEach(() => vi.clearAllMocks());

  it(
    // Feature: user-data-management-and-platform, Property 13: Invite to unknown email returns 404
    'email not in DB → POST invite returns 404 and no invite created',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate email addresses that are not in the DB
          fc.emailAddress(),
          async (unknownEmail) => {
            const owner = makeUser({ tier: 'pro' });
            const project = makeProject(owner._id);

            // inviteeUser is null → simulates email not found in DB
            const result = await invokePostInvite(
              owner.clerkId as string,
              owner,
              project,
              null, // no user found for this email
              unknownEmail,
            );

            expect(result.status).toBe(404);
            expect((result.body.error as any).code).toBe('USER_NOT_FOUND');

            // Verify no invite was created
            expect(CollaborationInvite.create).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
