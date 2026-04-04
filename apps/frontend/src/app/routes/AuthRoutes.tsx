import { lazy } from 'react';
import { Route } from 'react-router-dom';

const SignInPage = lazy(() => import('../../pages/SignInPage').then((m) => ({ default: m.SignInPage })));
const SignUpPage = lazy(() => import('../../pages/SignUpPage').then((m) => ({ default: m.SignUpPage })));
const ForgotPasswordPage = lazy(() => import('../../pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('../../pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const AccountLockedPage = lazy(() => import('../../pages/AccountLockedPage').then((m) => ({ default: m.AccountLockedPage })));
const LinkExpiredPage = lazy(() => import('../../pages/LinkExpiredPage').then((m) => ({ default: m.LinkExpiredPage })));

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
