import { FC } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Laptop, ShieldCheck, Zap } from 'lucide-react';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/layout/PageHeader';
import { PageFooter } from '../components/layout/PageFooter';
import { Button } from '../components/ui/button';

const features = [
  {
    icon: Monitor,
    title: 'Cross-Platform Runtime',
    text: 'Desktop experience for macOS, Windows, and Linux with consistent BeamLab workflows.',
  },
  {
    icon: Zap,
    title: 'Performance-Oriented UI',
    text: 'Desktop mode focuses on responsive model interaction and report workflows for engineering sessions.',
  },
  {
    icon: ShieldCheck,
    title: 'Team Governance Ready',
    text: 'Works with account-based access controls and project handoff workflows.',
  },
  {
    icon: Laptop,
    title: 'Cloud + Desktop Flexibility',
    text: 'Use web and desktop modes depending on project constraints and IT policy.',
  },
];

export const DesktopAppPage: FC = () => {
  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd]">
      <SEO
        title="BeamLab Desktop App | Cross-Platform Engineering Workspace"
        description="BeamLab Desktop delivers a cross-platform engineering workspace with cloud-connected workflows."
        path="/desktop-app"
      />
      <PageHeader navLinks={[{ to: '/', label: 'Home' }, { to: '/integrations', label: 'Integrations' }, { to: '/support', label: 'Support' }]} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <section className="text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#869ab8]">Desktop App</p>
          <h1 className="text-4xl md:text-5xl font-bold">Desktop When You Need It. Cloud When You Want It.</h1>
          <p className="text-[#869ab8] max-w-3xl mx-auto">
            BeamLab Desktop provides a cross-platform workspace for teams that need desktop ergonomics while staying aligned with cloud delivery.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button asChild><Link to="/contact?subject=desktop-access">Request Desktop Access</Link></Button>
            <Button asChild variant="outline"><Link to="/pricing">Compare Plans</Link></Button>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-[#1a2333] bg-[#131b2e] p-6">
              <feature.icon className="w-6 h-6 text-blue-400 mb-3" />
              <h2 className="text-xl font-semibold mb-2">{feature.title}</h2>
              <p className="text-[#869ab8]">{feature.text}</p>
            </div>
          ))}
        </section>
      </main>

      <PageFooter />
    </div>
  );
};

export default DesktopAppPage;
