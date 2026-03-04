import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import axios from "axios";
import queryString from "query-string";
import {
  UserModel,
  RefreshTokenModel,
  VerificationCodeModel
} from "../models.js";
import { emailService } from "../services/emailService.js";
import {
  validateBody,
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema
} from "../middleware/validation.js";
import { getCircuitBreaker } from "../utils/circuitBreaker.js";
import {
  recordAuthFailure,
  resetAuthFailures
} from "../middleware/accountLockout.js";
const router = Router();
const JWT_SECRET = process.env["JWT_SECRET"];
const JWT_REFRESH_SECRET = process.env["JWT_REFRESH_SECRET"];
if (process.env["USE_CLERK"] !== "true" && (!JWT_SECRET || !JWT_REFRESH_SECRET)) {
  throw new Error(
    "FATAL: JWT_SECRET and JWT_REFRESH_SECRET environment variables are required when USE_CLERK is not enabled. Refusing to start with insecure defaults."
  );
}
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const SALT_ROUNDS = 12;
const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"];
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"];
const GOOGLE_CALLBACK_URL = process.env["GOOGLE_CALLBACK_URL"] || "http://localhost:5173/auth/callback/google";
const GITHUB_CLIENT_ID = process.env["GITHUB_CLIENT_ID"];
const GITHUB_CLIENT_SECRET = process.env["GITHUB_CLIENT_SECRET"];
const GITHUB_CALLBACK_URL = process.env["GITHUB_CALLBACK_URL"] || "http://localhost:5173/auth/callback/github";
const LINKEDIN_CLIENT_ID = process.env["LINKEDIN_CLIENT_ID"];
const LINKEDIN_CLIENT_SECRET = process.env["LINKEDIN_CLIENT_SECRET"];
const LINKEDIN_CALLBACK_URL = process.env["LINKEDIN_CALLBACK_URL"] || "http://localhost:5173/auth/callback/linkedin";
const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};
const generateRefreshToken = (user) => {
  return jwt.sign({ userId: user.id, type: "refresh" }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY
  });
};
const generateVerificationCode = () => {
  return crypto.randomInt(1e5, 999999).toString();
};
const generateResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
const isValidPassword = (password) => {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain an uppercase letter"
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain a lowercase letter"
    };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain a number" };
  }
  return { valid: true };
};
const getErrorMessage = (error, fallback) => {
  if (error instanceof Error) return error.message;
  return fallback;
};
const getProviderErrorDetails = (error) => {
  if (error && typeof error === "object" && "response" in error) {
    return error.response?.data;
  }
  return getErrorMessage(error, "Unknown error");
};
const sanitizeUser = (user) => {
  return {
    id: user._id?.toString() || user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    role: user.role,
    subscriptionTier: user.subscriptionTier,
    company: user.company,
    phone: user.phone
  };
};
const handleOAuthUser = async (email, firstName, lastName, avatarUrl) => {
  let user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) {
    const randomPassword = crypto.randomBytes(16).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, SALT_ROUNDS);
    user = await UserModel.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      avatarUrl,
      role: "user",
      subscriptionTier: "free",
      emailVerified: true,
      // Trusted provider
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    });
  } else {
    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: {
          firstName,
          lastName,
          avatarUrl: user.avatarUrl || avatarUrl,
          lastLoginAt: /* @__PURE__ */ new Date(),
          emailVerified: true
        }
      }
    );
  }
  const accessToken = generateAccessToken({
    id: user._id.toString(),
    email: user.email,
    role: user.role
  });
  const refreshToken = generateRefreshToken({ id: user._id.toString() });
  await RefreshTokenModel.create({
    userId: user._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3)
  });
  return { user, accessToken, refreshToken };
};
router.get("/google/login", (req, res) => {
  if (!GOOGLE_CLIENT_ID)
    return res.status(503).json({ success: false, error: "Google OAuth not configured" });
  const params = queryString.stringify({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent"
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});
router.get("/github/login", (req, res) => {
  if (!GITHUB_CLIENT_ID)
    return res.status(503).json({ success: false, error: "GitHub OAuth not configured" });
  const params = queryString.stringify({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope: "read:user user:email"
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});
router.get("/linkedin/login", (req, res) => {
  if (!LINKEDIN_CLIENT_ID)
    return res.status(503).json({ success: false, error: "LinkedIn OAuth not configured" });
  const params = queryString.stringify({
    response_type: "code",
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: LINKEDIN_CALLBACK_URL,
    scope: "openid profile email"
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});
router.post("/google", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code)
      return res.status(400).json({ success: false, error: "Authorization code required" });
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({ success: false, error: "Google OAuth not configured" });
    }
    const googleBreaker = getCircuitBreaker("google-oauth", {
      failureThreshold: 3,
      resetTimeoutMs: 6e4
    });
    const {
      data: { access_token }
    } = await googleBreaker.execute(
      () => axios.post("https://oauth2.googleapis.com/token", {
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: GOOGLE_CALLBACK_URL
      })
    );
    const { data: profile } = await googleBreaker.execute(
      () => axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` }
      })
    );
    const result = await handleOAuthUser(
      profile.email,
      profile.given_name,
      profile.family_name || "",
      profile.picture
    );
    res.json({
      success: true,
      user: sanitizeUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
  } catch (error) {
    console.error("Google OAuth error:", getProviderErrorDetails(error));
    res.status(500).json({ success: false, error: "Google authentication failed" });
  }
});
router.post("/github", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code)
      return res.status(400).json({ success: false, error: "Authorization code required" });
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return res.status(503).json({ success: false, error: "GitHub OAuth not configured" });
    }
    const githubBreaker = getCircuitBreaker("github-oauth", {
      failureThreshold: 3,
      resetTimeoutMs: 6e4
    });
    const { data: tokenData } = await githubBreaker.execute(
      () => axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_CALLBACK_URL
        },
        {
          headers: { Accept: "application/json" }
        }
      )
    );
    if (tokenData.error) throw new Error(tokenData.error_description);
    const { data: profile } = await githubBreaker.execute(
      () => axios.get("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      })
    );
    let email = profile.email;
    if (!email) {
      const { data: emails } = await githubBreaker.execute(
        () => axios.get("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        })
      );
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary ? primary.email : emails[0].email;
    }
    const [firstName, ...lastNameParts] = (profile.name || profile.login).split(
      " "
    );
    const lastName = lastNameParts.join(" ");
    const result = await handleOAuthUser(
      email,
      firstName,
      lastName || "",
      profile.avatar_url
    );
    res.json({
      success: true,
      user: sanitizeUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
  } catch (error) {
    console.error("GitHub OAuth error:", getProviderErrorDetails(error));
    res.status(500).json({ success: false, error: "GitHub authentication failed" });
  }
});
router.post("/linkedin", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code)
      return res.status(400).json({ success: false, error: "Authorization code required" });
    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
      return res.status(503).json({ success: false, error: "LinkedIn OAuth not configured" });
    }
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: LINKEDIN_CALLBACK_URL,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET
    });
    const linkedinBreaker = getCircuitBreaker("linkedin-oauth", {
      failureThreshold: 3,
      resetTimeoutMs: 6e4
    });
    const { data: tokenData } = await linkedinBreaker.execute(
      () => axios.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        tokenParams.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      )
    );
    const { data: profile } = await linkedinBreaker.execute(
      () => axios.get("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      })
    );
    const result = await handleOAuthUser(
      profile.email,
      profile.given_name,
      profile.family_name,
      profile.picture
    );
    res.json({
      success: true,
      user: sanitizeUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
  } catch (error) {
    console.error("LinkedIn OAuth error:", getProviderErrorDetails(error));
    res.status(500).json({ success: false, error: "LinkedIn authentication failed" });
  }
});
router.post(
  "/signup",
  validateBody(signUpSchema),
  async (req, res) => {
    try {
      const { email, password, firstName, lastName, company, phone } = req.body;
      const existingUser = await UserModel.findOne({
        email: email.toLowerCase()
      });
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: "An account with this email already exists",
          errors: { email: "Email already registered" }
        });
        return;
      }
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await UserModel.create({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        company: company?.trim(),
        phone: phone?.trim(),
        role: "user",
        subscriptionTier: "free",
        emailVerified: false,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      });
      const accessToken = generateAccessToken({
        id: user._id.toString(),
        email: user.email,
        role: user.role
      });
      const refreshToken = generateRefreshToken({ id: user._id.toString() });
      await RefreshTokenModel.create({
        userId: user._id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3)
      });
      const verificationCode = generateVerificationCode();
      await VerificationCodeModel.create({
        userId: user._id,
        code: verificationCode,
        type: "email",
        expiresAt: new Date(Date.now() + 10 * 60 * 1e3)
        // 10 minutes
      });
      try {
        await emailService.sendVerificationEmail(
          user.email,
          user.firstName,
          verificationCode
        );
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
      }
      res.status(201).json({
        success: true,
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
        message: "Account created successfully. Please verify your email."
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create account. Please try again."
      });
    }
  }
);
router.post(
  "/signin",
  validateBody(signInSchema),
  async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;
      const user = await UserModel.findOne({ email: email.toLowerCase() });
      if (!user) {
        recordAuthFailure(req);
        return res.status(401).json({
          success: false,
          message: "Invalid email or password"
        });
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        recordAuthFailure(req);
        return res.status(401).json({
          success: false,
          message: "Invalid email or password"
        });
      }
      resetAuthFailures(req);
      const accessToken = generateAccessToken({
        id: user._id.toString(),
        email: user.email,
        role: user.role
      });
      const refreshToken = generateRefreshToken({ id: user._id.toString() });
      await RefreshTokenModel.create({
        userId: user._id,
        token: refreshToken,
        expiresAt: new Date(
          Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1e3
        )
      });
      await UserModel.updateOne(
        { _id: user._id },
        { $set: { lastLoginAt: /* @__PURE__ */ new Date() } }
      );
      res.json({
        success: true,
        user: sanitizeUser(user),
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error("Signin error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sign in. Please try again."
      });
    }
  }
);
router.post("/signout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshTokenModel.deleteOne({ token: refreshToken });
    }
    res.json({ success: true, message: "Signed out successfully" });
  } catch (error) {
    console.error("Signout error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sign out"
    });
  }
});
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required"
      });
    }
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token"
      });
    }
    const storedToken = await RefreshTokenModel.findOne({
      token: refreshToken
    });
    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token has been revoked"
      });
    }
    if (storedToken.expiresAt < /* @__PURE__ */ new Date()) {
      await RefreshTokenModel.deleteOne({ _id: storedToken._id });
      return res.status(401).json({
        success: false,
        message: "Refresh token expired"
      });
    }
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }
    const newAccessToken = generateAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role
    });
    const newRefreshToken = generateRefreshToken({ id: user._id.toString() });
    await RefreshTokenModel.updateOne(
      { _id: storedToken._id },
      {
        $set: {
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3)
        }
      }
    );
    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error("Refresh error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh token"
    });
  }
});
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }
    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    res.json({ success: true, data: sanitizeUser(user) });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, error: "Failed to get user" });
  }
});
router.post("/verify-email", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Verification code required"
      });
    }
    const verification = await VerificationCodeModel.findOne({
      userId: decoded.userId,
      code,
      type: "email",
      expiresAt: { $gt: /* @__PURE__ */ new Date() }
    });
    if (!verification) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code"
      });
    }
    await UserModel.updateOne(
      { _id: decoded.userId },
      { $set: { emailVerified: true, updatedAt: /* @__PURE__ */ new Date() } }
    );
    await VerificationCodeModel.deleteOne({ _id: verification._id });
    res.json({
      success: true,
      message: "Email verified successfully"
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify email"
    });
  }
});
router.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema),
  async (req, res) => {
    try {
      const { email } = req.body;
      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.json({
          success: true,
          message: "If an account exists with this email, you will receive a password reset link."
        });
      }
      const resetToken = generateResetToken();
      const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
      await VerificationCodeModel.create({
        userId: user._id,
        code: resetTokenHash,
        type: "password_reset",
        expiresAt: new Date(Date.now() + 60 * 60 * 1e3)
        // 1 hour
      });
      try {
        await emailService.sendPasswordResetEmail(
          user.email,
          user.firstName,
          resetToken
        );
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
      }
      res.json({
        success: true,
        message: "If an account exists with this email, you will receive a password reset link."
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process request"
      });
    }
  }
);
router.post(
  "/reset-password",
  validateBody(resetPasswordSchema),
  async (req, res) => {
    try {
      const { token, password: newPassword } = req.body;
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const resetRecord = await VerificationCodeModel.findOne({
        code: tokenHash,
        type: "password_reset",
        expiresAt: { $gt: /* @__PURE__ */ new Date() }
      });
      if (!resetRecord) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token"
        });
      }
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await UserModel.updateOne(
        { _id: resetRecord.userId },
        { $set: { password: hashedPassword, updatedAt: /* @__PURE__ */ new Date() } }
      );
      await VerificationCodeModel.deleteOne({ _id: resetRecord._id });
      await RefreshTokenModel.deleteMany({ userId: resetRecord.userId });
      res.json({
        success: true,
        message: "Password reset successfully. Please sign in with your new password."
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset password"
      });
    }
  }
);
router.put(
  "/profile",
  validateBody(updateProfileSchema),
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
      }
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const { firstName, lastName, avatarUrl, company, phone } = req.body;
      const updates = { updatedAt: /* @__PURE__ */ new Date() };
      if (firstName !== void 0) updates.firstName = firstName.trim();
      if (lastName !== void 0) updates.lastName = lastName.trim();
      if (avatarUrl !== void 0) updates.avatarUrl = avatarUrl;
      if (company !== void 0) updates.company = company.trim();
      if (phone !== void 0) updates.phone = phone.trim();
      const user = await UserModel.findByIdAndUpdate(
        decoded.userId,
        { $set: updates },
        { new: true }
      );
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update profile"
      });
    }
  }
);
router.post(
  "/change-password",
  validateBody(changePasswordSchema),
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
      }
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const { currentPassword, newPassword } = req.body;
      const user = await UserModel.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect"
        });
      }
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await UserModel.updateOne(
        { _id: user._id },
        { $set: { password: hashedPassword, updatedAt: /* @__PURE__ */ new Date() } }
      );
      res.json({
        success: true,
        message: "Password changed successfully"
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to change password"
      });
    }
  }
);
router.delete("/delete-account", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required to delete account"
      });
    }
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password"
      });
    }
    await RefreshTokenModel.deleteMany({ userId: user._id });
    await VerificationCodeModel.deleteMany({ userId: user._id });
    await UserModel.deleteOne({ _id: user._id });
    res.json({
      success: true,
      message: "Account deleted successfully"
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete account"
    });
  }
});
router.get("/check-email", async (req, res) => {
  try {
    const email = req.query["email"];
    if (!email) {
      return res.status(400).json({ available: false });
    }
    const delay = 100 + Math.random() * 150;
    await new Promise((resolve) => setTimeout(resolve, delay));
    const existingUser = await UserModel.findOne({
      email: email.toLowerCase()
    });
    if (existingUser) {
      res.json({ available: false, message: "This email cannot be used" });
    } else {
      res.json({ available: true });
    }
  } catch (error) {
    console.error("Check email error:", error);
    res.json({ available: false });
  }
});
router.post("/resend-verification", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified"
      });
    }
    const verificationCode = generateVerificationCode();
    await VerificationCodeModel.deleteMany({
      userId: user._id,
      type: "email"
    });
    await VerificationCodeModel.create({
      userId: user._id,
      code: verificationCode,
      type: "email",
      expiresAt: new Date(Date.now() + 10 * 60 * 1e3)
      // 10 minutes
    });
    try {
      await emailService.sendVerificationEmail(
        user.email,
        user.firstName,
        verificationCode
      );
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again later."
      });
    }
    res.json({
      success: true,
      message: "Verification email sent successfully"
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend verification email"
    });
  }
});
var authRoutes_default = router;
export {
  authRoutes_default as default
};
//# sourceMappingURL=authRoutes.js.map
