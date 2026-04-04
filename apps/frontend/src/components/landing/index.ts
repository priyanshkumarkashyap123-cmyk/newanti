/**
 * Landing Page Components — Barrel Export
 * Above-the-fold and lazy-loaded sections for the landing page
 */

export { HeroSection } from './HeroSection';
export { TrustBar } from './TrustBar';

// Below-the-fold sections (lazy-loaded by LandingPage.tsx)
// These are imported via dynamic import() in the page itself
// export { default as FeaturesSection } from './FeaturesSection';
// export { default as PricingSection } from './PricingSection';
// export { default as FAQSection } from './FAQSection';
