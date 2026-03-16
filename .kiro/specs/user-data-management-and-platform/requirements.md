# Requirements Document

## Introduction

This document defines requirements for the BeamLab user data management and platform features. The scope covers six interconnected areas: persistent user data and project state, usage quotas with rate limiting, compute-aware quota weighting, project-level collaboration, subscription tier management with adaptive UI, and optional WebGPU local compute. Together these features form the foundation of BeamLab's multi-tier SaaS platform.

## Glossary

- **User**: An authenticated individual with a unique user ID, display name, and account creation timestamp stored in the database.
- **Project**: A named structural engineering workspace owned by a User, containing model data, analysis results, and metadata.
- **Project_State**: The serialized representation of a Project including all nodes, members, loads, boundary conditions, and any partial or completed analysis results.
- **Session**: A period of authenticated activity between a User's login and logout events.
- **Quota_Service**: The backend service responsible for tracking and enforcing per-user daily usage limits.
- **Compute_Unit**: A normalized measure of server-side compute cost assigned to an analysis job based on the complexity of the structural model.
- **Daily_Window**: The 24-hour rolling period (UTC midnight to midnight) used to reset usage counters.
- **Rate_Limiter**: The middleware component that checks a User's remaining quota before permitting an analysis or project creation action.
- **Collaboration_Invite**: A record granting a named User access to a specific Project owned by another User.
- **Collaborator**: A User who has been granted access to a Project they do not own via a Collaboration_Invite.
- **Subscription_Tier**: The access level assigned to a User: Free, Pro, or Enterprise.
- **Tier_Config**: The server-side configuration object defining feature flags and quota limits for each Subscription_Tier.
- **WebGPU_Runtime**: The browser's WebGPU API used to execute GPU-accelerated structural analysis locally on the user's device.
- **Compute_Mode**: The selected execution target for an analysis job: either `local` (WebGPU_Runtime) or `server` (Rust_API or Python_API).
- **Node_API**: The Express 5 Node.js backend (port 3001) handling auth, user management, billing, and quota enforcement.
- **Rust_API**: The Axum-based Rust backend (port 8080) for medium-to-large structural analysis.
- **Python_API**: The FastAPI-based Python backend (port 8000) for design checks and job queuing.
- **Analysis_Router**: The unified frontend hook that selects the appropriate Compute_Mode and backend for a given analysis job.
- **Subscription_Provider**: The React context provider that exposes the current User's Subscription_Tier and feature flags to all UI components.

---

## Requirements

### Requirement 1: User Account Persistence

**User Story:** As a user, I want my account information saved when I register so that my identity and preferences are preserved across sessions.

#### Acceptance Criteria

1. WHEN a new user completes registration, THE Node_API SHALL persist the user's unique ID, display name, and account creation timestamp to the database within 2 seconds.
2. WHEN a registered user authenticates, THE Node_API SHALL retrieve and return the user's stored profile including user ID, display name, and creation timestamp.
3. IF a registration request is received with a user ID that already exists in the database, THEN THE Node_API SHALL return HTTP 409 and SHALL NOT create a duplicate record.
4. THE Node_API SHALL associate all Projects, Collaboration_Invites, and quota records with the User's unique ID as a foreign key.

---

### Requirement 2: Project State Persistence

**User Story:** As a user, I want my project and all work-in-progress saved automatically so that I can resume exactly where I left off after logging out and back in.

#### Acceptance Criteria

1. WHEN a user saves a Project, THE Node_API SHALL persist the complete Project_State including model geometry, loads, boundary conditions, and any partial or completed analysis results.
2. WHEN a user authenticates in a new Session, THE Node_API SHALL return all Projects owned by that User including their last-saved Project_State.
3. WHILE a user is editing a Project, THE System SHALL auto-save the Project_State at intervals no greater than 60 seconds without requiring explicit user action.
4. WHEN a user explicitly saves a Project, THE Node_API SHALL acknowledge the save within 3 seconds and update the Project's `updatedAt` timestamp.
5. IF a save request fails due to a network error, THEN THE System SHALL retain the unsaved Project_State in local browser storage and retry the save when connectivity is restored.
6. THE Node_API SHALL return a Project's full Project_State when a GET request is made for that Project by its owner or an authorized Collaborator.

---

### Requirement 3: Daily Usage Quota Enforcement

**User Story:** As a platform operator, I want free-tier users limited to a defined number of daily actions so that server compute costs remain predictable and sustainable.

#### Acceptance Criteria

