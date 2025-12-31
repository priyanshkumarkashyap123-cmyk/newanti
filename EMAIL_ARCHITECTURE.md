# Email System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BEAMLAB EMAIL SYSTEM                      │
└─────────────────────────────────────────────────────────────────┘

                        FRONTEND (React)
                              │
                ┌─────────────┼─────────────┐
                │             │             │
         /sign-up      /verify-email  /forgot-password
                │             │             │
                └─────────────┼─────────────┘
                              │
                              ▼
                        API SERVER (Node.js)
                    /apps/api/src/routes/
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    POST /signup         POST /verify-email   POST /forgot-password
         │                    │                    │
         ├─ Create user       ├─ Validate code    ├─ Find user
         ├─ Hash password     ├─ Mark verified    ├─ Gen token
         ├─ Gen verification  ├─ Delete code      ├─ Store token
         │  code (6-digit)    └─ Success          └─ [EMAIL SENT]
         └─ [EMAIL SENT] ◄────────────────────────┘
                │
         ┌──────▼──────────────────────────────────┐
         │   Email Service (Nodemailer)            │
         │  /apps/api/src/services/emailService.ts │
         └──────┬──────────────────────────────────┘
                │
         ┌──────▼──────────────────┐
         │  SMTP Server            │
         ├─ Gmail                  │
         ├─ Outlook                │
         ├─ Custom SMTP            │
         └─ SendGrid (optional)    │
                │
                ▼
         📧 EMAIL SENT TO USER
```

---

## Request/Response Flow

### **Signup with Email Verification**

```
CLIENT                          API SERVER                    EMAIL SERVICE

1. Fill signup form
   │
   ├─ POST /signup ─────────────────────────────────────────►
   │  {
   │    email: "user@example.com",
   │    password: "Password123!",
   │    firstName: "John",
   │    lastName: "Doe"
   │  }
   │
   │                    ┌─ Create user in DB
   │                    ├─ Hash password
   │                    ├─ Gen verification code: 123456
   │                    ├─ Store code (expires 10 min)
   │                    │
   │                    └─► Call emailService.sendVerificationEmail()
   │                         │
   │                         ├─ Read FROM_EMAIL, SMTP_USER, SMTP_PASSWORD
   │                         ├─ Connect to SMTP server
   │                         ├─ Render HTML template
   │                         ├─ Send email with code: 123456
   │                         │
   │                         └──► 📧 Email arrives in user's inbox
   │
   │◄──────────────────────────────────────────────────────────
   │  {
   │    success: true,
   │    message: "Account created. Verify your email.",
   │    accessToken: "eyJ...",
   │    refreshToken: "eyJ...",
   │    user: { email, firstName, ... }
   │  }
   │
2. User receives email with code: 123456
   │
3. Redirect to /verify-email
   │
4. Enter code: 123456
   │
   └─ POST /verify-email ───────────────────────────────────►
      {
        code: "123456"
      }
      + Authorization: Bearer accessToken
      │
      │                    ┌─ Find verification record
      │                    ├─ Validate code & expiry
      │                    ├─ Mark user: emailVerified = true
      │                    └─ Delete code from DB
      │
      │◄──────────────────────────────────────────────────────
      │  {
      │    success: true,
      │    message: "Email verified successfully"
      │  }
      │
5. Redirect to /app ✅ Email verified!
```

### **Password Reset Flow**

```
CLIENT                          API SERVER                    EMAIL SERVICE

1. Click "Forgot Password"
   │
   ├─ Go to /forgot-password
   │
2. Enter email: user@example.com
   │
   └─ POST /forgot-password ──────────────────────────────────►
      {
        email: "user@example.com"
      }
      │
      │                    ┌─ Find user by email
      │                    ├─ Gen reset token: abc123def456...
      │                    ├─ Hash token for storage
      │                    ├─ Store hash (expires 1 hour)
      │                    │
      │                    └─► Call emailService.sendPasswordResetEmail()
      │                         │
      │                         ├─ Connect to SMTP
      │                         ├─ Render email with reset link:
      │                         │  https://beamlabultimate.tech/reset-password
      │                         │  ?token=abc123def456...
      │                         │  &email=user@example.com
      │                         ├─ Send email
      │                         │
      │                         └──► 📧 Email arrives in user's inbox
      │
      │◄──────────────────────────────────────────────────────
      │  {
      │    success: true,
      │    message: "Check your email for reset link"
      │  }
      │
