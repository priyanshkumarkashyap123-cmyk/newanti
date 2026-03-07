/**
 * RefundCancellationPage.tsx - Refund and Cancellation Policy
 * Legal document for digital products/services refund and cancellation terms
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
  Mail,
  MapPin,
  Clock,
  Scale,
  FileText,
  AlertTriangle,
  Globe,
  RefreshCcw,
  XCircle,
  PackageX,
  Bug,
  Puzzle,
  CreditCard,
} from "lucide-react";
import { useState, useEffect, memo } from "react";

// ============================================
// TYPES & CONSTANTS
// ============================================

interface Section {
  id: string;
  number: string;
  title: string;
}

const sections: Section[] = [
  { id: "overview", number: "", title: "Overview" },
  { id: "cancellations", number: "1", title: "Cancellations" },
  { id: "non-refundable", number: "2", title: "Non-Refundable Digital Goods" },
  {
    id: "defective-delivery",
    number: "3",
    title: "Defective Digital Delivery",
  },
  { id: "third-party", number: "4", title: "Third-Party Compatibility" },
  { id: "refund-processing", number: "5", title: "Refund Processing" },
  { id: "how-to-request", number: "6", title: "How to Request" },
  { id: "contact", number: "7", title: "Contact Us" },
];

// ============================================
// COMPONENT
// ============================================

function RefundCancellationPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
      setMobileMenuOpen(false);
    }
  };

  useEffect(() => { document.title = 'Refund & Cancellation | BeamLab'; }, []);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-white dark:from-slate-950 via-slate-100 dark:via-slate-900 to-white dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <RefreshCcw className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">
                BeamLab
              </span>
            </Link>

            {/* Mobile menu button */}
            <button type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-900/70 dark:text-white/70 hover:text-slate-900 dark:hover:text-white"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            <nav className="hidden lg:flex items-center gap-6">
              <Link
                to="/terms-and-conditions"
                className="text-slate-900/70 dark:text-white/70 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Terms and Conditions
              </Link>
              <Link
                to="/privacy-policy"
                className="text-slate-900/70 dark:text-white/70 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
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
              ${mobileMenuOpen ? "fixed inset-0 z-40 bg-slate-50 dark:bg-slate-900 p-6 overflow-y-auto" : "hidden"}
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
                <RefreshCcw className="w-8 h-8 text-blue-400" />
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
                  Refund and Cancellation Policy
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
              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-200 font-medium">
                      Important Notice
                    </p>
                    <p className="text-amber-200/70 text-sm mt-1">
                      This refund and cancellation policy outlines how you can
                      cancel or seek a refund for a digital product or service
                      that you have purchased through the Platform. Please read
                      this policy carefully before making any purchase.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Sections */}
            <div className="prose prose-invert prose-lg max-w-none">
              {/* Overview */}
              <section id="overview" className="mb-12 scroll-mt-24">
                <div className="p-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                  <p className="text-slate-900/80 dark:text-white/80 leading-relaxed text-sm">
                    This refund and cancellation policy outlines how you can
                    cancel or seek a refund for a digital product or service
                    that you have purchased through the Platform operated by{" "}
                    <strong>Rakshit Tiwari</strong>, trading as{" "}
                    <strong>Beamlab</strong>. Under this policy, the
                    following terms apply to all transactions made on the
                    Platform.
                  </p>
                  <p className="text-slate-900/80 dark:text-white/80 leading-relaxed text-sm mt-3">
                    By purchasing any product or service on the Platform, you
                    acknowledge and agree to the terms set forth in this Refund
                    and Cancellation Policy. This policy should be read in
                    conjunction with our{" "}
                    <Link
                      to="/terms-and-conditions"
                      className="text-blue-400 hover:underline"
                    >
                      Terms and Conditions
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="/privacy-policy"
                      className="text-blue-400 hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>
              </section>

              {/* 1. Cancellations */}
              <section id="cancellations" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <XCircle className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">1.</span> Cancellations
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  Cancellations will only be considered if the request is made{" "}
                  <strong>within 2 days</strong> of placing the order.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  However, cancellation requests may <strong>not</strong> be
                  entertained if:
                </p>
                <ul className="space-y-3 text-slate-900/80 dark:text-white/80 mt-4">
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 font-bold mt-0.5">
                      &#x2715;
                    </span>
                    <span>
                      The order involves{" "}
                      <strong>custom structural analysis or consultancy</strong>{" "}
                      and the team has already initiated work on it.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 font-bold mt-0.5">
                      &#x2715;
                    </span>
                    <span>
                      <strong>Digital software access</strong> has already been
                      granted to the user.
                    </span>
                  </li>
                </ul>

                <div className="mt-6 p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <p className="text-slate-900/60 dark:text-white/60 text-sm font-semibold uppercase tracking-wider">
                      Cancellation Window
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-blue-400">2</div>
                    <div>
                      <p className="text-slate-900/80 dark:text-white/80 font-medium">
                        Days from order placement
                      </p>
                      <p className="text-slate-900/50 dark:text-white/50 text-sm">
                        Requests must be submitted within this period to be
                        considered.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Non-Refundable Digital Goods */}
              <section id="non-refundable" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <PackageX className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">2.</span> Non-Refundable
                  Digital Goods
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  <strong>Rakshit Tiwari</strong>, trading as{" "}
                  <strong>Beamlab</strong>, does not accept
                  cancellation requests for immediately accessible digital
                  items, such as:
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 font-bold mt-0.5">
                      &#x2715;
                    </span>
                    <span>
                      Downloadable resources (e.g., design templates, code
                      packages)
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 font-bold mt-0.5">
                      &#x2715;
                    </span>
                    <span>Generated analysis reports and exported data</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 font-bold mt-0.5">
                      &#x2715;
                    </span>
                    <span>
                      Instantly activated software subscriptions or feature
                      unlocks
                    </span>
                  </li>
                </ul>

                <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-emerald-200 font-medium">
                        Exception — Quality Issues
                      </p>
                      <p className="text-emerald-200/70 text-sm mt-1">
                        However, a refund or replacement can be made if the user
                        establishes that the digital product or data delivered
                        contains <strong>critical errors</strong> or{" "}
                        <strong>lacks the promised quality</strong>. In such
                        cases, please contact our customer service team with
                        supporting evidence of the defect.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Defective Digital Delivery */}
              <section id="defective-delivery" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Bug className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">3.</span> Defective Digital
                  Delivery
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  In case of receipt of any of the following issues, please
                  report to our customer service team immediately:
                </p>
                <ul className="space-y-2 text-slate-900/80 dark:text-white/80 mt-4">
                  <li className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-1" />
                    <span>Corrupted files or broken downloads</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-1" />
                    <span>
                      Inaccurate analysis outputs or calculation errors
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-1" />
                    <span>
                      Software access issues (e.g., license not activated,
                      features not unlocked)
                    </span>
                  </li>
                </ul>

                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  The request will be entertained once the Platform Owner has
                  checked and determined the technical issue at its own end.
                </p>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-red-400" />
                      <p className="text-slate-900/60 dark:text-white/60 text-xs font-semibold uppercase tracking-wider">
                        Technical Issues
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-3xl font-bold text-red-400">1</div>
                      <div>
                        <p className="text-slate-900/80 dark:text-white/80 font-medium text-sm">
                          Day from receipt
                        </p>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs">
                          Report corrupted files or access issues within this
                          window.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <p className="text-slate-900/60 dark:text-white/60 text-xs font-semibold uppercase tracking-wider">
                        Quality Concerns
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-3xl font-bold text-amber-400">2</div>
                      <div>
                        <p className="text-slate-900/80 dark:text-white/80 font-medium text-sm">
                          Days from receiving access
                        </p>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs">
                          Report if service is not as shown or doesn&apos;t
                          match expectations.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  In case you feel that the digital service received is not as
                  shown on the site or as per your expectations, you must bring
                  it to the notice of our customer service within{" "}
                  <strong>2 days</strong> of receiving access. The customer
                  service team, after looking into your complaint, will take an
                  appropriate decision.
                </p>
              </section>

              {/* 4. Third-Party Compatibility */}
              <section id="third-party" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Puzzle className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">4.</span> Third-Party
                  Compatibility
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  In case of complaints regarding digital products or exports
                  that are meant to be compatible with third-party engineering
                  software (or rely on external APIs), we{" "}
                  <strong>cannot guarantee</strong> the performance of those
                  external manufacturers&apos; tools.
                </p>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-4">
                  However, we will assist in verifying our data&apos;s integrity
                  and ensure that the output from our Platform conforms to the
                  documented specifications and standards.
                </p>

                <div className="mt-4 p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                  <p className="text-slate-900/70 dark:text-white/70 text-sm">
                    <strong>Examples include but are not limited to:</strong>{" "}
                    Exports to third-party CAD/BIM software, data files intended
                    for use in external FEA tools, API integrations with
                    third-party services, or analysis reports formatted for
                    external compliance checkers.
                  </p>
                </div>
              </section>

              {/* 5. Refund Processing */}
              <section id="refund-processing" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">5.</span> Refund Processing
                </h2>
                <div className="p-5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <p className="text-blue-200 leading-relaxed">
                    In case of any refunds approved by{" "}
                    <strong>Beamlab</strong>, it will take{" "}
                    <strong>15 days</strong> for the refund to be processed and
                    credited to you.
                  </p>
                </div>

                <div className="mt-6 p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <p className="text-slate-900/60 dark:text-white/60 text-sm font-semibold uppercase tracking-wider">
                      Refund Timeline
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-blue-400">15</div>
                    <div>
                      <p className="text-slate-900/80 dark:text-white/80 font-medium">
                        Days for processing
                      </p>
                      <p className="text-slate-900/50 dark:text-white/50 text-sm">
                        From the date the refund is approved by Beamlab
                        Ultimate.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mt-6">
                  Refunds will be credited to the original payment method used
                  during the transaction. If the original payment method is
                  unavailable, we will work with you to arrange an alternative
                  refund method.
                </p>
              </section>

              {/* 6. How to Request */}
              <section id="how-to-request" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-400" />
                  <span className="text-blue-400">6.</span> How to Request a
                  Refund or Cancellation
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed">
                  To submit a refund or cancellation request, please follow
                  these steps:
                </p>
                <ol className="space-y-4 text-slate-900/80 dark:text-white/80 mt-4">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 font-bold text-sm flex items-center justify-center">
                      1
                    </span>
                    <span>
                      Contact our customer service team via email at{" "}
                      <a
                        href="mailto:decodedoffice@gmail.com"
                        className="text-blue-400 hover:underline"
                      >
                        decodedoffice@gmail.com
                      </a>
                      .
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 font-bold text-sm flex items-center justify-center">
                      2
                    </span>
                    <span>
                      Include your <strong>order ID</strong>,{" "}
                      <strong>registered email address</strong>, and a clear
                      description of the reason for your request.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 font-bold text-sm flex items-center justify-center">
                      3
                    </span>
                    <span>
                      For defective delivery claims, attach{" "}
                      <strong>screenshots or evidence</strong> of the issue
                      (e.g., corrupted files, error messages, incorrect
                      outputs).
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 font-bold text-sm flex items-center justify-center">
                      4
                    </span>
                    <span>
                      Our team will review your request and respond within{" "}
                      <strong>2 business days</strong> with a resolution or
                      request for additional information.
                    </span>
                  </li>
                </ol>
              </section>

              {/* 7. Contact Us */}
              <section id="contact" className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-blue-400">7.</span> Contact Us
                </h2>
                <p className="text-slate-900/80 dark:text-white/80 leading-relaxed mb-6">
                  For any questions, concerns, or requests regarding refunds and
                  cancellations, please contact us:
                </p>
                <div className="p-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                  <div className="space-y-4 text-slate-900/80 dark:text-white/80">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">
                          Name
                        </p>
                        <p className="font-medium">
                          Rakshit Tiwari (Proprietor, Beamlab)
                        </p>
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
                      <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-slate-900/50 dark:text-white/50 text-xs uppercase tracking-wider">
                          Address
                        </p>
                        <p>
                          Rajapur Teonthar, Rewa, Madhya Pradesh 486220, India
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-blue-400 flex-shrink-0" />
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

              {/* Summary / Quick Reference */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-8 mb-8">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  Quick Reference
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/5">
                        <th className="text-left px-4 py-3 text-slate-900/60 dark:text-white/60 font-semibold uppercase tracking-wider text-xs">
                          Scenario
                        </th>
                        <th className="text-left px-4 py-3 text-slate-900/60 dark:text-white/60 font-semibold uppercase tracking-wider text-xs">
                          Timeline
                        </th>
                        <th className="text-left px-4 py-3 text-slate-900/60 dark:text-white/60 font-semibold uppercase tracking-wider text-xs">
                          Eligible?
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">
                          Order cancellation
                        </td>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">
                          Within 2 days
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-emerald-400 font-medium">
                            Yes*
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">
                          Custom work already started
                        </td>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">—</td>
                        <td className="px-4 py-3">
                          <span className="text-red-400 font-medium">No</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">
                          Digital access already granted
                        </td>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">—</td>
                        <td className="px-4 py-3">
                          <span className="text-red-400 font-medium">No</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">
                          Downloadable resources / reports
                        </td>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">—</td>
                        <td className="px-4 py-3">
                          <span className="text-red-400 font-medium">No*</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">
                          Defective/corrupted files
                        </td>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">
                          Within 1 day
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-emerald-400 font-medium">
                            Yes
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">
                          Service not as described
                        </td>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">
                          Within 2 days
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-emerald-400 font-medium">
                            Yes
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">
                          Third-party compatibility
                        </td>
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80">—</td>
                        <td className="px-4 py-3">
                          <span className="text-amber-400 font-medium">
                            Case-by-case
                          </span>
                        </td>
                      </tr>
                      <tr className="bg-blue-500/5">
                        <td className="px-4 py-3 text-slate-900/80 dark:text-white/80 font-medium">
                          Refund processing time
                        </td>
                        <td className="px-4 py-3 text-blue-300 font-bold">
                          15 days
                        </td>
                        <td className="px-4 py-3 text-slate-900/60 dark:text-white/60">
                          After approval
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-slate-900/40 dark:text-white/40 text-xs mt-2">
                  * Subject to conditions described above. &quot;No*&quot; =
                  Exception for critical errors or quality deficiencies.
                </p>
              </div>

              {/* Acceptance Footer */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-8">
                <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <RefreshCcw className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-blue-200 font-semibold mb-2">
                        Acknowledgment
                      </p>
                      <p className="text-blue-200/80 text-sm">
                        By purchasing any product or service on the Platform,
                        you acknowledge that you have read, understood, and
                        agree to be bound by this Refund and Cancellation
                        Policy. This policy should be read in conjunction with
                        our Terms and Conditions and Privacy Policy.
                      </p>
                      <p className="text-blue-200/60 text-xs mt-3">
                        Version 1.0 | Effective Date: February 24, 2026 |
                        Rakshit Tiwari trading as Beamlab
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
              <Link
                to="/refund-cancellation"
                className="text-slate-900/50 dark:text-white/50 hover:text-slate-900 dark:hover:text-white text-sm transition-colors"
              >
                Refund Policy
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
}

export default memo(RefundCancellationPage);
