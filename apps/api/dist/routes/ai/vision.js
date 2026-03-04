import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireAuth } from "../../middleware/authMiddleware.js";
const router = Router();
router.use(requireAuth());
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
router.post("/", async (req, res) => {
  try {
    const { image, prompt, mimeType = "image/png" } = req.body;
    if (!image || !prompt) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: image, prompt"
      });
    }
    if (typeof image === "string" && image.length > MAX_IMAGE_SIZE) {
      return res.status(413).json({
        success: false,
        error: `Image too large. Maximum size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`
      });
    }
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const imagePart = {
      inlineData: {
        data: image.replace(/^data:image\/\w+;base64,/, ""),
        mimeType
      }
    };
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    console.log("[Vision API] Processed image successfully");
    return res.json({
      success: true,
      response: text
    });
  } catch (error) {
    console.error("[Vision API] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Vision processing failed"
    });
  }
});
var vision_default = router;
export {
  vision_default as default
};
//# sourceMappingURL=vision.js.map
