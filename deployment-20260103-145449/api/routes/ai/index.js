import { Router } from "express";
import { modelGeneratorService } from "../../services/ai/index.js";
const router = Router();
router.post("/generate", async (req, res) => {
  try {
    const { prompt, constraints } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "Missing required field: prompt"
      });
    }
    if (prompt.length > 2e3) {
      return res.status(400).json({
        success: false,
        error: "Prompt too long (max 2000 characters)"
      });
    }
    console.log(`[AI] Generate request: "${prompt.substring(0, 100)}..."`);
    const result = await modelGeneratorService.generate({
      prompt,
      constraints
    });
    if (!result.success) {
      return res.status(500).json(result);
    }
    const validation = modelGeneratorService.validateModel(result.model);
    if (!validation.valid) {
      console.warn("[AI] Generated model has issues:", validation.issues);
    }
    return res.json({
      ...result,
      validation
    });
  } catch (error) {
    console.error("[AI] Generation error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
router.post("/validate", async (req, res) => {
  try {
    const { model } = req.body;
    if (!model || !model.nodes || !model.members) {
      return res.status(400).json({
        success: false,
        error: "Invalid model structure"
      });
    }
    const validation = modelGeneratorService.validateModel(model);
    return res.json({
      success: true,
      ...validation
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
router.get("/templates", (_req, res) => {
  res.json({
    success: true,
    templates: [
      { id: "simple-beam", name: "Simple Beam", prompt: "Create a simple supported beam of 6m span" },
      { id: "portal-frame", name: "Portal Frame", prompt: "Create a single-bay portal frame with 6m span and 4m height" },
      { id: "truss", name: "Pratt Truss", prompt: "Create a 12m span Pratt truss with 3m height" },
      { id: "2-story-frame", name: "2-Story Frame", prompt: "Create a 2-story steel frame with 2 bays of 6m each and 3.5m floor height" }
    ]
  });
});
var ai_default = router;
export {
  ai_default as default
};
//# sourceMappingURL=index.js.map
