/**
 * TermsOfServicePage.tsx - Comprehensive Terms of Service
 * Standalone page for legal terms - used with Clerk authentication
 */

import { Link } from 'react-router-dom';
import { ChevronRight, FileText, Shield } from 'lucide-react';
import { useState, useEffect, memo } from 'react';
import { PageHeader, type NavLink } from '../components/layout';
import { SEO } from '../components/SEO';

interface Section {
    id: string;
    number: string;
    title: string;
}

const sections: Section[] = [
    { id: 'acceptance', number: '1', title: 'Acceptance of Terms' },
    { id: 'description', number: '2', title: 'Service Description' },
    { id: 'accounts', number: '3', title: 'User Accounts' },
    { id: 'disclaimer', number: '4', title: 'Engineering Disclaimer' },
    { id: 'usage', number: '5', title: 'Acceptable Use' },
    { id: 'intellectual', number: '6', title: 'Intellectual Property' },
    { id: 'liability', number: '7', title: 'Limitation of Liability' },
    { id: 'indemnification', number: '8', title: 'Indemnification' },
    { id: 'termination', number: '9', title: 'Termination' },
    { id: 'changes', number: '10', title: 'Changes to Terms' },
    { id: 'governing', number: '11', title: 'Governing Law' },
    { id: 'contact', number: '12', title: 'Contact Information' },
];

