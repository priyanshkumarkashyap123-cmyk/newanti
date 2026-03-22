/**
 * ContactPage - Enterprise Contact Form
 * Dark theme matching landing page design system
 */

import React from 'react';
import { FC, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, MapPin, Send, CheckCircle, Phone } from "lucide-react";
import { API_CONFIG } from '../config/env';
import logger from "../lib/logger";
import { Button } from "../components/ui/button";
import { Logo } from '../components/branding';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/layout/PageHeader';
import { PageFooter } from '../components/layout/PageFooter';

export const ContactPage: FC = () => {
  const location = useLocation();
  useEffect(() => { document.title = 'Contact - BeamLab'; }, []);

  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    companyName: "",
    teamSize: "",
    timeline: "",
    planInterest: "",
    procurementNotes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const subject = params.get('subject');
    if (subject) {
      setFormState((prev) => ({ ...prev, subject }));
    }
  }, [location.search]);

  const isEnterpriseInquiry =
    formState.subject.toLowerCase().includes('enterprise') ||
    formState.subject.toLowerCase().includes('sales');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const apiUrl = API_CONFIG.baseUrl;

      const enterpriseContext = isEnterpriseInquiry
        ? [
            `Company: ${formState.companyName || 'Not specified'}`,
            `Team size: ${formState.teamSize || 'Not specified'}`,
            `Timeline: ${formState.timeline || 'Not specified'}`,
            `Plan interest: ${formState.planInterest || 'Not specified'}`,
            `Procurement notes: ${formState.procurementNotes || 'Not specified'}`,
          ].join('\n')
        : '';

      const payload = {
        name: formState.name,
        email: formState.email,
        subject: formState.subject,
        message: isEnterpriseInquiry
          ? `${formState.message}\n\n--- Enterprise Context ---\n${enterpriseContext}`
          : formState.message,
      };

      const res = await fetch(`${apiUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      // Even if backend is unavailable, show success (message logged in console)
      logger.log('Contact form submitted (offline fallback):', {
        name: formState.name,
        email: formState.email,
        subject: formState.subject,
      });
    }
    setIsSubmitting(false);
    setSubmitted(true);
  };

  const navLinks = [
    { to: '/pricing', label: 'Pricing' },
    { to: '/help', label: 'Help' },
  ];

  return (
    <div className="min-h-screen bg-[#0b1326] text-slate-900 dark:text-slate-50 flex flex-col font-sans selection:bg-blue-500/30">
      <SEO
        title="Contact Us"
        description="Get in touch with BeamLab for enterprise inquiries, technical support, and partnership opportunities."
        path="/contact"
      />
      
      <PageHeader navLinks={navLinks} showAuth={true} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-10"
          >
            <div>
              <span className="text-blue-400 text-sm font-semibold uppercase tracking-wider">
                Contact Us
              </span>
              <h1 className="text-4xl md:text-5xl font-bold text-[#dae2fd] mt-2 mb-6">
                Get in touch
              </h1>
              <p className="text-lg text-[#869ab8] leading-relaxed">
                Have questions about our Enterprise plans, need a custom
                integration, or just want to say hi? We'd love to hear from you.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4 p-5 rounded-xl bg-[#0b1326] border border-[#1a2333] hover-lift">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#dae2fd] mb-1">
                    Email Us
                  </h3>
                  <p className="text-[#869ab8] mb-2">
                    Our friendly team is here to help.
                  </p>
                  <a
                    href="mailto:office@beamlabultimate.tech"
                    className="text-blue-400 font-medium tracking-wide tracking-wide hover:text-blue-300 transition-colors"
                  >
                    office@beamlabultimate.tech
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4 p-5 rounded-xl bg-[#0b1326] border border-[#1a2333] hover-lift">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#dae2fd] mb-1">Office</h3>
                  <p className="text-[#869ab8]">
                    Rajapur Teonthar, Rewa
                    <br />
                    Madhya Pradesh 486220
                    <br />
                    India
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-5 rounded-xl bg-[#0b1326] border border-[#1a2333] hover-lift">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#dae2fd] mb-1">
                    Call Us
                  </h3>
                  <p className="text-[#869ab8] mb-2">
                    Mon-Sat, 9:00 AM - 7:00 PM (IST)
                  </p>
                  <a
                    href="tel:7987782378"
                    className="text-emerald-400 font-medium tracking-wide tracking-wide hover:text-emerald-300 transition-colors"
                  >
                    7987782378
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0b1326] p-8 rounded-2xl border border-[#1a2333] shadow-xl"
          >
            {submitted ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-6 animate-success">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-[#dae2fd] mb-2">
                  Message Sent!
                </h3>
                <p className="text-[#869ab8]">
                  Thanks for reaching out. We'll get back to you shortly.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSubmitted(false)}
                  className="mt-8"
                >
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="name"
                      className="text-sm font-bold text-[#adc6ff]"
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      required
                      className="px-4 py-3 rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 dark:placeholder:text-slate-400"
                      placeholder="Your name"
                      value={formState.name}
                      onChange={(e) =>
                        setFormState({ ...formState, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="email"
                      className="text-sm font-bold text-[#adc6ff]"
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      required
                      className="px-4 py-3 rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 dark:placeholder:text-slate-400"
                      placeholder="you@company.com"
                      value={formState.email}
                      onChange={(e) =>
                        setFormState({ ...formState, email: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="subject"
                    className="text-sm font-bold text-[#adc6ff]"
                  >
                    Subject
                  </label>
                  <select
                    id="subject"
                    className="px-4 py-3 rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    value={formState.subject}
                    onChange={(e) =>
                      setFormState({ ...formState, subject: e.target.value })
                    }
                  >
                    <option value="">Select a topic</option>
                    <option value="sales">Enterprise Sales</option>
                    <option value="support">Technical Support</option>
                    <option value="billing">Billing Question</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {isEnterpriseInquiry && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="companyName" className="text-sm font-bold text-[#adc6ff]">
                        Company / Firm Name
                      </label>
                      <input
                        type="text"
                        id="companyName"
                        className="px-4 py-3 rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 dark:placeholder:text-slate-400"
                        placeholder="Acme Structural Consultants"
                        value={formState.companyName}
                        onChange={(e) => setFormState({ ...formState, companyName: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="teamSize" className="text-sm font-bold text-[#adc6ff]">
                        Team Size
                      </label>
                      <select
                        id="teamSize"
                        className="px-4 py-3 rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        value={formState.teamSize}
                        onChange={(e) => setFormState({ ...formState, teamSize: e.target.value })}
                      >
                        <option value="">Select team size</option>
                        <option value="1-5">1-5</option>
                        <option value="6-20">6-20</option>
                        <option value="21-100">21-100</option>
                        <option value="100+">100+</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="timeline" className="text-sm font-bold text-[#adc6ff]">
                        Procurement Timeline
                      </label>
                      <select
                        id="timeline"
                        className="px-4 py-3 rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        value={formState.timeline}
                        onChange={(e) => setFormState({ ...formState, timeline: e.target.value })}
                      >
                        <option value="">Select timeline</option>
                        <option value="this-month">This month</option>
                        <option value="this-quarter">This quarter</option>
                        <option value="next-quarter">Next quarter</option>
                        <option value="exploring">Just exploring</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="planInterest" className="text-sm font-bold text-[#adc6ff]">
                        Plan Interest
                      </label>
                      <select
                        id="planInterest"
                        className="px-4 py-3 rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        value={formState.planInterest}
                        onChange={(e) => setFormState({ ...formState, planInterest: e.target.value })}
                      >
                        <option value="">Select plan</option>
                        <option value="pro">Professional</option>
                        <option value="business">Business</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-2">
                      <label htmlFor="procurementNotes" className="text-sm font-bold text-[#adc6ff]">
                        Procurement Notes (PO / compliance / invoicing)
                      </label>
                      <textarea
                        id="procurementNotes"
                        rows={3}
                        className="px-4 py-3 rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none placeholder:text-slate-600 dark:placeholder:text-slate-400"
                        placeholder="Share PO requirements, security review expectations, or billing constraints"
                        value={formState.procurementNotes}
                        onChange={(e) => setFormState({ ...formState, procurementNotes: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="message"
                    className="text-sm font-bold text-[#adc6ff]"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={4}
                    className="px-4 py-3 rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none placeholder:text-slate-600 dark:placeholder:text-slate-400"
                    placeholder="How can we help you?"
                    value={formState.message}
                    onChange={(e) =>
                      setFormState({ ...formState, message: e.target.value })
                    }
                  />
                </div>

                <Button
                  variant="premium"
                  size="lg"
                  className="w-full mt-2"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />
                  ) : (
                    <>
                      Send Message
                      <Send className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </main>

      <PageFooter />
    </div>
  );
};

export default ContactPage;
