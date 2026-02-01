/**
 * ContactPage - Enterprise Contact Form
 * Dark theme matching landing page design system
 */

import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, MapPin, Phone, Send, CheckCircle } from 'lucide-react';
import beamLabLogo from '../assets/beamlab_logo.png';

export const ContactPage: FC = () => {
    const [formState, setFormState] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsSubmitting(false);
        setSubmitted(true);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans selection:bg-blue-500/30">
            {/* Header - Dark Theme */}
            <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <Link to="/" className="flex items-center gap-3 group">
                            <div className="relative w-9 h-9 flex items-center justify-center rounded-lg shadow-lg overflow-hidden">
                                <img src={beamLabLogo} alt="BeamLab" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                                BeamLab Ultimate
                            </span>
                        </Link>
                        <div className="hidden md:flex items-center gap-8">
                            <Link to="/pricing" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Pricing</Link>
                            <Link to="/help" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Help</Link>
                            <Link to="/sign-in" className="text-slate-300 hover:text-white text-sm font-medium transition-colors">Log in</Link>
                            <Link to="/sign-up" className="px-5 py-2 rounded-full bg-white text-slate-950 text-sm font-bold hover:bg-slate-100 transition-colors">
                                Get Started
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-16 lg:py-24">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
                    {/* Contact Info */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-10"
                    >
                        <div>
                            <span className="text-blue-400 text-sm font-semibold uppercase tracking-wider">
                                Contact Us
                            </span>
                            <h1 className="text-4xl md:text-5xl font-bold text-white mt-2 mb-6">
                                Get in touch
                            </h1>
                            <p className="text-lg text-slate-400 leading-relaxed">
                                Have questions about our Enterprise plans, need a custom integration, or just want to say hi? We'd love to hear from you.
                            </p>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div className="flex items-start gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800 hover-lift">
                                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">Email Us</h3>
                                    <p className="text-slate-400 mb-2">Our friendly team is here to help.</p>
                                    <a href="mailto:support@beamlabultimate.tech" className="text-blue-400 font-medium hover:text-blue-300 transition-colors">
                                        support@beamlabultimate.tech
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800 hover-lift">
                                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-6 h-6 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">Office</h3>
                                    <p className="text-slate-400">
                                        123 Innovation Park, Tech Hub<br />
                                        Bangalore, Karnataka 560100<br />
                                        India
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800 hover-lift">
                                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Phone className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">Phone</h3>
                                    <p className="text-slate-400 mb-2">Mon-Fri from 9am to 6pm IST.</p>
                                    <a href="tel:+919876543210" className="text-blue-400 font-medium hover:text-blue-300 transition-colors">
                                        +91 98765 43210
                                    </a>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Contact Form */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl"
                    >
                        {submitted ? (
                            <div className="h-full flex flex-col items-center justify-center text-center py-12">
                                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-6 animate-success">
                                    <CheckCircle className="w-8 h-8 text-green-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Message Sent!</h3>
                                <p className="text-slate-400">
                                    Thanks for reaching out. We'll get back to you shortly.
                                </p>
                                <button
                                    onClick={() => setSubmitted(false)}
                                    className="mt-8 text-blue-400 font-medium hover:text-blue-300 transition-colors"
                                >
                                    Send another message
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="name" className="text-sm font-bold text-slate-300">Name</label>
                                        <input
                                            type="text"
                                            id="name"
                                            required
                                            className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-500"
                                            placeholder="Your name"
                                            value={formState.name}
                                            onChange={e => setFormState({ ...formState, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="email" className="text-sm font-bold text-slate-300">Email</label>
                                        <input
                                            type="email"
                                            id="email"
                                            required
                                            className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-500"
                                            placeholder="you@company.com"
                                            value={formState.email}
                                            onChange={e => setFormState({ ...formState, email: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label htmlFor="subject" className="text-sm font-bold text-slate-300">Subject</label>
                                    <select
                                        id="subject"
                                        className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        value={formState.subject}
                                        onChange={e => setFormState({ ...formState, subject: e.target.value })}
                                    >
                                        <option value="">Select a topic</option>
                                        <option value="sales">Enterprise Sales</option>
                                        <option value="support">Technical Support</option>
                                        <option value="billing">Billing Question</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label htmlFor="message" className="text-sm font-bold text-slate-300">Message</label>
                                    <textarea
                                        id="message"
                                        required
                                        rows={4}
                                        className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none placeholder:text-slate-500"
                                        placeholder="How can we help you?"
                                        value={formState.message}
                                        onChange={e => setFormState({ ...formState, message: e.target.value })}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="mt-2 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-white/20"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Send Message
                                            <Send className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </motion.div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 bg-slate-950 py-8 text-center text-sm text-slate-500">
                <p>© 2026 BeamLab Ultimate. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default ContactPage;