3. Show "Check email" message
   │
4. User receives email with reset link
   │
5. Click link in email
   ├─ Browser opens: /reset-password?token=abc123...&email=user@example.com
   │
6. Enter new password
   │
   └─ POST /reset-password ───────────────────────────────────►
      {
        token: "abc123def456...",
        newPassword: "NewPassword123!"
      }
      │
      │                    ┌─ Hash token for lookup
      │                    ├─ Find matching token record
      │                    ├─ Validate not expired
      │                    ├─ Hash new password
      │                    ├─ Update user password in DB
      │                    ├─ Delete token from DB
      │                    └─ Invalidate all refresh tokens
      │
      │◄──────────────────────────────────────────────────────
      │  {
      │    success: true,
      │    message: "Password reset. Sign in with new password"
      │  }
      │
7. Redirect to /signin
   │
8. Login with email + new password ✅
```

---

## Email Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│         Email Service (emailService.ts)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CONFIGURATION LOADER                                   │
│     ├─ Read env variables: SMTP_HOST, SMTP_USER, etc.      │
│     ├─ Initialize Nodemailer transporter                   │
│     └─ Setup SendGrid client (if configured)               │
│                                                             │
│  2. TEMPLATE ENGINE                                        │
│     ├─ verifyEmail(email, name, code)                      │
│     │  └─ HTML: Verification code with branding            │
│     ├─ resetPassword(email, name, token)                   │
│     │  └─ HTML: Reset link with 1-hour expiry message      │
│     ├─ welcome(email, name)                                │
│     │  └─ HTML: Welcome + onboarding info                  │
│     └─ emailChangeConfirmation(email, name, code)          │
│        └─ HTML: Email change + code verification           │
│                                                             │
│  3. SEND FUNCTIONS                                         │
│     ├─ sendVerificationEmail()                             │
│     │  └─ Call template + send via SMTP                    │
│     ├─ sendPasswordResetEmail()                            │
│     │  └─ Call template + send via SMTP                    │
│     ├─ sendWelcomeEmail()                                  │
│     │  └─ Call template + send via SMTP                    │
│     ├─ sendEmailChangeConfirmation()                       │
│     │  └─ Call template + send via SMTP                    │
│     └─ testEmailService()                                  │
│        └─ Send test email to verify SMTP works             │
│                                                             │
│  4. ERROR HANDLING                                         │
│     ├─ SMTP connection errors → Log & continue             │
│     ├─ Template rendering errors → Log & continue          │
│     ├─ SMTP sending errors → Log & return error            │
│     └─ Dev mode: Log to console if SMTP not configured     │
│                                                             │
│  5. DEVELOPMENT MODE                                       │
│     └─ If SMTP_HOST empty: Log emails to console only      │
│        Example: 📧 Verification code: 123456               │
│                                                             │
└─────────────────────────────────────────────────────────────┘

         NODEMAILER TRANSPORTER (SMTP Client)
                      │
         ┌────────────┴───────────┐
         │                        │
    ┌────▼─────┐            ┌────▼──────┐
    │   SMTP   │            │ SendGrid  │
    │ (Primary)│            │(Optional) │
    └────┬─────┘            └───────────┘
         │
    ┌────▼──────────────────┐
    │  Connection to SMTP   │
    │  (Gmail, Outlook, etc)│
    └────┬──────────────────┘
         │
         ▼
    📧 EMAIL SENT
```

---

## Database Schema

### **Users Table**
```typescript
{
  _id: ObjectId,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  emailVerified: boolean,     ← False initially, true after verification
  createdAt: Date,
  updatedAt: Date,
  ...otherFields
}
```

