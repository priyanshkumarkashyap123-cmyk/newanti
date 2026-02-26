/**
 * SketchRecognitionService.ts
 * 
 * Computer Vision Service for Structural Sketch Recognition
 * 
 * Features:
 * - Hand-drawn sketch to structural model conversion
 * - Line detection and classification
 * - Support/load symbol recognition
 * - Integration with Gemini Vision API
 */

// ============================================
// TYPES
// ============================================

export interface DetectedElement {
    id: string;
    type: 'node' | 'member' | 'support' | 'load' | 'dimension' | 'text';
    confidence: number;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    properties?: Record<string, any>;
}

export interface DetectedNode {
    id: string;
    x: number;
    y: number;
    confidence: number;
    isSupport: boolean;
    supportType?: 'pinned' | 'fixed' | 'roller';
}

export interface DetectedMember {
    id: string;
    startNodeId: string;
    endNodeId: string;
    confidence: number;
    estimatedLength?: number;
}

export interface DetectedLoad {
    id: string;
    nodeId?: string;
    memberId?: string;
    type: 'point' | 'distributed' | 'moment';
    direction: 'up' | 'down' | 'left' | 'right';
    confidence: number;
    magnitude?: number;
}

export interface SketchRecognitionResult {
    success: boolean;
    nodes: DetectedNode[];
    members: DetectedMember[];
    loads: DetectedLoad[];
    rawElements: DetectedElement[];
    structureType: 'beam' | 'frame' | 'truss' | 'unknown';
    confidence: number;
    warnings: string[];
}

export interface RecognitionOptions {
    useAI?: boolean;
    minConfidence?: number;
    detectDimensions?: boolean;
    detectText?: boolean;
}

// ============================================
// SKETCH RECOGNITION SERVICE
// ============================================

class SketchRecognitionServiceClass {
    private readonly GEMINI_VISION_ENDPOINT = '/api/ai/vision';

    /**
     * Process an image and extract structural elements
     */
    async recognizeSketch(
        imageData: string | Blob | File,
        options: RecognitionOptions = {}
    ): Promise<SketchRecognitionResult> {
        const { useAI = true, minConfidence = 0.6 } = options;

        try {
            // Convert to base64 if needed
            const base64Image = await this.toBase64(imageData);

            if (useAI) {
                return await this.recognizeWithGemini(base64Image, options);
            } else {
                return await this.recognizeWithCV(base64Image, options);
            }
        } catch (error) {
            console.error('[SketchRecognition] Error:', error);
            return {
                success: false,
                nodes: [],
                members: [],
                loads: [],
                rawElements: [],
                structureType: 'unknown',
                confidence: 0,
                warnings: ['Recognition failed: ' + (error as Error).message]
            };
        }
    }

