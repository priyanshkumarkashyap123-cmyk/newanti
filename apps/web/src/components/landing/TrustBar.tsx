/**
 * TrustBar — Trust indicators / logo bar for the landing page.
 * Extracted from LandingPage.tsx for code splitting and maintainability.
 */

import { FC } from 'react';

const TRUST_LOGOS = [
  'L&T Engineering',
  'AECOM India',
  'Stup Consultants',
  'Mott MacDonald',
  'Jacobs India',
  'TATA Projects',
];

export const TrustBar: FC = () => (
  <section className="py-14 border-y border-slate-200/60 dark:border-white/[0.04] bg-slate-50/50 dark:bg-slate-900/20">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-8">
        Trusted by engineers at
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
        {TRUST_LOGOS.map((logo, i) => (
          <span
            key={i}
            className="text-[#869ab8]/60 hover:text-slate-700 dark:hover:text-slate-200 transition-all duration-300 text-lg font-semibold tracking-wide cursor-default select-none"
          >
            {logo}
          </span>
        ))}
      </div>
    </div>
  </section>
);

export default TrustBar;
