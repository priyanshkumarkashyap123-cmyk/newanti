import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { API_CONFIG } from '../config/env';
import { getErrorMessage } from '../lib/errorHandling';
import { authLogger } from '../lib/logger';
import { Button } from '../components/ui/button';

const OAuthCallbackPage = () => {
    const { provider } = useParams<{ provider: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setUser, setTokens } = useAuthStore();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { document.title = 'Authenticating... | BeamLab Ultimate'; }, []);

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code');
            if (!code || !provider) {
                setError('Invalid callback parameters');
                return;
            }

            try {
                const API_URL = API_CONFIG.baseUrl;

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
            } catch (err: unknown) {
                authLogger.error('OAuth callback error:', err);
                setError(getErrorMessage(err, 'Authentication failed'));
            }
        };

        handleCallback();
    }, [provider, searchParams, navigate]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-red-500 mb-2">Login Failed</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
                    <Button variant="outline" onClick={() => navigate('/sign-in')}>
                        Return to Sign In
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
            <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Authenticating...</h2>
                <p className="text-slate-500 dark:text-slate-400">Please wait while we log you in via {provider}.</p>
            </div>
        </div>
    );
};

export default OAuthCallbackPage;