export const TermsOfServicePage = () => {
    const [activeSection, setActiveSection] = useState('acceptance');

    useEffect(() => { document.title = 'Terms of Service | BeamLab'; }, []);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setActiveSection(id);
        }
    };

    const navLinks: NavLink[] = [
        { to: '/', label: 'Features' },
        { to: '/pricing', label: 'Pricing' },
    ];

    return (
        <div className="min-h-screen bg-[#0b1326] flex flex-col">
            <SEO
                title="Terms of Service"
                description="BeamLab terms of service — usage terms, licensing, liability limitations, and dispute resolution."
                path="/terms-of-service"
            />
            <PageHeader
                showAuth={true}
                navLinks={navLinks}
            />

            <div className="flex-grow flex flex-col md:flex-row max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 md:py-16 gap-10">
                {/* Sidebar Navigation */}
                <aside className="w-64 flex-shrink-0">
                    <div className="sticky top-28">
                        <h3 className="text-sm font-bold text-[#dae2fd] uppercase tracking-wider mb-4">Contents</h3>
                        <nav className="space-y-1 border-l border-[#1a2333] ml-1">
                            {sections.map((section) => (
                                <button type="button"
                                    key={section.id}
                                    onClick={() => scrollToSection(section.id)}
                                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${activeSection === section.id
                                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold border-l-2 border-emerald-500 -ml-px'
                                        : 'text-[#869ab8] hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    {section.number && `${section.number}. `}{section.title}
                                </button>
                            ))}
                        </nav>
                        
                        <div className="mt-8 p-4 bg-[#131b2e] rounded-lg">
                            <p className="text-xs text-[#869ab8]">
                                Also see our{' '}
                                <Link to="/privacy-policy" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                                    Privacy Policy
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
                            <div className="flex items-center gap-2 text-sm text-[#869ab8] mb-4">
                                <Link to="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
                                <ChevronRight className="w-4 h-4" />
                                <span className="text-[#dae2fd] font-medium tracking-wide">Terms of Service</span>
                            </div>
                            
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-4xl font-bold text-[#dae2fd]">Terms of Service</h1>
                                    <p className="text-[#869ab8] mt-1">Last updated: January 7, 2026</p>
                                </div>
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-[#1a2333] rounded-lg p-4">
                                <p className="text-sm text-amber-900 dark:text-amber-100">
                                    <strong>Important:</strong> Please read these terms carefully before using BeamLab. 
                                    By accessing or using our service, you agree to be bound by these terms.
                                </p>
                            </div>
                        </div>

                        {/* Section 1: Acceptance of Terms */}
                        <section id="acceptance" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-[#dae2fd] mb-4">1. Acceptance of Terms</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    Welcome to BeamLab ("Service", "Platform", "we", "us", or "our"). These Terms of Service 
                                    ("Terms", "Agreement") govern your access to and use of our structural engineering analysis platform.
                                </p>
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    By creating an account or using BeamLab, you acknowledge that you have read, understood, 
                                    and agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, 
                                    you may not access or use the Service.
                                </p>
                                <p className="text-[#adc6ff] leading-relaxed">
                                    You must be at least 18 years old and have the legal capacity to enter into binding agreements 
                                    to use this Service.
                                </p>
                            </div>
                        </section>

                        {/* Section 2: Service Description */}
                        <section id="description" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-[#dae2fd] mb-4">2. Service Description</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    BeamLab provides cloud-based structural engineering analysis tools, including but not limited to:
                                </p>
                                <ul className="list-disc list-inside text-[#adc6ff] space-y-2 mb-4">
                                    <li>Finite Element Analysis (FEA) for structural systems</li>
                                    <li>Static and dynamic structural analysis</li>
                                    <li>Modal analysis and eigenvalue solutions</li>
                                    <li>Seismic and wind load analysis</li>
                                    <li>P-Delta and buckling analysis</li>
                                    <li>Steel and concrete member design</li>
                                    <li>Report generation and visualization tools</li>
                                    <li>3D modeling and rendering capabilities</li>
                                </ul>
                                <p className="text-[#adc6ff] leading-relaxed">
                                    We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time 
                                    without prior notice.
                                </p>
                            </div>
                        </section>

                        {/* Section 3: User Accounts */}
                        <section id="accounts" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-[#dae2fd] mb-4">3. User Accounts</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Account Registration</h3>
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    To use certain features of the Service, you must create an account. When creating an account, you agree to:
                                </p>
                                <ul className="list-disc list-inside text-[#adc6ff] space-y-2 mb-4">
                                    <li>Provide accurate, current, and complete information</li>
                                    <li>Maintain and promptly update your account information</li>
                                    <li>Maintain the security of your account credentials</li>
                                    <li>Accept responsibility for all activities under your account</li>
                                    <li>Notify us immediately of any unauthorized use</li>
                                </ul>

                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Account Security</h3>
                                <p className="text-[#adc6ff] leading-relaxed">
                                    You are responsible for maintaining the confidentiality of your account password. We are not 
                                    liable for any loss or damage arising from your failure to protect your account credentials.
                                </p>
                            </div>
                        </section>

                        {/* Section 4: Engineering Disclaimer */}
                        <section id="disclaimer" className="scroll-mt-24">
                            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-[#1a2333] rounded-lg p-6">
                                <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-4 flex items-center gap-2">
                                    <Shield className="w-6 h-6" />
                                    4. Critical Engineering Disclaimer
                                </h2>
                                <div className="prose dark:prose-invert max-w-none">
                                    <p className="text-red-800 dark:text-red-200 leading-relaxed mb-4 font-semibold">
                                        BEAMLAB IS A COMPUTATIONAL TOOL ONLY. IT IS NOT A SUBSTITUTE FOR PROFESSIONAL 
                                        ENGINEERING JUDGMENT.
                                    </p>
                                    
                                    <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-3">Professional Responsibility</h3>
                                    <p className="text-red-800 dark:text-red-200 leading-relaxed mb-4">
                                        All structural analysis results generated by this platform must be:
                                    </p>
                                    <ul className="list-disc list-inside text-red-800 dark:text-red-200 space-y-2 mb-4">
                                        <li><strong>Verified by a licensed professional engineer</strong> before use in design or construction</li>
                                        <li>Reviewed for accuracy, completeness, and compliance with applicable codes</li>
                                        <li>Validated against independent calculations and engineering principles</li>
                                        <li>Assessed within the context of the specific project requirements</li>
                                    </ul>

                                    <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-3">No Professional Engineering Services</h3>
                                    <p className="text-red-800 dark:text-red-200 leading-relaxed mb-4">
                                        BeamLab does not provide professional engineering services, design recommendations, 
                                        or certifications. Users are solely responsible for:
                                    </p>
                                    <ul className="list-disc list-inside text-red-800 dark:text-red-200 space-y-2 mb-4">
                                        <li>Proper interpretation of analysis results</li>
                                        <li>Verification of input parameters and assumptions</li>
                                        <li>Compliance with local building codes and regulations</li>
                                        <li>Ensuring structural safety and adequacy</li>
                                        <li>Obtaining necessary professional certifications and approvals</li>
                                    </ul>

                                    <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-3">Accuracy and Reliability</h3>
                                    <p className="text-red-800 dark:text-red-200 leading-relaxed">
                                        While we strive for accuracy, BeamLab makes no warranties regarding the accuracy, 
                                        reliability, or completeness of analysis results. Users acknowledge that:
                                    </p>
                                    <ul className="list-disc list-inside text-red-800 dark:text-red-200 space-y-2">
                                        <li>Computational errors may occur</li>
                                        <li>Results depend on user-provided input data</li>
                                        <li>Simplifications and assumptions are inherent in all analytical models</li>
                                        <li>The software cannot account for all real-world conditions</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* Section 5: Acceptable Use */}
                        <section id="usage" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-[#dae2fd] mb-4">5. Acceptable Use</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree NOT to:
                                </p>
                                <ul className="list-disc list-inside text-[#adc6ff] space-y-2 mb-4">
                                    <li>Use the Service in any way that violates applicable laws or regulations</li>
                                    <li>Attempt to gain unauthorized access to any part of the Service</li>
                                    <li>Interfere with or disrupt the Service or servers</li>
                                    <li>Use automated systems to access the Service without permission</li>
                                    <li>Reverse engineer, decompile, or disassemble the Service</li>
                                    <li>Remove or modify any proprietary notices or labels</li>
                                    <li>Use the Service to transmit harmful code or malware</li>
                                    <li>Impersonate any person or entity</li>
                                    <li>Share your account with others</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 6: Intellectual Property */}
                        <section id="intellectual" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-[#dae2fd] mb-4">6. Intellectual Property Rights</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Our Content</h3>
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    The Service, including all software, text, graphics, logos, and other content (excluding User Content), 
                                    is owned by BeamLab and protected by copyright, trademark, and other intellectual property laws.
                                </p>

                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Your Content</h3>
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    You retain all rights to the structural models, analysis results, and other content you create 
                                    using the Service ("User Content"). By using the Service, you grant us a limited license to:
                                </p>
                                <ul className="list-disc list-inside text-[#adc6ff] space-y-2 mb-4">
                                    <li>Store and process your User Content to provide the Service</li>
                                    <li>Create backups and ensure data redundancy</li>
                                    <li>Generate anonymous analytics to improve the Service</li>
                                </ul>
                                <p className="text-[#adc6ff] leading-relaxed">
                                    We will not share your User Content with third parties except as described in our Privacy Policy.
                                </p>
                            </div>
                        </section>

                        {/* Section 7: Limitation of Liability */}
                        <section id="liability" className="scroll-mt-24">
                            <div className="bg-[#131b2e] border border-[#1a2333] rounded-lg p-6">
                                <h2 className="text-2xl font-bold text-[#dae2fd] mb-4">7. Limitation of Liability</h2>
                                <div className="prose dark:prose-invert max-w-none">
                                    <p className="text-[#adc6ff] leading-relaxed mb-4 font-semibold uppercase">
                                        TO THE MAXIMUM EXTENT PERMITTED BY LAW:
                                    </p>
                                    
                                    <p className="text-[#adc6ff] leading-relaxed mb-4">
                                        <strong>BeamLab and its officers, directors, employees, and agents shall not be liable for:</strong>
                                    </p>
                                    <ul className="list-disc list-inside text-[#adc6ff] space-y-2 mb-4">
                                        <li>Any indirect, incidental, special, consequential, or punitive damages</li>
                                        <li>Loss of profits, revenue, data, or use</li>
                                        <li>Structural failures or safety issues resulting from use of analysis results</li>
                                        <li>Damages resulting from errors, inaccuracies, or omissions in the Service</li>
                                        <li>Interruption of service or loss of data</li>
                                        <li>Any damages arising from unauthorized access to your account</li>
                                    </ul>

                                    <p className="text-[#adc6ff] leading-relaxed mb-4">
                                        <strong>In no event shall our total liability exceed the amount you paid us in the 12 months 
                                        preceding the event giving rise to liability, or ₹5,000, whichever is greater.</strong>
                                    </p>

                                    <p className="text-[#adc6ff] leading-relaxed">
                                        The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, either 
                                        express or implied, including but not limited to warranties of merchantability, fitness for 
                                        a particular purpose, or non-infringement.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 8: Indemnification */}
                        <section id="indemnification" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-[#dae2fd] mb-4">8. Indemnification</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    You agree to indemnify, defend, and hold harmless BeamLab and its affiliates, officers, 
                                    directors, employees, agents, and licensors from and against any claims, liabilities, damages, 
                                    losses, and expenses, including reasonable attorney's fees, arising out of or in any way connected with:
                                </p>
                                <ul className="list-disc list-inside text-[#adc6ff] space-y-2">
                                    <li>Your use of the Service</li>
                                    <li>Your User Content</li>
                                    <li>Your violation of these Terms</li>
                                    <li>Your violation of any rights of another party</li>
                                    <li>Any structural designs or engineering decisions based on analysis results from the Service</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 9: Termination */}
                        <section id="termination" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-[#dae2fd] mb-4">9. Termination</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    We reserve the right to suspend or terminate your access to the Service at any time, with or 
                                    without cause, and with or without notice, for any reason including:
                                </p>
                                <ul className="list-disc list-inside text-[#adc6ff] space-y-2 mb-4">
                                    <li>Violation of these Terms</li>
                                    <li>Non-payment of fees</li>
                                    <li>Fraudulent or illegal activity</li>
                                    <li>Extended period of inactivity</li>
                                </ul>
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    You may terminate your account at any time by contacting us. Upon termination:
                                </p>
                                <ul className="list-disc list-inside text-[#adc6ff] space-y-2">
                                    <li>Your right to use the Service will immediately cease</li>
                                    <li>We may delete your User Content after a reasonable grace period</li>
                                    <li>Provisions of these Terms that by their nature should survive will survive termination</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 10: Changes to Terms */}
                        <section id="changes" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-[#dae2fd] mb-4">10. Changes to These Terms</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    We reserve the right to modify these Terms at any time. When we make changes, we will:
                                </p>
                                <ul className="list-disc list-inside text-[#adc6ff] space-y-2 mb-4">
                                    <li>Update the "Last Updated" date at the top of this page</li>
                                    <li>Notify you via email or through the Service</li>
                                    <li>Require re-acceptance for material changes</li>
                                </ul>
                                <p className="text-[#adc6ff] leading-relaxed">
                                    Your continued use of the Service after changes become effective constitutes acceptance of 
                                    the revised Terms. If you do not agree to the modified Terms, you must stop using the Service.
                                </p>
                            </div>
                        </section>

                        {/* Section 11: Governing Law */}
                        <section id="governing" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-[#dae2fd] mb-4">11. Governing Law and Disputes</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    These Terms shall be governed by and construed in accordance with the laws of the jurisdiction 
                                    in which BeamLab operates, without regard to its conflict of law provisions.
                                </p>
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    Any dispute arising out of or relating to these Terms or the Service shall be resolved through:
                                </p>
                                <ol className="list-decimal list-inside text-[#adc6ff] space-y-2 mb-4">
                                    <li>Good faith negotiations between the parties</li>
                                    <li>Mediation, if negotiations fail</li>
                                    <li>Binding arbitration or appropriate courts, as a last resort</li>
                                </ol>
                            </div>
                        </section>

                        {/* Section 12: Contact Information */}
                        <section id="contact" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold text-[#dae2fd] mb-4">12. Contact Information</h2>
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-[#adc6ff] leading-relaxed mb-4">
                                    If you have questions about these Terms of Service, please contact us:
                                </p>
                                <div className="bg-[#131b2e] rounded-lg p-6 space-y-3">
                                    <div>
                                        <p className="text-sm font-semibold text-[#dae2fd]">Email</p>
                                        <a 
                                            href="mailto:office@beamlabultimate.tech" 
                                            className="text-emerald-600 dark:text-emerald-400 hover:underline"
                                        >
                                            office@beamlabultimate.tech
                                        </a>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-[#dae2fd]">Website</p>
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

                        {/* Acceptance Footer */}
                        <div className="border-t border-[#1a2333] pt-8">
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-[#1a2333] rounded-lg p-6">
                                <p className="text-sm text-emerald-900 dark:text-emerald-100 mb-4">
                                    <strong>Acknowledgment:</strong> By creating an account and using BeamLab, you acknowledge 
                                    that you have read, understood, and agree to be bound by these Terms of Service.
                                </p>
                                <p className="text-xs text-emerald-800 dark:text-emerald-200">
                                    Version 1.0 | Effective Date: January 7, 2026
                                </p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Footer */}
            <footer className="border-t border-[#1a2333] bg-[#0b1326] mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-[#869ab8]">
                            © {new Date().getFullYear()} BeamLab. All rights reserved.
                        </p>
                        <div className="flex gap-6">
                            <Link to="/privacy-policy" className="text-sm text-[#869ab8] hover:text-slate-900 dark:hover:text-white transition-colors">
                                Privacy Policy
                            </Link>
                            <Link to="/terms-of-service" className="text-sm text-[#869ab8] hover:text-slate-900 dark:hover:text-white transition-colors">
                                Terms of Service
                            </Link>
                            <a href="mailto:office@beamlabultimate.tech" className="text-sm text-[#869ab8] hover:text-slate-900 dark:hover:text-white transition-colors">
                                Contact
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default memo(TermsOfServicePage);
