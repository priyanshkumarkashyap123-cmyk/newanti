# 👀 VISUAL WALKTHROUGH - What You'll See

## Opening the AI

Click the 🤖 icon in the bottom right corner

```
┌─────────────────────────────────────────┐
│  BeamLab AI Agent        [⚙️] [□] [×]  │
├─────────────────────────────────────────┤
│  12 nodes • 8 members                   │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │ Welcome to BeamLab AI!          │  │
│  │ I can help you create and       │  │
│  │ analyze structures.             │  │
│  └─────────────────────────────────┘  │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │ Type your request here...       │  │
│  │                          [Send] │  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## SCENARIO 1: Simple Request

### You Type:
```
"Create a 10m cantilever beam with 20 kN point load"
```

### What You See:

**Status bar updates:**
```
BeamLab AI Agent [ADVANCED]
Understanding your request...
No decomposition needed (simple query)
```

**Messages appear in order:**

```
┌────────────────────────────────────┐
│ 👤 YOU                             │
│ Create a 10m cantilever beam      │
│ with 20 kN point load             │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ ⏳ THINKING                         │
│ Analyzing your request...          │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ 📊 CONTEXT                         │
│ No existing model - will create    │
│ from scratch                       │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ 🧠 AI REASONING                    │
│ Creating a cantilever beam...      │
│                                    │
│ **Structure Design:**              │
│ - Length: 10m                      │
│ - Load: 20 kN at end              │
│ - Support: Fixed at base          │
│ - Max moment: 200 kN·m            │
│ - Deflection: 4.17mm              │
│ - Recommended: ISMB 300 section   │
└────────────────────────────────────┘

🏗️ Building structure...
   ✓ Node created (Base)
   ✓ Node created (End)
   ✓ Member created (Cantilever)
   ✓ Load applied (20 kN)
✅ Structure created successfully!
```

---

## SCENARIO 2: Medium Complexity

### You Type:
```
"Create a 20m span simply supported beam with 30 kN/m distributed load, 
then optimize for minimum weight"
```

### What You See:

**Header shows more detail:**
```
BeamLab AI Agent [ADVANCED]
Breaking down complex request...
Analyzing query → Identifying subtasks → Planning approach
```

**Messages appear with colors:**

```
┌────────────────────────────────────┐
│ 👤 YOU                             │
│ Create a 20m span simply...        │
│ then optimize for minimum weight   │
└────────────────────────────────────┘

🟠 ┌──────────────────────────────────┐
   │ 🔍 Breaking down complex request...│
   │    - Task 1: Design geometry     │
   │    - Task 2: Add loads           │
   │    - Task 3: Select section      │
   │    - Task 4: Optimize for weight │
   └──────────────────────────────────┘

🔵 ┌──────────────────────────────────┐
   │ 📊 Enriched context:             │
   │    No existing model             │
   │    Will create 3 nodes           │
   │    Load: 30 kN/m × 20m = 600 kN │
   └──────────────────────────────────┘

🧠 ┌──────────────────────────────────┐
   │ Using advanced reasoning...      │
   │ Applying IS 800 provisions       │
   │ Considering deflection limits    │
   │ Optimizing section selection     │
   └──────────────────────────────────┘

⚪ ┌──────────────────────────────────┐
   │ ## Simply Supported Beam Design  │
   │                                  │
   │ **Load Case:**                   │
   │ - Distributed: 30 kN/m           │
   │ - Span: 20m                      │
   │ - Reactions: 300 kN each         │
   │                                  │
   │ **Bending Moment:**              │
   │ M_max = wL²/8 = 1,500 kN·m      │
   │                                  │
   │ **Deflection Check:**            │
   │ δ = 5wL⁴/(384EI)                │
   │ Limit: L/360 = 55.6mm            │
   │                                  │
   │ **Section Selection:**           │
   │ - ISMB 500: I = 45,218 cm⁴      │
   │ - Weight: 120 kg/m               │
   │ - Stress: 245 MPa < 350 MPa ✓   │
   │ - Deflection: 35mm < 56mm ✓     │
   │                                  │
   │ **Optimization:**                │
   │ Weight already minimized          │
   │ (ISMB 450 insufficient)          │
   └──────────────────────────────────┘

