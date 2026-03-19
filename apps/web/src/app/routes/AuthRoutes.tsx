import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const SignInPage = lazy(() => import('../../pages/SignInPage').then((m) => ({ default: m.SignInPage })));
const SignUpPage = lazy(() => import('../../pages/SignUpPage').then((m) => ({ default: m.SignUpPage })));
const ForgotPasswordPage = lazy(() => import('../../pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../../pages/ResetPasswordPage'));
const AccountLockedPage = lazy(() => import('../../pages/AccountLockedPage'));
const LinkExpiredPage = lazy(() => import('../../pages/LinkExpiredPage'));

export function AuthRoutes() {
  return (
    <>
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="/account-locked" element={<AccountLockedPage />} />
      <Route path="/link-expired" element={<LinkExpiredPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </>
  );
}
