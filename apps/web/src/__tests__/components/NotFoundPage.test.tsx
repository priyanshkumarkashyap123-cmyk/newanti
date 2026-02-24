/**
 * Unit tests for the NotFoundPage component
 * 
 * Verifies that the 404 page renders correctly with:
 * - Proper heading and description
 * - Navigation links (home, dashboard, demo)
 * - Support link
 * 
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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

import { NotFoundPage } from '../../pages/NotFoundPage';

function renderWithRouter() {
    return render(
        <NotFoundPage />
    );
}

describe('NotFoundPage', () => {
    it('should render 404 heading', () => {
        renderWithRouter();
        expect(screen.getByText('404')).toBeDefined();
    });

    it('should render "Page Not Found" message', () => {
        renderWithRouter();
        expect(screen.getByText('Page Not Found')).toBeDefined();
    });

    it('should render navigation links', () => {
        renderWithRouter();
        expect(screen.getByText('Go Home')).toBeDefined();
        expect(screen.getByText('Dashboard')).toBeDefined();
        expect(screen.getByText('Try Demo')).toBeDefined();
    });

    it('should render support link', () => {
        renderWithRouter();
        expect(screen.getByText('Contact support')).toBeDefined();
    });

    it('should have correct link destinations', () => {
        renderWithRouter();
        const homeLink = screen.getByText('Go Home').closest('a');
        const dashLink = screen.getByText('Dashboard').closest('a');
        const demoLink = screen.getByText('Try Demo').closest('a');

        expect(homeLink?.getAttribute('href')).toBe('/');
        expect(dashLink?.getAttribute('href')).toBe('/stream');
        expect(demoLink?.getAttribute('href')).toBe('/demo');
    });
});