🏗️ Building structure...
   ✓ Left support (Pinned)
   ✓ Right support (Roller)
   ✓ Beam member (ISMB 500)
   ✓ UDL applied (30 kN/m)
✅ Structure created and optimized!
```

**Status bar during execution:**
```
BeamLab AI Agent [ADVANCED]
Building structure... (Step 4 of 4)
Creating nodes → Adding members → Applying loads
```

---

## SCENARIO 3: Complex Engineering Problem

### You Type:
```
"Design a 30m span Warren truss for a roof, with 2 kN/m loading, 
create it, run analysis, check P-Delta effects, verify IS 800 compliance, 
and optimize for cost"
```

### What You See:

**Processing Status - Header evolves:**

```
Step 1 - Decomposing:
BeamLab AI Agent [ADVANCED]
Breaking down complex request...
Analyzing query → Identifying subtasks → Planning approach

Step 2 - Context:
BeamLab AI Agent [ADVANCED]
Enriching context with model state...
Analyzing model geometry → Calculating loads → Reviewing constraints

Step 3 - Reasoning:
BeamLab AI Agent [ADVANCED]
Reasoning through solution...
Applying engineering knowledge → Considering constraints → Generating plan

Step 4 - Building:
BeamLab AI Agent [ADVANCED]
Building structure... (Step 8 of 32)
Creating nodes → Adding members → Applying loads
```

**In the chat, you see:**

```
┌────────────────────────────────────┐
│ 👤 YOU                             │
│ Design a 30m span Warren truss...  │
│ [Full request shown]               │
└────────────────────────────────────┘

🟠 ┌──────────────────────────────────┐
   │ 🔍 Decomposing into subtasks:    │
   │    ✓ Design Warren geometry      │
   │    ✓ Calculate panel dimensions  │
   │    ✓ Add distributed loads       │
   │    ✓ Create truss members        │
   │    ✓ Run structural analysis     │
   │    ✓ Check P-Delta effects       │
   │    ✓ Verify IS 800 provisions    │
   │    ✓ Optimize for cost           │
   │    ✓ Generate final report       │
   └──────────────────────────────────┘

🔵 ┌──────────────────────────────────┐
   │ 📊 Enriched model context:       │
   │    - Span: 30m → Depth: 3-4m    │
   │    - Total load: 60 kN            │
   │    - Est. nodes: 15-20            │
   │    - Est. members: 40-50          │
   └──────────────────────────────────┘

🧠 ┌──────────────────────────────────┐
   │ 🧠 Applying advanced reasoning:  │
   │    ✓ Warren pattern optimal      │
   │    ✓ Panel width: 2.5m (12 pnls) │
   │    ✓ Diagonal pitch: 45°          │
   │    ✓ Chord members: ISMC 200     │
   │    ✓ Diagonal: ISA 75×75×8      │
   │    ✓ Weight: 1.2 tonnes           │
   └──────────────────────────────────┘

⚪ ┌──────────────────────────────────┐
   │ ## 30m Warren Truss Design       │
   │                                  │
   │ **Configuration:**               │
   │ - Type: Warren with verticals    │
   │ - Span: 30m                      │
   │ - Depth: 3.75m (L/8)             │
   │ - Panels: 12 × 2.5m              │
   │ - Total load: 60 kN              │
   │                                  │
   │ **Member Design:**               │
   │ Top chord: ISMC 200 (I=1465 cm⁴)│
   │ Bottom chord: ISMC 200           │
   │ Diagonals: ISA 75×75×8 (I=99)   │
   │ Verticals: ISA 65×65×6 (I=51)   │
   │                                  │
   │ **Analysis Results:**            │
   │ Max displacement: 8.2mm (✓<150) │
   │ Max chord stress: 145 MPa (✓)   │
   │ Max diagonal: 98 MPa (✓)        │
   │                                  │
   │ **P-Delta Check:**               │
   │ B2 amplifier: 1.08 (✓ < 1.1)    │
   │ Second-order moments: 8% (✓)    │
   │                                  │
   │ **Code Compliance (IS 800):**    │
   │ ✓ Slenderness check passed       │
   │ ✓ Deflection L/300 satisfied     │
   │ ✓ Design utilization: 78%        │
   │ ✓ Connection capacity verified   │
   │                                  │
   │ **Cost Optimization:**           │
   │ Current: ISMC 200 = Rs 45/kg     │
   │ Alternative: ISA angles only     │
   │ Savings: 12% reduction possible  │
   │ Recommendation: Keep ISMC (strength) │
   └──────────────────────────────────┘

