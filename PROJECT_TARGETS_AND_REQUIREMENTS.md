# BeamLab Website Project Targets and Requirements

**Project:** BeamLab Ultimate Website  
**Scope:** Product, UX, architecture, backend integrations, deployment, validation, and release readiness for the web platform  
**Source basis:** Repository code, app READMEs, architecture docs, spec pack, deployment docs, and active workflows  
**Status:** Canonical project target and requirements reference

## 1. Purpose

This document defines the detailed targets and requirements for the BeamLab website so the project has a single planning reference for product scope, functional behavior, technical boundaries, and operational expectations.

It is intended to be used alongside:

- `README.md`
- `docs/README.md`
- `docs/specs/README.md`
- `docs/ARCHITECTURE.md`
- `DEPLOYMENT_RUNBOOK.md`
- `PRODUCTION_READINESS.md`

## 2. Product targets

### 2.1 Primary product target

BeamLab must provide a professional structural engineering platform that lets users:

- create and manage structural models
- run analysis through the correct backend service
- inspect results interactively
- generate engineering design checks and reports
- collaborate, export, and deploy in production environments

### 2.2 Business and product goals

The platform should:

- reduce time from model creation to first analysis
- present a clear and professional engineering UX
- support both free and paid user flows
- expose transparent engineering calculations and reports
- provide resilient production deployment across local, cloud, and CI/CD environments
- keep solver and design logic consistent across frontend, Node, Python, Rust, and WASM layers

### 2.3 Audience

Primary users:

- structural engineers
- civil engineers
- consultants and reviewers
- students and researchers
- teams using BeamLab for analysis, reporting, and collaboration

## 3. System scope

### 3.1 In scope

- React/Vite frontend in `apps/web`
- Node.js API in `apps/api`
- Python FastAPI service in `apps/backend-python`
- Rust Axum service in `apps/rust-api`
- WASM and shared solver packages
- documentation hub and specification pack
- deployment scripts and CI/CD workflows
- smoke tests and service health checks
- billing, payments, auth, and project orchestration
- structural analysis, design, reporting, and export workflows

### 3.2 Out of scope for this document

This file does not replace detailed solver mathematics, code-clause implementation notes, or task-specific engineering specs. Those remain in:

- `docs/specs/*`
- `docs/ARCHITECTURE.md`
- app-level READMEs and module docs

## 4. Functional requirements

### 4.1 Frontend requirements

The website shall:

1. provide a modern React-based interface for public and authenticated users
2. support route-driven layouts for marketing, dashboard, workspace, analysis, design, reports, AI, civil, and enterprise features
3. preserve auth state, project state, and analysis state across navigation and refreshes where appropriate
4. support lazy-loaded feature modules for performance
5. provide route-aware shells for full-screen workspace pages and public pages
6. show loading, error, offline, and fallback states gracefully
7. expose an accessible and responsive UI for desktop and mobile widths
8. support report generation, export, and visualization interactions
9. surface pricing, plans, and subscription actions clearly
10. connect to the proper backend service by feature domain

### 4.2 Auth and account requirements

The website shall:

1. support secure sign-in and sign-up flows
2. support authenticated and public route separation
3. allow session/token retrieval for backend requests
4. support account settings and user profile flows
5. preserve user-specific projects and preferences
6. integrate with the selected auth provider or fallback auth mode used by the codebase

### 4.3 Project and workspace requirements

The website shall:

1. allow users to create, open, edit, save, and review structural projects
2. support workspace modules for modeling, analysis, design, and reporting
3. persist project state in the correct storage layer
4. support duplicate, rename, delete, and restore behaviors where implemented
5. allow model data to flow from the UI into backend analysis services without manual translation errors

### 4.4 Structural analysis requirements

The website shall:

1. support linear and advanced analysis workflows
2. route analysis requests to the correct solver backend
3. support modal, p-delta, buckling, seismic, dynamic, and batch analysis where implemented
4. display analysis status, progress, and results clearly
5. support model validation before solver submission
6. prevent invalid analysis submission when blocking issues exist
7. preserve engineering sign conventions and units consistently across the product

### 4.5 Design and code-check requirements

The website shall:

1. expose design modules for concrete, steel, seismic, and other structural code checks
2. present step-by-step design results with readable calculations
3. preserve design-code-specific assumptions, safety factors, and clause references
4. support IS, ACI, AISC, Eurocode, and other implemented code families
5. provide report-ready outputs for engineering submission and review

### 4.6 Reporting and export requirements

The website shall:

1. generate professional reports from structural models and analysis results
2. support report previews and structured output sections
3. allow export to the formats implemented in the codebase
4. preserve tables, calculations, and engineering narrative in exported outputs
5. support printable and shareable report flows

### 4.7 AI and helper workflow requirements

