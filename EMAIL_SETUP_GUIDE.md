# Email Configuration Guide for BeamLab In-House Authentication

## Overview
The in-house authentication system uses email for:
- **Email Verification** during signup
- **Password Reset** for account recovery
- **Email Change Confirmation** when users change their email
- **Welcome Emails** for new users

## Email Service Setup

### Option 1: Using Nodemailer with SMTP (Recommended for Self-Hosted)

**Best for:** Gmail, Outlook, custom SMTP servers, or self-hosted email solutions

#### Environment Variables
Add these to your `.env` or `.env.local` file in `/apps/api`:

```bash
# Email Service Configuration
EMAIL_SERVICE=nodemailer
SMTP_HOST=smtp.gmail.com              # Gmail, Outlook, or your SMTP provider
SMTP_PORT=587                         # Usually 587 (TLS) or 465 (SSL)
SMTP_USER=your-email@gmail.com        # Your email address
SMTP_PASSWORD=your-app-password       # Gmail App Password or SMTP password
FROM_EMAIL=noreply@beamlabultimate.tech
FROM_NAME=BeamLab

# Frontend URL for email links
FRONTEND_URL=https://beamlabultimate.tech
```

#### Setup for Gmail
1. Enable 2-Step Verification on your Google Account
2. Create an [App Password](https://myaccount.google.com/apppasswords)
3. Copy the 16-character password
4. Use it as `SMTP_PASSWORD`

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx  # 16-character app password
```

#### Setup for Outlook/Microsoft
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-outlook-password
```

#### Setup for Custom SMTP Server
```bash
SMTP_HOST=mail.example.com
SMTP_PORT=587                     # or 465 for implicit TLS
SMTP_USER=no-reply@example.com
SMTP_PASSWORD=your-password
```

### Option 2: Using SendGrid (Recommended for Production)

**Best for:** High-volume email, enterprise reliability

#### Environment Variables
```bash
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG.your-api-key-here
FROM_EMAIL=noreply@beamlabultimate.tech
FROM_NAME=BeamLab
FRONTEND_URL=https://beamlabultimate.tech
```

**Implementation note:** Currently using Nodemailer. To add SendGrid, install the `@sendgrid/mail` package and add the SendGrid handler to `/apps/api/src/services/emailService.ts`.

## Email Flow in Authentication

### 1. **Signup Flow**
```
User submits signup form
   ↓
Backend creates user (email not verified)
   ↓
Generates 6-digit verification code
   ↓
Sends verification email ← Email Service
   ↓
Frontend shows: "Check your email to verify"
   ↓
User enters code or clicks link
   ↓
Backend verifies code, marks email as verified
   ↓
User redirected to app
```

**Frontend:** `/sign-up` → `/verify-email`
**Backend Endpoints:**
- `POST /api/auth/signup` - Create account
- `POST /api/auth/verify-email` - Verify email code
- `POST /api/auth/resend-verification` - Resend verification email

### 2. **Password Reset Flow**
```
User clicks "Forgot Password"
   ↓
Enters email address
   ↓
Backend generates reset token (valid 1 hour)
   ↓
Sends reset email with link ← Email Service
   ↓
Frontend shows: "Check your email"
   ↓
User clicks link in email
   ↓
Frontend loads reset form with token
   ↓
User enters new password
   ↓
Backend validates token and updates password
   ↓
User can now login with new password
```

**Frontend:** `/forgot-password` → `/reset-password?token=xxx&email=xxx`
**Backend Endpoints:**
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Complete password reset

### 3. **Email Change Flow**
```
User changes email in settings
   ↓
Backend generates verification code
   ↓
Sends verification email to NEW email ← Email Service
   ↓
User confirms code
   ↓
Backend updates email address
   ↓
Sends confirmation to OLD email about the change
```

**Backend Endpoints:**
- `PUT /api/auth/change-email` - Request email change
- `POST /api/auth/verify-new-email` - Confirm new email

## Implementation Details

### Location of Email Service
**File:** `/apps/api/src/services/emailService.ts`

### Key Functions
```typescript
// Send verification email
await emailService.sendVerificationEmail(email, name, code);

// Send password reset email
await emailService.sendPasswordResetEmail(email, name, resetToken);

// Send welcome email
await emailService.sendWelcomeEmail(email, name);

// Send email change confirmation
await emailService.sendEmailChangeConfirmation(email, name, code);

// Test email service
await emailService.testEmailService(testEmail);
```

### Database Models Needed

The email system requires these models (already included):

```typescript
// User model
interface IUser {
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  password: string;
  // ... other fields
}

// Verification codes (temporary, expire in 10 mins)
interface IVerificationCode {
  userId: ObjectId;
  code: string;
  type: 'email' | 'password' | 'email_change';
  expiresAt: Date;
  createdAt: Date;
}

// Reset tokens (temporary, expire in 1 hour)
// Stored in verification codes table with type: 'password'
```

## Testing Email Service

### Development Mode (No Real Emails)
When SMTP is not configured, emails are logged to console:
```
📧 [DEV MODE] Verification code for user@example.com: 123456
```

### Production Mode (Real Emails)
Test the email service by calling:
```bash
curl -X POST http://localhost:3001/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"testEmail":"your@email.com"}'
```

### Common Issues

#### "Email service not configured"
- Check SMTP_USER and SMTP_PASSWORD are set
- Verify SMTP_HOST is correct
- Check FRONTEND_URL is set

#### "535 Authentication failed"
- Gmail: App password is incorrect or not generated
- Outlook: Password might have changed
- Custom: SMTP credentials are wrong

#### "Emails not arriving"
- Check spam/junk folder
- Verify FROM_EMAIL is authorized (SPF/DKIM)
- Check email service logs for bounce notifications

#### "Links in email don't work"
- FRONTEND_URL in env doesn't match actual frontend domain
- Check routes are registered in App.tsx

## Email Templates

Located in `/apps/api/src/services/emailService.ts`:

1. **verifyEmail** - Signup verification
2. **resetPassword** - Password reset
3. **welcome** - Welcome after signup
4. **emailChangeConfirmation** - Email change notification

All templates are:
- Responsive HTML with inline CSS
- Branded with BeamLab logo
- Include clear calls-to-action
- Have fallback text for plain text clients

## Security Considerations

1. **Verification Codes**
   - 6-digit random numbers
   - Expire in 10 minutes
   - Single-use only
   - Rate limited (prevent brute force)

2. **Reset Tokens**
   - 64-character hex strings
   - Expire in 1 hour
   - Single-use only
   - Invalidated after password reset

3. **Email Spoofing Prevention**
   - Verify email domain ownership (SPF, DKIM, DMARC)
   - Use company email for FROM address
   - Include unsubscribe links for compliance

4. **GDPR/Privacy**
   - Don't store plain text passwords
   - Allow email opt-out for marketing
   - Implement data retention policies
   - Include privacy notice in emails

## Frontend Integration

### Pages for Email Flows
- `/verify-email` - Email verification page
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset form

### Auth Store Integration
```typescript
// In authStore.ts
const { verifyEmail, forgotPassword, resetPassword } = useAuthStore();

// Usage
await verifyEmail(code);
await forgotPassword(email);
await resetPassword(token, email, newPassword);
```

## Monitoring and Logs

### Email Service Logs
```
✅ Email service ready
📧 [DEV MODE] Verification code for user@example.com: 123456
✅ Verification email sent to user@example.com
❌ Failed to send verification email: SMTP error
```

### Error Handling
- All email failures are logged but don't block user signup
- Users can request to resend emails
- Fall back to "verify manually" if email fails (optional)

## Next Steps

1. **Set up SMTP credentials** in `.env`
2. **Install nodemailer** if not already: `npm install nodemailer`
3. **Add TypeScript types** for nodemailer if needed
4. **Test email service** with test endpoint
5. **Update deployment environment variables**
6. **Monitor email delivery** in production
7. **Set up bounce handling** (optional, for SendGrid)

## Additional Resources

- [Nodemailer Documentation](https://nodemailer.com/about/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [SendGrid Documentation](https://sendgrid.com/docs/)
- [Email Best Practices](https://www.emailonacid.com/blog)
