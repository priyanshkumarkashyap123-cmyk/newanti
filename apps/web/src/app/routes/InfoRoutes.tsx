import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const PrivacyPolicyPageNew = lazy(() => import('../../pages/PrivacyPolicyPageNew'));
const TermsOfServicePage = lazy(() => import('../../pages/TermsOfServicePage'));
const TermsAndConditionsPage = lazy(() => import('../../pages/TermsAndConditionsPage'));
const RefundCancellationPage = lazy(() => import('../../pages/RefundCancellationPage'));
const HelpPage = lazy(() => import('../../pages/HelpPage'));
const AboutPage = lazy(() => import('../../pages/AboutPage'));
const ContactPage = lazy(() => import('../../pages/ContactPage'));

export function InfoRoutes() {
  return (
    <>
      <Route path="/privacy-policy" element={<PrivacyPolicyPageNew />} />
      <Route path="/terms-of-service" element={<TermsOfServicePage />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
      <Route path="/refund-cancellation" element={<RefundCancellationPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
    </>
  );
}
