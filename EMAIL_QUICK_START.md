# Email System - Quick Start Guide

## 🚀 Getting Started (5 Minutes)

### Step 1: Install Dependencies (Already Done ✅)
```bash
npm install nodemailer  # Already added to package.json
```

### Step 2: Configure Email in `.env` (Choose One)

#### **Option A: Development Mode (Emails log to console)**
```bash
# Leave SMTP_HOST blank to use console logging
EMAIL_SERVICE=nodemailer
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=

FROM_EMAIL=noreply@beamlabultimate.tech
FROM_NAME=BeamLab
FRONTEND_URL=http://localhost:5173
```

#### **Option B: Gmail (Real Emails)**
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows" → Generate password
3. Copy the 16-character password
4. Update `.env`:

```bash
EMAIL_SERVICE=nodemailer
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx

FROM_EMAIL=noreply@beamlabultimate.tech
FROM_NAME=BeamLab
FRONTEND_URL=http://localhost:5173
```

#### **Option C: Outlook (Real Emails)**
```bash
EMAIL_SERVICE=nodemailer
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-outlook-password

FROM_EMAIL=noreply@beamlabultimate.tech
FROM_NAME=BeamLab
FRONTEND_URL=http://localhost:5173
```

### Step 3: Test the Email System
Run the API server:
```bash
npm run dev
```

Watch the console when you:
1. **Sign up** → See verification code logged
2. **Test email** → Call test endpoint (if implemented)

### Step 4: Test Full Signup Flow
1. Go to http://localhost:5173/sign-up
2. Fill signup form
3. Click "Sign up"
4. Should see `/verify-email` page
5. If using dev mode: Check console for code
6. If using real SMTP: Check email inbox
7. Enter code → Email verified ✅

---

## 📧 Email Flows Summary

### **Signup → Email Verification**
```
POST /api/auth/signup
├─ Create user
├─ Generate verification code (6-digit, 10 min expiry)
└─ Send verification email ← EMAIL SENT HERE
   
User enters code on /verify-email
   ↓
POST /api/auth/verify-email (with code)
└─ Mark email as verified
```

### **Forgot Password → Email Reset**
```
User visits /forgot-password
   ↓
POST /api/auth/forgot-password (with email)
├─ Generate reset token (64-char, 1 hour expiry)
└─ Send reset email with link ← EMAIL SENT HERE
   
User clicks link in email
   ↓
User enters new password on /reset-password
   ↓
POST /api/auth/reset-password (with token & new password)
└─ Update password & invalidate all refresh tokens
```

### **Resend Verification Email**
```
User didn't receive email
   ↓
POST /api/auth/resend-verification (authenticated)
├─ Delete old verification codes
├─ Generate new code
└─ Send new email ← EMAIL SENT HERE
```

---

## 📝 Available Endpoints

### **Authentication Endpoints**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/signup` | Create account + send verification email |
| POST | `/api/auth/verify-email` | Verify email with code |
| POST | `/api/auth/forgot-password` | Request password reset + send email |
| POST | `/api/auth/reset-password` | Complete password reset |
| POST | `/api/auth/resend-verification` | Resend verification email |

### **Email Service Functions** (In Node.js code)
```typescript
await emailService.sendVerificationEmail(email, firstName, code);
await emailService.sendPasswordResetEmail(email, firstName, token);
await emailService.sendWelcomeEmail(email, firstName);
await emailService.sendEmailChangeConfirmation(email, firstName, code);
```

---

## 🔍 Debug & Testing

### **See email logs in console:**
```
✅ Email service ready
📧 [DEV MODE] Verification code for user@example.com: 123456
```

### **Check if emails are sending:**
```bash
# Watch the API console output
# You should see confirmation messages for each email sent
```

### **Test with real email (Gmail example):**
1. Use your personal Gmail in `.env`:
   ```
   SMTP_USER=your-personal-email@gmail.com
   SMTP_PASSWORD=your-16-char-app-password
   ```
2. Sign up with a test email
3. Check your personal Gmail inbox for the test email

### **Common Errors**

| Error | Solution |
|-------|----------|
| "Email service not configured" | Set SMTP_HOST or SENDGRID_API_KEY in .env |
| "535 Authentication failed" | Use Gmail App Password, not regular password |
| "ENOTFOUND smtp.gmail.com" | Check internet connection, verify SMTP_HOST spelling |
| "Emails not arriving" | Check spam folder, verify FROM_EMAIL is authorized |

---

## ✅ Files Changed Summary

**Modified Files:**
- `apps/api/src/routes/authRoutes.ts` - Email service integrated
- `apps/api/src/services/emailService.ts` - Created ✅
- `apps/api/package.json` - Added nodemailer ✅
- `apps/api/.env` - Added email config ✅
- `apps/api/.env.example` - Updated ✅

**Frontend Pages (Ready to Use):**
- `apps/web/src/pages/VerifyEmailPage.tsx` - Email verification UI ✅
- `apps/web/src/pages/ForgotPasswordPage.tsx` - Password reset request ✅
- `apps/web/src/pages/ResetPasswordPage.tsx` - Password reset form ✅

---

## 🎯 Next Steps

### **Immediate (Today)**
1. ✅ Email service created
2. ✅ Backend endpoints integrated
3. ✅ Environment variables set
4. **→ Test signup flow in development**

### **Short-term (This Week)**
1. Test with real SMTP (Gmail)
2. Verify email links work correctly
3. Test password reset flow
4. Add email rate limiting (optional)

### **Production Deployment**
1. Get production SMTP credentials
2. Set FRONTEND_URL to production domain
3. Update production `.env`
4. Test all flows on production
5. Monitor email delivery

---

## 📚 Email Template Customization

Email templates are in `/apps/api/src/services/emailService.ts` (lines ~50-290)

To customize:
1. Open `emailService.ts`
2. Find `emailTemplates` object
3. Edit HTML/CSS for each template
4. Test in development mode

Current templates:
- `verifyEmail` - Signup verification
- `resetPassword` - Password reset
- `welcome` - Welcome after signup
- `emailChangeConfirmation` - Email change notification

---

## 🚀 Production Checklist

Before deploying to production:

- [ ] Configure production SMTP credentials
- [ ] Set FRONTEND_URL to production domain
- [ ] Set FROM_EMAIL to company email
- [ ] Test all email flows
- [ ] Verify email links work from production
- [ ] Check email templates display correctly
- [ ] Set up email monitoring/logging
- [ ] Configure bounce handling (optional)
- [ ] Test with multiple email providers (Gmail, Outlook, etc.)

---

## 📞 Support

**Email Service Location:** `/apps/api/src/services/emailService.ts`

**Auth Routes:** `/apps/api/src/routes/authRoutes.ts`

**Frontend Pages:** `/apps/web/src/pages/`
- VerifyEmailPage.tsx
- ForgotPasswordPage.tsx
- ResetPasswordPage.tsx

---

**✅ System Ready!** Your email infrastructure is now set up. Start testing in development mode (emails will log to console), then configure with real SMTP when ready for production.
