# AI Architect Gap Analysis
**Date:** March 17, 2026  
**Reviewer:** AIML Engineering Perspective (15 years experience)

---

## Executive Summary

The AI Architect is a hybrid rule-based + LLM system for generating structural models from natural language. The rule-based factory is solid and covers ~20 structure types. The LLM integration is broken in production (deprecated model), and the overall system lacks the feedback loops, validation, and intelligence expected of a production AI feature.

---

## Current Architecture

```
User Prompt
    │
    ▼
PromptAnalyzer.analyze()          ← Rule-based NLP (regex + keyword matching)
    │
    ▼
EnhancedAIArchitect.generate()
    ├── _try_factory_generation()  ← Deterministic factory (primary path)
    ├── _try_llm_generation()      ← Gemini LLM (fallback, currently broken)
    └── _fallback_generation()     ← Hardcoded 2-node beam (last resort)
```

---

## Gap 1: Deprecated LLM Model — Production Broken

**File:** `apps/backend-python/ai_architect.py` line ~430  
**Severity:** CRITICAL

```python
model = genai.GenerativeModel('gemini-pro')  # ❌ Deprecated Feb 2024
```

`gemini-pro` was deprecated in February 2024 and returns 404 errors. The LLM path silently fails and falls through to the fallback (a hardcoded 2-node beam). Users who trigger the LLM path get a useless result with no error message.

**Fix:**
```python
model = genai.GenerativeModel('gemini-1.5-flash')  # Fast, cheap, capable
# or
model = genai.GenerativeModel('gemini-2.0-flash')  # Latest
```

Also: The system prompt (`SYSTEM_PROMPT_v2`) should be reviewed — it was written for `gemini-pro` and may not leverage the longer context window of 1.5/2.0 models.

---

## Gap 2: No Validation of Generated Models

**Severity:** MAJOR

Neither factory-generated nor LLM-generated models are validated before being returned to the frontend. Issues that can silently pass through:

- Disconnected nodes (nodes with no members attached)
- Members referencing non-existent node IDs
- Unstable structures (insufficient supports, mechanism)
- Zero-length members (duplicate node coordinates)
- Singular stiffness matrix (will crash the FEA solver)

**What's needed:**
```python
class ModelValidator:
    def validate(self, model: dict) -> ValidationResult:
        # 1. All member node references exist
        # 2. No zero-length members
        # 3. At least 1 support node
        # 4. Structure is connected (graph connectivity check)
        # 5. Degrees of freedom check (not a mechanism)
        # 6. Reasonable coordinate ranges (not 1000m spans)
```

---

## Gap 3: No Feedback Loop Between AI and Analysis Results

**Severity:** MAJOR

The AI generates a model, the user runs analysis, but the results never feed back to improve the model. A production AI architect should:

1. Detect when analysis fails (singular matrix, excessive deflection, member overstress)
2. Suggest model corrections ("Member M3 is overstressed at 145% — suggest upgrading to ISMB400")
3. Offer section optimization ("Based on analysis, ISMB250 is sufficient for this span/load")

Currently the AI is a one-shot generator with no awareness of analysis outcomes.

---

## Gap 4: Rust AI Architect is a Stub

**File:** `apps/backend-rust/src/ai_architect.rs`  
**Severity:** MAJOR

```rust
pub fn suggest_beam_size(span: f64, load: f64) -> String {
    format!("IPE {}", (span * load / 10.0).round())  // ❌ Fake formula
}
```

This function is called from the Rust API but produces nonsensical results. `span * load / 10` has no dimensional consistency. For a 10m span with 5 kN/m load it returns "IPE 5" which doesn't exist.

**Correct approach:**
```rust
pub fn suggest_beam_size(span_m: f64, w_kn_m: f64, fy_mpa: f64) -> String {
    // Required Zx = Mu / (fy/γm0)
    // Mu = wL²/8 for simply supported
    let mu_knm = w_kn_m * span_m.powi(2) / 8.0;
    let gamma_m0 = 1.10;
    let zx_req_mm3 = mu_knm * 1e6 * gamma_m0 / fy_mpa;
    // Look up nearest ISMB section with Zx >= zx_req
    select_ismb_section(zx_req_mm3)
}
```