### **Verification Codes Table**
```typescript
{
  _id: ObjectId,
  userId: ObjectId,           ← Reference to user
  code: string,               ← Either:
                             │  "123456" (email verification, 6-digit)
                             │  "abc123..." (password reset, 64-char hex)
  type: string,              ← "email" or "password_reset"
  expiresAt: Date,           ← Date when code expires
  createdAt: Date
}

Indexes:
- { userId: 1, type: 1 }     ← For finding codes by user
- { expiresAt: 1 }           ← For cleanup/expiry
```

---

## Environment Variables

```
EMAIL_SERVICE
├─ nodemailer: Use SMTP configuration
└─ sendgrid: Use SendGrid API key

SMTP Configuration (if EMAIL_SERVICE=nodemailer)
├─ SMTP_HOST: smtp.gmail.com
├─ SMTP_PORT: 587 or 465
├─ SMTP_USER: sender@example.com
└─ SMTP_PASSWORD: app-password or SMTP password

Email Configuration
├─ FROM_EMAIL: noreply@beamlabultimate.tech
├─ FROM_NAME: BeamLab
└─ FRONTEND_URL: http://localhost:5173 (for email links)
```

---

## Error Handling

```
Email Sending Attempt
        │
        ├─ SMTP Connection Error
        │  └─ Log error, continue (user can retry)
        │
        ├─ Template Rendering Error
        │  └─ Log error, continue (user can retry)
        │
        ├─ SMTP Send Error
        │  └─ Log error, return error to caller
        │
        ├─ Success
        │  └─ Log success message, return OK
        │
        └─ Dev Mode (No SMTP Configured)
           └─ Log to console: "📧 Code: 123456"
```

---

## Security Considerations

```
Verification Code Security
├─ 6-digit random number
├─ 10-minute expiry
├─ Single-use (deleted after verification)
├─ User-specific (can't use another user's code)
└─ Rate-limited per user (prevent brute force)

Reset Token Security
├─ 64-character hex string (cryptographically random)
├─ 1-hour expiry
├─ Stored as hash in database (not plaintext)
├─ Single-use (deleted after reset)
├─ User-specific
├─ All refresh tokens invalidated after reset
└─ Old tokens can't be replayed

Email Security
├─ From address is company email
├─ Links include token in URL
├─ Tokens are cryptographically random
├─ No passwords sent via email
└─ HTTPS required for production
```

---

## Integration Points

```
Authentication Flow
    │
    ├─► POST /api/auth/signup
    │   └─► emailService.sendVerificationEmail()
    │
    ├─► POST /api/auth/verify-email
    │   └─► Check code, update emailVerified
    │
    ├─► POST /api/auth/forgot-password
    │   └─► emailService.sendPasswordResetEmail()
    │
    ├─► POST /api/auth/reset-password
    │   └─► Validate token, update password
    │
    └─► POST /api/auth/resend-verification
        └─► emailService.sendVerificationEmail()

Frontend Flows
    │
    ├─► /sign-up
    │   └─► Calls POST /signup
    │       └─► Redirects to /verify-email
    │
    ├─► /verify-email
    │   ├─► Calls POST /verify-email
    │   ├─► Calls POST /resend-verification (resend button)
    │   └─► Redirects to /app (on success)
    │
    ├─► /forgot-password
    │   └─► Calls POST /forgot-password
    │
    └─► /reset-password?token=...
        └─► Calls POST /reset-password
            └─► Redirects to /signin (on success)
```

---

## Deployment Checklist

```
Development ✅
├─ Email service created
├─ Auth endpoints integrated
├─ Env variables configured (SMTP_HOST=empty for dev)
└─ Testing in console mode

Staging
├─ Configure Gmail SMTP
├─ Test email sending
├─ Verify email links work
└─ Test all user flows

Production
├─ Configure production SMTP
├─ Set FRONTEND_URL to production domain
├─ Set FROM_EMAIL to company email
├─ Test all flows
├─ Monitor email delivery
├─ Set up bounce handling
└─ Monitor error logs
```

---

This architecture provides a complete email system for authentication while maintaining security, reliability, and ease of deployment.
