
import { FC } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Users, Globe, Target, Award, ArrowRight } from 'lucide-react';

export const AboutPage: FC = () => {
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
                        <Link to="/contact" className="text-zinc-600 dark:text-zinc-300 hover:text-blue-600 text-sm font-medium transition-colors">Contact</Link>
                    </nav>
                </div>
            </header>

            <main className="flex-1">
                {/* Hero Section */}
                <section className="bg-white dark:bg-zinc-900 py-20 px-6">
                    <div className="max-w-4xl mx-auto text-center">
                        <h1 className="text-4xl md:text-6xl font-bold text-zinc-900 dark:text-white mb-6">
                            Building the Future of <br />
                            <span className="text-blue-600">Structural Engineering</span>
                        </h1>
                        <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
                            BeamLab Ultimate is a next-generation cloud platform designed to make professional structural analysis accessible, fast, and collaborative.
                        </p>
                    </div>
                </section>

                {/* Mission Grid */}
                <section className="py-20 px-6 bg-zinc-50 dark:bg-zinc-950/50">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div className="flex flex-col gap-4">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                <Target className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Our Mission</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                To democratize advanced structural analysis tools, removing barriers of cost and complexity for engineers, students, and firms worldwide.
                            </p>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                                <Globe className="w-6 h-6 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Global Reach</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                Used by engineers in over 50 countries, supporting international design codes (IS, AISC, Eurocode) to foster global collaboration.
                            </p>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                                <Award className="w-6 h-6 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Excellence</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                We combine rigorous engineering standards with cutting-edge web technology (WASM, WebGL, AI) to deliver uncompromised precision and speed.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Team Section */}
                <section className="py-20 px-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                            <div>
                                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Developed By</h2>
                                <p className="text-zinc-500 dark:text-zinc-400">The minds behind the platform.</p>
                            </div>
                            <Link to="/contact" className="text-blue-600 font-bold flex items-center gap-2 hover:gap-3 transition-all">
                                Join our team <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {/* Lead Developer */}
                            <div className="group">
                                <div className="aspect-square bg-zinc-200 dark:bg-zinc-800 rounded-2xl mb-4 overflow-hidden relative">
                                    <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
                                        <Users className="w-12 h-12" />
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Rakshit Tiwari</h3>
                                <p className="text-sm text-blue-600 font-medium mb-2">Lead Architect & Developer</p>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Full-stack engineer passionate about structural mechanics and high-performance computing.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-8 text-center text-sm text-zinc-500">
                <p>© 2026 BeamLab Ultimate. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default AboutPage;
