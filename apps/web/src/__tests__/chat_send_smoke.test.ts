import { describe, it, expect, vi } from 'vitest';
import { API_CONFIG } from '../config/env';

describe('chat send payload', () => {
  it('posts to /api/ai-sessions with auth header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ session: { _id: 'cloud123', messages: [] } }) });
    vi.stubGlobal('fetch', fetchSpy);

    const accessToken = 'token123';
    const payload = {
      name: 'Chat session',
      type: 'chat',
      messages: [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
      ],
    };

    await fetch(`${API_CONFIG.baseUrl}/api/ai-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      `${API_CONFIG.baseUrl}/api/ai-sessions`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${accessToken}` }),
      })
    );
  });
});
