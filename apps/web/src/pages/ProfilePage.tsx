import { useState, useEffect } from 'react';
import { UserButton, useUser } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../providers/AuthProvider';
import { API_CONFIG } from '../config/env';

const DESIGN_CODES = ['IS 456', 'IS 800', 'ACI 318', 'AISC 360', 'EC2', 'EC3', 'NDS 2018'];
const UNIT_SYSTEMS = ['SI (kN, m, MPa)', 'Metric (kN, mm, N/mm²)', 'Imperial (kip, ft, ksi)'];

interface QuotaStatus {
  projectsRemaining: number | null;
  computeUnitsRemaining: number | null;
  projectsCreated: number;
  computeUnitsUsed: number;
}

export const ProfilePage = () => {
  const { user } = useUser();
  const { subscription } = useSubscription();
  const { getToken } = useAuth();
  const [quota, setQuota] = useState<QuotaStatus | null>(null);

  const [firm, setFirm] = useState('');
  const [designation, setDesignation] = useState('');
  const [preferredCode, setPreferredCode] = useState('IS 456');
  const [unitSystem, setUnitSystem] = useState('SI (kN, m, MPa)');
  const [saved, setSaved] = useState(false);

  // Fetch quota status
  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      return fetch(`${API_CONFIG.baseUrl}/api/user/quota`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }).then((res) => {
      if (!res || !res.ok || cancelled) return;
      return res.json();
    }).then((body) => {
      if (!body || cancelled) return;
      const d = body.data ?? body;
      setQuota({
        projectsRemaining: d.projectsRemaining ?? null,
        computeUnitsRemaining: d.computeUnitsRemaining ?? null,
        projectsCreated: d.projectsCreated ?? 0,
        computeUnitsUsed: d.computeUnitsUsed ?? 0,
      });
    }).catch(() => { /* quota fetch is non-critical */ });
    return () => { cancelled = true; };
  }, [getToken]);

  // Load any previously saved preferences on first mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('beamlab-profile-prefs');
      if (stored) {
        const { firm: f, designation: d, preferredCode: pc, unitSystem: us } = JSON.parse(stored) as {
          firm?: string; designation?: string; preferredCode?: string; unitSystem?: string;
        };
        if (f)  setFirm(f);
        if (d)  setDesignation(d);
        if (pc) setPreferredCode(pc);
        if (us) setUnitSystem(us);
      }
    } catch { /* corrupt storage — silently ignore */ }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Persisted locally until backend profile API is available
    localStorage.setItem(
      'beamlab-profile-prefs',
      JSON.stringify({ firm, designation, preferredCode, unitSystem })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-full bg-[#0b1326] text-slate-900 dark:text-slate-50 p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Account section */}
        <section className="rounded-2xl border border-[#1a2333] bg-[#0b1326] p-6">
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="mt-1 text-sm text-[#869ab8]">
            Manage your account details and engineering profile settings.
          </p>

          <div className="mt-6 flex items-start gap-5">
            <UserButton />
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-semibold">Name:</span> {user?.fullName ?? '—'}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Email:</span> {user?.primaryEmailAddress?.emailAddress ?? '—'}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Member since:</span>{' '}
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Subscription & Quota section */}
        <section className="rounded-2xl border border-[#1a2333] bg-[#0b1326] p-6">
          <h2 className="text-lg font-semibold">Subscription &amp; Usage</h2>
          <p className="mt-1 text-sm text-[#869ab8]">
            Your current plan and today's remaining quota.
          </p>
          <div className="mt-5 grid sm:grid-cols-3 gap-4">
            {/* Current tier */}
            <div className="rounded-xl border border-[#1a2333] bg-[#131b2e] p-4">
              <p className="text-xs text-[#869ab8] uppercase tracking-widest mb-1">Plan</p>
              <p className={`text-lg font-bold ${
                subscription.tier === 'enterprise'
                  ? 'text-purple-400'
                  : subscription.tier === 'pro'
                    ? 'text-blue-400'
                    : 'text-slate-300'
              }`}>
                {subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}
              </p>
            </div>
            {/* Projects remaining */}
            <div className="rounded-xl border border-[#1a2333] bg-[#131b2e] p-4">
              <p className="text-xs text-[#869ab8] uppercase tracking-widest mb-1">Projects today</p>
              <p className="text-lg font-bold text-[#dae2fd]">
                {quota
                  ? quota.projectsRemaining === null
                    ? 'Unlimited'
                    : `${quota.projectsRemaining} remaining`
                  : '—'}
              </p>
              {quota && quota.projectsRemaining !== null && (
                <p className="text-xs text-[#869ab8] mt-0.5">{quota.projectsCreated} created today</p>
              )}
            </div>
            {/* Compute units remaining */}
            <div className="rounded-xl border border-[#1a2333] bg-[#131b2e] p-4">
              <p className="text-xs text-[#869ab8] uppercase tracking-widest mb-1">Compute units today</p>
              <p className="text-lg font-bold text-[#dae2fd]">
                {quota
                  ? quota.computeUnitsRemaining === null
                    ? 'Unlimited'
                    : `${quota.computeUnitsRemaining} remaining`
                  : '—'}
              </p>
              {quota && quota.computeUnitsRemaining !== null && (
                <p className="text-xs text-[#869ab8] mt-0.5">{quota.computeUnitsUsed} used today</p>
              )}
            </div>
          </div>
        </section>

        {/* Professional details form */}
        <section className="rounded-2xl border border-[#1a2333] bg-[#0b1326] p-6">
          <h2 className="text-lg font-semibold">Professional Details</h2>
          <p className="mt-1 text-sm text-[#869ab8]">
            Set your engineering firm, role, and preferred design code defaults.
          </p>

          <form onSubmit={handleSave} className="mt-6 grid sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="firm" className="text-sm font-medium tracking-wide tracking-wide">Engineering Firm / Organisation</label>
              <input
                id="firm"
                type="text"
                value={firm}
                onChange={(e) => setFirm(e.target.value)}
                placeholder="e.g. Tata Projects, AECOM, Self-employed"
                maxLength={120}
                className="rounded-lg border border-[#1a2333] bg-[#131b2e] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="designation" className="text-sm font-medium tracking-wide tracking-wide">Designation / Role</label>
              <input
                id="designation"
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Senior Structural Engineer"
                maxLength={120}
                className="rounded-lg border border-[#1a2333] bg-[#131b2e] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="preferredCode" className="text-sm font-medium tracking-wide tracking-wide">Preferred Design Code</label>
              <select
                id="preferredCode"
                value={preferredCode}
                onChange={(e) => setPreferredCode(e.target.value)}
                className="rounded-lg border border-[#1a2333] bg-[#131b2e] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DESIGN_CODES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="unitSystem" className="text-sm font-medium tracking-wide tracking-wide">Unit System</label>
              <select
                id="unitSystem"
                value={unitSystem}
                onChange={(e) => setUnitSystem(e.target.value)}
                className="rounded-lg border border-[#1a2333] bg-[#131b2e] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {UNIT_SYSTEMS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 flex items-center gap-4">
              <button
                type="submit"
                className="rounded-lg bg-gradient-to-r from-[#4d8eff] to-[#3b72cc] hover:from-[#3b72cc] hover:to-[#2a5599] text-white shadow-[0_0_15px_rgba(77,142,255,0.3)] hover:shadow-[0_0_20px_rgba(77,142,255,0.5)] text-sm font-semibold px-5 py-2 transition-colors"
              >
                Save Preferences
              </button>
              {saved && (
                <span className="text-sm text-emerald-500 font-medium tracking-wide tracking-wide">Saved successfully!</span>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default ProfilePage;