The website shall:

1. support AI-assisted workflows where implemented
2. provide AI status and helper endpoints
3. allow users to request assisted generation or analysis support through the front end
4. fail safely when AI services are unavailable or mocked

### 4.8 Billing and subscription requirements

The website shall:

1. display plan information and pricing clearly
2. support payment gateway selection and checkout flows where implemented
3. enforce feature gating by plan when required
4. show contextual upgrade prompts for gated actions
5. support free, pro, and business-style plan behavior where present in the codebase

### 4.9 Collaboration and enterprise requirements

The website shall:

1. support collaboration features where implemented
2. expose enterprise/integration dashboards and workflows
3. support data sharing and project visibility controls where configured
4. provide audit-friendly behavior for account and usage events

## 5. Non-technical requirements

This section captures the product expectations that matter to non-technical stakeholders such as founders, product managers, operations teams, sales, support, and customer success.

### 5.1 Business requirements

The website should:

1. present BeamLab as a professional structural engineering platform
2. clearly explain what the product does, who it is for, and why it is valuable
3. support free, paid, and team-style offerings where applicable
4. make upgrade paths understandable without requiring technical knowledge
5. support lead generation, trial conversion, and retained customer usage
6. communicate product value through the website, docs, and onboarding flows

### 5.2 Branding and presentation requirements

The website should:

1. look polished, modern, and trustworthy
2. use consistent branding, terminology, and visual style across pages
3. present engineering content in a clean and readable way
4. avoid confusing jargon in public-facing marketing content
5. make the product feel reliable, premium, and professional

### 5.3 Sales and marketing requirements

The website should:

1. clearly show product capabilities, use cases, and plan differences
2. include a pricing and plan comparison experience that is easy to understand
3. surface product strengths such as analysis, design, reporting, and AI assistance
4. support call-to-action paths for sign-up, demo, purchase, or contact
5. provide content that helps prospects evaluate the product quickly

### 5.4 Onboarding and adoption requirements

The website should:

1. help new users understand the product quickly
2. guide first-time users toward their first successful model or analysis
3. provide help content, tooltips, and walkthroughs where needed
4. reduce confusion for non-technical users with clear labels and explanations
5. make the learning curve manageable for students and new customers

### 5.5 Support and success requirements

The website should:

1. give users a clear path to help, documentation, and troubleshooting
2. make errors understandable and actionable
3. allow support teams to identify issues quickly
4. make it easy to verify whether the platform is working correctly
5. provide operational confidence for customer success and account management

### 5.6 Legal and compliance requirements

The website should:

1. include visible legal pages such as privacy policy, terms, and cookie notices where required
2. protect user data and avoid exposing secrets or private information
3. respect consent and usage tracking expectations
4. keep billing and payment flows clear and compliant
5. provide traceable behavior for subscription and account-related actions

### 5.7 Commercial and customer-facing requirements

The website should:

1. support customer trust in the platform's accuracy and stability
2. make paid features and limitations transparent
3. explain report branding, watermarks, and export differences where relevant
4. support repeat usage and customer retention
5. help convert interest into active use and paid plans

### 5.8 Content and communication requirements

The website should:

1. use plain language on public pages whenever possible
2. explain engineering terms in a way non-specialists can follow
3. provide summaries before detailed technical information
4. keep help articles, release notes, and product pages aligned with the actual product
5. avoid overstating features that are not yet implemented

### 5.9 Operational expectations for non-technical stakeholders

The website should:

1. be easy to demonstrate in sales calls and product demos
2. show stable uptime and predictable behavior
3. support safe releases without breaking customer workflows
4. make it clear when a feature is in preview, beta, or production
5. allow teams to communicate product status confidently

## 6. Architecture requirements

### 5.1 Frontend architecture

The frontend must:

- remain the primary user-facing application
- use route-based composition and lazy loading
- keep UI state concerns separated from analysis service orchestration
- call backend services through stable API adapters
- avoid directly coupling UI components to solver internals

### 5.2 Backend service boundaries

The architecture must preserve these responsibilities:

- `apps/api` = gateway, auth, billing, project orchestration, user-facing API glue
- `apps/backend-python` = FastAPI analysis, AI, validation, report helpers, supporting services
- `apps/rust-api` = high-performance structural analysis and design computations
- `packages/solver*` = shared solver and WASM computation layers

### 5.3 Canonical source-of-truth order

When documentation conflicts with implementation, trust in this order:

1. runtime code and entrypoints
2. CI/CD workflows
3. active architecture and operations docs
4. historical or archive documents

## 7. UX and product quality requirements

### 6.1 Usability

- The product should minimize time-to-first-analysis.
- The product should make analysis paths discoverable.
- The product should clearly separate public, workspace, and result surfaces.
- The product should use engineering terminology correctly.

