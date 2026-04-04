import { FC } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/layout/PageHeader';
import { PageFooter } from '../components/layout/PageFooter';
import { Button } from '../components/ui/button';

const highlights = [
  'IS 456, IS 800, IS 875, IS 1893-first workflows',
  'Integrated geotechnical + structural design path',
  'Bridge and foundation modules in one platform',
  'INR billing with annual plan options',
];

export const IndiaMarketPage: FC = () => {
  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd]">
      <SEO
        title="BeamLab for India | IS Code Structural Platform"
        description="Cloud structural analysis and design platform for Indian engineers with IS 456, IS 800, IS 875 and IS 1893 workflows."
        path="/india"
      />
      <PageHeader navLinks={[{ to: '/', label: 'Home' }, { to: '/pricing', label: 'Pricing' }, { to: '/support', label: 'Support' }]} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <section className="text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#869ab8]">India Edition</p>
          <h1 className="text-4xl md:text-5xl font-bold">Built for Indian Structural Engineers</h1>
          <p className="text-[#869ab8] max-w-3xl mx-auto">
            BeamLab combines IS-code-driven design workflows with analysis, geotechnical context, and project reporting in one cloud platform.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button asChild><Link to="/sign-up">Get Started Free</Link></Button>
            <Button asChild variant="outline"><Link to="/pricing">View Pricing</Link></Button>
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
          <h2 className="text-2xl font-semibold mb-3">Typical workflows</h2>
          <ul className="list-disc list-inside text-[#adc6ff] space-y-2">
            <li>Building frame analysis with IS load combinations</li>
            <li>RC and steel member checks under IS code families</li>
            <li>Foundation and geotechnical context checks in design pipeline</li>
          </ul>
        </section>
      </main>

      <PageFooter />
    </div>
  );
};

export default IndiaMarketPage;
