/**
 * PrivacyPolicyPage.tsx - Privacy Policy Document
 * Legal document with sidebar table of contents
 */

import { Link } from 'react-router-dom';
import { Mail, MapPin, Shield, ChevronRight, Server, Gavel, Menu, X } from 'lucide-react';
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
    { id: 'collection', number: '1', title: 'Information We Collect' },
    { id: 'usage', number: '2', title: 'How We Use Information' },
    { id: 'sharing', number: '3', title: 'How We Share Information' },
    { id: 'choices', number: '4', title: 'Your Choices' },
    { id: 'security', number: '5', title: 'Data Security' },
    { id: 'children', number: '6', title: "Children's Privacy" },
    { id: 'changes', number: '7', title: 'Changes to Policy' },
    { id: 'contact', number: '8', title: 'Contact Us' },
];

// ============================================
// COMPONENT
// ============================================

export const PrivacyPolicyPage = () => {
    const [activeSection, setActiveSection] = useState('introduction');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setActiveSection(id);
            setMobileMenuOpen(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                                <Shield className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold text-zinc-900 dark:text-white">
                                BeamLab <span className="text-zinc-500 font-normal">Ultimate</span>
                            </span>
                        </Link>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center gap-8">
                            <nav className="flex gap-6">
                                <Link to="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors">Features</Link>
                                <Link to="/pricing" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors">Pricing</Link>
                                <Link to="/help" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors">Resources</Link>
                            </nav>
                            <div className="flex items-center gap-4 border-l border-zinc-200 dark:border-zinc-700 pl-8">
                                <Link to="/sign-in" className="text-sm font-medium text-zinc-900 dark:text-white">Log in</Link>
                                <Link to="/sign-up" className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors">
                                    Get Started
                                </Link>
                            </div>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden p-2 text-zinc-600 dark:text-zinc-300"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-grow flex flex-col md:flex-row max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 md:py-16 gap-10">
                {/* Sidebar Navigation */}
                <aside className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block w-64 flex-shrink-0`}>
                    <div className="sticky top-28">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-4">Contents</h3>
                        <nav className="space-y-1 border-l border-zinc-200 dark:border-zinc-700 ml-1">
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => scrollToSection(section.id)}
                                    className={`block w-full text-left pl-4 py-2 text-sm transition-colors ${activeSection === section.id
                                            ? 'border-l-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-r-md font-medium'
                                            : 'border-l-2 border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-600'
                                        }`}
                                >
                                    {section.number ? `${section.number}. ${section.title}` : section.title}
                                </button>
                            ))}
                        </nav>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 max-w-3xl">
                    {/* Page Heading */}
                    <div className="mb-12" id="introduction">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-400">
                                Legal
                            </span>
                            <span className="text-sm text-zinc-500 dark:text-zinc-400">Last updated: December 28, 2024</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-6">
                            Privacy Policy
                        </h1>
                        <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
                            At BeamLab Ultimate, we take your privacy seriously. This policy outlines how we collect, use, and protect your personal and structural project data when you use our software and services. We are committed to transparency and ensuring your information remains secure.
                        </p>
                    </div>

                    {/* Content Sections */}
                    <div className="space-y-12">
                        {/* Section 1 */}
                        <section className="scroll-mt-28" id="collection">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-sm font-bold">1</span>
                                Information We Collect
                            </h2>
                            <div className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-300 space-y-4">
                                <p>
                                    We collect information you provide directly to us, such as when you create an account, update your profile, request customer support, or otherwise communicate with us. This may include:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li><strong>Account Information:</strong> Your name, email address, company name, and payment information.</li>
                                    <li><strong>Project Data:</strong> Structural models, load configurations, material properties, and analysis results you upload or generate using BeamLab Ultimate.</li>
                                    <li><strong>Usage Data:</strong> Information about how you access and use our services, including device information, log data, and interaction data.</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 2 */}
                        <section className="scroll-mt-28" id="usage">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-sm font-bold">2</span>
                                How We Use Your Information
                            </h2>
                            <div className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-300 space-y-4">
                                <p>We use the information we collect to operate, maintain, and improve our services. Specifically, we use your data to:</p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Process structural calculations and render 3D models efficiently.</li>
                                    <li>Send you technical notices, updates, security alerts, and support messages.</li>
                                    <li>Monitor and analyze trends, usage, and activities in connection with our services to improve user experience.</li>
                                    <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities.</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 3 */}
                        <section className="scroll-mt-28" id="sharing">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-sm font-bold">3</span>
                                How We Share Your Information
                            </h2>
                            <div className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-300 space-y-4">
                                <p>We do not sell your personal data. We may share your information in the following circumstances:</p>
                                <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-100 dark:border-zinc-700 shadow-sm">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="flex gap-3">
                                            <Server className="w-5 h-5 text-emerald-500 mt-1 flex-shrink-0" />
                                            <div>
                                                <h4 className="font-bold text-zinc-900 dark:text-white">Service Providers</h4>
                                                <p className="text-sm mt-1">With vendors who need access to such information to carry out work on our behalf (e.g., cloud computing providers).</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <Gavel className="w-5 h-5 text-emerald-500 mt-1 flex-shrink-0" />
                                            <div>
                                                <h4 className="font-bold text-zinc-900 dark:text-white">Legal Obligations</h4>
                                                <p className="text-sm mt-1">In response to a request for information if we believe disclosure is in accordance with any applicable law or legal process.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 4 */}
                        <section className="scroll-mt-28" id="choices">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-sm font-bold">4</span>
                                Your Choices
                            </h2>
                            <p className="text-zinc-600 dark:text-zinc-300">
                                You may update, correct, or delete your account information at any time by logging into your online account. You may also opt out of receiving promotional communications from us by following the instructions in those communications. If you opt out, we may still send you non-promotional communications, such as those about your account or our ongoing business relations.
                            </p>
                        </section>

                        {/* Section 5 */}
                        <section className="scroll-mt-28" id="security">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-sm font-bold">5</span>
                                Data Security
                            </h2>
                            <p className="text-zinc-600 dark:text-zinc-300">
                                We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction. Your project data is encrypted both in transit and at rest using industry-standard AES-256 encryption protocols.
                            </p>
                        </section>

                        {/* Section 6 */}
                        <section className="scroll-mt-28" id="children">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-sm font-bold">6</span>
                                Children's Privacy
                            </h2>
                            <p className="text-zinc-600 dark:text-zinc-300">
                                Our services are not directed to individuals under 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete such information.
                            </p>
                        </section>

                        {/* Section 7 */}
                        <section className="scroll-mt-28" id="changes">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-sm font-bold">7</span>
                                Changes to This Policy
                            </h2>
                            <p className="text-zinc-600 dark:text-zinc-300">
                                We may change this Privacy Policy from time to time. If we make changes, we will notify you by revising the date at the top of the policy and, in some cases, we may provide you with additional notice (such as adding a statement to our homepage or sending you a notification).
                            </p>
                        </section>

                        {/* Section 8 */}
                        <section className="scroll-mt-28 mb-16" id="contact">
                            <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-8 border border-zinc-200 dark:border-zinc-700">
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">8. Contact Us</h2>
                                <p className="text-zinc-600 dark:text-zinc-300 mb-6">
                                    If you have any questions about this Privacy Policy, please contact us at:
                                </p>
                                <div className="flex flex-col sm:flex-row gap-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-700 flex items-center justify-center shadow-sm">
                                            <Mail className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase font-semibold">Email</p>
                                            <a href="mailto:privacy@beamlab.com" className="font-medium text-zinc-900 dark:text-white hover:text-emerald-500 transition-colors">
                                                privacy@beamlab.com
                                            </a>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-700 flex items-center justify-center shadow-sm">
                                            <MapPin className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase font-semibold">Address</p>
                                            <span className="font-medium text-zinc-900 dark:text-white">88 Structural Way, San Francisco, CA</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </main>
            </div>

            {/* Footer */}
            <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-12 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">© 2024 BeamLab Ultimate. All rights reserved.</p>
                        <div className="flex gap-6">
                            <Link to="/privacy" className="text-xs text-zinc-500 hover:text-emerald-500 transition-colors">Privacy Policy</Link>
                            <Link to="/terms" className="text-xs text-zinc-500 hover:text-emerald-500 transition-colors">Terms of Service</Link>
                            <Link to="/help" className="text-xs text-zinc-500 hover:text-emerald-500 transition-colors">Help</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PrivacyPolicyPage;
