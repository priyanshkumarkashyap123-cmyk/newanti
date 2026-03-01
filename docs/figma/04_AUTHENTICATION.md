# 04 — Authentication Flow
## BeamLab Ultimate Figma Specification

---

## 4.1 Sign In Page

### Desktop Layout (1440×900)
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  ┌────────────────────────────┐  ┌─────────────────────────────────────────────┐│
│  │                            │  │                                             ││
│  │                            │  │        Welcome Back                         ││
│  │     LEFT PANEL             │  │        Sign in to your account              ││
│  │     (Brand showcase)       │  │                                             ││
│  │                            │  │  ┌─────────────────────────────────────┐    ││
│  │  ┌──────────────────────┐  │  │  │ 🔵 Continue with Google            │    ││
│  │  │                      │  │  │  └─────────────────────────────────────┘    ││
│  │  │  3D structural       │  │  │  ┌─────────────────────────────────────┐    ││
│  │  │  model preview       │  │  │  │ 🐙 Continue with GitHub            │    ││
│  │  │  (animated,          │  │  │  └─────────────────────────────────────┘    ││
│  │  │  rotating)           │  │  │  ┌─────────────────────────────────────┐    ││
│  │  │                      │  │  │  │ 🔗 Continue with LinkedIn           │    ││
│  │  └──────────────────────┘  │  │  └─────────────────────────────────────┘    ││
│  │                            │  │                                             ││
│  │  "Analyze structures      │  │  ──────── or continue with email ────────   ││
│  │   10x faster with AI"     │  │                                             ││
│  │                            │  │  Email                                      ││
│  │  ★★★★★ 4.9/5 rating      │  │  [your@email.com                   ]        ││
│  │  from 2,000+ engineers    │  │                                             ││
│  │                            │  │  Password                                   ││
│  │  ┌───┐ ┌───┐ ┌───┐       │  │  [••••••••••               ] [👁]           ││
│  │  │   │ │   │ │   │       │  │                                             ││
│  │  │L&T│ │TA │ │ACC│ logos │  │  [Forgot password?]                          ││
│  │  └───┘ └───┘ └───┘       │  │                                             ││
│  │                            │  │  ☐ Remember this device                    ││
│  │                            │  │                                             ││
│  │                            │  │  ┌─────────────────────────────────────┐    ││
│  │                            │  │  │         Sign In →                   │    ││
│  │                            │  │  └─────────────────────────────────────┘    ││
│  │                            │  │                                             ││
│  │                            │  │  Don't have an account? [Sign Up]          ││
│  │                            │  │                                             ││
│  │                            │  └─────────────────────────────────────────────┘│
│  └────────────────────────────┘                                                 │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘

Layout:
  Split 50/50 (left brand, right form)
  Left panel: bg gradient primary→secondary, hidden on mobile
  Right panel: bg background-dark
  Form card: max-width 400px, centered in right half
  OAuth buttons: full-width, 44px height, outline style
  Divider: "or continue with email" with lines
  Inputs: standard input component
  CTA: primary button, full-width, 44px
  Link text: 13px, primary color
```

### Sign In States
```
Loading State:
  Button → spinner + "Signing in..."
  Inputs disabled

Error State:
  Red border on input with error
  Error message: "Invalid email or password" below form
  Toast notification (error variant)

Rate Limited:
  "Too many attempts. Try again in 30 seconds."
  Countdown timer displayed
