/**
 * AboutPage - Company About Page
 * Dark theme matching landing page design system
 */

import { FC, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Globe, Target, Award, ArrowRight, Rocket, Code, Lightbulb } from 'lucide-react';
import beamLabLogo from '../assets/beamlab_logo.png';
import { Button } from '../components/ui/button';

const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
};

export const AboutPage: FC = () => {
    useEffect(() => { document.title = 'About - BeamLab'; }, []);

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col font-sans selection:bg-blue-500/30">
            {/* Header - Dark Theme */}
            <nav className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/90 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <Link to="/" className="flex items-center gap-3 group">
                            <div className="relative w-9 h-9 flex items-center justify-center rounded-lg shadow-lg overflow-hidden">
                                <img src={beamLabLogo} alt="BeamLab" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                                BeamLab Ultimate
                            </span>
                        </Link>
                        <div className="hidden md:flex items-center gap-8">
                            <Link to="/pricing" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors">Pricing</Link>
                            <Link to="/contact" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors">Contact</Link>
                            <Link to="/sign-in" className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors">Log in</Link>
                            <Button asChild className="px-5 py-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors">
                                <Link to="/sign-up">Get Started</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-1">
                {/* Hero Section */}
                <section className="py-24 px-6 relative overflow-hidden">
                    {/* Background blobs */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                        <div className="absolute top-20 left-10 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] opacity-60" />
                        <div className="absolute bottom-0 right-10 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] opacity-60" />
                    </div>

                    <motion.div {...fadeInUp} className="max-w-4xl mx-auto text-center relative z-10">
                        <span className="text-blue-400 text-sm font-semibold uppercase tracking-wider">
                            About Us
                        </span>
                        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mt-4 mb-6">
                            Building the Future of<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400">
                                Structural Engineering
                            </span>
                        </h1>
                        <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
                            BeamLab Ultimate is a next-generation cloud platform designed to make professional structural analysis accessible, fast, and collaborative.
                        </p>
                    </motion.div>
                </section>

                {/* Mission Grid */}
                <section className="py-20 px-6 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="flex flex-col gap-4 p-6 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover-lift"
                        >
                            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                <Target className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Our Mission</h3>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                To democratize advanced structural analysis tools, removing barriers of cost and complexity for engineers, students, and firms worldwide.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="flex flex-col gap-4 p-6 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover-lift"
                        >
                            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                                <Globe className="w-6 h-6 text-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Global Reach</h3>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                Used by engineers in over 50 countries, supporting international design codes (IS, AISC, Eurocode) to foster global collaboration.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="flex flex-col gap-4 p-6 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover-lift"
                        >
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                                <Award className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Excellence</h3>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                We combine rigorous engineering standards with cutting-edge web technology (WASM, WebGL, AI) to deliver uncompromised precision.
                            </p>
                        </motion.div>
                    </div>
                </section>

                {/* Technology Section */}
                <section className="py-20 px-6">
                    <div className="max-w-7xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            className="text-center mb-12"
                        >
                            <span className="text-blue-400 text-sm font-semibold uppercase tracking-wider">
                                Our Technology
                            </span>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                                Built for the Modern Era
                            </h2>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="text-center p-6"
                            >
                                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                    <Rocket className="w-7 h-7 text-blue-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">WebAssembly Powered</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm">
                                    Near-native performance in the browser using compiled WASM solvers.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                                className="text-center p-6"
                            >
                                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                    <Code className="w-7 h-7 text-purple-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Real-time Collaboration</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm">
                                    Work together with your team using live sync and shared sessions.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 }}
                                className="text-center p-6"
                            >
                                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                                    <Lightbulb className="w-7 h-7 text-emerald-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">AI-Assisted Design</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm">
                                    Intelligent recommendations powered by machine learning models.
                                </p>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* Team Section */}
                <section className="py-20 px-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                            <div>
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Developed By</h2>
                                <p className="text-slate-600 dark:text-slate-400">The minds behind the platform.</p>
                            </div>
                            <Link to="/contact" className="text-blue-400 font-bold flex items-center gap-2 hover:gap-3 transition-all group">
                                Join our team <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="group"
                            >
                                <div className="aspect-square bg-gradient-to-br from-slate-200 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl mb-4 overflow-hidden relative border border-slate-200 dark:border-slate-800 group-hover:border-blue-500/30 transition-colors">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Users className="w-16 h-16 text-slate-700 group-hover:text-slate-500 transition-colors" />
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rakshit Tiwari</h3>
                                <p className="text-sm text-blue-400 font-medium mb-2">Lead Architect & Developer</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Full-stack engineer passionate about structural mechanics and high-performance computing.
                                </p>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-20 px-6">
                    <div className="max-w-4xl mx-auto text-center">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                            Ready to transform your workflow?
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-8">
                            Join thousands of engineers using BeamLab Ultimate every day.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button asChild className="px-8 py-3 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-lg">
                                <Link to="/sign-up">Start Free Trial</Link>
                            </Button>
                            <Button asChild variant="outline" className="px-8 py-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <Link to="/demo">View Demo</Link>
                            </Button>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-8 text-center text-sm text-slate-600 dark:text-slate-400">
                <p>© {new Date().getFullYear()} BeamLab Ultimate. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default AboutPage;
