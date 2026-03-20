/**
 * SupportPage.tsx - Engineer-Backed Support & Resources
 * 
 * Positions BeamLab's support narrative:
 * - Engineer-staffed support team
 * - Fast response times
 * - Technical expertise
 * - Multi-channel support
 */

import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mail,
  MessageSquare,
  Phone,
  Clock,
  Users,
  HelpCircle,
  Slack,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/layout/PageHeader';
import { PageFooter } from '../components/layout/PageFooter';
import { SEO } from '../components/SEO';
import { cn } from '../lib/utils';

// ============================================
// TYPES
// ============================================

interface SupportChannel {
  id: string;
  icon: React.ReactNode;
  name: string;
  description: string;
  responseTime: string;
  availableTiers: string[];
  cta: {
    label: string;
    href: string;
  };
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  expertise: string[];
  image?: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'billing' | 'technical' | 'account' | 'general';
}

// ============================================
// DATA
// ============================================

const SUPPORT_CHANNELS: SupportChannel[] = [
  {
    id: 'email',
    icon: <Mail className="w-6 h-6" />,
    name: 'Email Support',
    description: 'Detailed technical support via email. Perfect for complex design questions and bug reports.',
    responseTime: 'Typical: 4-24 hours',
    availableTiers: ['Pro', 'Business', 'Enterprise'],
    cta: {
      label: 'Email Us',
      href: 'mailto:support@beamlabultimate.tech',
    },
  },
  {
    id: 'chat',
    icon: <MessageSquare className="w-6 h-6" />,
    name: 'Live Chat',
    description: 'Real-time chat support during business hours. Get quick answers to common questions.',
    responseTime: 'Typical: <2 hours (live)',
    availableTiers: ['Free', 'Pro', 'Business', 'Enterprise'],
    cta: {
      label: 'Start Chat',
      href: '#chat-widget',
    },
  },
  {
    id: 'slack',
    icon: <Slack className="w-6 h-6" />,
    name: 'Slack Community',
    description: 'Join the BeamLab community channel for peer discussions, workflow tips, and product updates.',
    responseTime: 'Community-driven',
    availableTiers: ['Free', 'Pro', 'Business', 'Enterprise'],
    cta: {
      label: 'Open Help Center',
      href: '/help',
    },
  },
  {
    id: 'phone',
    icon: <Phone className="w-6 h-6" />,
    name: 'Phone Support',
    description: 'Priority phone support for complex issues. Speak directly with a structural engineer.',
    responseTime: 'Typical: <1 hour',
    availableTiers: ['Business', 'Enterprise'],
    cta: {
      label: 'Schedule Call',
      href: '/contact?type=phone',
    },
  },
];

const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'track1',
    name: 'Structural Analysis Support',
    role: 'Model setup, stability checks, result interpretation',
    expertise: ['2D/3D analysis', 'P-Delta', 'Buckling', 'Load combinations'],
  },
  {
    id: 'track2',
    name: 'Design Code Support',
    role: 'Design workflow guidance across major code families',
    expertise: ['IS 456 / IS 800', 'ACI / AISC', 'Eurocode', 'Clause mapping'],
  },
  {
    id: 'track3',
    name: 'Platform & Integrations Support',
    role: 'API usage, reporting, account and team workflows',
    expertise: ['API onboarding', 'Project exports', 'Team setup', 'Billing support'],
  },
];

const FAQS: FAQ[] = [
  {
    id: 'faq1',
    category: 'technical',
    question: 'What do I do if my model shows "Geometric Instability"?',
    answer:
      'This error indicates insufficient supports or a structural mechanism. Check: (1) All nodes are properly constrained, (2) Member releases don\'t create instability, (3) No unsupported members extending to infinity. If the model looks correct, try re-running the analysis or contact our engineering team for a model review.',
  },
  {
    id: 'faq2',
    category: 'technical',
    question: 'How do I switch between IS 456 and ACI 318 design codes?',
    answer:
      'In the Design Settings panel, click the dropdown for "Design Code" and select your preferred code. All design checks will update automatically. You can also check a structure against multiple codes simultaneously by running separate analyses.',
  },
  {
    id: 'faq3',
    category: 'billing',
    question: 'Can I change my plan at any time?',
    answer:
      'Yes! You can upgrade or downgrade your plan anytime. Upgrades take effect immediately; downgrades apply at your next billing cycle. Contact support if you need assistance with a plan change.',
  },
  {
    id: 'faq4',
    category: 'account',
    question: 'How do I export my projects for backup?',
    answer:
      'Go to Dashboard → Settings → Data Export. You can download all your projects as JSON files. We also provide automatic cloud backups with all paid plans.',
  },
  {
    id: 'faq5',
    category: 'general',
    question: 'What is the response time for support inquiries?',
    answer:
      'Typical response windows: Free tier users can use Help Center and community channels. Pro/Business users receive prioritized email and chat support. Enterprise plans include dedicated escalation workflows. Exact SLAs are finalized during procurement.',
  },
];

// ============================================
// COMPONENTS
// ============================================

