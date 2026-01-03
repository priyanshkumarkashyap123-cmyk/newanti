import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express';
import { SocketServer } from './SocketServer.js';
import analysisRouter from './routes/analysis/index.js';
import designRouter from './routes/design/index.js';
import advancedRouter from './routes/advanced/index.js';
import interopRouter from './routes/interop/index.js';
import authRouter from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import { razorpayRouter } from './razorpay.js';
import { connectDB } from './models.js';
import { authMiddleware as inHouseAuthMiddleware, isUsingClerk } from './middleware/authMiddleware.js';
import {
    securityHeaders,
    generalRateLimit,
    analysisRateLimit,
    billingRateLimit,
    requestLogger,
    secureErrorHandler
} from './middleware/security.js';

const app = express();
const PORT = process.env['PORT'] ?? 3001;

// Create HTTP server for socket.io
const httpServer = createServer(app);

// Initialize Socket.IO server
const socketServer = new SocketServer(httpServer);

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// HTTP security headers (helmet)
app.use(securityHeaders);

// Request logging
app.use(requestLogger);

// General rate limiting
app.use(generalRateLimit);

// ============================================
// CORS & PARSING
// ============================================

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    process.env['FRONTEND_URL'] || "http://localhost:5173",
    "https://beamlabultimate.tech",
    "https://www.beamlabultimate.tech",
    "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net",
    "http://localhost:5173",
    "http://localhost:3000"
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) {
            return callback(null, true);
        }
        // Check if origin is in allowed list
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        // Log blocked origins for debugging
        console.warn(`CORS blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));  // Limit payload size

// Initialize authentication middleware based on provider
// USE_CLERK=true -> Clerk, otherwise -> in-house JWT
if (isUsingClerk()) {
    console.log('🔐 Using Clerk authentication');
    app.use(clerkMiddleware());
} else {
    console.log('🔐 Using in-house JWT authentication');
    app.use(inHouseAuthMiddleware);
}

// ============================================
// IN-HOUSE AUTH ROUTES (always available)
// ============================================

// Auth routes (signup, signin, signout, etc.)
// Auth routes (signup, signin, signout, etc.)
if (!isUsingClerk()) {
    app.use('/api/auth', authRouter);
}

// Health check (public)
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'ok',
        service: 'BeamLab Ultimate API',
        websocket: true,
        authProvider: isUsingClerk() ? 'clerk' : 'inhouse'
    });
});

// Structural Analysis API (rate limited: 10/min)
app.use('/api/analyze', analysisRateLimit, analysisRouter);
app.use('/api/analysis', analysisRateLimit, analysisRouter);

// Structural Design API (rate limited: 10/min)
app.use('/api/design', analysisRateLimit, designRouter);

// Advanced Analysis API (P-Delta, Modal, Buckling)
app.use('/api/advanced', analysisRateLimit, advancedRouter);

// Interoperability API (STAAD, DXF import/export)
app.use('/api/interop', analysisRateLimit, interopRouter);

// User Activity API (protected)
app.use('/api/user', userRoutes);

// Razorpay Billing API (rate limited: 5/min)
app.use('/api/billing', billingRateLimit, razorpayRouter);

// ============================================
// PROTECTED ROUTES (require authentication)
// ============================================

// Middleware to require authentication
const authRequired = requireAuth();

// Get current user projects
// Project API handled by projectRoutes
// app.get('/api/project', ... ) removed

// Project API
app.use('/api/project', projectRoutes);

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

// Start server immediately to satisfy startup probes
httpServer.listen(PORT, () => {
    console.log(`🚀 BeamLab Ultimate API running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket server ready for real-time collaboration`);
    console.log(`🔒 Security middleware active: helmet, rate limiting, logging`);

    // Connect to MongoDB in background
    connectDB().then(() => {
        console.log('✅ MongoDB connected successfully');
    }).catch(err => {
        console.error('❌ Failed to connect to MongoDB:', err);
    });
});

// Error handler (must be last middleware)
app.use(secureErrorHandler);
