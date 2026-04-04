import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import GeotechnicalDesignPage from '../../pages/GeotechnicalDesignPage';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GeotechnicalDesignPage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders core geotechnical check cards and default endpoint', () => {
    render(<GeotechnicalDesignPage />);

    expect(screen.getByText('Geotechnical Design Center')).toBeTruthy();
    expect(screen.getAllByText('SPT Correlation').length).toBeGreaterThan(0);
    expect(screen.getByText('Pile Axial Capacity')).toBeTruthy();
    expect(screen.getByText('Earth Pressure (Seismic)')).toBeTruthy();

    expect(screen.getAllByText('/api/design/geotech/spt-correlation').length).toBeGreaterThan(0);
  });

  it('switches selected case and endpoint text when a different card is clicked', () => {
    render(<GeotechnicalDesignPage />);

    fireEvent.click(screen.getByRole('button', { name: /Pile Axial Capacity/i }));

    expect(screen.getAllByText('/api/design/geotech/foundation/pile-axial-capacity').length).toBeGreaterThan(0);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('unit_skin_friction_kpa');
    expect(textarea.value).toContain('unit_end_bearing_kpa');
  });

  it('submits payload to selected endpoint and renders API response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            passed: true,
            utilization: 0.61,
            message: 'Pile check OK',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<GeotechnicalDesignPage />);

    fireEvent.click(screen.getByRole('button', { name: /Pile Axial Capacity/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Check/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const [endpoint, init] = mockFetch.mock.calls[0];
    expect(endpoint).toBe('/api/design/geotech/foundation/pile-axial-capacity');
    expect(init.method).toBe('POST');

    const parsedBody = JSON.parse(init.body as string);
    expect(parsedBody).toHaveProperty('diameter_m');
    expect(parsedBody).toHaveProperty('unit_skin_friction_kpa');
    expect(parsedBody).toHaveProperty('unit_end_bearing_kpa');

    await waitFor(() => {
      expect(screen.getByText(/Pile check OK/i)).toBeTruthy();
      expect(screen.getByText(/"utilization": 0.61/i)).toBeTruthy();
    });
  });

  it('shows validation error on invalid JSON payload', async () => {
    render(<GeotechnicalDesignPage />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '{invalid-json' } });

    fireEvent.click(screen.getByRole('button', { name: /Run Check/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid JSON payload/i)).toBeTruthy();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows backend-provided error message when API returns non-success payload', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: 'Liquefaction input out of range',
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<GeotechnicalDesignPage />);

    fireEvent.click(screen.getByRole('button', { name: /Liquefaction Screening/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Check/i }));

    await waitFor(() => {
      expect(screen.getByText(/Liquefaction input out of range/i)).toBeTruthy();
    });
  });

  it('prefers first validation detail message when backend returns structured details', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: [
            { path: 'kh', message: 'Number must be less than or equal to 0.6' },
          ],
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<GeotechnicalDesignPage />);

    fireEvent.click(screen.getByRole('button', { name: /Earth Pressure \(Seismic\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Check/i }));

    await waitFor(() => {
      expect(screen.getByText(/kh: Number must be less than or equal to 0.6/i)).toBeTruthy();
    });
  });

  it('renders nested gateway result envelopes without crashing', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          engine: 'rust',
          result: {
            success: true,
            result: {
              passed: true,
              utilization: 0.44,
              message: 'Nested envelope OK',
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<GeotechnicalDesignPage />);
    fireEvent.click(screen.getByRole('button', { name: /Run Check/i }));

    await waitFor(() => {
      expect(screen.getByText(/Nested envelope OK/i)).toBeTruthy();
      expect(screen.getByText(/"success": true/i)).toBeTruthy();
      expect(screen.queryByText(/"engine": "rust"/i)).toBeNull();
    });
  });

  it('resets payload editor to selected sample JSON when reset is clicked', () => {
    render(<GeotechnicalDesignPage />);

    fireEvent.click(screen.getByRole('button', { name: /Earth Pressure \(Rankine\)/i }));

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"manually":"edited"}' } });

    fireEvent.click(screen.getByRole('button', { name: /Reset Sample/i }));

    expect(textarea.value).toContain('friction_angle_deg');
    expect(textarea.value).toContain('retained_height_m');
    expect(textarea.value).not.toContain('manually');
  });
});
