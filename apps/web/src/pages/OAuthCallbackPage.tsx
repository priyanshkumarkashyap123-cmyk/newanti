import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const OAuthCallbackPage = () => {
    const { provider } = useParams<{ provider: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setUser, setTokens } = useAuthStore();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code');
            if (!code || !provider) {
                setError('Invalid callback parameters');
                return;
            }

            try {
                // Determine backend URL based on env or default
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

                const response = await fetch(`${API_URL}/api/auth/${provider}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });

                const data = await response.json();

                if (data.success) {
                    // Update auth store
                    setUser(data.user);
                    setTokens({
                        accessToken: data.accessToken,
                        refreshToken: data.refreshToken,
                        expiresAt: Date.now() + (15 * 60 * 1000) // 15 mins default
                    });

                    navigate('/app');
                } else {
                    setError(data.message || 'Authentication failed');
                }
            } catch (err: any) {
                console.error('OAuth callback error:', err);
                setError(err.message || 'Authentication failed');
            }
        };

        handleCallback();
    }, [provider, searchParams, navigate]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-red-500 mb-2">Login Failed</h2>
                    <p className="text-zinc-400 mb-4">{error}</p>
                    <button
                        onClick={() => navigate('/sign-in')}
                        className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 transition-colors"
                    >
                        Return to Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
            <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Authenticating...</h2>
                <p className="text-zinc-400">Please wait while we log you in via {provider}.</p>
            </div>
        </div>
    );
};

export default OAuthCallbackPage;