```

---

## 4.2 Sign Up Page

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  LEFT PANEL (brand)              RIGHT PANEL (form)                             │
│                                                                                  │
│                                  Create Your Account                            │
│                                  Start analyzing structures for free            │
│                                                                                  │
│                                  [🔵 Sign up with Google]                       │
│                                  [🐙 Sign up with GitHub]                       │
│                                  [🔗 Sign up with LinkedIn]                     │
│                                                                                  │
│                                  ──────── or ────────                           │
│                                                                                  │
│                                  Full Name                                      │
│                                  [_____________________]                        │
│                                                                                  │
│                                  Email                                          │
│                                  [_____________________]                        │
│                                                                                  │
│                                  Password (min 8 chars)                         │
│                                  [_____________________] [👁]                   │
│                                                                                  │
│                                  Password Strength:                             │
│                                  [████████████░░░░░░░░] Strong                  │
│                                  ✓ 8+ characters                                │
│                                  ✓ Uppercase letter                             │
│                                  ✓ Number                                       │
│                                  ✕ Special character                            │
│                                                                                  │
│                                  Company / Organization (optional)              │
│                                  [_____________________]                        │
│                                                                                  │
│                                  Role (optional)                                │
│                                  [Structural Engineer ▾]                        │
│                                    - Structural Engineer                        │
│                                    - Civil Engineer                             │
│                                    - Architect                                  │
│                                    - Student                                    │
│                                    - Academic                                   │
│                                    - Other                                      │
│                                                                                  │
│                                  ☑ I agree to [Terms] and [Privacy Policy]      │
│                                  ☐ Send me product updates (optional)           │
│                                                                                  │
│                                  [Create Account →]                             │
│                                                                                  │
│                                  Already have an account? [Sign In]             │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4.3 Email Verification

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│                         📧                                                      │
│                                                                                  │
│               Check Your Email                                                  │
│                                                                                  │
│    We sent a verification link to                                               │
│    rakshit@example.com                                                          │
│                                                                                  │
│    Click the link in the email to verify                                        │
│    your account and get started.                                                │
│                                                                                  │
│    ┌──────────────────────────────────────┐                                     │
│    │      Open Email App →               │                                     │
│    └──────────────────────────────────────┘                                     │
│                                                                                  │
│    Didn't receive the email?                                                    │
│    [Resend verification email]                                                  │
│                                                                                  │
│    Check your spam folder or try a                                              │
│    different email address.                                                     │
│                                                                                  │
│    [← Back to Sign In]                                                          │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘

Center-aligned, max-width 480px
Success animation on email icon (successPop)
```

---

## 4.4 Forgot Password

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│               Reset Your Password                                               │
│                                                                                  │
│    Enter the email address associated with                                      │
│    your account and we'll send you a                                            │
│    password reset link.                                                         │
│                                                                                  │
│    Email                                                                        │
│    [_________________________________]                                          │
│                                                                                  │
│    ┌──────────────────────────────────┐                                         │
│    │   Send Reset Link →             │                                         │
│    └──────────────────────────────────┘                                         │
│                                                                                  │
│    [← Back to Sign In]                                                          │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Reset Password (After clicking email link)
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│               Set New Password                                                  │
│                                                                                  │
│    New Password                                                                 │
│    [_________________________________] [👁]                                     │
│                                                                                  │
│    Confirm New Password                                                         │
│    [_________________________________] [👁]                                     │
│                                                                                  │
│    Password Strength:                                                           │
│    [██████████████████████] Very Strong                                         │
│                                                                                  │
│    ┌──────────────────────────────────┐                                         │
│    │   Update Password →             │                                         │
│    └──────────────────────────────────┘                                         │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4.5 OAuth Callback / Loading

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│                         🏗                                                      │
│                         ⟳                                                       │
│                                                                                  │
│               Completing sign in...                                             │
│                                                                                  │
│    ┌──────────────────────────────────────┐                                     │
│    │████████████████░░░░░░░░░░░░░░│      │                                     │
│    └──────────────────────────────────────┘                                     │
│                                                                                  │
│    Validating your credentials with Google                                      │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘

Animated spinner on logo
Progress bar (indeterminate)
Auto-redirect on success
Error fallback with retry button
```

---

## 4.6 Auth Error States

```
Account Locked:
┌────────────────────────────────────────────┐
│  🔒 Account Locked                         │
│                                            │
│  Your account has been temporarily locked  │
│  due to too many failed login attempts.    │
│                                            │
│  Try again in: 14:32                       │
│                                            │
│  [Reset Password]  [Contact Support]       │
└────────────────────────────────────────────┘

Invalid Token:
┌────────────────────────────────────────────┐
│  ⚠ Link Expired                           │
│                                            │
│  This verification link has expired.       │
│  Please request a new one.                 │
│                                            │
│  [Resend Verification Email]               │
│  [← Back to Sign In]                       │
└────────────────────────────────────────────┘
```

---

## 4.7 Mobile Auth (375×812)
```
┌───────────────────────┐
│ 🏗 BeamLab            │
│                       │
│                       │
│  Welcome Back         │
│  Sign in to continue  │
│                       │
│ ┌───────────────────┐ │
│ │🔵 Google          │ │
│ └───────────────────┘ │
│ ┌───────────────────┐ │
│ │🐙 GitHub          │ │
│ └───────────────────┘ │
│                       │
│ ─── or with email ── │
│                       │
│ Email                 │
│ [___________________] │
│                       │
│ Password              │
│ [___________________] │
│                       │
│ [Forgot password?]    │
│                       │
│ ┌───────────────────┐ │
│ │    Sign In →      │ │
│ └───────────────────┘ │
│                       │
│ No account? [Sign Up] │
│                       │
└───────────────────────┘

No left brand panel on mobile
Full-width form, 16px margins
Stacked vertically
44px minimum touch targets
```