🏗️ Building structure...
   ✓ Bottom chord nodes created (13 nodes)
   ✓ Top chord nodes created
   ✓ Bottom chord members connected
   ✓ Top chord members connected  
   ✓ Vertical members added
   ✓ Diagonal members added
   ✓ UDL applied to top chord
✅ Warren truss created!

📊 Analysis Results:
   Max displacement: 8.2mm
   Max stress: 145 MPa
   Status: ✅ SAFE

✅ All checks passed!
   - P-Delta: OK
   - IS 800: OK
   - Deflection: OK
   - Cost optimized: 12% savings possible
```

---

## Color Reference Chart

```
🟣 PURPLE GRADIENT - Your message
   "Create a beam..."

🟠 AMBER BACKGROUND - Task decomposition
   "🔍 Breaking down complex request..."

🔵 CYAN BACKGROUND - Reasoning/Context
   "📊 Enriched context: 12 nodes, 8 members"

⚪ GRAY - Thinking indicator
   "⏳ Analyzing your request..."

⚪ LIGHT GRAY - AI full response
   "## Beam Design Explanation..."

🔴 RED - Errors
   "❌ Error: Unstable structure"
```

---

## Header Status Evolution

```
START:
│ BeamLab AI Agent [ADVANCED]
│ 12 nodes • 8 members

PROCESSING SIMPLE:
│ BeamLab AI Agent [ADVANCED]  
│ Understanding your request...

PROCESSING COMPLEX:
│ BeamLab AI Agent [ADVANCED]
│ Breaking down complex request...
│ Analyzing query → Identifying subtasks → Planning approach

BUILDING:
│ BeamLab AI Agent [ADVANCED]
│ Building structure... (Step 5 of 12)
│ Creating nodes → Adding members → Applying loads

COMPLETE:
│ BeamLab AI Agent [ADVANCED]
│ 27 nodes • 45 members
```

---

## Interactive Elements

### Settings Panel (Click ⚙️)
```
┌─────────────────────────────────┐
│ Gemini API Key                  │
│ [•••••••••••••••] [Save]        │
│ ✅ Connected                     │
│                                 │
│ ☑ Auto-Execute                  │
│ ☑ Show Thinking                 │
└─────────────────────────────────┘
```

### Controls
- **⚙️ Settings** - Configure API key, options
- **□ Fullscreen** - Expand to full screen
- **×** - Collapse/minimize panel
- **🔄 Refresh** - Clear and restart
- **📜 History** - View past conversations

---

## Example Conversation Flow

```
You: "What's deflection formula?"
AI:  δ = 5wL⁴/(384EI)
     Where:
     - w = load per unit length
     - L = span
     - E = Young's modulus  
     - I = moment of inertia
     
You: "Apply it to a 20m beam with 10 kN/m"
AI:  📊 Enriched context for 20m beam...
     w = 10 kN/m, L = 20m
     δ = 5(10)(20)⁴/(384×200×I)
     For ISMB 400 (I=20458 cm⁴):
     δ = 32.5mm ✓ (within L/360 = 55.6mm)
     
You: "What section if we want < 30mm?"
AI:  Analyzing current results...
     Need higher I value
     ISMB 500 (I = 45,218):
     δ = 15.6mm ✓ (meets requirement)
     
You: "Create that structure"
AI:  🏗️ Building 20m beam with ISMB 500...
     ✅ Structure created!
```

---

## Key Observations

✅ **Color indicates what's happening:**
- 🟠 Orange = Breaking down
- 🔵 Blue = Thinking/analyzing
- ⚪ Gray = Normal response

✅ **Progress is visible:**
- Status updates in header
- Step-by-step messages
- Building progress shown

✅ **Reasoning is clear:**
- See calculations
- See code references
- See optimization process

✅ **Results are precise:**
- Specific values shown
- Code compliance stated
- Recommendations given

---

**Now when you open the AI, you'll see it WORKING, not just responding!** 🎉

Try complex requests and watch the AI break them down, reason through them, and build solutions!
