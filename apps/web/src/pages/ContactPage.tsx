
import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, Send, Zap } from 'lucide-react';

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
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsSubmitting(false);
        setSubmitted(true);
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm">
                <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">BeamLab Ultimate</h2>
                    </Link>
                    <nav className="hidden md:flex items-center gap-8">
                        <Link to="/pricing" className="text-zinc-600 dark:text-zinc-300 hover:text-blue-600 text-sm font-medium transition-colors">Pricing</Link>
                        <Link to="/help" className="text-zinc-600 dark:text-zinc-300 hover:text-blue-600 text-sm font-medium transition-colors">Help</Link>
                    </nav>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 lg:py-20">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
                    {/* Contact Info */}
                    <div className="flex flex-col gap-8">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-6">
                                Get in touch
                            </h1>
                            <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                Have questions about our Enterprise plans, need a custom integration, or just want to say hi? We'd love to hear from you.
                            </p>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Email Us</h3>
                                    <p className="text-zinc-600 dark:text-zinc-400 mb-1">Our friendly team is here to help.</p>
                                    <a href="mailto:support@beamlabultimate.tech" className="text-blue-600 font-medium hover:underline">support@beamlabultimate.tech</a>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Office</h3>
                                    <p className="text-zinc-600 dark:text-zinc-400">
                                        123 Innovation Park, Tech Hub<br />
                                        Bangalore, Karnataka 560100<br />
                                        India
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Phone className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Phone</h3>
                                    <p className="text-zinc-600 dark:text-zinc-400 mb-1">Mon-Fri from 9am to 6pm IST.</p>
                                    <a href="tel:+919876543210" className="text-blue-600 font-medium hover:underline">+91 98765 43210</a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="bg-white dark:bg-zinc-800 p-8 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-700">
                        {submitted ? (
                            <div className="h-full flex flex-col items-center justify-center text-center py-12">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                                    <div className="w-8 h-8 rounded-full bg-green-500 animate-pulse" />
                                </div>
                                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Message Sent!</h3>
                                <p className="text-zinc-600 dark:text-zinc-400">
                                    Thanks for reaching out. We'll get back to you shortly.
                                </p>
                                <button
                                    onClick={() => setSubmitted(false)}
                                    className="mt-8 text-blue-600 font-medium hover:underline"
                                >
                                    Send another message
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="name" className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Name</label>
                                        <input
                                            type="text"
                                            id="name"
                                            required
                                            className="px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            placeholder="Your name"
                                            value={formState.name}
                                            onChange={e => setFormState({ ...formState, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="email" className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Email</label>
                                        <input
                                            type="email"
                                            id="email"
                                            required
                                            className="px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            placeholder="you@company.com"
                                            value={formState.email}
                                            onChange={e => setFormState({ ...formState, email: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label htmlFor="subject" className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Subject</label>
                                    <select
                                        id="subject"
                                        className="px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                                    <label htmlFor="message" className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Message</label>
                                    <textarea
                                        id="message"
                                        required
                                        rows={4}
                                        className="px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                        placeholder="How can we help you?"
                                        value={formState.message}
                                        onChange={e => setFormState({ ...formState, message: e.target.value })}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-blue-600/20"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Send Message
                                            <Send className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </main>

            <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-8 text-center text-sm text-zinc-500">
                <p>© 2026 BeamLab Ultimate. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default ContactPage;
