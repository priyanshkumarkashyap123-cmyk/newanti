/**
 * Legal Documents for BeamLab Ultimate
 * Contains Terms of Service, Privacy Policy, and Engineering Disclaimer
 */

export const TERMS_OF_SERVICE = `
# Terms of Service

**Last Updated: January 1, 2026**

## 1. Acceptance of Terms

By accessing or using BeamLab Ultimate ("Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use this Service.

## 2. Service Description

BeamLab Ultimate is a structural analysis and design software tool intended for use by qualified professionals. The Service provides:
- Finite Element Analysis (FEA)
- Structural design calculations
- Code compliance checking (AISC, Eurocode, IS codes)
- AI-assisted model generation

## 3. Professional Responsibility

**YOU ACKNOWLEDGE AND AGREE THAT:**

- You are solely responsible for verifying all analysis results
- BeamLab Ultimate is a **computational aid**, not a substitute for professional engineering judgment
- All designs must be reviewed and stamped by a licensed Professional Engineer
- You must verify results using independent methods before construction

## 4. Limitation of Liability

**TO THE MAXIMUM EXTENT PERMITTED BY LAW:**

- BeamLab Ultimate and its operators are **NOT LIABLE** for any property damage, structural failure, injury, or death arising from use of this software
- Results are provided "AS IS" without warranty of any kind
- We do not guarantee accuracy, completeness, or fitness for any particular purpose
- Maximum liability is limited to the amount you paid for the Service in the past 12 months

## 5. Indemnification

You agree to indemnify and hold harmless BeamLab Ultimate, its developers, and operators from any claims, damages, or expenses arising from:
- Your use or misuse of the Service
- Your violation of these Terms
- Your violation of applicable laws or regulations
- Any engineering projects where you used this software

## 6. User Obligations

You agree to:
- Use the Service only for lawful purposes
- Not redistribute or reverse-engineer the software
- Maintain confidentiality of your account credentials
- Comply with all applicable building codes and regulations

## 7. Modifications

We reserve the right to modify these Terms at any time. Continued use after modifications constitutes acceptance.

## 8. Governing Law

These Terms are governed by the laws of India. Disputes shall be resolved in courts of competent jurisdiction.

## 9. Contact

For questions about these Terms: contact@beamlabultimate.tech
`;

export const PRIVACY_POLICY = `
# Privacy Policy

**Last Updated: January 1, 2026**

## Information We Collect

### Account Information
- Name, email address
- Professional credentials (if provided)
- Payment information (processed securely via Razorpay/Stripe)

### Usage Data
- Analysis history and models you create
- IP address, browser type, device information
- Session duration and feature usage

### Cookies
We use cookies and local storage to:
- Maintain your login session
- Remember your preferences
- Analyze site usage

## How We Use Your Information

- **Service Delivery**: To provide analysis and design tools
- **Account Management**: To manage subscriptions and payments
- **Communication**: To send important updates and notifications
- **Improvement**: To enhance our algorithms and user experience
- **Legal Compliance**: To comply with applicable laws

## Data Sharing

We **DO NOT** sell your personal information. We may share data with:
- **Payment Processors**: Razorpay/Stripe for billing
- **Cloud Providers**: Azure for hosting (encrypted storage)
- **Analytics**: Aggregated, anonymized usage statistics

## Data Security

- All data is encrypted in transit (HTTPS/TLS)
- Passwords are hashed using industry-standard algorithms
- Models are stored with user-level access controls
- Regular security audits and updates

## Your Rights

You have the right to:
- Access your personal data
- Request data deletion
- Export your models and analysis results
- Opt-out of marketing communications

## Data Retention

- Active accounts: Data retained indefinitely
- Deleted accounts: Data purged within 30 days
- Backup retention: Up to 90 days

## Third-Party Services

We integrate with:
- **Clerk.dev**: Authentication service
- **Razorpay**: Payment processing
- **Azure**: Cloud infrastructure

Each has their own privacy policies.

## Children's Privacy

BeamLab Ultimate is not intended for users under 18 years of age.

## Changes to This Policy

We will notify you of material changes via email or in-app notification.

## Contact

Privacy concerns: privacy@beamlabultimate.tech
`;

