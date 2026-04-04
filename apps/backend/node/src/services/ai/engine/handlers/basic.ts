import type { AIResponse } from '../types.js';

export function handleGreeting(): AIResponse {
  const greetings = [
    "Hello! I'm the AI Architect for BeamLab. I can help you create structures, run analyses, optimize designs, and check code compliance. What would you like to build today?",
    "Hi there! Ready to engineer something? I can create frames, trusses, bridges, buildings — just describe what you need in plain English.",
    "Welcome to BeamLab AI Architect! Tell me what structure you'd like to design and I'll generate it for you. I understand Indian Standards (IS 800, IS 456) and international codes too.",
  ];
  return { success: true, response: greetings[Math.floor(Math.random() * greetings.length)] };
}

export function handleThanks(): AIResponse {
  return { success: true, response: "You're welcome! Let me know if you need anything else — I'm here to help with your structural design." };
}

export function handleHelp(): AIResponse {
  return {
    success: true,
    response: `## 🏗️ AI Architect — What I Can Do

**Create Structures:**
- "Create a 10m span portal frame with 6m height"
- "Build a 3-story, 2-bay steel frame"
- "Make a 15m Pratt truss with 3m depth"
- "Design an industrial shed 20m × 10m"

**Modify Existing Model:**
- "Add another bay to the right"
- "Increase the height to 8m"
- "Add a third floor"
- "Change all columns to ISMB500"

**Apply Loads:**
- "Add 50 kN downward load at the top"
- "Apply UDL of 10 kN/m on all beams"
- "Add wind load of 1.5 kN/m² on the left face"

**Analyze & Check:**
- "Run static analysis"
- "Diagnose this model for issues"
- "Check code compliance per IS 800"
- "Optimize the sections"

**Learn & Explain:**
- "What is P-Delta analysis?"
- "Explain IS 800 slenderness limits"
- "What's the difference between ISMB and ISHB?"

💡 **Tip:** Be specific with dimensions and I'll generate more accurate models!`,
  };
}

export function handleClearModel(): AIResponse {
  return {
    success: true,
    response: '⚠️ This will clear the entire model. Click **Execute** to confirm.',
    actions: [{ type: 'clearModel', params: {}, description: 'Clear the entire model' }],
  };
}
