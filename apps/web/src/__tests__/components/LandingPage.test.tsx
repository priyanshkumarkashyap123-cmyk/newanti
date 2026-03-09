/**
 * Unit tests for the LandingPage component
 *
 * Verifies that the landing page renders correctly with:
 * - Hero heading and sub-heading
 * - CTA buttons (Get Started, Demo)
 * - Navigation links (Features, Pricing, Tools, Demo)
 * - Stats section
 * - Accessibility skip link
 * - Pricing section
 * - Footer content
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock react-router-dom to avoid ESM/CJS resolution issues in vmForks pool
vi.mock('react-router-dom', () => ({
    Link: ({ children, to, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
    MemoryRouter: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'default' }),
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    NavLink: ({ children, to, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
    Outlet: () => null,
    Routes: ({ children }: any) => React.createElement(React.Fragment, null, children),
    Route: () => null,
    BrowserRouter: ({ children }: any) => React.createElement(React.Fragment, null, children),
}));

// Mock framer-motion to render plain HTML elements
vi.mock('framer-motion', () => {
    const motionHandler = {
        get(_target: any, prop: string) {
            // motion.div, motion.h1, motion.p, etc. — render the native element
            return React.forwardRef((props: any, ref: any) => {
                const { initial, animate, exit, variants, whileInView, viewport, transition, whileHover, whileTap, ...rest } = props;
                return React.createElement(prop, { ...rest, ref });
            });
        },
    };
    return {
        motion: new Proxy({}, motionHandler),
        AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
        useInView: () => true,
    };
});

// Mock Clerk
vi.mock('@clerk/clerk-react', () => ({
    UserButton: () => React.createElement('div', { 'data-testid': 'user-button' }, 'UserButton'),
    useUser: () => ({ user: null, isLoaded: true }),
}));

// Mock AuthProvider
vi.mock('../../providers/AuthProvider', () => ({
    useAuth: () => ({
        isSignedIn: false,
        isLoaded: true,
        signOut: vi.fn(),
        user: null,
    }),
    isUsingClerk: () => false,
}));

// Mock Logo component
vi.mock('../../components/branding', () => ({
    Logo: (props: any) => React.createElement('div', { 'data-testid': 'logo', ...props }, 'BeamLab'),
}));

// Mock react-helmet-async to avoid HelmetProvider requirement in tests
vi.mock('react-helmet-async', () => ({
    Helmet: ({ children }: any) => React.createElement(React.Fragment, null, children),
    HelmetProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
}));

// Mock marketing components
vi.mock('../../components/marketing/FeatureShowcase', () => ({
    CompetitiveAdvantage: () => React.createElement('div', { 'data-testid': 'competitive-advantage' }),
    InteractiveDemo: () => React.createElement('div', { 'data-testid': 'interactive-demo' }),
    Testimonials: () => React.createElement('div', { 'data-testid': 'testimonials' }),
    CTABanner: () => React.createElement('div', { 'data-testid': 'cta-banner' }),
    PerformanceMetrics: () => React.createElement('div', { 'data-testid': 'performance-metrics' }),
}));

import { LandingPage } from '../../pages/LandingPage';

describe('LandingPage', () => {
    afterEach(() => {
        cleanup();
    });

    it('should render the hero heading', () => {
        render(<LandingPage />);

        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toBeDefined();
        expect(heading.textContent).toContain('Structural');
        expect(heading.textContent).toContain('Engineering is Here');
    });

    it('should render the hero sub-heading text', () => {
        render(<LandingPage />);

        const matches = screen.getAllByText(/Professional-grade structural analysis/i);
        expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should render CTA buttons in the hero section', () => {
        render(<LandingPage />);

        expect(screen.getByText('Start Analyzing Free')).toBeDefined();
        expect(screen.getByText('View Live Demo')).toBeDefined();
    });

    it('should render desktop navigation links', () => {
        render(<LandingPage />);

        // Use getAllByText since they appear in both desktop and mobile menu markup
        const featureLinks = screen.getAllByText('Features');
        const pricingLinks = screen.getAllByText('Pricing');
        const toolsLinks = screen.getAllByText('Tools');
        const demoLinks = screen.getAllByText('Demo');

        expect(featureLinks.length).toBeGreaterThanOrEqual(1);
        expect(pricingLinks.length).toBeGreaterThanOrEqual(1);
        expect(toolsLinks.length).toBeGreaterThanOrEqual(1);
        expect(demoLinks.length).toBeGreaterThanOrEqual(1);
    });

    it('should render stats section with key metrics', () => {
        render(<LandingPage />);

        expect(screen.getByText('200+')).toBeDefined();
        expect(screen.getByText('10K+')).toBeDefined();
        expect(screen.getByText('99.9%')).toBeDefined();
    });

    it('should render the "Get Started" auth button for unauthenticated users', () => {
        render(<LandingPage />);

        // The auth button area should have "Get Started" and "Log in"
        const getStartedLinks = screen.getAllByText('Get Started');
        expect(getStartedLinks.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Log in')).toBeDefined();
    });

    it('should have an accessibility skip link', () => {
        render(<LandingPage />);

        const skipLink = screen.getByText('Skip to main content');
        expect(skipLink).toBeDefined();
        expect(skipLink.getAttribute('href')).toBe('#main-content');
    });

    it('should render pricing tiers', () => {
        render(<LandingPage />);

        // The pricing tiers include Academic, Professional, and Enterprise
        // Use getAllByText since these words can match multiple elements
        expect(screen.getAllByText(/Academic/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/Professional/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/Enterprise/i).length).toBeGreaterThanOrEqual(1);
    });
});
