import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { API_CONFIG } from '../config/env';
import { getErrorMessage } from '../lib/errorHandling';
import { authLogger } from '../lib/logger';
import { Button } from '../components/ui/button';
import { Cpu, AlertTriangle } from 'lucide-react';

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
                <div className="text-center max-w-sm space-y-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-red-500 mb-2">Authentication Failed</h2>
                        <p className="text-slate-500 dark:text-slate-400">{error}</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <Button variant="premium" onClick={() => navigate('/sign-in')} className="w-full">
                            Return to Sign In
                        </Button>
                        <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
                            Try Again
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const providerName = provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'provider';

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
            <div className="text-center max-w-sm space-y-8">
                {/* Branded Logo with Spinner - per Figma §4.5 */}
                <div className="relative mx-auto w-20 h-20">
                    <div className="absolute inset-0 rounded-xl border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                    <div className="absolute inset-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                        <Cpu className="w-8 h-8 text-white" />
                    </div>
                </div>

                <div>
                    <h2 className="text-xl font-bold mb-2">Completing sign in...</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Validating your credentials with {providerName}
                    </p>
                </div>

                {/* Progress Bar - per Figma §4.5 */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-[indeterminate_1.5s_ease-in-out_infinite]"
                        style={{ width: '40%', animation: 'indeterminate 1.5s ease-in-out infinite' }}
                    />
                </div>
            </div>

            {/* Indeterminate progress animation */}
            <style>{`
                @keyframes indeterminate {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(350%); }
                }
            `}</style>
        </div>
    );
};

export default OAuthCallbackPage;
