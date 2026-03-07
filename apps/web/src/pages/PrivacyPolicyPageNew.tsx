/**
 * PrivacyPolicyPageNew.tsx - Comprehensive Privacy Policy
 * Legal document compliant with Indian IT Act 2000, Consumer Protection Act 2019,
 * and IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021
 *
 * Owner: Rakshit Tiwari trading as Beamlab
 * Address: Rajapur Teonthar, Rewa, Madhya Pradesh 486220
 * Last updated: February 24, 2026
 */

import { Link } from "react-router-dom";
import {
  Shield,
  ChevronRight,
  Menu,
  X,
  Lock,
  Mail,
  MapPin,
  Clock,
  Scale,
  FileText,
  AlertTriangle,
  Globe,
  UserCheck,
  Eye,
  Trash2,
  Key,
} from "lucide-react";
import { useState, useEffect, memo } from "react";
import { PageHeader, type NavLink } from "../components/layout";

// ============================================
// TYPES & CONSTANTS
// ============================================

interface Section {
  id: string;
  number: string;
  title: string;
}

const sections: Section[] = [
  { id: "introduction", number: "", title: "Introduction" },
  { id: "collection", number: "1", title: "Collection" },
  { id: "usage", number: "2", title: "Usage" },
  { id: "sharing", number: "3", title: "Sharing" },
  { id: "security", number: "4", title: "Security Precautions" },
  { id: "deletion-retention", number: "5", title: "Data Deletion & Retention" },
  { id: "rights-consent", number: "6", title: "Your Rights & Consent" },
  { id: "cookies", number: "7", title: "Cookies & Tracking" },
  { id: "children", number: "8", title: "Children's Privacy" },
  { id: "changes", number: "9", title: "Changes to This Policy" },
  { id: "grievance-officer", number: "10", title: "Grievance Officer" },
  { id: "contact", number: "11", title: "Contact Us" },
];

// ============================================
// COMPONENT
// ============================================

