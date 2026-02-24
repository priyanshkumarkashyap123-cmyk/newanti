/**
 * TermsPage.tsx - Terms of Service / Terms and Conditions
 * Legal document with sidebar table of contents
 * Compliant with Indian laws: IT Act 2000, Consumer Protection Act 2019
 */

import { Link } from 'react-router-dom';
import { Mail, MapPin, Scale, ChevronRight, FileText, Shield, Menu, X, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

// ============================================
// TYPES
// ============================================

interface Section {
    id: string;
    number: string;
    title: string;
}

const sections: Section[] = [
    { id: 'introduction', number: '', title: 'Introduction' },
    { id: 'definitions', number: '1', title: 'Definitions' },
    { id: 'acceptance', number: '2', title: 'Acceptance of Terms' },
    { id: 'service-description', number: '3', title: 'Service Description' },
    { id: 'user-obligations', number: '4', title: 'User Obligations' },
    { id: 'professional-responsibility', number: '5', title: 'Professional Responsibility' },
    { id: 'intellectual-property', number: '6', title: 'Intellectual Property' },
    { id: 'payment-terms', number: '7', title: 'Payment & Subscriptions' },
    { id: 'limitation-liability', number: '8', title: 'Limitation of Liability' },
    { id: 'indemnification', number: '9', title: 'Indemnification' },
    { id: 'termination', number: '10', title: 'Termination' },
    { id: 'governing-law', number: '11', title: 'Governing Law (India)' },
    { id: 'dispute-resolution', number: '12', title: 'Dispute Resolution' },
    { id: 'modifications', number: '13', title: 'Modifications' },
    { id: 'contact', number: '14', title: 'Contact Us' },
];

// ============================================
// COMPONENT
// ============================================

function TermsPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setMobileMenuOpen(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <Scale className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xl font-bold text-white">BeamLab Ultimate</span>
                        </Link>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden p-2 text-white/70 hover:text-white"
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>

                        <nav className="hidden lg:flex items-center gap-6">
                            <Link to="/privacy" className="text-white/70 hover:text-white transition-colors">
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
                    <aside className={`
                        ${mobileMenuOpen ? 'fixed inset-0 z-40 bg-slate-900 p-6 overflow-y-auto' : 'hidden'}
                        lg:block lg:relative lg:w-72 lg:flex-shrink-0
                    `}>
                        <div className="lg:sticky lg:top-24">
                            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
                                Table of Contents
                            </h3>
                            <nav className="space-y-1">
                                {sections.map((section) => (
                                    <button
                                        key={section.id}
                                        onClick={() => scrollToSection(section.id)}
                                        className="w-full text-left px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2 group"
                                    >
                                        <ChevronRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <span className="text-blue-400 font-mono text-sm w-6">
                                            {section.number}
                                        </span>
                                        <span className="text-sm">{section.title}</span>
                                    </button>
                                ))}
                            </nav>

                            {/* Quick Links */}
                            <div className="mt-8 pt-6 border-t border-white/10">
                                <h4 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">
                                    Related Documents
                                </h4>
                                <div className="space-y-2">
                                    <Link
                                        to="/privacy"
                                        className="flex items-center gap-2 text-sm text-white/60 hover:text-blue-400 transition-colors"
                                    >
                                        <Shield className="w-4 h-4" />
                                        Privacy Policy
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
                                <h1 className="text-4xl font-bold text-white">Terms of Service</h1>
                            </div>
                            <p className="text-white/60">
                                Last Updated: January 1, 2025 | Effective Date: January 1, 2025
                            </p>

                            {/* Important Notice */}
                            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-amber-200 font-medium">Important Notice</p>
                                        <p className="text-amber-200/70 text-sm mt-1">
                                            BeamLab Ultimate is a computational aid for structural analysis. All designs must be
                                            independently verified and approved by a licensed Professional Engineer before construction.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content Sections */}
                        <div className="prose prose-invert prose-lg max-w-none">

                            {/* Introduction */}
                            <section id="introduction" className="mb-12 scroll-mt-24">
                                <p className="text-white/80 leading-relaxed">
                                    Welcome to BeamLab Ultimate ("Service", "Platform", "we", "us", or "our"). These Terms of Service
                                    ("Terms", "Agreement") govern your access to and use of our structural analysis and design software
                                    platform. By accessing or using BeamLab Ultimate, you agree to be bound by these Terms.
                                </p>
                                <p className="text-white/80 leading-relaxed mt-4">
                                    This Agreement is made in accordance with the <strong>Information Technology Act, 2000</strong> of India
                                    and constitutes an electronic contract under Indian law. By clicking "I Accept" or by using the Service,
                                    you acknowledge that you have read, understood, and agree to be bound by these Terms.
                                </p>
                            </section>

                            {/* 1. Definitions */}
                            <section id="definitions" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">1.</span> Definitions
                                </h2>
                                <ul className="space-y-3 text-white/80">
                                    <li><strong>"User"</strong> means any individual or entity that accesses or uses the Service.</li>
                                    <li><strong>"Content"</strong> means all data, models, analysis results, and materials uploaded or generated through the Service.</li>
                                    <li><strong>"Subscription"</strong> means the paid access plan (Pro or Enterprise) that grants additional features.</li>
                                    <li><strong>"Free Tier"</strong> means the limited access version of the Service available without payment.</li>
                                    <li><strong>"Professional Engineer"</strong> means a person licensed to practice engineering under applicable laws.</li>
                                </ul>
                            </section>

                            {/* 2. Acceptance of Terms */}
                            <section id="acceptance" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">2.</span> Acceptance of Terms
                                </h2>
                                <p className="text-white/80 leading-relaxed">
                                    By accessing or using BeamLab Ultimate, you confirm that:
                                </p>
                                <ul className="space-y-2 text-white/80 mt-4">
                                    <li>You are at least 18 years of age.</li>
                                    <li>You have the legal capacity to enter into a binding agreement.</li>
                                    <li>You are not prohibited from using the Service under applicable laws.</li>
                                    <li>If using on behalf of an organization, you have authority to bind that organization.</li>
                                </ul>
                                <p className="text-white/80 leading-relaxed mt-4">
                                    If you do not agree to these Terms, you must not access or use the Service.
                                </p>
                            </section>

                            {/* 3. Service Description */}
                            <section id="service-description" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">3.</span> Service Description
                                </h2>
                                <p className="text-white/80 leading-relaxed">
                                    BeamLab Ultimate is a web-based structural analysis and design software platform that provides:
                                </p>
                                <ul className="space-y-2 text-white/80 mt-4">
                                    <li>Finite Element Analysis (FEA) capabilities</li>
                                    <li>Structural design calculations and code checks</li>
                                    <li>Support for international design codes (AISC, Eurocode, IS codes)</li>
                                    <li>AI-assisted model generation and optimization</li>
                                    <li>Report generation and result visualization</li>
                                </ul>
                                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                    <p className="text-red-200 font-medium">Important Disclaimer</p>
                                    <p className="text-red-200/70 text-sm mt-1">
                                        The Service is a <strong>computational aid only</strong>. It is NOT a substitute for professional
                                        engineering judgment. All results must be independently verified by a qualified Professional Engineer.
                                    </p>
                                </div>
                            </section>

                            {/* 4. User Obligations */}
                            <section id="user-obligations" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">4.</span> User Obligations
                                </h2>
                                <p className="text-white/80 leading-relaxed">You agree to:</p>
                                <ul className="space-y-2 text-white/80 mt-4">
                                    <li>Use the Service only for lawful purposes and in compliance with all applicable laws.</li>
                                    <li>Provide accurate and complete information when creating an account.</li>
                                    <li>Maintain the confidentiality of your account credentials.</li>
                                    <li>Not share, transfer, or sell your account to any third party.</li>
                                    <li>Not attempt to reverse-engineer, decompile, or disassemble the software.</li>
                                    <li>Not use the Service to develop competing products.</li>
                                    <li>Comply with all applicable building codes and engineering regulations.</li>
                                </ul>
                            </section>

                            {/* 5. Professional Responsibility */}
                            <section id="professional-responsibility" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">5.</span> Professional Responsibility
                                </h2>
                                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-6">
                                    <p className="text-amber-200 font-bold uppercase">Critical Engineering Notice</p>
                                </div>
                                <p className="text-white/80 leading-relaxed">
                                    <strong>YOU ACKNOWLEDGE AND AGREE THAT:</strong>
                                </p>
                                <ul className="space-y-3 text-white/80 mt-4">
                                    <li>You are <strong>solely responsible</strong> for verifying all analysis results before implementation.</li>
                                    <li>BeamLab Ultimate is a computational tool, not a replacement for licensed engineering review.</li>
                                    <li>All designs must be reviewed, approved, and sealed by a licensed Professional Engineer (PE/SE).</li>
                                    <li>You must verify results using independent methods (hand calculations, peer review, alternative software).</li>
                                    <li>You must account for actual site conditions, construction tolerances, and material properties.</li>
                                    <li>Local building codes may differ from the design codes implemented in the software.</li>
                                </ul>
                            </section>

                            {/* 6. Intellectual Property */}
                            <section id="intellectual-property" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">6.</span> Intellectual Property
                                </h2>
                                <h3 className="text-xl font-semibold text-white/90 mt-6 mb-3">6.1 Our Intellectual Property</h3>
                                <p className="text-white/80 leading-relaxed">
                                    The Service, including its software, algorithms, user interface, and documentation, is owned by
                                    BeamLab Ultimate and protected by intellectual property laws. You are granted a limited,
                                    non-exclusive, non-transferable license to use the Service.
                                </p>

                                <h3 className="text-xl font-semibold text-white/90 mt-6 mb-3">6.2 Your Content</h3>
                                <p className="text-white/80 leading-relaxed">
                                    You retain ownership of all Content you upload or create using the Service. By using the Service,
                                    you grant us a limited license to process and store your Content for the purpose of providing the Service.
                                </p>
                            </section>

                            {/* 7. Payment Terms */}
                            <section id="payment-terms" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">7.</span> Payment & Subscriptions
                                </h2>
                                <h3 className="text-xl font-semibold text-white/90 mt-6 mb-3">7.1 Subscription Plans</h3>
                                <p className="text-white/80 leading-relaxed">
                                    We offer Free, Pro, and Enterprise subscription plans. Features and pricing are as displayed
                                    on our website at the time of purchase.
                                </p>

                                <h3 className="text-xl font-semibold text-white/90 mt-6 mb-3">7.2 Billing</h3>
                                <p className="text-white/80 leading-relaxed">
                                    Subscriptions are billed in advance on a monthly or yearly basis. All fees are in Indian Rupees (INR)
                                    unless otherwise specified. Payments are processed securely through Razorpay.
                                </p>

                                <h3 className="text-xl font-semibold text-white/90 mt-6 mb-3">7.3 Refund Policy</h3>
                                <p className="text-white/80 leading-relaxed">
                                    Refund requests may be considered within 7 days of purchase for annual subscriptions, subject to
                                    our discretion. Monthly subscriptions are generally non-refundable. This does not affect your
                                    statutory rights under the <strong>Consumer Protection Act, 2019</strong>.
                                </p>
                            </section>

                            {/* 8. Limitation of Liability */}
                            <section id="limitation-liability" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">8.</span> Limitation of Liability
                                </h2>
                                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-6">
                                    <p className="text-red-200 font-bold">IMPORTANT - PLEASE READ CAREFULLY</p>
                                </div>
                                <p className="text-white/80 leading-relaxed">
                                    <strong>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:</strong>
                                </p>
                                <ul className="space-y-3 text-white/80 mt-4">
                                    <li>The Service is provided <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong> without warranties of any kind.</li>
                                    <li>We do not guarantee the accuracy, completeness, or reliability of analysis results.</li>
                                    <li>We are <strong>NOT LIABLE</strong> for any structural failures, property damage, personal injury, or death arising from use of this software.</li>
                                    <li>We are not liable for any indirect, incidental, special, consequential, or punitive damages.</li>
                                    <li>Our total liability shall not exceed the amount paid by you for the Service in the preceding 12 months.</li>
                                </ul>
                                <p className="text-white/80 leading-relaxed mt-4">
                                    Nothing in these Terms excludes or limits liability that cannot be excluded under Indian law, including
                                    liability for fraud or fraudulent misrepresentation.
                                </p>
                            </section>

                            {/* 9. Indemnification */}
                            <section id="indemnification" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">9.</span> Indemnification
                                </h2>
                                <p className="text-white/80 leading-relaxed">
                                    You agree to indemnify, defend, and hold harmless BeamLab Ultimate, its officers, directors, employees,
                                    and agents from any claims, damages, losses, liabilities, costs, and expenses arising from:
                                </p>
                                <ul className="space-y-2 text-white/80 mt-4">
                                    <li>Your use or misuse of the Service</li>
                                    <li>Your violation of these Terms</li>
                                    <li>Your violation of any applicable law or regulation</li>
                                    <li>Any engineering projects where you used this software</li>
                                    <li>Any claims by third parties related to structures you designed using the Service</li>
                                </ul>
                            </section>

                            {/* 10. Termination */}
                            <section id="termination" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">10.</span> Termination
                                </h2>
                                <p className="text-white/80 leading-relaxed">
                                    We may terminate or suspend your access to the Service immediately, without prior notice, for any reason,
                                    including breach of these Terms.
                                </p>
                                <p className="text-white/80 leading-relaxed mt-4">
                                    Upon termination:
                                </p>
                                <ul className="space-y-2 text-white/80 mt-2">
                                    <li>Your right to use the Service ceases immediately.</li>
                                    <li>You may request export of your data within 30 days.</li>
                                    <li>We may delete your Content after 30 days.</li>
                                    <li>Provisions that should survive termination shall continue to apply.</li>
                                </ul>
                            </section>

                            {/* 11. Governing Law (India) */}
                            <section id="governing-law" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">11.</span> Governing Law (India)
                                </h2>
                                <p className="text-white/80 leading-relaxed">
                                    These Terms shall be governed by and construed in accordance with the laws of <strong>India</strong>,
                                    including but not limited to:
                                </p>
                                <ul className="space-y-2 text-white/80 mt-4">
                                    <li><strong>Information Technology Act, 2000</strong> and its amendments</li>
                                    <li><strong>Indian Contract Act, 1872</strong></li>
                                    <li><strong>Consumer Protection Act, 2019</strong></li>
                                    <li><strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011</strong></li>
                                </ul>
                                <p className="text-white/80 leading-relaxed mt-4">
                                    This Agreement constitutes an electronic contract within the meaning of the Information Technology Act, 2000
                                    and the rules thereunder.
                                </p>
                            </section>

                            {/* 12. Dispute Resolution */}
                            <section id="dispute-resolution" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">12.</span> Dispute Resolution
                                </h2>
                                <h3 className="text-xl font-semibold text-white/90 mt-6 mb-3">12.1 Amicable Resolution</h3>
                                <p className="text-white/80 leading-relaxed">
                                    Parties shall first attempt to resolve any dispute through good-faith negotiation.
                                </p>

                                <h3 className="text-xl font-semibold text-white/90 mt-6 mb-3">12.2 Arbitration</h3>
                                <p className="text-white/80 leading-relaxed">
                                    If negotiation fails, disputes shall be referred to and finally resolved by arbitration in accordance
                                    with the <strong>Arbitration and Conciliation Act, 1996</strong> of India. The seat of arbitration
                                    shall be New Delhi, India. The language of arbitration shall be English.
                                </p>

                                <h3 className="text-xl font-semibold text-white/90 mt-6 mb-3">12.3 Jurisdiction</h3>
                                <p className="text-white/80 leading-relaxed">
                                    Subject to the arbitration clause, the courts of New Delhi, India shall have exclusive jurisdiction
                                    over any disputes arising from these Terms.
                                </p>
                            </section>

                            {/* 13. Modifications */}
                            <section id="modifications" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">13.</span> Modifications
                                </h2>
                                <p className="text-white/80 leading-relaxed">
                                    We reserve the right to modify these Terms at any time. We will notify you of material changes by:
                                </p>
                                <ul className="space-y-2 text-white/80 mt-4">
                                    <li>Posting the updated Terms on our website</li>
                                    <li>Sending an email to your registered email address</li>
                                    <li>Displaying an in-app notification</li>
                                </ul>
                                <p className="text-white/80 leading-relaxed mt-4">
                                    Continued use of the Service after modifications constitutes acceptance of the updated Terms.
                                </p>
                            </section>

                            {/* 14. Contact Us */}
                            <section id="contact" className="mb-12 scroll-mt-24">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-400">14.</span> Contact Us
                                </h2>
                                <p className="text-white/80 leading-relaxed mb-6">
                                    For questions about these Terms or the Service, please contact:
                                </p>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 text-white/80">
                                        <Mail className="w-5 h-5 text-blue-400" />
                                        <a href="mailto:legal@beamlabultimate.tech" className="hover:text-blue-400 transition-colors">
                                            legal@beamlabultimate.tech
                                        </a>
                                    </div>
                                    <div className="flex items-center gap-3 text-white/80">
                                        <MapPin className="w-5 h-5 text-blue-400" />
                                        <span>India</span>
                                    </div>
                                </div>

                                {/* Grievance Officer (required under Indian IT Rules) */}
                                <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
                                    <h3 className="text-lg font-semibold text-white mb-3">Grievance Officer</h3>
                                    <p className="text-white/70 text-sm">
                                        In accordance with the Information Technology Act, 2000 and rules made thereunder,
                                        the name and contact details of the Grievance Officer are:
                                    </p>
                                    <div className="mt-3 space-y-1 text-white/80">
                                        <p><strong>Name:</strong> Rakshit Tiwari</p>
                                        <p><strong>Email:</strong> grievance@beamlabultimate.tech</p>
                                        <p><strong>Response Time:</strong> Within 24 hours of receipt</p>
                                    </div>
                                </div>
                            </section>

                        </div>
                    </main>
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-white/10 py-8 mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-white/50 text-sm">
                            © 2025 BeamLab Ultimate. All rights reserved.
                        </p>
                        <div className="flex gap-6">
                            <Link to="/privacy" className="text-white/50 hover:text-white text-sm transition-colors">
                                Privacy Policy
                            </Link>
                            <Link to="/terms" className="text-white/50 hover:text-white text-sm transition-colors">
                                Terms of Service
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default TermsPage;
