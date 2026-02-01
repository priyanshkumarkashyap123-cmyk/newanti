
import express, { Request, Response, Router } from 'express';
import { requireAuth, getAuth } from '../middleware/authMiddleware.js';
import { Project, User, IUser } from '../models.js';
import mongoose from 'mongoose';

const router: Router = express.Router();

// Middleware to require authentication
const authRequired = requireAuth();

// Sub-function to get or create Mongo User from Clerk ID
async function getMongoUser(clerkId: string, email?: string): Promise<IUser> {
    let user = await User.findOne({ clerkId });
    if (!user && email) {
        // Create user if not exists (JIT provisioning)
        user = await User.create({
            clerkId,
            email,
            tier: 'free'
        });
    }
    if (!user) {
        throw new Error('User not found');
    }
    return user;
}

// GET / - List all projects for current user
router.get('/', authRequired, async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Find user by Clerk ID
        const user = await User.findOne({ clerkId: userId });
        if (!user) {
            return res.json({ success: true, projects: [] });
        }

        // Find projects owned by this user
        const projects = await Project.find({ owner: user._id })
            .select('name description thumbnail updatedAt createdAt isPublic')
            .sort({ updatedAt: -1 });

        return res.json({
            success: true,
            projects
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// GET /:id - Get specific project
router.get('/:id', authRequired, async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        const projectId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ success: false, error: 'Invalid project ID' });
        }

        const user = await User.findOne({ clerkId: userId });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const project = await Project.findOne({
            _id: projectId,
            owner: user._id
        });

        if (!project) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }

        return res.json({
            success: true,
            project
        });
    } catch (error) {
        console.error('Error fetching project:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST / - Create new project
router.post('/', authRequired, async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        // Note: Clerk sometimes provides details in session claims, but we might rely on the DB
        // For JIT creation we assume the user already exists or we need email. 
        // For now, fail if user not found in DB (should be created via webhook or login)

        const { name, description, data, thumbnail } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Project name is required' });
        }

        const user = await User.findOne({ clerkId: userId });
        if (!user) {
            // Alternatively, could fetch user details from Clerk API here if needed
            return res.status(404).json({ success: false, error: 'User profile not found. Please log in again.' });
        }

        const project = await Project.create({
            name,
            description,
            thumbnail,
            data: data || {},
            owner: user._id,
            isPublic: false
        });

        // Add to user's project list
        await User.findByIdAndUpdate(user._id, {
            $push: { projects: project._id },
            $inc: { totalAnalysisRuns: 1 }
        });

        return res.json({
            success: true,
            project
        });
    } catch (error) {
        console.error('Error creating project:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// PUT /:id - Update project
router.put('/:id', authRequired, async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        const projectId = req.params.id;
        const { name, description, data, thumbnail } = req.body;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ success: false, error: 'Invalid project ID' });
        }

        const user = await User.findOne({ clerkId: userId });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Find and update
        const project = await Project.findOneAndUpdate(
            { _id: projectId, owner: user._id },
            {
                $set: {
                    ...(name && { name }),
                    ...(description && { description }),
                    ...(data && { data }),
                    ...(thumbnail && { thumbnail }),
                    updatedAt: new Date()
                }
            },
            { new: true }
        );

        if (!project) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }

        return res.json({
            success: true,
            project
        });
    } catch (error) {
        console.error('Error updating project:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// DELETE /:id - Delete project
router.delete('/:id', authRequired, async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        const projectId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ success: false, error: 'Invalid project ID' });
        }

        const user = await User.findOne({ clerkId: userId });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const project = await Project.findOneAndDelete({
            _id: projectId,
            owner: user._id
        });

        if (!project) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }

        // Remove from user's list
        await User.findByIdAndUpdate(user._id, {
            $pull: { projects: project._id }
        });

        return res.json({
            success: true,
            id: projectId
        });
    } catch (error) {
        console.error('Error deleting project:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

export default router;
