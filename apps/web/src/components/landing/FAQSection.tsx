/**
 * FAQSection — FAQ accordion for the landing page.
 * Extracted from LandingPage.tsx for lazy loading.
 */

import { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: 'Is BeamLab suitable for professional structural engineering?',
    a: 'Yes. BeamLab is designed for professional structural engineers. It supports IS 456, IS 800, ACI 318, AISC 360, Eurocode 2/3/8, and other international standards with full calculation traceability.',
  },
  {
    q: 'How does BeamLab compare to STAAD.Pro?',
    a: 'BeamLab offers comparable analysis capabilities (linear static, modal, buckling, P-Delta, time history) in a browser-native platform. No installation required, real-time collaboration, and AI-powered design assistance.',
  },
  {
    q: 'Can I use BeamLab offline?',
    a: 'Small models (< 500 nodes) run entirely in-browser using WebAssembly — no internet required. Larger models use our cloud backends for faster computation.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'We accept UPI, credit/debit cards, net banking, and other Indian payment methods via PhonePe. GST-compliant invoices are available for all paid plans.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes! The free plan supports up to 3 projects, basic 2D analysis, IS 456 & ACI 318 design codes, and standard PDF reports. No credit card required.',
  },
  {
    q: 'Can I export my analysis results?',
    a: 'Pro and Business plans include professional PDF report export with calculations, diagrams, and design summaries. Free plan includes basic report export.',
  },
  {
    q: 'Is my data secure?',
    a: 'All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Projects are stored in your private cloud workspace and never shared without your permission.',
  },
  {
    q: 'Do you offer team collaboration?',
    a: 'Yes. Pro plans support up to 5 team members with real-time collaboration. Business plans support up to 10 members with centralized admin controls.',
  },
];

export const FAQSection: FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 sm:py-32 bg-canvas">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block text-blue-400 text-xs font-semibold uppercase tracking-[0.2em] mb-5"
          >
            FAQ
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-[#dae2fd]"
          >
            Frequently Asked Questions
          </motion.h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-[#1a2333] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left bg-[#0b1326] hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                aria-expanded={openFaq === i}
              >
                <span className="font-medium tracking-wide text-[#dae2fd] text-sm sm:text-base pr-4">
                  {item.q}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                    openFaq === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 pt-1 text-sm text-[#869ab8] leading-relaxed bg-[#0b1326]">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
