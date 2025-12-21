import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express';
import { analyzeStructure } from './solver.js';
import { SocketServer } from './SocketServer.js';

const app = express();
const PORT = process.env['PORT'] ?? 3001;

// Create HTTP server for socket.io
const httpServer = createServer(app);

// Initialize Socket.IO server
const socketServer = new SocketServer(httpServer);

app.use(cors());
app.use(express.json());

// Initialize Clerk middleware (optional auth check on all routes)
app.use(clerkMiddleware());

// Health check (public)
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'BeamLab Ultimate API', websocket: true });
});

// Structural Analysis Endpoint (public for now)
app.post('/api/analyze', (req: Request, res: Response) => {
    try {
        const { nodes, members, loads } = req.body;

        if (!nodes || !members) {
            res.status(400).json({ success: false, message: 'Missing nodes or members' });
            return;
        }

        const result = analyzeStructure({ nodes, members, loads: loads || [] });
        res.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message });
    }
});

// ============================================
// PROTECTED ROUTES (require authentication)
// ============================================

// Middleware to require authentication
const authRequired = requireAuth();

// Get current user projects
app.get('/api/project', authRequired, (req: Request, res: Response) => {
    const auth = getAuth(req);
    const userId = auth.userId;

    // TODO: Fetch projects from database
    res.json({
        success: true,
        userId,
        projects: []
    });
});

// Create a new project
app.post('/api/project', authRequired, (req: Request, res: Response) => {
    const auth = getAuth(req);
    const userId = auth.userId;
    const { name, description } = req.body;

    // TODO: Save project to database
    res.json({
        success: true,
        project: {
            id: `proj_${Date.now()}`,
            userId,
            name,
            description,
            createdAt: new Date().toISOString()
        }
    });
});

// Get a specific project
app.get('/api/project/:id', authRequired, (req: Request, res: Response) => {
    const auth = getAuth(req);
    const userId = auth.userId;
    const projectId = req.params['id'];

    // TODO: Fetch project from database
    res.json({
        success: true,
        project: { id: projectId, userId }
    });
});

// Update a project
app.put('/api/project/:id', authRequired, (req: Request, res: Response) => {
    const auth = getAuth(req);
    const userId = auth.userId;
    const projectId = req.params['id'];
    const { name, data } = req.body;

    // TODO: Update project in database
    res.json({
        success: true,
        project: { id: projectId, userId, name, data, updatedAt: new Date().toISOString() }
    });
});

// Delete a project
app.delete('/api/project/:id', authRequired, (req: Request, res: Response) => {
    const auth = getAuth(req);
    const userId = auth.userId;
    const projectId = req.params['id'];

    // TODO: Delete project from database
    res.json({
        success: true,
        deleted: { id: projectId, userId }
    });
});

// Get users in a project (for multiplayer)
app.get('/api/project/:id/users', (req: Request, res: Response) => {
    const projectId = req.params['id'] ?? '';
    const users = socketServer.getProjectUsers(projectId);
    res.json({
        success: true,
        projectId,
        users: users.map(u => ({ id: u.id, name: u.name, color: u.color }))
    });
});

// Use HTTP server instead of app.listen for socket.io
httpServer.listen(PORT, () => {
    console.log(`🚀 BeamLab Ultimate API running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket server ready for real-time collaboration`);
});

