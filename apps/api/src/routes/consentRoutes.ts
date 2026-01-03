
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Define Schema here for simplicity or import from models
const ConsentSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    ipAddress: { type: String, required: true },
    consentDate: { type: Date, default: Date.now },
    termsVersion: { type: String, required: true },
    userAgent: { type: String }
});

const Consent = mongoose.models['Consent'] || mongoose.model('Consent', ConsentSchema);

// POST /api/consent/record
router.post('/record', async (req: Request, res: Response) => {
    try {
        const { userId, ipAddress, termsVersion, userAgent } = req.body;

        if (!userId || !ipAddress) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const newConsent = new Consent({
            userId,
            ipAddress,
            termsVersion,
            userAgent
        });

        await newConsent.save();

        return res.status(200).json({
            success: true,
            message: 'Consent recorded successfully',
            data: newConsent
        });

    } catch (error) {
        console.error('Error recording consent:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

export default router;