1. THE Quota_Service SHALL track, per User per Daily_Window, the number of Projects created and the total Compute_Units consumed by analysis jobs.
2. WHEN a free-tier User attempts to create a Project and the User's project creation count for the current Daily_Window has reached the Free tier limit, THE Rate_Limiter SHALL reject the request with HTTP 429 and a message stating "You have reached your limit of [N] projects for today."
3. WHEN a free-tier User attempts to run an analysis and the User's Compute_Unit total for the current Daily_Window has reached the Free tier limit, THE Rate_Limiter SHALL reject the request with HTTP 429 and a message stating "You have exhausted your [N] analyses for today."
4. THE Tier_Config SHALL define the following Free tier limits: a maximum of 3 Projects created per Daily_Window and a maximum of 5 Compute_Units consumed per Daily_Window.
5. WHEN the Daily_Window resets at UTC midnight, THE Quota_Service SHALL reset all per-User counters for the new window.
6. THE Node_API SHALL expose a `GET /api/user/quota` endpoint that returns the current User's remaining project creations and remaining Compute_Units for the current Daily_Window.
7. WHEN a Pro or Enterprise User attempts an action, THE Rate_Limiter SHALL permit the action without checking daily quotas.

---

### Requirement 4: Compute-Aware Quota Weighting

**User Story:** As a platform operator, I want analysis jobs weighted by structural complexity so that a large model consumes more quota than a small one, reflecting actual server cost.

#### Acceptance Criteria

1. THE Quota_Service SHALL assign a Compute_Unit weight to each analysis job before execution using the formula: `units = ceil(nodeCount / 50) + ceil(memberCount / 100)`, with a minimum of 1 unit per job.
2. WHEN an analysis job completes or is rejected, THE Quota_Service SHALL deduct the job's Compute_Unit weight from the User's remaining Daily_Window allowance.
3. WHEN a User's remaining Compute_Unit allowance is less than the weight of a requested analysis job, THE Rate_Limiter SHALL reject the request before execution with HTTP 429 and SHALL include the job's computed weight and the User's remaining allowance in the response body.
4. THE Node_API SHALL include the Compute_Unit weight of a pending analysis job in the pre-flight response so that the frontend can display the cost to the User before they confirm execution.
5. WHEN a User selects local Compute_Mode (WebGPU), THE Quota_Service SHALL NOT deduct Compute_Units from the User's server-side Daily_Window allowance for that job.

---

### Requirement 5: Project Collaboration

**User Story:** As a user, I want to share a project with another user so that we can work on the same structural model together.

#### Acceptance Criteria

1. WHEN a Project owner sends a collaboration invite to a valid User email address, THE Node_API SHALL create a Collaboration_Invite record linking the Project to the invited User and SHALL send a notification to the invited User.
2. WHEN an invited User accepts a Collaboration_Invite, THE Node_API SHALL grant that User read and write access to the Project and SHALL add the Project to the Collaborator's workspace view.
3. WHEN a Collaborator saves changes to a shared Project, THE Node_API SHALL persist the updated Project_State and update the `updatedAt` timestamp.
4. WHEN a Project owner revokes a Collaborator's access, THE Node_API SHALL remove the Collaboration_Invite record and SHALL prevent further access to the Project by that Collaborator within 5 seconds of revocation.
5. IF a collaboration invite is sent to an email address that does not correspond to a registered User, THEN THE Node_API SHALL return HTTP 404 with the message "No account found for that email address."
6. THE Node_API SHALL enforce that only the Project owner can send, modify, or revoke Collaboration_Invites for a given Project.
7. WHEN a Collaborator accesses a shared Project, THE Node_API SHALL return the full Project_State with the same fidelity as it would for the owner.
8. THE Node_API SHALL expose a `GET /api/projects/:id/collaborators` endpoint that returns the list of current Collaborators and their access status for a given Project.

---

### Requirement 6: Subscription Tier Feature Gating

**User Story:** As a product manager, I want each subscription tier to have a clearly defined and enforced feature set so that users only access capabilities included in their plan.

#### Acceptance Criteria

1. THE Tier_Config SHALL define three tiers — Free, Pro, and Enterprise — each with explicit values for: maximum Projects per Daily_Window, maximum Compute_Units per Daily_Window, collaboration access (boolean), PDF export (boolean), AI assistant (boolean), advanced design codes (boolean), and API access (boolean).
2. WHEN a User attempts to use a feature that is not included in their Subscription_Tier, THE Subscription_Provider SHALL return `canAccess(feature) = false` and THE System SHALL display an upgrade prompt.
3. THE Tier_Config SHALL define the following tier boundaries:
   - Free: 3 projects/day, 5 Compute_Units/day, no collaboration, no PDF export, no AI assistant, no API access.
   - Pro: unlimited projects, 100 Compute_Units/day, collaboration enabled, PDF export enabled, AI assistant enabled, no API access.
   - Enterprise: unlimited projects, unlimited Compute_Units, all features enabled including API access.
