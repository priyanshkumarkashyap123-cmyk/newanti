import { Link } from 'react-router-dom';

export default function CivilEngineeringBookLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-900 via-slate-100 dark:via-slate-800 to-slate-50 dark:to-slate-900 
      flex flex-col items-center justify-start p-8 overflow-y-auto">

      <div className="text-center mb-12 mt-8">
        <h1 className="text-4xl md:text-5xl font-serif text-amber-100 mb-4">
          🏛️ Civil Engineering Hub
        </h1>
        <p className="text-amber-200/60 text-lg max-w-lg mx-auto">
          Comprehensive suite for Hydraulic, Transportation, and Construction Management.
        </p>
      </div>

      {/* Engineering Tools */}
      <div className="max-w-6xl w-full mb-16">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 border-b border-white/10 pb-2">Engineering Tools</h2>
        <div className="grid md:grid-cols-3 gap-6">

          {/* Hydraulics */}
          <Link to="/civil/hydraulics"
            className="group relative p-6 rounded-xl bg-gradient-to-br from-cyan-900/40 to-slate-800/40 
              border border-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300
              hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">💧</div>
            <h3 className="text-xl font-bold text-cyan-100 mb-2">Hydraulics</h3>
            <p className="text-cyan-200/50 text-sm">
              Open channel flow, pipe networks, culvert design, and storm drainage analysis.
            </p>
          </Link>

          {/* Transportation */}
          <Link to="/civil/transportation"
            className="group relative p-6 rounded-xl bg-gradient-to-br from-orange-900/40 to-slate-800/40 
              border border-orange-500/20 hover:border-orange-400/50 transition-all duration-300
              hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🛣️</div>
            <h3 className="text-xl font-bold text-orange-100 mb-2">Transportation</h3>
            <p className="text-orange-200/50 text-sm">
              Highway geometric design, pavement design (flexible/rigid), and traffic analysis.
            </p>
          </Link>

          {/* Construction */}
          <Link to="/civil/construction"
            className="group relative p-6 rounded-xl bg-gradient-to-br from-emerald-900/40 to-slate-800/40 
              border border-emerald-500/20 hover:border-emerald-400/50 transition-all duration-300
              hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🏗️</div>
            <h3 className="text-xl font-bold text-emerald-100 mb-2">Construction</h3>
            <p className="text-emerald-200/50 text-sm">
              Project scheduling (CPM/PERT), cost estimation, and risk analysis.
            </p>
          </Link>

        </div>
      </div>

      {/* Knowledge Base */}
      <div className="max-w-6xl w-full">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 border-b border-white/10 pb-2">Knowledge Base & Guides</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <Link to="/civil-engineering/book"
            className="group relative p-8 rounded-2xl bg-gradient-to-br from-amber-900/40 to-slate-800/40 
              border border-amber-500/20 hover:border-amber-400/40 transition-all duration-300">
            <h2 className="text-xl font-serif text-amber-100 mb-2">📖 Classic Guide</h2>
            <p className="text-amber-200/50 text-sm">Clean book interface for reading design standards.</p>
          </Link>

          <Link to="/civil-engineering/book/realistic"
            className="group relative p-8 rounded-2xl bg-gradient-to-br from-amber-900/40 to-slate-800/40 
              border border-amber-500/20 hover:border-amber-400/40 transition-all duration-300">
            <h2 className="text-xl font-serif text-amber-100 mb-2">📚 Realistic Edition</h2>
            <p className="text-amber-200/50 text-sm">Immersive 3D book experience with page tuning.</p>
          </Link>
        </div>
      </div>

      {/* Back link */}
      <div className="mt-16">
        <Link to="/stream"
          className="text-amber-400/40 hover:text-amber-400/70 text-sm transition-colors">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

