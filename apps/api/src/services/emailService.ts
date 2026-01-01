/**
 * emailService.ts - Email Sending Service
 * 
 * Supports both SendGrid and Nodemailer (SMTP)
 * Handles email verification, password reset, and other notifications
 */

import nodemailer from 'nodemailer';

// ============================================
// EMAIL SERVICE CONFIGURATION
// ============================================

const EMAIL_SERVICE = process.env['EMAIL_SERVICE'] || 'nodemailer'; // 'sendgrid' or 'nodemailer'
const SMTP_HOST = process.env['SMTP_HOST'] || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env['SMTP_PORT'] || '587');
const SMTP_USER = process.env['SMTP_USER'];
const SMTP_PASSWORD = process.env['SMTP_PASSWORD'];
const SENDGRID_API_KEY = process.env['SENDGRID_API_KEY'];
const FROM_EMAIL = process.env['FROM_EMAIL'] || 'noreply@beamlabultimate.tech';
const FROM_NAME = process.env['FROM_NAME'] || 'BeamLab';
const FRONTEND_URL = process.env['FRONTEND_URL'] || 'http://localhost:5173';

// ============================================
// EMAIL TEMPLATES
// ============================================

const emailTemplates = {
    // Verification Email
    verifyEmail: (name: string, code: string, email: string): { subject: string; html: string } => {
        const verifyLink = `${FRONTEND_URL}/verify-email?code=${code}&email=${encodeURIComponent(email)}`;
        return {
            subject: 'Verify your BeamLab account',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
                        .email-box { background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                        .header { text-align: center; margin-bottom: 30px; }
                        .logo { font-size: 24px; font-weight: bold; color: #7c3aed; }
                        .content { margin: 30px 0; }
                        .code-box { background-color: #f3f4f6; border: 2px solid #e5e7eb; border-radius: 6px; padding: 15px; text-align: center; }
                        .code { font-size: 32px; font-weight: bold; color: #7c3aed; letter-spacing: 4px; }
                        .button { display: inline-block; background-color: #7c3aed; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: 600; }
                        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="email-box">
                            <div class="header">
                                <div class="logo">BeamLab</div>
                            </div>
                            
                            <div class="content">
                                <p>Hello ${name || 'User'},</p>
                                <p>Welcome to BeamLab! Please verify your email address to complete your registration.</p>
                                
                                <div class="code-box">
                                    <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your verification code:</p>
                                    <div class="code">${code}</div>
                                </div>
                                
                                <p>Or click the button below to verify:</p>
                                <div style="text-align: center;">
                                    <a href="${verifyLink}" class="button">Verify Email</a>
                                </div>
                                
                                <p style="color: #666; font-size: 14px;">
                                    This code expires in 10 minutes.<br/>
                                    If you didn't create a BeamLab account, please ignore this email.
                                </p>
                            </div>
                            
                            <div class="footer">
                                <p>© 2025 BeamLab. All rights reserved.</p>
                                <p><a href="${FRONTEND_URL}" style="color: #7c3aed; text-decoration: none;">beamlabultimate.tech</a></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    },

    // Password Reset Email
    resetPassword: (name: string, resetToken: string, email: string): { subject: string; html: string } => {
        const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
        return {
            subject: 'Reset your BeamLab password',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
                        .email-box { background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                        .header { text-align: center; margin-bottom: 30px; }
                        .logo { font-size: 24px; font-weight: bold; color: #7c3aed; }
                        .alert { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
                        .button { display: inline-block; background-color: #7c3aed; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: 600; }
                        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="email-box">
                            <div class="header">
                                <div class="logo">BeamLab</div>
                            </div>
                            
                            <div class="content">
                                <p>Hello ${name || 'User'},</p>
                                <p>We received a request to reset your BeamLab password. Click the button below to create a new password:</p>
                                
                                <div style="text-align: center;">
                                    <a href="${resetLink}" class="button">Reset Password</a>
                                </div>
                                
                                <div class="alert">
                                    <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
                                </div>
                                
                                <p style="color: #666; font-size: 14px;">
                                    If the button doesn't work, copy and paste this link into your browser:<br/>
                                    <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${resetLink}</code>
                                </p>
                            </div>
                            
                            <div class="footer">
                                <p>© 2025 BeamLab. All rights reserved.</p>
                                <p><a href="${FRONTEND_URL}" style="color: #7c3aed; text-decoration: none;">beamlabultimate.tech</a></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    },

    // Welcome Email
    welcome: (name: string): { subject: string; html: string } => {
        return {
            subject: 'Welcome to BeamLab!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
                        .email-box { background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                        .header { text-align: center; margin-bottom: 30px; }
                        .logo { font-size: 24px; font-weight: bold; color: #7c3aed; }
                        .button { display: inline-block; background-color: #7c3aed; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: 600; }
                        .feature { margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 6px; }
                        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="email-box">
                            <div class="header">
                                <div class="logo">BeamLab</div>
                            </div>
                            
                            <div class="content">
                                <p>Welcome to BeamLab, ${name || 'User'}!</p>
                                <p>We're excited to have you on board. BeamLab is a professional structural analysis platform designed for engineers.</p>
                                
                                <div class="feature">
                                    <strong>🏗️ Structural Analysis</strong><br/>
                                    Analyze beams, trusses, and frames with professional FEA tools.
                                </div>
                                
                                <div class="feature">
                                    <strong>📊 Visualization</strong><br/>
                                    Beautiful 3D visualizations with bending moment, shear force, and deflection diagrams.
                                </div>
                                
                                <div class="feature">
                                    <strong>📐 Design Checks</strong><br/>
                                    Automatic code compliance checks and design recommendations.
                                </div>
                                
                                <p>Get started now:</p>
                                <div style="text-align: center;">
                                    <a href="${FRONTEND_URL}/app" class="button">Open BeamLab</a>
                                </div>
                            </div>
                            
                            <div class="footer">
                                <p>© 2025 BeamLab. All rights reserved.</p>
                                <p><a href="${FRONTEND_URL}" style="color: #7c3aed; text-decoration: none;">beamlabultimate.tech</a></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    },

    // Email Change Confirmation
    emailChangeConfirmation: (name: string, code: string): { subject: string; html: string } => {
        return {
            subject: 'Confirm your new email address',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
                        .email-box { background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                        .header { text-align: center; margin-bottom: 30px; }
                        .logo { font-size: 24px; font-weight: bold; color: #7c3aed; }
                        .code-box { background-color: #f3f4f6; border: 2px solid #e5e7eb; border-radius: 6px; padding: 15px; text-align: center; }
                        .code { font-size: 32px; font-weight: bold; color: #7c3aed; letter-spacing: 4px; }
                        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="email-box">
                            <div class="header">
                                <div class="logo">BeamLab</div>
                            </div>
                            
                            <div class="content">
                                <p>Hello ${name || 'User'},</p>
                                <p>Please confirm your new email address using the code below:</p>
                                
                                <div class="code-box">
                                    <div class="code">${code}</div>
                                </div>
                                
                                <p style="color: #666; font-size: 14px;">
                                    This code expires in 10 minutes.<br/>
                                    If you didn't request this change, please contact support immediately.
                                </p>
                            </div>
                            
                            <div class="footer">
                                <p>© 2025 BeamLab. All rights reserved.</p>
                                <p><a href="${FRONTEND_URL}" style="color: #7c3aed; text-decoration: none;">beamlabultimate.tech</a></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }
};

// ============================================
// NODEMAILER TRANSPORTER
// ============================================

let transporter: nodemailer.Transporter | null = null;

if (EMAIL_SERVICE === 'nodemailer') {
    if (!SMTP_USER || !SMTP_PASSWORD) {
        console.warn('⚠️  SMTP credentials not configured. Email sending will be disabled.');
        console.warn('   Set SMTP_USER, SMTP_PASSWORD, and optionally SMTP_HOST, SMTP_PORT');
    } else {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465, // true for 465, false for other ports
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASSWORD
            }
        });

        // Verify connection
        transporter.verify((error: Error | null, success: boolean) => {
            if (error) {
                console.error('❌ Email service failed to initialize:', error.message);
            } else {
                console.log('✅ Email service ready');
            }
        });
    }
}

// ============================================
// EMAIL SERVICE FUNCTIONS
// ============================================

export const emailService = {
    /**
     * Send verification email
     */
    sendVerificationEmail: async (email: string, name: string, code: string): Promise<boolean> => {
        try {
            if (!transporter) {
                console.log(`📧 [DEV MODE] Verification code for ${email}: ${code}`);
                return true;
            }

            const template = emailTemplates.verifyEmail(name, code, email);
            await transporter.sendMail({
                from: `${FROM_NAME} <${FROM_EMAIL}>`,
                to: email,
                subject: template.subject,
                html: template.html
            });

            console.log(`✅ Verification email sent to ${email}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to send verification email to ${email}:`, error);
            return false;
        }
    },

    /**
     * Send password reset email
     */
    sendPasswordResetEmail: async (email: string, name: string, resetToken: string): Promise<boolean> => {
        try {
            if (!transporter) {
                console.log(`📧 [DEV MODE] Password reset link for ${email}: /reset-password?token=${resetToken}`);
                return true;
            }

            const template = emailTemplates.resetPassword(name, resetToken, email);
            await transporter.sendMail({
                from: `${FROM_NAME} <${FROM_EMAIL}>`,
                to: email,
                subject: template.subject,
                html: template.html
            });

            console.log(`✅ Password reset email sent to ${email}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to send password reset email to ${email}:`, error);
            return false;
        }
    },

    /**
     * Send welcome email
     */
    sendWelcomeEmail: async (email: string, name: string): Promise<boolean> => {
        try {
            if (!transporter) {
                console.log(`📧 [DEV MODE] Welcome email for ${email}`);
                return true;
            }

            const template = emailTemplates.welcome(name);
            await transporter.sendMail({
                from: `${FROM_NAME} <${FROM_EMAIL}>`,
                to: email,
                subject: template.subject,
                html: template.html
            });

            console.log(`✅ Welcome email sent to ${email}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to send welcome email to ${email}:`, error);
            return false;
        }
    },

    /**
     * Send email change confirmation
     */
    sendEmailChangeConfirmation: async (email: string, name: string, code: string): Promise<boolean> => {
        try {
            if (!transporter) {
                console.log(`📧 [DEV MODE] Email change confirmation for ${email}: ${code}`);
                return true;
            }

            const template = emailTemplates.emailChangeConfirmation(name, code);
            await transporter.sendMail({
                from: `${FROM_NAME} <${FROM_EMAIL}>`,
                to: email,
                subject: template.subject,
                html: template.html
            });

            console.log(`✅ Email change confirmation sent to ${email}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to send email change confirmation to ${email}:`, error);
            return false;
        }
    },

    /**
     * Test email service
     */
    testEmailService: async (testEmail: string): Promise<boolean> => {
        try {
            if (!transporter) {
                console.log('❌ Email service not configured');
                return false;
            }

            const result = await transporter.sendMail({
                from: `${FROM_NAME} <${FROM_EMAIL}>`,
                to: testEmail,
                subject: 'BeamLab Email Service Test',
                html: '<p>This is a test email from BeamLab. Email service is working correctly!</p>'
            });

            console.log('✅ Test email sent successfully:', result.messageId);
            return true;
        } catch (error) {
            console.error('❌ Test email failed:', error);
            return false;
        }
    }
};

export default emailService;