---

## Gap 5: NLP is Regex-Only — No Semantic Understanding

**Severity:** MAJOR

The `PromptAnalyzer` uses regex patterns and keyword lists. This breaks on:

- Paraphrasing: "a beam that spans 8 metres carrying 10 kN per metre" → fails to extract span
- Ambiguity: "design a 5 storey building" — doesn't know if it's RC or steel
- Context: "same as before but 3 storeys" — no conversation memory
- Units: "20 feet span" → not handled (only metres)
- Mixed languages: Hindi/English code-switching common in Indian engineering context

**What's needed:**
- Use the LLM for parameter extraction, not just generation
- Structured output mode (Gemini/GPT function calling) to extract parameters reliably
- Conversation history for iterative refinement

---

## Gap 6: No Section Optimization

**Severity:** MAJOR

The AI generates structures with hardcoded section profiles (`ISMB300`, `ISA100x100x10`, etc.) regardless of the actual loads. There is no optimization loop that:

1. Runs analysis with initial sections
2. Checks utilization ratios
3. Upgrades overstressed members
4. Downgrades under-utilized members
5. Converges to an optimal design

This is table-stakes functionality for a structural AI tool.

---

## Gap 7: No Load Generation from Codes

**Severity:** MAJOR

The AI generates geometry but not loads. Users must manually add loads. A production system should:

- Auto-generate IS 875 Part 1 (dead loads) based on floor type
- Auto-generate IS 875 Part 2 (live loads) based on occupancy
- Auto-generate IS 875 Part 3 (wind loads) based on location and height
- Auto-generate IS 1893 (seismic loads) based on zone and building type

The `IS_875_LOADS` and `IS_SECTIONS` dictionaries exist in `ai_architect.py` but are never used in load generation.

---

## Gap 8: No Confidence Scoring or Uncertainty Communication

**Severity:** MODERATE

When the AI generates a model, it doesn't communicate:
- How confident it is in the interpretation
- What assumptions were made (e.g., "assumed simply supported, assumed E250 steel")
- What parameters were defaulted vs. extracted from the prompt
- Whether the LLM or factory path was used

Users have no way to know if the generated model matches their intent.

---

## Gap 9: LLM Response Parsing is Fragile

**Severity:** MODERATE

```python
def _clean_json(self, raw_text: str) -> str:
    cleaned = raw_text.replace("```json", "").replace("```", "").strip()
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    ...
```

This will fail on:
- Nested JSON with comments
- LLM responses that include explanation text before/after JSON
- Malformed JSON from the LLM

**Fix:** Use Gemini's structured output / JSON mode:
```python
model = genai.GenerativeModel(
    'gemini-1.5-flash',
    generation_config={"response_mime_type": "application/json"}
)
```

---

## Gap 10: No Caching of Generated Models

**Severity:** MODERATE

Every identical prompt generates a new model. For common prompts ("10m simply supported beam with 5 kN/m UDL"), the result is deterministic from the factory. These should be cached (Redis/in-memory) to avoid redundant computation and LLM API calls.

---

## Recommended Improvements (Priority Order)

### P0 — Fix Immediately
1. Update Gemini model to `gemini-1.5-flash` or `gemini-2.0-flash`
2. Add model validation before returning to frontend
3. Fix Rust `suggest_beam_size` stub

### P1 — Next Sprint
4. Use LLM structured output (JSON mode) for reliable parsing
5. Add assumption logging — tell users what was defaulted
6. Add IS 875 automatic load generation
7. Implement basic section optimization loop (3 iterations max)

### P2 — Roadmap
8. Replace regex NLP with LLM-based parameter extraction (function calling)
9. Add conversation memory for iterative refinement
10. Add feedback loop: analysis results → AI suggestions
11. Add confidence scoring
12. Add Redis caching for common prompts
