/**
 * Unit tests for the NotFoundPage component
 * 
 * Verifies that the 404 page renders correctly with:
 * - Proper heading and description
 * - Navigation links (home, dashboard, demo)
 * - Support link
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from '../../pages/NotFoundPage';

function renderWithRouter() {
    return render(
        <MemoryRouter>
            <NotFoundPage />
        </MemoryRouter>
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
