/**
 * Dynamic Analysis Page - Comprehensive Dynamic/Vibration Analysis Hub
 * Central hub for all dynamic analysis types
 * 
 * Features:
 * - Modal Analysis (eigenvalue)
 * - Response Spectrum Analysis (RSA)
 * - Time History Analysis
 * - Harmonic Analysis
 * - Random Vibration Analysis
 * - Floor Vibration Serviceability
 */

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Waves,
  BarChart3,
  TrendingUp,
  Zap,
  ArrowRight,
  ArrowLeft,
  Home,
  Gauge,
  Radio,
  Volume2,
  Building2,
  Target
} from 'lucide-react';

interface AnalysisCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  link: string;
  tags: string[];
  status: 'ready' | 'beta' | 'coming';
}

const analysisTypes: AnalysisCard[] = [
  {
    id: 'modal',
    title: 'Modal Analysis',
    description: 'Natural frequencies, mode shapes, and mass participation factors per IS 1893, ASCE 7, Eurocode 8',
    icon: Activity,
    color: 'from-indigo-600 to-purple-600',
    link: '/analysis/modal-page',
    tags: ['Eigenvalue', 'Frequencies', 'Mode Shapes'],
    status: 'ready'
  },
  {
    id: 'rsa',
    title: 'Response Spectrum Analysis',
    description: 'Seismic response using CQC, SRSS, ABSSUM combination methods with code-based spectra',
    icon: Waves,
    color: 'from-blue-600 to-cyan-600',
    link: '/analysis/seismic',
    tags: ['Seismic', 'IS 1893', 'ASCE 7'],
    status: 'ready'
  },
  {
    id: 'time-history',
    title: 'Time History Analysis',
    description: 'Nonlinear dynamic analysis with real earthquake records, Newmark-β, HHT-α integration',
    icon: TrendingUp,
    color: 'from-emerald-600 to-teal-600',
    link: '/analysis/time-history-page',
    tags: ['Newmark', 'HHT-α', 'Ground Motion'],
    status: 'ready'
  },
  {
    id: 'pushover',
    title: 'Pushover Analysis',
    description: 'Nonlinear static analysis for performance-based design per ATC-40, FEMA 356, ASCE 41',
    icon: Target,
    color: 'from-amber-600 to-orange-600',
    link: '/analysis/pushover',
    tags: ['PBSD', 'Capacity Curve', 'Hinge Status'],
    status: 'ready'
  },
  {
    id: 'harmonic',
    title: 'Harmonic Analysis',
    description: 'Steady-state response to harmonic loading, frequency response functions, resonance detection',
    icon: Radio,
    color: 'from-pink-600 to-rose-600',
    link: '/analysis/time-history-page?mode=harmonic',
    tags: ['FRF', 'Resonance', 'Machinery'],
    status: 'ready'
  },
  {
    id: 'random-vibration',
    title: 'Random Vibration',
    description: 'Power spectral density analysis, RMS response, fatigue life estimation from random excitation',
    icon: Volume2,
    color: 'from-violet-600 to-purple-600',
    link: '/analysis/time-history-page?mode=random',
    tags: ['PSD', 'RMS', 'Fatigue'],
    status: 'ready'
  },
  {
    id: 'floor-vibration',
    title: 'Floor Vibration',
    description: 'Walking-induced vibration assessment per AISC Design Guide 11, Eurocode 5 serviceability',
    icon: Building2,
    color: 'from-slate-600 to-slate-600',
    link: '/analysis/floor-vibration',
    tags: ['Serviceability', 'DG11', 'Human Comfort'],
    status: 'beta'
  },
  {
    id: 'buckling',
    title: 'Buckling Analysis',
    description: 'Linear eigenvalue buckling, critical load factors, buckling mode shapes',
    icon: Gauge,
    color: 'from-red-600 to-orange-600',
    link: '/analysis/buckling',
    tags: ['Stability', 'Critical Load', 'Euler'],
    status: 'ready'
  }
];

export const DynamicAnalysisPage: React.FC = () => {
  useEffect(() => { document.title = 'Dynamic Analysis | BeamLab'; }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 dark:from-slate-900 via-indigo-900/30 to-slate-50 dark:to-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link to="/stream" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </Link>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <Link to="/" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
              <Home className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Dynamic Analysis Hub
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Comprehensive vibration, seismic, and dynamic response analysis suite
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-8 grid grid-cols-4 gap-4">
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">8</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Analysis Types</div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="text-2xl font-bold text-emerald-400">53x</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Faster (Rust WASM)</div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="text-2xl font-bold text-blue-400">17+</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Design Codes</div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="text-2xl font-bold text-purple-400">100%</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Cloud Native</div>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Cards Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {analysisTypes.map((analysis) => {
            const Icon = analysis.icon;
            return (
              <Link
                key={analysis.id}
                to={analysis.status === 'coming' ? '#' : analysis.link}
                className={`group relative bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xl ${
                  analysis.status === 'coming' ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {/* Gradient Header */}
                <div className={`h-24 bg-gradient-to-br ${analysis.color} flex items-center justify-center relative`}>
                  <Icon className="w-12 h-12 text-slate-900/90 dark:text-white/90" />
                  {analysis.status !== 'ready' && (
                    <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full ${
                      analysis.status === 'beta' 
                        ? 'bg-amber-500/20 text-amber-300' 
                        : 'bg-slate-500/20 text-slate-700 dark:text-slate-300'
                    }`}>
                      {analysis.status === 'beta' ? 'Beta' : 'Coming Soon'}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-400 transition-colors">
                    {analysis.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                    {analysis.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {analysis.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Action */}
                  {analysis.status !== 'coming' && (
                    <div className="flex items-center text-sm text-blue-400 group-hover:text-blue-300">
                      Open Analysis
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Additional Info Section */}
        <div className="mt-12 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Industry-Standard Methods</h3>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <li>• Subspace Iteration, Lanczos eigensolvers</li>
                <li>• Newmark-β, HHT-α, Wilson-θ integration</li>
                <li>• CQC, SRSS, ABSSUM combinations</li>
                <li>• Newton-Raphson, Arc-Length solvers</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Supported Codes</h3>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <li>• IS 1893:2016 (India)</li>
                <li>• ASCE 7-22 (USA)</li>
                <li>• Eurocode 8 (Europe)</li>
                <li>• NZS 1170.5 (New Zealand)</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Performance</h3>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <li>• Rust-powered WASM solver</li>
                <li>• 20-100x faster than competitors</li>
                <li>• Multi-threaded parallel assembly</li>
                <li>• Real-time results visualization</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link
            to="/design-center"
            className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Design Center
          </Link>
          <Link
            to="/app"
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Open Modeler
          </Link>
          <Link
            to="/tools/load-combinations"
            className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Target className="w-4 h-4" />
            Load Combinations
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DynamicAnalysisPage;
