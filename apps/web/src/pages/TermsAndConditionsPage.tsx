/**
 * TermsAndConditionsPage.tsx - Comprehensive Terms and Conditions
 * Legal document compliant with Indian IT Act 2000, Consumer Protection Act 2019,
 * and IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021
 *
 * Jurisdiction: Civil Court, Rewa, Madhya Pradesh
 * Last updated: February 24, 2026
 */

import { Link } from 'react-router-dom';
import {
  Mail,
  MapPin,
  Scale,
  ChevronRight,
  FileText,
  Shield,
  Menu,
  X,
  AlertTriangle,
  Phone,
  Globe,
  Clock,
  Gavel,
} from 'lucide-react';
import { useState, useEffect, memo } from 'react';
import { SEO } from '../components/SEO';

// ============================================
// TYPES & CONSTANTS
// ============================================

interface Section {
  id: string;
  number: string;
  title: string;
}

const sections: Section[] = [
  { id: 'preamble', number: '', title: 'Preamble' },
  { id: 'electronic-record', number: '1', title: 'Electronic Record' },
  { id: 'definitions', number: '2', title: 'Definitions' },
  { id: 'acceptance', number: '3', title: 'Acceptance of Terms' },
  { id: 'eligibility', number: '4', title: 'Eligibility' },
  { id: 'registration', number: '5', title: 'User Registration & Account' },
  { id: 'service-description', number: '6', title: 'Service Description' },
  { id: 'engineering-disclaimer', number: '7', title: 'Engineering Disclaimer' },
  { id: 'no-warranty', number: '8', title: 'No Warranties' },
  { id: 'user-obligations', number: '9', title: 'User Obligations' },
  { id: 'prohibited-conduct', number: '10', title: 'Prohibited Conduct' },
  { id: 'intellectual-property', number: '11', title: 'Intellectual Property' },
  { id: 'payment-terms', number: '12', title: 'Payment & Subscriptions' },
  { id: 'third-party-links', number: '13', title: 'Third-Party Links' },
  { id: 'limitation-liability', number: '14', title: 'Limitation of Liability' },
  { id: 'indemnification', number: '15', title: 'Indemnification' },
  { id: 'force-majeure', number: '16', title: 'Force Majeure' },
  { id: 'termination', number: '17', title: 'Termination' },
  { id: 'modifications', number: '18', title: 'Modifications to Terms' },
  { id: 'governing-law', number: '19', title: 'Governing Law' },
  { id: 'jurisdiction', number: '20', title: 'Jurisdiction' },
  { id: 'dispute-resolution', number: '21', title: 'Dispute Resolution' },
  { id: 'severability', number: '22', title: 'Severability' },
  { id: 'entire-agreement', number: '23', title: 'Entire Agreement' },
  { id: 'grievance-officer', number: '24', title: 'Grievance Officer' },
  { id: 'contact', number: '25', title: 'Contact Us' },
];

// ============================================
// COMPONENT
// ============================================

function TermsAndConditionsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('preamble');

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
      setMobileMenuOpen(false);
    }
  };

  useEffect(() => { document.title = 'Terms & Conditions | BeamLab'; }, []);

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
      { rootMargin: '-20% 0px -60% 0px' }
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white dark:from-slate-950 via-slate-100 dark:via-slate-900 to-white dark:to-slate-950">
      <SEO
        title="Terms & Conditions"
        description="BeamLab Terms of Service. Governed by the Indian IT Act 2000 and Consumer Protection Act 2019. Jurisdiction: Civil Court, Rewa, Madhya Pradesh."
        path="/terms-and-conditions"
      />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Scale className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">BeamLab</span>
            </Link>

            {/* Mobile menu button */}
            <button type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-900/70 dark:text-white/70 hover:text-slate-900 dark:hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <nav className="hidden lg:flex items-center gap-6">
              <Link to="/privacy-policy" className="text-slate-900/70 dark:text-white/70 hover:text-slate-900 dark:hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link to="/" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                Back to Home
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar - Table of Contents */}
          <aside
            className={`
              ${mobileMenuOpen ? 'fixed inset-0 z-40 bg-slate-50 dark:bg-slate-900 p-6 overflow-y-auto' : 'hidden'}
              lg:block lg:relative lg:w-72 lg:flex-shrink-0
            `}
          >
            <div className="lg:sticky lg:top-24">
              {mobileMenuOpen && (
                <button type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="lg:hidden mb-4 p-2 text-slate-900/70 dark:text-white/70 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
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
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'text-slate-900/70 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <ChevronRight
                      className={`w-4 h-4 transition-opacity ${
                        activeSection === section.id
                          ? 'text-blue-400 opacity-100'
                          : 'text-blue-400 opacity-0 group-hover:opacity-100'
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
              <div className="mt-8 pt-6 border-t border-white/10">
                <h4 className="text-sm font-semibold text-slate-900/50 dark:text-white/50 uppercase tracking-wider mb-3">
                  Related Documents
                </h4>
                <div className="space-y-2">
                  <Link
                    to="/privacy-policy"
                    className="flex items-center gap-2 text-sm text-slate-900/60 dark:text-white/60 hover:text-blue-400 transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    Privacy Policy
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
                <FileText className="w-8 h-8 text-blue-400" />
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Terms and Conditions</h1>
              </div>
              <p className="text-slate-900/60 dark:text-white/60">
                Last Updated: February 24, 2026 | Effective Date: February 24, 2026
              </p>
              <p className="text-slate-900/50 dark:text-white/50 text-sm mt-1">
                Domain: beamlab.app
              </p>

              {/* Important Notice */}
              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-200 font-medium">Important Notice</p>
                    <p className="text-amber-200/70 text-sm mt-1">
                      PLEASE READ THESE TERMS AND CONDITIONS CAREFULLY BEFORE USING THIS PLATFORM.
                      ACCESSING, BROWSING OR OTHERWISE USING THE PLATFORM INDICATES YOUR AGREEMENT
                      TO ALL THE TERMS AND CONDITIONS UNDER THESE TERMS OF USE.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Sections */}
            <div className="prose prose-invert prose-lg max-w-none">
              {/* Preamble */}
              <section id="preamble" className="mb-12 scroll-mt-24">
                <div className="p-5 bg-white/5 border border-white/10 rounded-xl">
                  <p className="text-slate-900/80 dark:text-white/80 leading-relaxed text-sm">
                    This document is an electronic record in terms of the <strong>Information Technology Act, 2000</strong> and
                    rules thereunder as applicable and the amended provisions pertaining to electronic records in various
                    statutes as amended by the Information Technology Act, 2000. This electronic record is generated by a
                    computer system and does not require any physical or digital signatures.
                  </p>
                  <p className="text-slate-900/80 dark:text-white/80 leading-relaxed text-sm mt-4">
                    This document is published in accordance with the provisions of <strong>Rule 3(1) of the Information
                    Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</strong> that require
                    publishing the rules and regulations, privacy policy, and Terms of Use for access or usage of domain name{' '}
                    <strong>beamlab.app</strong> (&apos;Website&apos;), including the related mobile site and mobile
                    application (hereinafter referred to as &apos;<strong>Platform</strong>&apos;).
                  </p>
                </div>
              </section>

              {/* 1. Electronic Record */}
              <section id="electronic-record" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">1.</span> Electronic Record
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  This Agreement constitutes an electronic contract within the meaning of the{' '}
                  <strong>Information Technology Act, 2000</strong> (as amended from time to time) and the rules framed
                  thereunder. This electronic record is generated by a computer system and does not require any physical or
                  digital signatures.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  The Platform is owned by <strong>Rakshit Tiwari</strong>, trading as{' '}
                  <strong>Beamlab</strong>, an enterprise registered under the Ministry of Micro, Small and Medium
                  Enterprises (Udyam Registration), with its principal place of business at:
                </p>
                <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-slate-900/80 dark:text-white/80">
                      <p className="font-semibold">Registered Address</p>
                      <p>Rajapur, Teonthar</p>
                      <p>Rewa, Madhya Pradesh — 486220</p>
                      <p>India</p>
                    </div>
                  </div>
                </div>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  (Hereinafter referred to as &apos;<strong>Platform Owner</strong>&apos;, &apos;<strong>we</strong>&apos;,
                  &apos;<strong>us</strong>&apos;, &apos;<strong>our</strong>&apos;.)
                </p>
              </section>

              {/* 2. Definitions */}
              <section id="definitions" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">2.</span> Definitions
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mb-4">
                  For the purpose of these Terms and Conditions, wherever the context so requires:
                </p>
                <ul className="space-y-3 text-slate-900/80 dark:text-white/80">
                  <li>
                    <strong>&quot;Platform&quot;</strong> means the website at{' '}
                    <a
                      href="https://beamlab.app"
                      className="text-blue-400 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      beamlab.app
                    </a>
                    , including the related mobile site and mobile application.
                  </li>
                  <li>
                    <strong>&quot;User&quot;, &quot;You&quot;, &quot;Your&quot;</strong> means any natural or legal person who
                    has agreed to become a user/buyer on the Platform by accessing, browsing, or using the Platform.
                  </li>
                  <li>
                    <strong>&quot;Services&quot;</strong> collectively refers to the website, goods (as applicable), and services
                    (as applicable) offered through the Platform, including structural analysis tools, engineering design modules,
                    AI-assisted computation, and all related functionality.
                  </li>
                  <li>
                    <strong>&quot;Content&quot;</strong> means all data, models, analysis results, designs, and materials
                    uploaded, created, or generated through the Platform.
                  </li>
                  <li>
                    <strong>&quot;Subscription&quot;</strong> means the paid access plan (Pro or Enterprise) that grants
                    additional features and capabilities.
                  </li>
                  <li>
                    <strong>&quot;Professional Engineer&quot;</strong> means a person licensed or registered to practice
                    engineering under applicable laws of the relevant jurisdiction.
                  </li>
                  <li>
                    <strong>&quot;Force Majeure Event&quot;</strong> means any event beyond the reasonable control of a party,
                    including but not limited to acts of God, fire, flood, earthquake, epidemic, pandemic, governmental actions,
                    war, terrorism, strikes, or failure of third-party systems.
                  </li>
                </ul>
              </section>

              {/* 3. Acceptance of Terms */}
              <section id="acceptance" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">3.</span> Acceptance of Terms
                </h2>
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-6">
                  <p className="text-amber-200 text-sm font-bold uppercase">
                    ACCESSING, BROWSING OR OTHERWISE USING THE PLATFORM INDICATES YOUR AGREEMENT TO ALL THE TERMS AND
                    CONDITIONS UNDER THESE TERMS OF USE, SO PLEASE READ THE TERMS OF USE CAREFULLY BEFORE PROCEEDING.
                  </p>
                </div>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  Your use of the Platform and Services and tools are governed by the following Terms and Conditions
                  (&quot;Terms of Use&quot;) as applicable to the Platform including the applicable policies which are
                  incorporated herein by way of reference. If You transact on the Platform, You shall be subject to the
                  policies that are applicable to the Platform for such transaction.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  By mere use of the Platform, You shall be contracting with the Platform Owner and these Terms and Conditions
                  including the policies constitute Your binding obligations with the Platform Owner.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  Any terms and conditions proposed by You which are in addition to or which conflict with these Terms of Use
                  are expressly rejected by the Platform Owner and shall be of no force or effect.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  These Terms of Use can be modified at any time without assigning any reason. It is your responsibility to
                  periodically review these Terms of Use to stay informed of updates.
                </p>
              </section>

              {/* 4. Eligibility */}
              <section id="eligibility" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">4.</span> Eligibility
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">By accessing or using the Platform, you confirm that:</p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>You are at least 18 years of age or the age of majority in your jurisdiction.</li>
                  <li>You have the legal capacity to enter into a binding agreement under the Indian Contract Act, 1872.</li>
                  <li>You are not a person barred from receiving Services under the laws of India or other applicable jurisdiction.</li>
                  <li>
                    If using on behalf of an organization, you have the authority to bind that organization to these Terms.
                  </li>
                </ul>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  If you do not meet these requirements or do not agree to these Terms, you must not access or use the Platform.
                </p>
              </section>

              {/* 5. Registration & Account */}
              <section id="registration" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">5.</span> User Registration &amp; Account
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  To access and use the Services, you agree to provide true, accurate and complete information to us during and
                  after registration, and you shall be responsible for all acts done through the use of your registered account
                  on the Platform.
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>You must provide accurate, current, and complete registration information.</li>
                  <li>You must maintain and promptly update your account information to keep it accurate and complete.</li>
                  <li>You must maintain the confidentiality of your account credentials and password.</li>
                  <li>You are responsible for all activities that occur under your account.</li>
                  <li>You must notify us immediately of any unauthorized use of your account.</li>
                  <li>You must not share, transfer, sell, or assign your account to any third party.</li>
                </ul>
              </section>

              {/* 6. Service Description */}
              <section id="service-description" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">6.</span> Service Description
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  BeamLab is a web-based structural analysis and engineering design software platform that provides:
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>Finite Element Analysis (FEA) capabilities</li>
                  <li>Static and dynamic structural analysis</li>
                  <li>Modal analysis and eigenvalue solutions</li>
                  <li>Seismic and wind load analysis</li>
                  <li>P-Delta, buckling, and nonlinear analysis</li>
                  <li>Steel, concrete, and foundation member design</li>
                  <li>Structural design calculations and code checks (AISC, Eurocode, IS codes)</li>
                  <li>AI-assisted model generation and optimization</li>
                  <li>Report generation and result visualization</li>
                  <li>3D modeling and rendering capabilities</li>
                  <li>Collaboration and cloud storage tools</li>
                </ul>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  Your use of our Services and the Platform is solely and entirely at your own risk and discretion, for which
                  we shall not be liable to you in any manner. You are required to independently assess and ensure that the
                  Services meet your requirements.
                </p>
              </section>

              {/* 7. Engineering Disclaimer */}
              <section id="engineering-disclaimer" className="mb-12 scroll-mt-24">
                <div className="p-6 bg-red-500/10 border-2 border-red-500/30 rounded-xl">
                  <h2 className="text-2xl font-bold text-red-200 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                    <span className="text-red-400">7.</span> Critical Engineering Disclaimer
                  </h2>
                  <p className="text-red-200 leading-relaxed font-semibold mb-4">
                    BEAMLAB IS A COMPUTATIONAL AID ONLY. IT IS NOT A SUBSTITUTE FOR PROFESSIONAL ENGINEERING JUDGMENT.
                  </p>
                  <p className="text-red-200/80 leading-relaxed mb-4">
                    All structural analysis results generated by this Platform must be:
                  </p>
                  <ul className="space-y-2 text-red-200/80">
                    <li>
                      <strong>Independently verified and approved by a licensed Professional Engineer</strong> before use in
                      design or construction.
                    </li>
                    <li>Reviewed for accuracy, completeness, and compliance with applicable building codes and regulations.</li>
                    <li>Validated against independent calculations, peer review, and/or alternative software.</li>
                    <li>Assessed within the context of actual site conditions, construction tolerances, and material properties.</li>
                  </ul>
                  <p className="text-red-200/80 leading-relaxed mt-4">
                    Neither we nor any third parties provide any warranty or guarantee as to the accuracy, timeliness,
                    performance, completeness or suitability of the information and materials offered on this website or
                    through the Services, for any specific purpose. You acknowledge that such information and materials may
                    contain inaccuracies or errors and we expressly exclude liability for any such inaccuracies or errors to
                    the fullest extent permitted by law.
                  </p>
                </div>
              </section>

              {/* 8. No Warranties */}
              <section id="no-warranty" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">8.</span> No Warranties
                </h2>
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-6">
                  <p className="text-red-200 font-bold">IMPORTANT — PLEASE READ CAREFULLY</p>
                </div>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  <strong>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:</strong>
                </p>
                <ul className="space-y-3 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>
                    The Platform and Services are provided on an <strong>&quot;AS IS&quot;</strong> and{' '}
                    <strong>&quot;AS AVAILABLE&quot;</strong> basis without warranties of any kind, either express or implied.
                  </li>
                  <li>
                    Neither we nor any third parties provide any warranty or guarantee as to the accuracy, timeliness,
                    performance, completeness or suitability of the information and materials offered on this Platform or
                    through the Services, for any specific purpose.
                  </li>
                  <li>
                    You acknowledge that such information and materials may contain inaccuracies or errors and we expressly
                    exclude liability for any such inaccuracies or errors to the fullest extent permitted by law.
                  </li>
                  <li>
                    We do not guarantee the accuracy, completeness, or reliability of any analysis results generated through the
                    Platform.
                  </li>
                  <li>
                    We are <strong>NOT LIABLE</strong> for any structural failures, property damage, personal injury, or death
                    arising from the use of this software or reliance on its outputs.
                  </li>
                </ul>
              </section>

              {/* 9. User Obligations */}
              <section id="user-obligations" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">9.</span> User Obligations
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  The use of Platform and/or availing of our Services is subject to the following obligations:
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>
                    You agree to provide true, accurate and complete information to us during and after registration, and shall
                    be responsible for all acts done through the use of your registered account.
                  </li>
                  <li>
                    You acknowledge that unauthorized use of the Platform and/or the Services may lead to action against you as
                    per these Terms of Use and/or applicable laws.
                  </li>
                  <li>You agree to pay us the charges associated with availing the Services.</li>
                  <li>
                    You agree not to use the Platform and/or Services for any purpose that is unlawful, illegal or forbidden by
                    these Terms, or Indian or local laws that might apply to you.
                  </li>
                  <li>
                    You are required to independently assess and ensure that the Services meet your requirements before relying
                    on any output.
                  </li>
                  <li>
                    You must comply with all applicable building codes, engineering regulations, and professional standards
                    relevant to your jurisdiction.
                  </li>
                </ul>
              </section>

              {/* 10. Prohibited Conduct */}
              <section id="prohibited-conduct" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">10.</span> Prohibited Conduct
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  You agree NOT to:
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>Use the Platform in any way that violates applicable laws or regulations.</li>
                  <li>Attempt to gain unauthorized access to any part of the Platform or its systems.</li>
                  <li>Interfere with or disrupt the Platform, servers, or networks connected to the Platform.</li>
                  <li>Use automated systems, bots, or scripts to access the Platform without prior written permission.</li>
                  <li>Reverse engineer, decompile, or disassemble any software or technology underlying the Platform.</li>
                  <li>Remove or modify any proprietary notices, labels, or markings on the Platform.</li>
                  <li>Use the Platform to transmit harmful code, malware, or viruses.</li>
                  <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity.</li>
                  <li>Use the Platform to develop a competing product or service.</li>
                  <li>Share your account credentials with others or allow others to access your account.</li>
                </ul>
              </section>

              {/* 11. Intellectual Property */}
              <section id="intellectual-property" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">11.</span> Intellectual Property
                </h2>
                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">11.1 Platform Content</h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  The contents of the Platform and the Services are proprietary to us and are licensed to us. You will not have
                  any authority to claim any intellectual property rights, title, or interest in its contents. The contents
                  includes and is not limited to the design, layout, look, graphics, software, algorithms, user interface,
                  documentation, logos, icons, trademarks, and all other material on the Platform.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  All such content is protected under <strong>Indian Copyright Act, 1957</strong>,{' '}
                  <strong>Trade Marks Act, 1999</strong>, and other applicable intellectual property laws.
                </p>

                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">11.2 Your Content</h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  You retain ownership of all Content you upload or create using the Platform. By using the Services, you grant
                  us a limited, non-exclusive, non-transferable license to process, store, and display your Content solely for
                  the purpose of providing the Services.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  We will not share your Content with third parties except as described in our{' '}
                  <Link to="/privacy-policy" className="text-blue-400 hover:underline">
                    Privacy Policy
                  </Link>.
                </p>
              </section>

              {/* 12. Payment & Subscriptions */}
              <section id="payment-terms" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">12.</span> Payment &amp; Subscriptions
                </h2>
                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">12.1 Subscription Plans</h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  We offer Free, Pro, and Enterprise subscription plans. Features and pricing are as displayed on our Platform
                  at the time of purchase. You agree to pay us the charges associated with availing the Services.
                </p>

                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">12.2 Billing</h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  Subscriptions are billed in advance on a monthly or yearly basis. All fees are in Indian Rupees (INR) unless
                  otherwise specified. Payments are processed securely through authorized payment gateways.
                </p>

                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">12.3 Refund Policy</h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  Refund requests may be considered within 7 days of purchase for annual subscriptions, subject to our
                  discretion. Monthly subscriptions are generally non-refundable. This does not affect your statutory rights
                  under the <strong>Consumer Protection Act, 2019</strong>.
                </p>

                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">12.4 Binding Contract</h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  You understand that upon initiating a transaction for availing the Services, you are entering into a legally
                  binding and enforceable contract with the Platform Owner for the Services.
                </p>
              </section>

              {/* 13. Third-Party Links */}
              <section id="third-party-links" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">13.</span> Third-Party Links
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  You agree and acknowledge that the Platform and the Services may contain links to other third-party websites.
                  On accessing these links, you will be governed by the terms of use, privacy policy, and such other policies
                  of such third-party websites. These links are provided for your convenience to provide further information.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  We have no responsibility for the content, accuracy, or practices of any third-party websites. The inclusion
                  of any link does not imply endorsement by us. You access any third-party websites entirely at your own risk.
                </p>
              </section>

              {/* 14. Limitation of Liability */}
              <section id="limitation-liability" className="mb-12 scroll-mt-24">
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="text-blue-400">14.</span> Limitation of Liability
                  </h2>
                  <p className="text-slate-900/80 dark:text-white/80 leading-relaxed font-semibold uppercase mb-4">
                    TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
                  </p>
                  <ul className="space-y-3 text-slate-900/80 dark:text-white/80">
                    <li>
                      The Platform Owner and its officers, directors, employees, affiliates, and agents shall not be liable
                      for any indirect, incidental, special, consequential, or punitive damages.
                    </li>
                    <li>We shall not be liable for loss of profits, revenue, data, or use.</li>
                    <li>
                      We shall not be liable for structural failures or safety issues resulting from the use of analysis
                      results generated through the Platform.
                    </li>
                    <li>We shall not be liable for damages resulting from errors, inaccuracies, or omissions in the Services.</li>
                    <li>We shall not be liable for interruption of service or loss of data.</li>
                    <li>
                      We shall not be liable for any damages arising from unauthorized access to your account or data.
                    </li>
                    <li>
                      In no event shall our total aggregate liability exceed the amount paid by you for the Services in the
                      12 months preceding the event giving rise to liability, or ₹5,000 (Indian Rupees Five Thousand),
                      whichever is greater.
                    </li>
                  </ul>
                  <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                    Nothing in these Terms excludes or limits liability that cannot be excluded or limited under applicable
                    Indian law, including liability for fraud or fraudulent misrepresentation.
                  </p>
                </div>
              </section>

              {/* 15. Indemnification */}
              <section id="indemnification" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">15.</span> Indemnification
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  You shall indemnify and hold harmless the Platform Owner, its affiliates, group companies (as applicable) and
                  their respective officers, directors, agents, and employees, from any claim or demand, or actions including
                  reasonable attorney&apos;s fees, made by any third party or penalty imposed due to or arising out of:
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>Your breach of these Terms of Use, Privacy Policy, and other Policies.</li>
                  <li>Your violation of any law, rules, or regulations.</li>
                  <li>
                    Your violation of the rights (including infringement of intellectual property rights) of a third party.
                  </li>
                  <li>Any engineering projects or structural designs where you used this Platform.</li>
                  <li>Any claims by third parties related to structures you designed or analyzed using the Services.</li>
                  <li>Your use or misuse of the Platform and/or the Services.</li>
                </ul>
              </section>

              {/* 16. Force Majeure */}
              <section id="force-majeure" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">16.</span> Force Majeure
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  Notwithstanding anything contained in these Terms of Use, the parties shall not be liable for any failure to
                  perform an obligation under these Terms if performance is prevented or delayed by a Force Majeure Event.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  Force Majeure Events include but are not limited to: acts of God, fire, flood, earthquake, epidemic, pandemic,
                  governmental actions, war, terrorism, riots, embargoes, acts of civil or military authority, strikes, labour
                  disputes, shortages of raw materials or supplies, failure of third-party telecommunications or power supply,
                  or any other event beyond the reasonable control of the affected party.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  The affected party shall use reasonable efforts to mitigate the effect of the Force Majeure Event and shall
                  resume performance as soon as reasonably practicable after the event ceases.
                </p>
              </section>

              {/* 17. Termination */}
              <section id="termination" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">17.</span> Termination
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  We may terminate or suspend your access to the Platform immediately, without prior notice or liability, for
                  any reason whatsoever, including but not limited to breach of these Terms.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">Upon termination:</p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-2">
                  <li>Your right to use the Platform and Services shall immediately cease.</li>
                  <li>You may request export of your data within 30 days of termination.</li>
                  <li>We may delete your Content after a period of 30 days following termination.</li>
                  <li>
                    All provisions of these Terms which by their nature should survive termination shall survive, including
                    intellectual property provisions, warranty disclaimers, indemnification, limitation of liability, and
                    dispute resolution clauses.
                  </li>
                </ul>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  You may terminate your account at any time by contacting us at the email address provided below.
                </p>
              </section>

              {/* 18. Modifications to Terms */}
              <section id="modifications" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">18.</span> Modifications to Terms
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  These Terms of Use can be modified at any time without assigning any reason. It is your responsibility to
                  periodically review these Terms of Use to stay informed of updates.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">When we make material changes, we will:</p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>Update the &quot;Last Updated&quot; date at the top of this page.</li>
                  <li>Send an email notification to your registered email address (where applicable).</li>
                  <li>Display an in-app notification on the Platform.</li>
                </ul>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  Continued use of the Platform after modifications become effective constitutes acceptance of the revised Terms.
                  If you do not agree to the modified Terms, you must stop using the Platform.
                </p>
              </section>

              {/* 19. Governing Law */}
              <section id="governing-law" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Gavel className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">19.</span> Governing Law
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  These Terms and any dispute or claim relating to it, or its enforceability, shall be governed by and construed
                  in accordance with the <strong>laws of India</strong>, including but not limited to:
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li>
                    <strong>Information Technology Act, 2000</strong> and its amendments.
                  </li>
                  <li>
                    <strong>Indian Contract Act, 1872.</strong>
                  </li>
                  <li>
                    <strong>Consumer Protection Act, 2019.</strong>
                  </li>
                  <li>
                    <strong>Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.</strong>
                  </li>
                  <li>
                    <strong>
                      Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or
                      Information) Rules, 2011.
                    </strong>
                  </li>
                </ul>
              </section>

              {/* 20. Jurisdiction */}
              <section id="jurisdiction" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Scale className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">20.</span> Jurisdiction
                </h2>
                <div className="p-5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <p className="text-blue-200 leading-relaxed font-semibold">
                    All disputes arising out of or in connection with these Terms shall be subject to the{' '}
                    <strong>exclusive jurisdiction of the Civil Court at Rewa, Madhya Pradesh, India</strong>.
                  </p>
                </div>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  The parties irrevocably submit to the exclusive jurisdiction of the courts at Rewa, Madhya Pradesh, India
                  for the purpose of any suit, action, or other judicial proceeding arising out of or relating to these Terms,
                  the Platform, or the Services.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  Notwithstanding the foregoing, the Platform Owner reserves the right to seek injunctive or other equitable
                  relief in any court of competent jurisdiction to protect its intellectual property rights or confidential
                  information.
                </p>
              </section>

              {/* 21. Dispute Resolution */}
              <section id="dispute-resolution" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">21.</span> Dispute Resolution
                </h2>
                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">21.1 Amicable Resolution</h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  Parties shall first attempt to resolve any dispute through good-faith negotiation for a period of 30 days
                  from the date of written notice of the dispute.
                </p>

                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">21.2 Arbitration</h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  If negotiation fails, disputes shall be referred to and finally resolved by arbitration in accordance with the{' '}
                  <strong>Arbitration and Conciliation Act, 1996</strong> of India. The seat and venue of arbitration shall be{' '}
                  <strong>Rewa, Madhya Pradesh, India</strong>. The language of arbitration shall be English or Hindi, as
                  mutually agreed. The arbitration shall be conducted by a sole arbitrator mutually appointed by the parties.
                </p>

                <h3 className="text-xl font-semibold text-slate-900/90 dark:text-white/90 mt-6 mb-3">21.3 Court Jurisdiction</h3>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  Subject to the arbitration clause, the{' '}
                  <strong>Civil Court at Rewa, Madhya Pradesh, India</strong> shall have exclusive jurisdiction over any
                  disputes arising from these Terms.
                </p>
              </section>

              {/* 22. Severability */}
              <section id="severability" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">22.</span> Severability
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent
                  jurisdiction, such provision shall be severed from the Terms and the remaining provisions shall continue in
                  full force and effect.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  The invalid or unenforceable provision shall be deemed modified to the minimum extent necessary to make it
                  valid, legal, and enforceable while preserving the original intent of the parties.
                </p>
              </section>

              {/* 23. Entire Agreement */}
              <section id="entire-agreement" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">23.</span> Entire Agreement
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  These Terms, together with the{' '}
                  <Link to="/privacy-policy" className="text-blue-400 hover:underline">
                    Privacy Policy
                  </Link>{' '}
                  and any other policies referenced herein, constitute the entire agreement between you and the Platform Owner
                  with respect to your use of the Platform and Services, and supersede all prior or contemporaneous
                  communications, proposals, and agreements, whether oral or written, between the parties with respect to the
                  subject matter hereof.
                </p>
              </section>

              {/* 24. Grievance Officer */}
              <section id="grievance-officer" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">24.</span> Grievance Officer
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mb-4">
                  In accordance with the <strong>Information Technology Act, 2000</strong> and rules made thereunder, the name
                  and contact details of the Grievance Officer are provided below:
                </p>
                <div className="p-5 bg-white/5 border border-white/10 rounded-xl">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Grievance Officer</h3>
                  <div className="space-y-3 text-slate-900/80 dark:text-white/80">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">Name</p>
                        <p className="font-medium">Rakshit Tiwari</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">Email</p>
                        <a
                          href="mailto:decodedoffice@gmail.com"
                          className="text-blue-400 hover:underline"
                        >
                          decodedoffice@gmail.com
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">Address</p>
                        <p>Rajapur, Teonthar, Rewa, Madhya Pradesh — 486220, India</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">Response Time</p>
                        <p>Within 24 hours of receipt</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 25. Contact Us */}
              <section id="contact" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">25.</span> Contact Us
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mb-6">
                  All concerns or communications relating to these Terms must be communicated to us using the contact
                  information provided below:
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-900/80 dark:text-white/80">
                    <Mail className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">Email</p>
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
                      <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">Website</p>
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
                      <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">Registered Office</p>
                      <p>Rajapur, Teonthar, Rewa, Madhya Pradesh — 486220, India</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Acceptance Footer */}
              <div className="border-t border-white/10 pt-8">
                <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-blue-200 font-semibold mb-2">Acknowledgment</p>
                      <p className="text-blue-200/80 text-sm">
                        By creating an account or using BeamLab, you acknowledge that you have read, understood, and
                        agree to be bound by these Terms and Conditions. This document constitutes an electronic contract
                        within the meaning of the Information Technology Act, 2000 and does not require any physical or
                        digital signatures.
                      </p>
                      <p className="text-blue-200/60 text-xs mt-3">
                        Version 2.0 | Effective Date: February 24, 2026 | Jurisdiction: Civil Court, Rewa, Madhya Pradesh,
                        India
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
      <footer className="border-t border-white/10 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-900/50 dark:text-white/50 text-sm">© {new Date().getFullYear()} BeamLab. All rights reserved.</p>
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
              Jurisdiction: Civil Court, Rewa, Madhya Pradesh, India | Udyam Registered Enterprise
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default memo(TermsAndConditionsPage);
