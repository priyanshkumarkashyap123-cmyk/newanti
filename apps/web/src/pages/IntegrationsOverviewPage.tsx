import { FC } from 'react';
import { Link } from 'react-router-dom';
import { APIIntegrationDashboard } from './APIIntegrationDashboard';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/layout/PageHeader';
import { PageFooter } from '../components/layout/PageFooter';
import { Button } from '../components/ui/button';

const integrationCards = [
  {
    title: 'API Integration Dashboard',
    description: 'Manage API keys, integration settings, and automation-ready access patterns.',
    href: '/integrations/api-dashboard',
    authRequired: true,
  },
  {
    title: 'BIM Integration',
    description: 'IFC upload, validation, clash checks, and export workflow.',
    href: '/bim',
    authRequired: true,
  },
  {
    title: 'CAD Integration Hub',
    description: 'CAD import/export workflow for structural drawing interoperability.',
    href: '/cad/integration',
    authRequired: true,
  },
];

export const IntegrationsOverviewPage: FC = () => {
  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd]">
      <SEO
        title="BeamLab Integrations | API, BIM, CAD"
        description="Explore BeamLab integration pathways including API dashboard, BIM workflows, and CAD interoperability."
        path="/integrations"
      />
      <PageHeader navLinks={[{ to: '/', label: 'Home' }, { to: '/desktop-app', label: 'Desktop App' }, { to: '/support', label: 'Support' }]} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
        <section className="text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#869ab8]">Integrations</p>
          <h1 className="text-4xl md:text-5xl font-bold">API, BIM, and CAD Connectivity</h1>
          <p className="text-[#869ab8] max-w-3xl mx-auto">
            BeamLab provides integration pathways for engineering teams that need automation, model interoperability,
            and data continuity across tools.
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          {integrationCards.map((card) => (
            <div key={card.title} className="rounded-xl border border-[#1a2333] bg-[#131b2e] p-6">
              <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
              <p className="text-[#869ab8] mb-4">{card.description}</p>
              <Button asChild variant="outline" className="w-full">
                <Link to={card.href}>{card.authRequired ? 'Open (Sign-in required)' : 'Open'}</Link>
              </Button>
            </div>
          ))}
        </section>
      </main>

      <PageFooter />
    </div>
  );
};

export default IntegrationsOverviewPage;
