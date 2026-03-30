import { FC } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/layout/PageHeader';
import { PageFooter } from '../components/layout/PageFooter';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

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
    <div className="min-h-screen bg-canvas text-[var(--color-text)]">
      <SEO
        title="BeamLab Integrations | API, BIM, CAD"
        description="Explore BeamLab integration pathways including API dashboard, BIM workflows, and CAD interoperability."
        path="/integrations"
      />
      <PageHeader navLinks={[{ to: '/', label: 'Home' }, { to: '/desktop-app', label: 'Desktop App' }, { to: '/support', label: 'Support' }]} />

      <main className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-12 py-16 space-y-12">
        <section className="text-center space-y-4 max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-[0.2em] text-soft">Integrations</p>
          <h1 className="text-4xl md:text-5xl font-bold">API, BIM, and CAD Connectivity</h1>
          <p className="text-soft">
            BeamLab provides integration pathways for engineering teams that need automation, model interoperability,
            and data continuity across tools.
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {integrationCards.map((card) => (
            <Card key={card.title} className="h-full border border-token bg-surface/70">
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl font-semibold">{card.title}</CardTitle>
                <CardDescription className="text-soft">{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full justify-center">
                  <Link to={card.href}>{card.authRequired ? 'Open (Sign-in required)' : 'Open'}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <PageFooter />
    </div>
  );
};

export default IntegrationsOverviewPage;
