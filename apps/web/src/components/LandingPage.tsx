/**
 * LandingPage - Professional marketing landing page
 * BeamLab Ultimate - Structural Engineering Platform
 */

import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { useAuth, isUsingClerk } from '../providers/AuthProvider';
import './LandingPage.css';

interface LandingPageProps {
    onEnterApp: () => void;
}

export const LandingPage: FC<LandingPageProps> = ({ onEnterApp }) => {
    // Use unified auth hook
    const { isSignedIn, isLoaded, signOut } = useAuth();
    const useClerk = isUsingClerk();

    const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

    // Render auth buttons based on auth provider
    const renderAuthButtons = () => {
        if (!isLoaded) return null;

        if (isSignedIn) {
            return (
                <>
                    <button className="btn-primary" onClick={onEnterApp}>
                        Open App
                    </button>
                    {useClerk ? (
                        <UserButton afterSignOutUrl="/" />
                    ) : (
                        <button className="btn-secondary" onClick={() => signOut()}>
                            Sign Out
                        </button>
                    )}
                </>
            );
        }

        // Not signed in
        if (useClerk) {
            return (
                <>
                    <SignInButton mode="modal">
                        <button className="btn-secondary">Sign In</button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                        <button className="btn-primary">Get Started Free</button>
                    </SignUpButton>
                </>
            );
        }

        // In-house auth
        return (
            <>
                <Link to="/sign-in" className="btn-secondary">Sign In</Link>
                <Link to="/sign-up" className="btn-primary">Get Started Free</Link>
            </>
        );
    };

    return (
        <div className="landing-container">
            {/* Navigation */}
            <nav className="landing-nav">
                <div className="landing-logo">
                    <span className="logo-icon">⬡</span>
                    <span className="logo-text">BeamLab</span>
                    <span className="logo-badge">Ultimate</span>
                </div>
                <div className="nav-links">
                    <a href="#features" className="nav-link">Features</a>
                    <a href="#pricing" className="nav-link">Pricing</a>
                    <a href="#about" className="nav-link">About</a>
                </div>
                <div className="nav-auth">
                    {renderAuthButtons()}
                </div>
            </nav>

            {/* Hero Section */}
            <section className="hero">
                <div className="hero-content">
                    <div className="hero-badge">
                        🚀 Now with IS 456 & IS 800 Design Codes
                    </div>
                    <h1 className="hero-title">
                        Professional Structural
                        <br />
                        <span className="hero-gradient">Analysis & Design</span>
                    </h1>
                    <p className="hero-subtitle">
                        The next-generation structural engineering platform.
                        Analyze frames, design steel & concrete, generate reports —
                        all in your browser.
                    </p>
                    <div className="hero-cta">
                        {isSignedIn ? (
                            <button className="btn-large" onClick={onEnterApp}>
                                Launch BeamLab →
                            </button>
                        ) : useClerk ? (
                            <SignUpButton mode="modal">
                                <button className="btn-large">
                                    Start Free Trial →
                                </button>
                            </SignUpButton>
                        ) : (
                            <button className="btn-large" onClick={onEnterApp}>
                                Try Demo (No Login Required) →
                            </button>
                        )}
                        <span className="hero-note">No credit card required</span>
                    </div>
                </div>
                <div className="hero-visual">
                    <div className="hero-frame">
                        <div className="hero-mockup">
                            <div className="mockup-header">
                                <span className="mockup-dot red" />
                                <span className="mockup-dot yellow" />
                                <span className="mockup-dot green" />
                            </div>
                            <div className="mockup-content">
                                <svg viewBox="0 0 200 120" className="mockup-svg">
                                    <defs>
                                        <linearGradient id="beamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#3B82F6" />
                                            <stop offset="100%" stopColor="#8B5CF6" />
                                        </linearGradient>
                                    </defs>
                                    <line x1="30" y1="100" x2="30" y2="40" stroke="url(#beamGrad)" strokeWidth="3" />
                                    <line x1="100" y1="100" x2="100" y2="40" stroke="url(#beamGrad)" strokeWidth="3" />
                                    <line x1="170" y1="100" x2="170" y2="40" stroke="url(#beamGrad)" strokeWidth="3" />
                                    <line x1="30" y1="40" x2="170" y2="40" stroke="url(#beamGrad)" strokeWidth="3" />
                                    <line x1="30" y1="70" x2="170" y2="70" stroke="url(#beamGrad)" strokeWidth="2" strokeOpacity="0.6" />
                                    <circle cx="30" cy="40" r="4" fill="#22C55E" />
                                    <circle cx="100" cy="40" r="4" fill="#22C55E" />
                                    <circle cx="170" cy="40" r="4" fill="#22C55E" />
                                    <polygon points="30,100 25,110 35,110" fill="#FACC15" />
                                    <polygon points="100,100 95,110 105,110" fill="#FACC15" />
                                    <polygon points="170,100 165,110 175,110" fill="#FACC15" />
                                    <line x1="65" y1="20" x2="65" y2="38" stroke="#EF4444" strokeWidth="2" />
                                    <polygon points="65,40 62,35 68,35" fill="#EF4444" />
                                    <line x1="135" y1="20" x2="135" y2="38" stroke="#EF4444" strokeWidth="2" />
                                    <polygon points="135,40 132,35 138,35" fill="#EF4444" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="features-section">
                <h2 className="section-title">Everything You Need</h2>
                <p className="section-subtitle">
                    Professional-grade tools for structural engineers
                </p>
                <div className="features-grid">
                    {FEATURES.map((feature, i) => (
                        <div
                            key={i}
                            className={`feature-card ${hoveredFeature === i ? 'hovered' : ''}`}
                            onMouseEnter={() => setHoveredFeature(i)}
                            onMouseLeave={() => setHoveredFeature(null)}
                        >
                            <div className="feature-icon">{feature.icon}</div>
                            <h3 className="feature-title">{feature.title}</h3>
                            <p className="feature-desc">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="pricing-section">
                <h2 className="section-title">Simple Pricing</h2>
                <p className="section-subtitle">Start free, upgrade when you need more</p>
                <div className="pricing-grid">
                    {/* Free Plan */}
                    <div className="pricing-card">
                        <h3 className="plan-name">Free</h3>
                        <div className="plan-price">
                            <span className="price-amount">₹0</span>
                            <span className="price-period">/month</span>
                        </div>
                        <ul className="plan-features">
                            <li>✓ 3 Projects</li>
                            <li>✓ Basic Analysis</li>
                            <li>✓ 2D Frame Analysis</li>
                            <li>✓ Community Support</li>
                        </ul>
                        <button className="btn-outline" onClick={onEnterApp}>Get Started</button>
                    </div>
                    {/* Pro Plan */}
                    <div className="pricing-card pro">
                        <div className="popular-badge">Most Popular</div>
                        <h3 className="plan-name">Pro</h3>
                        <div className="plan-price">
                            <span className="price-amount">₹999</span>
                            <span className="price-period">/month</span>
                        </div>
                        <ul className="plan-features">
                            <li>✓ Unlimited Projects</li>
                            <li>✓ 3D Analysis</li>
                            <li>✓ Steel Design (IS 800)</li>
                            <li>✓ Concrete Design (IS 456)</li>
                            <li>✓ Modal Analysis</li>
                            <li>✓ PDF Reports</li>
                            <li>✓ Priority Support</li>
                        </ul>
                        <button className="btn-primary">Upgrade to Pro</button>
                    </div>
                    {/* Enterprise */}
                    <div className="pricing-card">
                        <h3 className="plan-name">Enterprise</h3>
                        <div className="plan-price">
                            <span className="price-amount">Custom</span>
                        </div>
                        <ul className="plan-features">
                            <li>✓ Everything in Pro</li>
                            <li>✓ Custom Integrations</li>
                            <li>✓ On-premise Option</li>
                            <li>✓ Dedicated Support</li>
                            <li>✓ SLA Guarantee</li>
                        </ul>
                        <button className="btn-outline">Contact Sales</button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-content">
                    <div className="footer-brand">
                        <span className="logo-icon">⬡</span>
                        <span className="logo-text">BeamLab</span>
                    </div>
                    <div className="footer-links">
                        <a href="#" className="footer-link">Privacy</a>
                        <a href="#" className="footer-link">Terms</a>
                        <a href="#" className="footer-link">Contact</a>
                    </div>
                    <div className="footer-copy">
                        © 2024 BeamLab. Made in India 🇮🇳
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FEATURES = [
    { icon: '📐', title: 'Frame Analysis', desc: '2D & 3D structural analysis with stiffness matrix solver' },
    { icon: '🏗️', title: 'Steel Design', desc: 'IS 800:2007 compliance with automatic section optimization' },
    { icon: '🧱', title: 'Concrete Design', desc: 'IS 456:2000 beam, column & footing design' },
    { icon: '📊', title: 'Modal Analysis', desc: 'Dynamic analysis with mode shapes & frequencies' },
    { icon: '📄', title: 'PDF Reports', desc: 'Professional reports with diagrams & calculations' },
    { icon: '☁️', title: 'Cloud Storage', desc: 'Access your projects from anywhere, anytime' },
];

export default LandingPage;
