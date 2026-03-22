import React, { FC, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, FileCheck2, Server, Clock3, BadgeCheck } from 'lucide-react';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/layout/PageHeader';
import { PageFooter } from '../components/layout/PageFooter';
import { Button } from '../components/ui/button';

const trustPillars = [
  {
    icon: <Lock className="w-5 h-5 text-blue-400" />,
    title: 'Security Controls',
    points: [
      'Encryption in transit and at rest',
      'Gateway signature verification for payment callbacks',
      'Role-based access strategy for team workflows',
    ],
  },
  {
    icon: <FileCheck2 className="w-5 h-5 text-emerald-400" />,
    title: 'Compliance Readiness',
    points: [
      'Privacy and terms documentation maintained in-platform',
      'Audit-ready billing and invoicing roadmap for enterprise buyers',
      'Design-code traceability improvements in progress for report trust UX',
    ],
  },
  {
    icon: <Server className="w-5 h-5 text-purple-400" />,
    title: 'Reliability',
    points: [
      'Webhook-safe idempotent payment operations',
      'Progressive loading and route-level fault boundaries',
      'Monitoring and support escalation path for enterprise incidents',
    ],
  },
];

export const TrustCenterPage: FC = () => {
  useEffect(() => {
    document.title = 'Trust Center - BeamLab';
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-token flex flex-col font-sans">
      <SEO
        title="Trust Center"
        description="BeamLab Trust Center: security, compliance, privacy, reliability, and enterprise procurement readiness."
        path="/trust"
      />

      <PageHeader
        navLinks={[
          { to: '/pricing', label: 'Pricing' },
          { to: '/help', label: 'Help' },
          { to: '/contact', label: 'Contact' },
        ]}
        showAuth={true}
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1a2333] bg-[#131b2e] text-[#adc6ff] text-xs font-semibold mb-6">
            <ShieldCheck className="w-4 h-4" />
            Trust & Compliance
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-token">BeamLab Trust Center</h1>
          <p className="text-dim text-lg leading-relaxed">
            A single place for security posture, compliance readiness, reliability commitments,
            and enterprise procurement guidance.
          </p>
        </section>

        <section className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {trustPillars.map((pillar) => (
            <article key={pillar.title} className="rounded-xl border border-[#1a2333] bg-[#131b2e] p-6">
              <div className="flex items-center gap-2 mb-3">
                {pillar.icon}
                <h2 className="text-lg font-semibold text-token">{pillar.title}</h2>
              </div>
              <ul className="space-y-2 text-sm text-soft">
                {pillar.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <BadgeCheck className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-xl border border-[#1a2333] bg-[#131b2e] p-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock3 className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-token">Enterprise Procurement Support</h2>
          </div>
          <p className="text-soft text-sm leading-relaxed">
            Need procurement artifacts for committee review? We support enterprise discovery for
            pricing validation, legal/procurement workflow preparation, and implementation planning.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="default">
              <Link to="/contact?subject=enterprise">Contact Enterprise Sales</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/pricing">View Plan Comparison</Link>
            </Button>
          </div>
        </section>
      </main>

      <PageFooter />
    </div>
  );
};

export default TrustCenterPage;
