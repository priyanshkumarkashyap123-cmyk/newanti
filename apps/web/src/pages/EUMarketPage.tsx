import { FC } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/layout/PageHeader';
import { PageFooter } from '../components/layout/PageFooter';
import { Button } from '../components/ui/button';

const highlights = [
  'Eurocode-oriented design flow (EN 1992 / EN 1993 context)',
  'ULS/SLS-aware analysis-to-reporting workflow',
  'Cross-code project support for international teams',
  'Cloud collaboration with export-ready outputs',
];

export const EUMarketPage: FC = () => {
  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd]">
      <SEO
        title="BeamLab for Europe | Eurocode Structural Workflow"
        description="BeamLab provides Eurocode-oriented structural analysis and design workflow for EU engineering teams."
        path="/eu"
      />
      <PageHeader navLinks={[{ to: '/', label: 'Home' }, { to: '/pricing', label: 'Pricing' }, { to: '/support', label: 'Support' }]} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <section className="text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#869ab8]">EU Edition</p>
          <h1 className="text-4xl md:text-5xl font-bold">Eurocode-Ready Structural Delivery</h1>
          <p className="text-[#869ab8] max-w-3xl mx-auto">
            BeamLab supports EU teams with Eurocode-oriented workflows, advanced analysis options, and report-friendly outputs for collaborative delivery.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button asChild><Link to="/sign-up">Start Free</Link></Button>
            <Button asChild variant="outline"><Link to="/pricing">Compare Plans</Link></Button>
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
          <h2 className="text-2xl font-semibold mb-3">Where this helps</h2>
          <ul className="list-disc list-inside text-[#adc6ff] space-y-2">
            <li>Mixed-material structure design workflows</li>
            <li>Collaborative reviews across geographically distributed teams</li>
            <li>Consistent report generation for approval cycles</li>
          </ul>
        </section>
      </main>

      <PageFooter />
    </div>
  );
};

export default EUMarketPage;