export const PrivacyPolicyPageNew = () => {
  const [activeSection, setActiveSection] = useState("introduction");

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  };

  useEffect(() => { document.title = 'Privacy Policy | BeamLab'; }, []);

  // Intersection observer to track active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const navLinks: NavLink[] = [
    { to: '/terms-and-conditions', label: 'Terms and Conditions' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white dark:from-slate-950 via-slate-100 dark:via-slate-900 to-white dark:to-slate-950">
      <PageHeader
        showAuth={true}
        navLinks={navLinks}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar - Table of Contents */}
          <aside className="w-72 flex-shrink-0">
            <div className="sticky top-24">
              <h3 className="text-sm font-semibold text-slate-900/50 dark:text-white/50 uppercase tracking-wider mb-4">
                Table of Contents
              </h3>
              <nav className="space-y-1 max-h-[70vh] overflow-y-auto pr-2">
                {sections.map((section) => (
                  <button type="button"
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 group ${
                      activeSection === section.id
                        ? "bg-blue-500/20 text-blue-300"
                        : "text-slate-900/70 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <ChevronRight
                      className={`w-4 h-4 transition-opacity ${
                        activeSection === section.id
                          ? "text-blue-400 opacity-100"
                          : "text-blue-400 opacity-0 group-hover:opacity-100"
                      }`}
                    />
                    <span className="text-blue-400 font-mono text-sm w-6">
                      {section.number}
                    </span>
                    <span className="text-sm">{section.title}</span>
                  </button>
                ))}
              </nav>

              {/* Quick Links */}
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10">
                <h4 className="text-sm font-semibold text-slate-900/50 dark:text-white/50 uppercase tracking-wider mb-3">
                  Related Documents
                </h4>
                <div className="space-y-2">
                  <Link
                    to="/terms-and-conditions"
                    className="flex items-center gap-2 text-sm text-slate-900/60 dark:text-white/60 hover:text-blue-400 transition-colors"
                  >
                    <Scale className="w-4 h-4" />
                    Terms and Conditions
                  </Link>
                  <Link
                    to="/contact"
                    className="flex items-center gap-2 text-sm text-slate-900/60 dark:text-white/60 hover:text-blue-400 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Contact Us
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 max-w-4xl">
            {/* Title Section */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-8 h-8 text-blue-400" />
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
                  Privacy Policy
                </h1>
              </div>
              <p className="text-slate-900/60 dark:text-white/60">
                Last Updated: February 24, 2026 | Effective Date: February 24,
                2026
              </p>
              <p className="text-slate-900/50 dark:text-white/50 text-sm mt-1">
                Domain: beamlab.app
              </p>

              {/* Important Notice */}
              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-200 font-medium">
                      Your Privacy Matters
                    </p>
                    <p className="text-blue-200/70 text-sm mt-1">
                      This Privacy Policy describes how Rakshit Tiwari trading
                      as Beamlab and its affiliates collect, use,
                      share, protect, or otherwise process your information and
                      personal data through our Platform. Please read this
                      policy carefully before using or accessing our Platform.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Sections */}
            <div className="prose prose-invert prose-lg max-w-none">
              {/* Introduction */}
              <section id="introduction" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  Introduction
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  This Privacy Policy describes how{" "}
                  <strong>Rakshit Tiwari</strong> trading as{" "}
                  <strong>Beamlab</strong> and its affiliates
                  (collectively &quot;Beamlab&quot;, &quot;we&quot;,
                  &quot;our&quot;, &quot;us&quot;) collect, use, share, protect,
                  or otherwise process your information and personal data
                  through our website{" "}
                  <a
                    href="https://beamlab.app"
                    className="text-blue-400 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    beamlab.app
                  </a>{" "}
                  (hereinafter referred to as the &quot;
                  <strong>Platform</strong>&quot;).
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  Please note that you may be able to browse certain sections of
                  the Platform without registering with us.
                </p>

                <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-200 font-medium">
                        Important Notice — India Only
                      </p>
                      <p className="text-amber-200/70 text-sm mt-1">
                        We do not offer any product/service under this Platform
                        outside India, and your personal data will primarily be
                        stored and processed in India. By visiting this
                        Platform, providing your information, or availing of any
                        product/service offered on the Platform, you expressly
                        agree to be bound by the terms and conditions of this
                        Privacy Policy, the{" "}
                        <Link
                          to="/terms-and-conditions"
                          className="text-amber-300 hover:underline"
                        >
                          Terms of Use
                        </Link>
                        , and the applicable service/product terms and
                        conditions, and agree to be governed by the laws of
                        India, including but not limited to the laws applicable
                        to data protection and privacy.
                      </p>
                      <p className="text-amber-200/70 text-sm mt-2 font-semibold">
                        If you do not agree, please do not use or access our
                        Platform.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 1. Collection */}
              <section id="collection" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">1.</span> Collection
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  We collect your personal data when you use our Platform,
                  services, or otherwise interact with us during the course of
                  providing our services. Some of the information that we may
                  collect includes but is not limited to:
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>Your name</li>
                  <li>Date of birth</li>
                  <li>Address</li>
                  <li>Telephone/mobile number</li>
                  <li>Email ID</li>
                  <li>
                    Proof of identity or address provided during sign-up or
                    verification
                  </li>
                </ul>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  All data collection is in accordance with applicable Indian
                  laws. You always have the option to not provide information by
                  choosing not to use a particular service, product, or feature
                  on the Platform. We may track your behaviour, preferences, and
                  other information that you choose to provide on our Platform.
                  We use this information in an aggregate or anonymous form for
                  internal research on demographics, interests, and behaviour of
                  our users.
                </p>

                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-200 font-bold">Fraud Warning</p>
                      <p className="text-red-200/70 text-sm mt-1">
                        If you receive an email, SMS, or phone call from a
                        person/entity claiming to be Beamlab seeking
                        any sensitive personal data like debit/credit card PIN,
                        net-banking or mobile banking password, One Time
                        Password (OTP), etc.,{" "}
                        <strong>please do not provide such information</strong>.
                        If you have already revealed such information, report it
                        immediately to the appropriate law enforcement agency.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Usage */}
              <section id="usage" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">2.</span> Usage
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  We use personal data to provide the services you request. This
                  includes but is not limited to:
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>
                    Providing and fulfilling the services you request on the
                    Platform.
                  </li>
                  <li>
                    Enhancing your customer experience and improving our
                    services.
                  </li>
                  <li>Resolving disputes and troubleshooting problems.</li>
                  <li>
                    Informing you about online and offline offers, products,
                    services, and updates relevant to you.
                  </li>
                  <li>
                    Detecting and protecting us against error, fraud, and other
                    criminal or unlawful activity.
                  </li>
                  <li>Enforcing our terms and conditions.</li>
                  <li>
                    Conducting internal research and analysis to improve our
                    Platform and Services.
                  </li>
                </ul>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  To the extent we use your personal data to market to you, we
                  will provide you the ability to opt-out of such uses. You may
                  opt out of marketing communications by using the unsubscribe
                  link in our emails or contacting us directly.
                </p>
              </section>

              {/* 3. Sharing */}
              <section id="sharing" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">3.</span> Sharing
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  We may share personal data internally within our group
                  entities and affiliates to provide you access to the services
                  and products offered by them.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  We may also disclose personal data to third parties, including
                  but not limited to:
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>
                    <strong>Business partners and affiliates</strong> — to
                    jointly provide services and fulfill product/service
                    requests.
                  </li>
                  <li>
                    <strong>Service providers</strong> — such as logistics
                    providers, cloud hosting platforms, payment gateways, and
                    other vendors required to deliver and support our Services.
                  </li>
                  <li>
                    <strong>Government agencies or law enforcement</strong> — if
                    required to do so by law or in good faith belief that such
                    disclosure is reasonably necessary to respond to subpoenas,
                    court orders, legal processes, or to protect the rights,
                    property, and safety of Beamlab, its users, or the
                    public.
                  </li>
                </ul>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  These entities and affiliates may market to you as a result of
                  such sharing unless you explicitly opt-out.
                </p>
                <div className="mt-4 p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                  <p className="text-slate-900/70 dark:text-white/70 text-sm">
                    <strong>Note:</strong> We do not sell your personal data to
                    any unaffiliated third parties for their marketing purposes
                    without your explicit consent.
                  </p>
                </div>
              </section>

              {/* 4. Security Precautions */}
              <section id="security" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Key className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">4.</span> Security Precautions
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  To protect your personal data from unauthorised access or
                  disclosure, loss or misuse, we adopt reasonable security
                  practices and procedures, in line with industry standards.
                  These include but are not limited to:
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>
                    <strong>Encryption:</strong> TLS/SSL encryption for all data
                    in transit.
                  </li>
                  <li>
                    <strong>Secure Storage:</strong> Encrypted storage for
                    sensitive personal data at rest.
                  </li>
                  <li>
                    <strong>Access Controls:</strong> Role-based access control
                    and multi-factor authentication.
                  </li>
                  <li>
                    <strong>Monitoring:</strong> Continuous security monitoring
                    and threat detection systems.
                  </li>
                  <li>
                    <strong>Regular Audits:</strong> Periodic security
                    assessments and vulnerability scans.
                  </li>
                </ul>

                <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-200 font-medium">Important</p>
                      <p className="text-amber-200/70 text-sm mt-1">
                        However, the transmission of information via the
                        internet is not completely secure and therefore, while
                        we strive to protect your personal data, we cannot
                        guarantee the security of data transmitted to us over
                        the internet. By using our Platform, users accept the
                        inherent security implications of data transmission over
                        the internet and will not hold us responsible for any
                        breach of security. Users are responsible for ensuring
                        the protection of their login and password records for
                        the Platform.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 5. Data Deletion and Retention */}
              <section id="deletion-retention" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Trash2 className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">5.</span> Data Deletion and
                  Retention
                </h2>
                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">
                  5.1 Account Deletion
                </h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  You have the option to delete your account by visiting your
                  profile and settings on the Platform. Please note that upon
                  deletion of your account, you will lose all information
                  related to your account, including your project files,
                  analysis data, and account history. This action is
                  irreversible.
                </p>

                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">
                  5.2 Retention Policy
                </h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  We retain your personal data for a period no longer than is
                  required for the purpose for which it was collected or as
                  required under any applicable law. However, we may retain data
                  beyond this period if necessary for the following purposes:
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>
                    Preventing fraud and investigating suspected illegal
                    activities.
                  </li>
                  <li>Resolving pending matters, disputes, or grievances.</li>
                  <li>
                    Complying with applicable laws, legal obligations, or court
                    orders.
                  </li>
                  <li>Protecting legitimate legal or business interests.</li>
                </ul>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  Once the retention period expires or the purpose is fulfilled,
                  your personal data will be securely deleted or anonymised in
                  accordance with applicable laws.
                </p>
              </section>

              {/* 6. Your Rights & Consent */}
              <section id="rights-consent" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <UserCheck className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">6.</span> Your Rights &amp;
                  Consent
                </h2>

                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">
                  6.1 Access & Rectification
                </h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  You may access, rectify, and update your personal data
                  directly through the functionalities provided on the Platform
                  (for example, through your profile and settings pages).
                </p>

                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">
                  6.2 Consent
                </h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  By visiting our Platform or by providing your information, you
                  consent to the collection, use, storage, disclosure, and
                  otherwise processing of your information on the Platform in
                  accordance with this Privacy Policy. If you disclose to us any
                  personal data relating to other people, you represent that you
                  have the authority to do so and to permit us to use the
                  information in accordance with this Privacy Policy.
                </p>

                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">
                  6.3 Withdrawal of Consent
                </h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  You have the option to withdraw your consent that you have
                  already provided by writing to the Grievance Officer at the
                  contact information provided below. Please mention{" "}
                  <strong>
                    &quot;Withdrawal of consent for processing personal
                    data&quot;
                  </strong>{" "}
                  in your communication&apos;s subject line.
                </p>
                <div className="mt-4 p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                  <p className="text-slate-900/70 dark:text-white/70 text-sm">
                    <strong>Please note:</strong> Withdrawal of consent will not
                    be retrospective and will be in accordance with the Terms of
                    Use, this Privacy Policy, and applicable laws. In the event
                    you withdraw consent given to us under this Privacy Policy,
                    we reserve the right to restrict or deny the provision of
                    our services for which we consider such information to be
                    necessary.
                  </p>
                </div>
              </section>

              {/* 7. Cookies & Tracking */}
              <section id="cookies" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Eye className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">7.</span> Cookies &amp;
                  Tracking Technologies
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  We use cookies and similar tracking technologies to enhance
                  your experience on the Platform. These include:
                </p>
                <ul className="space-y-3 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>
                    <strong>Essential Cookies:</strong> Required for
                    authentication, security, and core functionality of the
                    Platform.
                  </li>
                  <li>
                    <strong>Preference Cookies:</strong> Remember your settings,
                    preferences, and configuration choices.
                  </li>
                  <li>
                    <strong>Analytics Cookies:</strong> Help us understand how
                    you use the Platform and identify areas for improvement.
                  </li>
                  <li>
                    <strong>Session Cookies:</strong> Maintain your login state
                    and session information during your visit.
                  </li>
                </ul>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  You can control cookies through your browser settings. Please
                  note that disabling certain cookies may limit the
                  functionality and features of the Platform.
                </p>
              </section>

              {/* 8. Children's Privacy */}
              <section id="children" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">8.</span> Children&apos;s
                  Privacy
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  The Platform and Services are not intended for use by
                  individuals under the age of 18. We do not knowingly collect
                  personal information from children.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  If we become aware that we have inadvertently collected
                  personal information from a child under 18 without verified
                  parental consent, we will take reasonable steps to delete that
                  information as quickly as possible. If you believe we might
                  have any information from or about a child under 18, please
                  contact us immediately at the email address listed in this
                  policy.
                </p>
              </section>

              {/* 9. Changes to This Policy */}
              <section id="changes" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">9.</span> Changes to This
                  Privacy Policy
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  Please check our Privacy Policy periodically for changes. We
                  may update this Privacy Policy to reflect changes to our
                  information practices. We may alert you to significant changes
                  by sending a notice to the primary email address specified in
                  your account, by placing a prominent notice on our Platform,
                  or by updating the date at the top of this policy.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  Your continued use of the Platform after any modifications to
                  this Privacy Policy will constitute your acknowledgment of the
                  modifications and your consent to abide and be bound by the
                  modified Privacy Policy.
                </p>
              </section>

              {/* 10. Grievance Officer */}
              <section id="grievance-officer" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Scale className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">10.</span> Grievance Officer
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mb-4">
                  In accordance with the{" "}
                  <strong>Information Technology Act 2000</strong> and rules
                  made thereunder, the name and contact details of the Grievance
                  Officer are provided below:
                </p>
                <div className="p-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Grievance Officer Details
                  </h3>
                  <div className="space-y-4 text-slate-900/80 dark:text-white/80">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">
                          Name
                        </p>
                        <p className="font-medium">Rakshit Tiwari</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">
                          Designation
                        </p>
                        <p className="font-medium">
                          Grievance Officer / Proprietor
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">
                          Company Address
                        </p>
                        <p>Rajapur Teonthar, Rewa, Madhya Pradesh 486220</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">
                          Email
                        </p>
                        <a
                          href="mailto:decodedoffice@gmail.com"
                          className="text-blue-400 hover:underline"
                        >
                          decodedoffice@gmail.com
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">
                          Availability
                        </p>
                        <p>Monday – Friday (9:00 AM – 6:00 PM IST)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 11. Contact Us */}
              <section id="contact" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">11.</span> Contact Us
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mb-6">
                  If you have any questions, concerns, or requests regarding
                  this Privacy Policy or how your personal data is handled,
                  please contact us using the information provided below:
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-900/80 dark:text-white/80">
                    <Mail className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">
                        Email
                      </p>
                      <a
                        href="mailto:decodedoffice@gmail.com"
                        className="text-blue-400 hover:underline"
                      >
                        decodedoffice@gmail.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-slate-900/80 dark:text-white/80">
                    <Globe className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">
                        Website
                      </p>
                      <a
                        href="https://beamlab.app"
                        className="text-blue-400 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        https://beamlab.app
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-slate-900/80 dark:text-white/80">
                    <MapPin className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">
                        Registered Office
                      </p>
                      <p>
                        Rajapur Teonthar, Rewa, Madhya Pradesh 486220, India
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Acceptance Footer */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-8">
                <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-blue-200 font-semibold mb-2">
                        Acknowledgment
                      </p>
                      <p className="text-blue-200/80 text-sm">
                        By visiting our Platform, providing your information, or
                        availing of any product/service offered on the Platform,
                        you expressly agree to be bound by the terms and
                        conditions of this Privacy Policy, the Terms of Use, and
                        the applicable service/product terms and conditions, and
                        agree to be governed by the laws of India, including but
                        not limited to the laws applicable to data protection
                        and privacy.
                      </p>
                      <p className="text-blue-200/60 text-xs mt-3">
                        Version 2.0 | Effective Date: February 24, 2026 |
                        Governed by Laws of India
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-white/10 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-900/50 dark:text-white/50 text-sm">
              © {new Date().getFullYear()} BeamLab. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link
                to="/privacy-policy"
                className="text-slate-900/50 dark:text-white/50 hover:text-slate-900 dark:hover:text-white text-sm transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms-and-conditions"
                className="text-slate-900/50 dark:text-white/50 hover:text-slate-900 dark:hover:text-white text-sm transition-colors"
              >
                Terms and Conditions
              </Link>
              <a
                href="mailto:decodedoffice@gmail.com"
                className="text-slate-900/50 dark:text-white/50 hover:text-slate-900 dark:hover:text-white text-sm transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-slate-900/30 dark:text-white/30 text-xs">
              Rakshit Tiwari trading as Beamlab | Rajapur Teonthar,
              Rewa, Madhya Pradesh 486220
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default memo(PrivacyPolicyPageNew);
