/**
 * PrivacyPolicyPageNew.tsx - Comprehensive Privacy Policy
 * Standalone page for privacy policy - used with Clerk authentication
 */

import { Link } from 'react-router-dom';
import { Shield, ChevronRight, Menu, X, Lock } from 'lucide-react';
import { useState } from 'react';

interface Section {
    id: string;
    number: string;
    title: string;
}

const sections: Section[] = [
    { id: 'introduction', number: '', title: 'Introduction' },
    { id: 'collection', number: '1', title: 'Information We Collect' },
    { id: 'usage', number: '2', title: 'How We Use Your Information' },
    { id: 'sharing', number: '3', title: 'Information Sharing' },
    { id: 'security', number: '4', title: 'Data Security' },
    { id: 'retention', number: '5', title: 'Data Retention' },
    { id: 'rights', number: '6', title: 'Your Privacy Rights' },
    { id: 'cookies', number: '7', title: 'Cookies and Tracking' },
    { id: 'children', number: '8', title: "Children's Privacy" },
    { id: 'international', number: '9', title: 'International Users' },
    { id: 'changes', number: '10', title: 'Changes to This Policy' },
    { id: 'contact', number: '11', title: 'Contact Us' },
];

export const PrivacyPolicyPageNew = () => {
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
                        <Link to="/" className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                                <Shield className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold text-zinc-900 dark:text-white">
                                BeamLab <span className="text-zinc-500 font-normal">Ultimate</span>
                            </span>
                        </Link>

                        <div className="hidden md:flex items-center gap-8">
                            <nav className="flex gap-6">
                                <Link to="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors">Features</Link>
                                <Link to="/pricing" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors">Pricing</Link>
                            </nav>
                            <div className="flex items-center gap-4 border-l border-zinc-200 dark:border-zinc-700 pl-8">
                                <Link to="/sign-in" className="text-sm font-medium text-zinc-900 dark:text-white">Log in</Link>
                                <Link to="/sign-up" className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors">
                                    Get Started
                                </Link>
                            </div>
                        </div>

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
                                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${activeSection === section.id
                                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold border-l-2 border-emerald-500 -ml-px'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                        }`}
                                >
                                    {section.number && `${section.number}. `}{section.title}
                                </button>
                            ))}
                        </nav>
                        
                        <div className="mt-8 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                Also see our{' '}
                                <Link to="/terms-of-service" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                                    Terms of Service
                                </Link>
                            </p>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 max-w-3xl">
                    <div className="space-y-12">
                        {/* Header */}
                        <div>
                            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                <Link to="/" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Home</Link>
                                <ChevronRight className="w-4 h-4" />
                                <span className="text-zinc-900 dark:text-white font-medium">Privacy Policy</span>
                            </div>
                            
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                                    <Lock className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-4xl font-bold text-zinc-900 dark:text-white">Privacy Policy</h1>
                                    <p className="text-zinc-600 dark:text-zinc-400 mt-1">Last updated: January 7, 2026</p>
                                </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <p className="text-sm text-blue-900 dark:text-blue-100">
                                    <strong>Your Privacy Matters:</strong> This Privacy Policy explains how BeamLab Ultimate 
                                    collects, uses, and protects your personal information.
                                </p>
                            </div>
                        </div>

                        {/* Introduction */}
                        <section id="introduction" className="scroll-mt-24">
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    BeamLab Ultimate ("we," "us," or "our") is committed to protecting your privacy. This Privacy 
                                    Policy describes how we collect, use, disclose, and safeguard your information when you use 
                                    our structural engineering analysis platform.
                                </p>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                    Please read this Privacy Policy carefully. By accessing or using BeamLab Ultimate, you acknowledge 
                                    that you have read, understood, and agree to be bound by this Privacy Policy. If you do not agree 
                                    with this policy, please do not use our Service.
                                </p>
                            </div>
                        </section>

                        {/* Section 1: Information Collection */}
                        <section id="collection" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">1. Information We Collect</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Information You Provide</h3>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    We collect information you provide directly to us, including:
                                </p>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li><strong>Account Information:</strong> Name, email address, password, company name, job title</li>
                                    <li><strong>Profile Information:</strong> Professional credentials, education, areas of expertise</li>
                                    <li><strong>Billing Information:</strong> Payment card details, billing address (processed by third-party payment providers)</li>
                                    <li><strong>Communications:</strong> Messages, support tickets, feedback you send to us</li>
                                    <li><strong>User Content:</strong> Structural models, analysis data, project files, reports you create</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Information Collected Automatically</h3>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    When you use the Service, we automatically collect certain information:
                                </p>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li><strong>Usage Data:</strong> Features accessed, actions performed, time spent, frequency of use</li>
                                    <li><strong>Device Information:</strong> Browser type, operating system, device identifiers</li>
                                    <li><strong>Log Data:</strong> IP address, access times, pages viewed, referring URLs</li>
                                    <li><strong>Performance Data:</strong> Analysis computation times, error logs, crash reports</li>
                                    <li><strong>Cookies:</strong> Session identifiers, preferences, authentication tokens</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Information from Third Parties</h3>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    We may receive information from third-party services:
                                </p>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2">
                                    <li><strong>Authentication Providers:</strong> Profile information from Clerk, Google, Microsoft if you use single sign-on</li>
                                    <li><strong>Payment Processors:</strong> Transaction confirmation from Razorpay or other payment services</li>
                                    <li><strong>Analytics Services:</strong> Aggregated usage statistics and performance metrics</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 2: Information Usage */}
                        <section id="usage" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">2. How We Use Your Information</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    We use the information we collect to:
                                </p>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Provide and Improve the Service</h3>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li>Create and manage your account</li>
                                    <li>Process your structural analysis requests</li>
                                    <li>Store and retrieve your project data</li>
                                    <li>Generate reports and visualizations</li>
                                    <li>Provide customer support and respond to inquiries</li>
                                    <li>Improve our algorithms and analysis capabilities</li>
                                    <li>Develop new features and functionality</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Business Operations</h3>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li>Process payments and maintain billing records</li>
                                    <li>Send transactional emails (e.g., password resets, receipts)</li>
                                    <li>Monitor and analyze usage patterns and trends</li>
                                    <li>Detect and prevent fraud, abuse, and security incidents</li>
                                    <li>Comply with legal obligations and enforce our Terms of Service</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Communications (With Your Consent)</h3>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2">
                                    <li>Send product updates and new feature announcements</li>
                                    <li>Provide educational content and engineering resources</li>
                                    <li>Notify you of special offers and promotions</li>
                                    <li>Request feedback and testimonials</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 3: Information Sharing */}
                        <section id="sharing" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">3. Information Sharing and Disclosure</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4 font-semibold">
                                    We do not sell your personal information to third parties.
                                </p>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    We may share your information in the following circumstances:
                                </p>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Service Providers</h3>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    We share information with third-party vendors who perform services on our behalf:
                                </p>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li><strong>Cloud Hosting:</strong> Microsoft Azure for application hosting and data storage</li>
                                    <li><strong>Authentication:</strong> Clerk for user authentication and identity management</li>
                                    <li><strong>Payments:</strong> Razorpay for payment processing (they receive billing information)</li>
                                    <li><strong>Email:</strong> Email service providers for transactional and marketing communications</li>
                                    <li><strong>Analytics:</strong> Analytics platforms for usage monitoring and performance tracking</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Legal Requirements</h3>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    We may disclose your information if required by law or in good faith belief that such action is necessary to:
                                </p>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li>Comply with legal obligations or valid legal processes</li>
                                    <li>Protect and defend our rights or property</li>
                                    <li>Prevent fraud or security issues</li>
                                    <li>Protect the safety of users or the public</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Business Transfers</h3>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                    If we are involved in a merger, acquisition, or sale of assets, your information may be 
                                    transferred. We will notify you before your information becomes subject to a different privacy policy.
                                </p>
                            </div>
                        </section>

                        {/* Section 4: Data Security */}
                        <section id="security" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">4. Data Security</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    We implement industry-standard security measures to protect your information:
                                </p>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Technical Safeguards</h3>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li><strong>Encryption:</strong> TLS/SSL encryption for data in transit</li>
                                    <li><strong>Database Security:</strong> Encrypted storage for sensitive data at rest</li>
                                    <li><strong>Access Controls:</strong> Role-based access and authentication requirements</li>
                                    <li><strong>Monitoring:</strong> Continuous security monitoring and threat detection</li>
                                    <li><strong>Backups:</strong> Regular automated backups with geo-redundancy</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Organizational Measures</h3>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li>Limited employee access to personal data (need-to-know basis)</li>
                                    <li>Confidentiality agreements with employees and contractors</li>
                                    <li>Regular security training and awareness programs</li>
                                    <li>Incident response procedures</li>
                                </ul>

                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 my-4">
                                    <p className="text-sm text-amber-900 dark:text-amber-100">
                                        <strong>Important:</strong> While we implement robust security measures, no method of 
                                        transmission over the internet or electronic storage is 100% secure. We cannot guarantee 
                                        absolute security of your information.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 5: Data Retention */}
                        <section id="retention" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">5. Data Retention</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    We retain your information for as long as necessary to:
                                </p>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li>Maintain your account and provide the Service</li>
                                    <li>Comply with legal, tax, or accounting obligations</li>
                                    <li>Resolve disputes and enforce our agreements</li>
                                    <li>Maintain business records and analytics</li>
                                </ul>

                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    <strong>Specific Retention Periods:</strong>
                                </p>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2">
                                    <li><strong>Account Data:</strong> Retained while your account is active, plus 90 days after closure</li>
                                    <li><strong>Project Files:</strong> Retained for the duration of your subscription, plus 30 days</li>
                                    <li><strong>Transaction Records:</strong> Retained for 7 years for tax and accounting purposes</li>
                                    <li><strong>Logs and Analytics:</strong> Retained for 12-24 months</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 6: Your Privacy Rights */}
                        <section id="rights" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">6. Your Privacy Rights</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    You have the following rights regarding your personal information:
                                </p>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Access and Portability</h3>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li>Request a copy of your personal data</li>
                                    <li>Export your project files and analysis results</li>
                                    <li>Receive your data in a machine-readable format</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Correction and Updates</h3>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li>Update your account information anytime in Settings</li>
                                    <li>Request correction of inaccurate data</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Deletion</h3>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li>Delete your account and associated data</li>
                                    <li>Request deletion of specific information (subject to legal retention requirements)</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Marketing Communications</h3>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li>Opt out of marketing emails using unsubscribe links</li>
                                    <li>Manage communication preferences in account settings</li>
                                    <li>Note: You cannot opt out of transactional emails (e.g., password resets)</li>
                                </ul>

                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                    To exercise these rights, contact us at{' '}
                                    <a href="mailto:privacy@beamlabultimate.tech" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                                        privacy@beamlabultimate.tech
                                    </a>
                                </p>
                            </div>
                        </section>

                        {/* Section 7: Cookies */}
                        <section id="cookies" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">7. Cookies and Tracking Technologies</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    We use cookies and similar tracking technologies to:
                                </p>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li><strong>Essential Cookies:</strong> Required for authentication and basic functionality</li>
                                    <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
                                    <li><strong>Analytics Cookies:</strong> Understand how you use the Service</li>
                                    <li><strong>Session Cookies:</strong> Maintain your login state</li>
                                </ul>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                    You can control cookies through your browser settings. Note that disabling certain cookies 
                                    may limit functionality of the Service.
                                </p>
                            </div>
                        </section>

                        {/* Section 8: Children's Privacy */}
                        <section id="children" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">8. Children's Privacy</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    BeamLab Ultimate is not intended for use by individuals under the age of 18. We do not 
                                    knowingly collect personal information from children.
                                </p>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                    If we become aware that we have collected personal information from a child without parental 
                                    consent, we will take steps to delete that information promptly.
                                </p>
                            </div>
                        </section>

                        {/* Section 9: International Users */}
                        <section id="international" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">9. International Data Transfers</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    BeamLab Ultimate is hosted on Microsoft Azure with data centers in multiple regions. Your 
                                    information may be transferred to and processed in countries other than your own.
                                </p>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    We ensure appropriate safeguards are in place for international data transfers, including:
                                </p>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2">
                                    <li>Standard contractual clauses approved by relevant authorities</li>
                                    <li>Compliance with applicable data protection regulations (GDPR, CCPA, etc.)</li>
                                    <li>Adequate security measures for data protection</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 10: Changes to Policy */}
                        <section id="changes" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">10. Changes to This Privacy Policy</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    We may update this Privacy Policy from time to time. When we make changes, we will:
                                </p>
                                <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 space-y-2 mb-4">
                                    <li>Update the "Last Updated" date at the top of this page</li>
                                    <li>Notify you via email for material changes</li>
                                    <li>Display a notice within the Service</li>
                                </ul>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                    Your continued use of the Service after changes become effective constitutes acceptance of 
                                    the revised Privacy Policy.
                                </p>
                            </div>
                        </section>

                        {/* Section 11: Contact */}
                        <section id="contact" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">11. Contact Us</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                                    If you have questions about this Privacy Policy or our privacy practices, please contact us:
                                </p>
                                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-6 space-y-3">
                                    <div>
                                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Privacy Inquiries</p>
                                        <a 
                                            href="mailto:privacy@beamlabultimate.tech" 
                                            className="text-emerald-600 dark:text-emerald-400 hover:underline"
                                        >
                                            privacy@beamlabultimate.tech
                                        </a>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">General Support</p>
                                        <a 
                                            href="mailto:support@beamlabultimate.tech" 
                                            className="text-emerald-600 dark:text-emerald-400 hover:underline"
                                        >
                                            support@beamlabultimate.tech
                                        </a>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Website</p>
                                        <a 
                                            href="https://beamlabultimate.tech" 
                                            className="text-emerald-600 dark:text-emerald-400 hover:underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            https://beamlabultimate.tech
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Footer Acknowledgment */}
                        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-8">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                                <p className="text-sm text-blue-900 dark:text-blue-100 mb-4">
                                    <strong>Acknowledgment:</strong> By using BeamLab Ultimate, you acknowledge that you have 
                                    read and understood this Privacy Policy.
                                </p>
                                <p className="text-xs text-blue-800 dark:text-blue-200">
                                    Version 1.0 | Effective Date: January 7, 2026
                                </p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Footer */}
            <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            © 2026 BeamLab Ultimate. All rights reserved.
                        </p>
                        <div className="flex gap-6">
                            <Link to="/privacy-policy" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                                Privacy Policy
                            </Link>
                            <Link to="/terms-of-service" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                                Terms of Service
                            </Link>
                            <a href="mailto:privacy@beamlabultimate.tech" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                                Contact
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};