const SupportChannelCard: FC<SupportChannel> = (channel) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className={cn(
      'p-6 rounded-xl border transition-all duration-300',
      'hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10',
      'bg-gradient-to-br from-[#0b1326] to-[#131b2e] border-[#1a2333]'
    )}
  >
    <div className="flex items-start gap-4 mb-4">
      <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">{channel.icon}</div>
      <div>
        <h3 className="text-lg font-bold text-[#dae2fd]">{channel.name}</h3>
        <p className="text-sm text-[#869ab8]">{channel.description}</p>
      </div>
    </div>

    <div className="space-y-3 mb-4">
      <div className="flex items-center gap-2 text-sm text-[#adc6ff]">
        <Clock className="w-4 h-4 text-blue-400" />
        <span>{channel.responseTime}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {channel.availableTiers.map((tier) => (
          <span
            key={tier}
            className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20"
          >
            {tier}
          </span>
        ))}
      </div>
    </div>

    <Button
      asChild
      variant={channel.cta.href.startsWith('/') ? 'default' : 'outline'}
      size="sm"
      className="w-full"
    >
      {channel.cta.href.startsWith('/') ? (
        <Link to={channel.cta.href}>{channel.cta.label}</Link>
      ) : (
        <a href={channel.cta.href} target="_blank" rel="noopener noreferrer">
          {channel.cta.label}
        </a>
      )}
    </Button>
  </motion.div>
);

const FAQItem: FC<FAQ & { isOpen: boolean; onToggle: () => void }> = ({
  question,
  answer,
  isOpen,
  onToggle,
}) => (
  <div className="border border-[#1a2333] rounded-lg bg-[#0b1326] overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#131b2e] transition-colors text-left"
    >
      <span className="font-semibold text-[#dae2fd]">{question}</span>
      <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
        <HelpCircle className="w-5 h-5 text-blue-400" />
      </motion.div>
    </button>
    <motion.div
      initial={false}
      animate={{ height: isOpen ? 'auto' : 0 }}
      className="overflow-hidden"
    >
      <div className="px-6 py-4 border-t border-[#1a2333] bg-[#131b2e]/50">
        <p className="text-[#adc6ff] leading-relaxed">{answer}</p>
      </div>
    </motion.div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const SupportPage: FC = () => {
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1326] via-[#131b2e] to-[#0b1326]">
      <SEO
        title="Support & Resources | BeamLab"
        description="Engineer-backed support, tutorials, and community. Get help with structural analysis, design codes, and BeamLab features."
        path="/support"
      />

      <PageHeader
        navLinks={[
          { to: '/', label: 'Home' },
          { to: '/help', label: 'Help Center' },
          { to: '/contact', label: 'Contact' },
        ]}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-[#dae2fd] mb-4">
            Expert Support Built into Every Plan
          </h1>
          <p className="text-lg text-[#869ab8] max-w-2xl mx-auto">
            Get practical help for analysis workflows, design-code checks, and platform usage. Whether you're
            designing your first beam or managing complex multidisciplinary projects, BeamLab support is built to keep you moving.
          </p>
        </motion.div>

        {/* Support Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="grid md:grid-cols-4 gap-6 mb-20"
        >
          {[
            { icon: Users, label: 'Support Model', value: 'Engineer-aware workflows' },
            { icon: Clock, label: 'Coverage', value: 'Business-hour response windows' },
            { icon: MessageSquare, label: 'Channels', value: 'Email, chat, community, phone' },
            { icon: Phone, label: 'Enterprise Escalation', value: 'Priority path available' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-center p-6 rounded-lg bg-gradient-to-br from-blue-600/5 to-purple-600/5 border border-[#1a2333]"
            >
              <stat.icon className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <p className="text-sm text-[#869ab8] mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-[#dae2fd]">{stat.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Support Channels */}
        <section className="mb-20">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#dae2fd] mb-3">How to Reach Us</h2>
            <p className="text-[#869ab8] max-w-2xl mx-auto">
              Choose the support channel that fits your urgency and plan tier. For complex engineering issues,
              include your model details so we can reproduce quickly.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {SUPPORT_CHANNELS.map((channel) => (
              <SupportChannelCard key={channel.id} {...channel} />
            ))}
          </div>
        </section>

        {/* Engineering Team */}
        <section className="mb-20 py-16 border-y border-[#1a2333]">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#dae2fd] mb-3">Support Specializations</h2>
            <p className="text-[#869ab8] max-w-2xl mx-auto">
              Our support organization is aligned by problem type so routing is faster and answers are more actionable.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {TEAM_MEMBERS.map((member, i) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
                  <Users className="w-12 h-12 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-[#dae2fd] mb-1">{member.name}</h3>
                <p className="text-sm text-blue-400 font-medium mb-3">{member.role}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {member.expertise.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-full text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FAQs */}
        <section className="mb-20">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#dae2fd] mb-3">Frequently Asked Questions</h2>
            <p className="text-[#869ab8] max-w-2xl mx-auto">
              Quick answers to common questions. Can't find what you're looking for? Contact our support team.
            </p>
          </motion.div>

          <div className="space-y-3">
            {FAQS.map((faq) => (
              <FAQItem
                key={faq.id}
                {...faq}
                isOpen={openFaqId === faq.id}
                onToggle={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
              />
            ))}
          </div>
        </section>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-2xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20"
        >
          <h2 className="text-3xl font-bold text-[#dae2fd] mb-4">Ready to Get Started?</h2>
          <p className="text-[#869ab8] mb-8 max-w-2xl mx-auto">
            Sign up for a free account or contact our sales team to discuss your engineering needs.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button asChild variant="default" size="lg">
              <Link to="/sign-up">Get Started Free</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/contact">Talk to Sales</Link>
            </Button>
          </div>
        </motion.div>
      </main>

      <PageFooter />
    </div>
  );
};

export default SupportPage;
