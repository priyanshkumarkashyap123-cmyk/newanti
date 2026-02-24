# Unit & Tolerance Guard Plan

- Normalize all engine inputs to SI inside the computation layer; convert at UI/API boundaries only.
- Validate incoming payloads: explicit unit fields or context; reject ambiguous mixes.
- Tolerance policy: abs for small magnitudes (e.g., deflection mm), rel for larger (moments/forces). Default: abs=1e-3 where meaningful, rel=5e-3 unless domain overrides.
- Each regression fixture declares its tolerances; harness uses them per key.
- Add unit schema/types in TypeScript and Rust (e.g., discriminated unions) to prevent mm/kN vs ft/kips mix-ups.
