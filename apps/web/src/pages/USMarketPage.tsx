import { FC } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/layout/PageHeader';
import { PageFooter } from '../components/layout/PageFooter';
import { Button } from '../components/ui/button';

const highlights = [
  'AISC 360 and ACI 318 design pathways',
  'Dynamic analysis modes including response spectrum and time history',
  'Integrated geotechnical context in structural workflow',
  'API-oriented automation for engineering teams',
];

export const USMarketPage: FC = () => {
  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd]">
      <SEO
        title="BeamLab for US Teams | AISC + ACI Structural Platform"
        description="BeamLab supports AISC/ACI structural workflows with advanced analysis and integration-first architecture for US teams."
        path="/us"
      />
      <PageHeader navLinks={[{ to: '/', label: 'Home' }, { to: '/integrations', label: 'Integrations' }, { to: '/support', label: 'Support' }]} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <section className="text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#869ab8]">US Edition</p>
          <h1 className="text-4xl md:text-5xl font-bold">AISC + ACI Workflows in One Platform</h1>
          <p className="text-[#869ab8] max-w-3xl mx-auto">
            BeamLab gives US teams a single environment for analysis, code-based design checks, and collaboration-ready project delivery.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button asChild><Link to="/sign-up">Open Workspace</Link></Button>
            <Button asChild variant="outline"><Link to="/integrations">Explore Integrations</Link></Button>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          {highlights.map((item) => (
            <div key={item} className="rounded-xl border border-[#1a2333] bg-[#131b2e] p-5 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" />
              <p className="text-[#adc6ff]">{item}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-[#1a2333] bg-[#131b2e] p-6">
          <h2 className="text-2xl font-semibold mb-3">Team outcomes</h2>
          <ul className="list-disc list-inside text-[#adc6ff] space-y-2">
            <li>Reduce tool switching across analysis and code checks</li>
            <li>Standardize reporting outputs across distributed teams</li>
            <li>Support mixed-code and multinational project requirements</li>
          </ul>
        </section>
      </main>

      <PageFooter />
    </div>
  );
};

export default USMarketPage;