4. WHEN a User's Subscription_Tier changes (upgrade or downgrade), THE Subscription_Provider SHALL reflect the new tier within one page refresh without requiring a full logout/login cycle.
5. THE Node_API SHALL validate the User's Subscription_Tier on every quota-gated or feature-gated API request rather than relying solely on client-side checks.

---

### Requirement 7: Adaptive UI by Subscription Tier

**User Story:** As a user, I want the application interface to show only the features available in my plan so that I am not confused by locked or irrelevant controls.

#### Acceptance Criteria

1. WHEN a Free-tier User is authenticated, THE System SHALL render navigation items and feature controls that correspond only to Free-tier capabilities, visually distinguishing or hiding Pro and Enterprise features.
2. WHEN a Pro-tier User is authenticated, THE System SHALL render all Free and Pro features as active and SHALL visually indicate Enterprise-only features as requiring an upgrade.
3. WHEN an Enterprise-tier User is authenticated, THE System SHALL render all features as active with no upgrade prompts.
4. WHEN a Free-tier User interacts with a gated feature control, THE System SHALL display an upgrade modal identifying the feature, the tier that unlocks it, and a call-to-action to upgrade.
5. THE System SHALL NOT make API calls for features that are gated for the current User's tier, to avoid unnecessary server load.
6. WHEN the Subscription_Provider is loading the User's tier, THE System SHALL display the last cached tier state rather than hiding all gated content, to prevent layout shift.

---

### Requirement 8: WebGPU Local Compute Detection and Selection

**User Story:** As a user, I want to run structural analysis on my own GPU so that I can avoid consuming my server quota and get faster results on capable hardware.

#### Acceptance Criteria

1. WHEN the application loads, THE Analysis_Router SHALL detect whether the browser supports the WebGPU_Runtime by calling `navigator.gpu.requestAdapter()` and SHALL store the result in the Subscription_Provider context.
2. WHEN WebGPU_Runtime is available, THE Analysis_Router SHALL present the User with a Compute_Mode selector offering "Local (Your GPU)" and "Server" options before executing an analysis.
3. WHEN a User selects local Compute_Mode and initiates an analysis, THE Analysis_Router SHALL execute the analysis using the WebGPU_Runtime without sending the model to the Rust_API or Python_API.
4. WHEN a User selects server Compute_Mode, THE Analysis_Router SHALL route the analysis to the Rust_API or Python_API according to the existing routing rules.
5. IF the WebGPU_Runtime is not available in the browser, THEN THE Analysis_Router SHALL default to server Compute_Mode and SHALL NOT display the local compute option to the User.
6. WHEN a User selects local Compute_Mode, THE Analysis_Router SHALL perform a pre-flight capability check by estimating the model's memory footprint and comparing it against the available GPU memory reported by the WebGPU_Runtime adapter.
7. IF the estimated model memory footprint exceeds the available GPU memory, THEN THE Analysis_Router SHALL warn the User that the model may be too large for local compute and SHALL offer to fall back to server Compute_Mode.
8. WHEN a local Compute_Mode analysis completes successfully, THE Analysis_Router SHALL return a result conforming to the standard `AnalysisResult` interface with `computeMode: 'local'`.
9. IF a local Compute_Mode analysis fails at runtime, THEN THE Analysis_Router SHALL surface a descriptive error to the User and SHALL offer to retry using server Compute_Mode.

---

### Requirement 9: WebGPU Quota Exemption

**User Story:** As a platform operator, I want local compute jobs excluded from server quota consumption so that users who use their own hardware do not deplete server-side resources.

#### Acceptance Criteria

1. WHEN an analysis job is executed with `computeMode: 'local'`, THE Quota_Service SHALL NOT increment the User's Compute_Unit counter for the current Daily_Window.
2. WHEN an analysis job is executed with `computeMode: 'server'`, THE Quota_Service SHALL deduct the job's Compute_Unit weight from the User's Daily_Window allowance as defined in Requirement 4.
3. THE Node_API `GET /api/user/quota` response SHALL include a `localComputeAvailable` boolean field indicating whether the User's browser session has reported WebGPU support.
4. WHEN a Free-tier User has exhausted their server-side Compute_Unit allowance, THE System SHALL inform the User that local compute (if available) remains unrestricted and SHALL prompt them to switch to local Compute_Mode.