### 6.2 Accessibility

- Interactive controls should be keyboard accessible where feasible.
- Color should not be the only way to convey status.
- Error messages should be readable and actionable.
- Result visualizations should expose text alternatives where practical.

### 6.3 Responsiveness

- The UI should remain usable at common desktop breakpoints.
- Long-running operations should show progress or loading states.
- Route transitions should avoid unnecessary full-page reloads.

### 6.4 Reliability

- The website should degrade gracefully when a backend is unavailable.
- Health checks and dependency checks should be visible in operational flows.
- Validation failures should be actionable rather than cryptic.

## 8. Data, state, and persistence requirements

The website shall:

1. keep project/model state consistent across UI and backend layers
2. avoid losing user work on route changes where persistence is expected
3. preserve analysis outputs and report data until explicitly cleared or replaced
4. support workspace cache and local persistence patterns already used in the codebase
5. respect data boundaries between user project data, auth data, billing data, and operational telemetry

## 9. Integration requirements

### 8.1 Frontend to Node API

Used for:

- auth orchestration
- billing and subscription flows
- project/user/session APIs
- collaboration and account flows
- platform-level administrative endpoints

### 8.2 Frontend to Python backend

Used for:

- structural generation and validation
- AI-assisted generation paths
- report or helper service calls
- dependency health checks

### 8.3 Frontend to Rust API

Used for:

- fast analysis workloads
- design checks
- advanced solver calls
- section/structure service operations

### 8.4 Cross-service integration requirements

The platform shall:

1. use consistent request/response shapes where possible
2. centralize API routing and service selection
3. maintain CORS and auth compatibility across services
4. support service health checks and graceful fallback behavior

## 10. Environment and configuration requirements

### 9.1 Local development

The repository must support local setup for:

- frontend
- Node API
- Python backend
- Rust API
- shared solver packages

### 9.2 Configuration

The project must support environment-driven configuration for:

- API base URLs
- frontend public URLs
- database connection strings
- auth secrets
- AI keys
- payment provider keys
- logging and telemetry flags
- feature flags and environment selectors

### 9.3 Secret management

- Secrets must not be committed to source control.
- Production secrets must be stored in secure external systems.
- Example environment files should remain non-secret.

## 11. Deployment requirements

The platform shall support:

1. local development deployment
2. containerized runtime deployment
3. Azure-oriented production deployment workflows
4. CI/CD build and release automation
5. health verification after deployment
6. smoke tests for critical routes and services
7. repeatable rollback or remediation procedures where defined

## 12. Testing and validation requirements

### 11.1 Test coverage expectations

The platform should include:

- frontend unit tests
- frontend E2E tests
- backend smoke tests
- service health checks
- integration and deployment verification scripts
- solver or design parity checks where relevant

### 11.2 Validation behavior

The website shall:

1. validate model inputs before analysis submission
2. validate backend dependencies before critical workflows
3. surface failures with clear messages
4. keep test and verification scripts aligned with active code paths

## 13. Engineering and domain requirements

The website shall preserve engineering correctness by default, including:

- correct units
- correct sign conventions
- code-clause-specific assumptions
- solver and design result traceability
- report transparency
- consistent treatment of serviceability and ultimate limit state outputs

For detailed engineering rules, solver math, and clause-specific behavior, refer to the structural-engineering workflow and the design-code implementation files under `apps/rust-api/src/design_codes/`.

## 14. Documentation requirements

The repository should maintain:

- a canonical root `README.md`
- a canonical documentation hub in `docs/README.md`
- a canonical spec bundle in `docs/specs/README.md`
- app-level READMEs for specialized backend services
- active operations and deployment docs
- archive folders for historical snapshots only

## 15. Acceptance targets

The website is considered aligned when:

- the root README accurately summarizes the platform
- the project requirements are documented in one place
- service boundaries are clearly defined
- the frontend can route to the correct backend by feature
- deployment and verification paths are documented
- documentation hierarchy is clear and consistent
- engineering workflows remain transparent and traceable

## 16. Related files

- `README.md`
- `docs/README.md`
- `docs/specs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/API_SURFACE_MAP.md`
- `docs/FRONTEND_ROUTE_AND_FEATURE_MAP.md`
- `apps/web/src/App.tsx`
- `apps/web/src/config/appRouteMeta.ts`
- `apps/api/src/index.ts`
- `apps/backend-python/README.md`
- `apps/rust-api/README.md`
- `smoke-test.sh`
- `build-production.sh`
- `.github/workflows/*.yml`

## 17. Maintenance rule

If the platform adds a new major feature area, the following must be updated together:

- root README overview
- this requirements document
- docs/spec index
- frontend route map
- backend API surface documentation
- deployment and smoke-test scripts if the feature affects runtime behavior