    /**
     * Convert image to base64
     */
    private async toBase64(imageData: string | Blob | File): Promise<string> {
        if (typeof imageData === 'string') {
            // Already base64 or data URL
            return imageData.replace(/^data:image\/\w+;base64,/, '');
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result.replace(/^data:image\/\w+;base64,/, ''));
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageData);
        });
    }

    /**
     * Recognize using Gemini Vision API
     */
    private async recognizeWithGemini(
        base64Image: string,
        options: RecognitionOptions
    ): Promise<SketchRecognitionResult> {
        const prompt = `Analyze this structural engineering sketch and identify:
1. All nodes/joints (intersection points)
2. All members/beams/columns (lines connecting nodes)
3. Support conditions (triangles=pinned, squares=fixed, circles=roller)
4. Applied loads (arrows indicating forces)

Return a JSON object with this structure:
{
  "structureType": "beam" | "frame" | "truss",
  "nodes": [{"id": "N1", "x": 0, "y": 0, "isSupport": true, "supportType": "pinned"}],
  "members": [{"id": "M1", "startNodeId": "N1", "endNodeId": "N2"}],
  "loads": [{"nodeId": "N2", "type": "point", "direction": "down", "magnitude": 10}]
}

Coordinates should be normalized 0-100. Be precise about support types and load directions.`;

        try {
            const response = await fetch(this.GEMINI_VISION_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: base64Image,
                    prompt,
                    mimeType: 'image/png'
                })
            });

            if (!response.ok) {
                throw new Error('Vision API request failed');
            }

            const result = await response.json();
            return this.parseGeminiResponse(result.response, options.minConfidence || 0.6);

        } catch (error) {
            console.error('[SketchRecognition] Gemini error:', error);
            // Fallback to basic CV
            return this.recognizeWithCV(base64Image, options);
        }
    }

    /**
     * Parse Gemini response into structured result
     */
    private parseGeminiResponse(response: string, minConfidence: number): SketchRecognitionResult {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            const nodes: DetectedNode[] = (parsed.nodes || []).map((n: any, idx: number) => ({
                id: n.id || `N${idx + 1}`,
                x: n.x || 0,
                y: n.y || 0,
                confidence: 0.85,
                isSupport: n.isSupport || false,
                supportType: n.supportType
            }));

            const members: DetectedMember[] = (parsed.members || []).map((m: any, idx: number) => ({
                id: m.id || `M${idx + 1}`,
                startNodeId: m.startNodeId,
                endNodeId: m.endNodeId,
                confidence: 0.85
            }));

            const loads: DetectedLoad[] = (parsed.loads || []).map((l: any, idx: number) => ({
                id: `L${idx + 1}`,
                nodeId: l.nodeId,
                memberId: l.memberId,
                type: l.type || 'point',
                direction: l.direction || 'down',
                confidence: 0.80,
                magnitude: l.magnitude
            }));

            return {
                success: true,
                nodes,
                members,
                loads,
                rawElements: [],
                structureType: parsed.structureType || 'unknown',
                confidence: 0.85,
                warnings: []
            };

        } catch (error) {
            return {
                success: false,
                nodes: [],
                members: [],
                loads: [],
                rawElements: [],
                structureType: 'unknown',
                confidence: 0,
                warnings: ['Failed to parse AI response']
            };
        }
    }

    /**
     * Basic computer vision recognition (fallback)
     */
    private async recognizeWithCV(
        base64Image: string,
        options: RecognitionOptions
    ): Promise<SketchRecognitionResult> {
        // This would use Canvas/OpenCV for basic line detection
        // For now, return placeholder indicating manual is needed

        console.log('[SketchRecognition] CV mode - basic detection');

        return {
            success: false,
            nodes: [],
            members: [],
            loads: [],
            rawElements: [],
            structureType: 'unknown',
            confidence: 0,
            warnings: ['Basic CV not implemented - use AI mode or draw manually']
        };
    }

    /**
     * Convert recognition result to BeamLab model format
     */
    toBeamLabModel(result: SketchRecognitionResult, scale: number = 1): {
        nodes: Array<{ id: string; x: number; y: number; z: number }>;
        members: Array<{ id: string; startNodeId: string; endNodeId: string }>;
        supports: Array<{ nodeId: string; type: string; dofX: boolean; dofY: boolean; dofRz: boolean }>;
        loads: Array<{ nodeId: string; fy: number }>;
    } {
        const nodes = result.nodes.map(n => ({
            id: n.id,
            x: n.x * scale / 100,
            y: 0,
            z: n.y * scale / 100
        }));

        const members = result.members.map(m => ({
            id: m.id,
            startNodeId: m.startNodeId,
            endNodeId: m.endNodeId
        }));

        const supports = result.nodes
            .filter(n => n.isSupport)
            .map(n => ({
                nodeId: n.id,
                type: n.supportType || 'pinned',
                dofX: n.supportType === 'fixed' || n.supportType === 'pinned',
                dofY: true,
                dofRz: n.supportType === 'fixed'
            }));

        const loads = result.loads
            .filter(l => l.nodeId && l.type === 'point')
            .map(l => ({
                nodeId: l.nodeId!,
                fy: (l.direction === 'down' ? -1 : 1) * (l.magnitude || 10)
            }));

        return { nodes, members, supports, loads };
    }
}

// ============================================
// PDF PARSING SERVICE
// ============================================

export interface PDFParseResult {
    success: boolean;
    pages: number;
    drawings: Array<{
        pageNumber: number;
        elements: DetectedElement[];
        structureHint?: string;
    }>;
    tables: Array<{
        pageNumber: number;
        type: 'schedule' | 'loads' | 'materials' | 'unknown';
        data: Record<string, any>[];
    }>;
    text: string;
    warnings: string[];
}

class PDFParserServiceClass {
    /**
     * Parse structural drawing PDF
     */
    async parsePDF(file: File): Promise<PDFParseResult> {
        console.log('[PDFParser] Processing:', file.name);

        // This would integrate with pdf.js and Gemini Vision
        // For now, return placeholder

        return {
            success: false,
            pages: 0,
            drawings: [],
            tables: [],
            text: '',
            warnings: ['PDF parsing requires pdf.js integration - coming soon']
        };
    }

    /**
     * Extract tables from PDF (schedules, etc.)
     */
    async extractTables(file: File): Promise<PDFParseResult['tables']> {
        // Would use Gemini to extract tabular data
        return [];
    }
}

// ============================================
// EXPORTS
// ============================================

export const sketchRecognition = new SketchRecognitionServiceClass();
export const pdfParser = new PDFParserServiceClass();

export default {
    sketchRecognition,
    pdfParser
};