export const ENGINEERING_DISCLAIMER = `
# Engineering Disclaimer

**CRITICAL NOTICE FOR PROFESSIONAL ENGINEERS**

## Computational Tool Only

BeamLab Ultimate is a **computational aid** designed to assist professional engineers in structural analysis and design. It is **NOT**:
- A substitute for professional engineering judgment
- A replacement for licensed engineering reviews
- A guarantee of structural safety or code compliance

## Professional Verification Required

**BEFORE CONSTRUCTION OR IMPLEMENTATION:**

1. **Independent Verification**: All results MUST be independently verified using alternative methods, hand calculations, or peer review
2. **Code Compliance**: Ensure compliance with local building codes, which may differ from implemented standards
3. **Licensed Review**: All designs must be reviewed and sealed by a licensed Professional Engineer (PE/SE)
4. **Site Conditions**: Account for actual site conditions, material properties, and construction tolerances

## Known Limitations

- **Idealized Models**: Analysis assumes perfect materials, connections, and construction
- **Boundary Conditions**: Simplified support conditions may not reflect reality
- **Dynamic Effects**: Limited dynamic and seismic analysis capabilities
- **Material Behavior**: Assumes linear elastic behavior unless otherwise specified
- **Human Error**: User input errors can lead to incorrect results

## No Liability for Failures

**BeamLab Ultimate and its operators accept ZERO liability for:**
- Structural failures or collapses
- Property damage or financial losses
- Personal injury or death
- Code violations or permit rejections
- Professional liability claims against users

## User Responsibility

By using this software, you accept **FULL RESPONSIBILITY** for:
- Accuracy of input data (loads, materials, geometry)
- Interpretation of results
- Design decisions based on analysis
- Safety of constructed structures
- Compliance with applicable codes and standards

## Standard of Care

Output from this software does **NOT** meet the standard of care for professional engineering practice without:
- Manual review by a qualified PE
- Independent verification calculations
- Consideration of local conditions
- Application of professional judgment

## Warranty Disclaimer

**ALL RESULTS PROVIDED "AS IS" WITHOUT WARRANTY.**

We make NO representations regarding:
- Accuracy or reliability
- Fitness for any particular purpose
- Freedom from errors or bugs
- Compliance with any specific code edition

## Report to Engineer of Record

Any analysis performed using BeamLab Ultimate should be clearly documented in project records, noting:
- Software version used
- Assumptions made
- Verification methods employed
- Engineering judgment applied

---

**BY CLICKING "I ACCEPT", YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO THESE TERMS, INCLUDING THE LIMITATIONS OF LIABILITY AND YOUR PROFESSIONAL RESPONSIBILITIES.**

**IF YOU DO NOT AGREE, DO NOT USE THIS SOFTWARE FOR ANY STRUCTURAL DESIGN OR ANALYSIS.**
`;

export const CONSENT_SUMMARY = {
    title: "Legal Agreement Required",
    subtitle: "Please review and accept before using BeamLab Ultimate for structural analysis",
    checkboxes: [
        {
            id: "terms",
            label: "I accept the Terms of Service",
            required: true
        },
        {
            id: "privacy",
            label: "I accept the Privacy Policy",
            required: true
        },
        {
            id: "disclaimer",
            label: "I understand the Engineering Disclaimer and accept full professional responsibility",
            required: true,
            highlight: true
        },
        {
            id: "verification",
            label: "I will independently verify all analysis results before implementation",
            required: true,
            highlight: true
        },
        {
            id: "liability",
            label: "I acknowledge that BeamLab Ultimate is not liable for any structural failures or property damage",
            required: true,
            highlight: true
        }
    ]
};
