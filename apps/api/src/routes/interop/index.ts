/**
 * interop/index.ts - File Interoperability API Routes
 * 
 * Provides endpoints for:
 * - STAAD.Pro import/export
 * - DXF import
 * - Report generation
 */

import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Python backend
const PYTHON_PATH = path.join(__dirname, '..', '..', '..', 'backend-python');

// ============================================
// HELPER: Execute Python Script
// ============================================

interface PythonResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

async function runPythonScript(script: string, input: unknown): Promise<PythonResult> {
    return new Promise((resolve) => {
        const pythonProcess = spawn('python3', ['-c', script], {
            cwd: PYTHON_PATH,
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdin.write(JSON.stringify(input));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout);
                    resolve({ success: true, data: result });
                } catch {
                    resolve({ success: true, data: stdout });
                }
            } else {
                resolve({ success: false, error: stderr || 'Python script failed' });
            }
        });

        pythonProcess.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}

// ============================================
// STAAD.Pro IMPORT
// ============================================

/**
 * POST /api/interop/staad/import
 * Parse STAAD.Pro .std file content
 */
router.post('/staad/import', async (req: Request, res: Response) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Missing file content' });
        }

        const script = `
import json
import sys
sys.path.insert(0, '.')
from analysis.interop import STAADImporter

input_data = json.loads(sys.stdin.read())
content = input_data['content']

importer = STAADImporter()
result = importer.parse(content)

print(json.dumps({
    'success': True,
    'model': {
        'nodes': [{'id': n['id'], 'x': n['x'], 'y': n['y'], 'z': n['z']} for n in result.get('nodes', [])],
        'members': [{'id': m['id'], 'startNodeId': m['start'], 'endNodeId': m['end']} for m in result.get('members', [])],
        'supports': result.get('supports', []),
    },
    'stats': {
        'nodesCount': len(result.get('nodes', [])),
        'membersCount': len(result.get('members', [])),
        'supportsCount': len(result.get('supports', [])),
        'loadCasesCount': len(result.get('load_cases', [])),
    }
}))
`;

        const result = await runPythonScript(script, { content });

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        return res.json(result.data);
    } catch (error) {
        console.error('STAAD import error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Import failed',
        });
    }
});

// ============================================
// STAAD.Pro EXPORT
// ============================================

/**
 * POST /api/interop/staad/export
 * Export model to STAAD.Pro format
 */
router.post('/staad/export', async (req: Request, res: Response) => {
    try {
        const { model } = req.body;

        if (!model) {
            return res.status(400).json({ error: 'Missing model data' });
        }

        const script = `
import json
import sys
sys.path.insert(0, '.')
from analysis.interop import STAADExporter

input_data = json.loads(sys.stdin.read())
model = input_data['model']

exporter = STAADExporter()
content = exporter.export_model(
    nodes=model.get('nodes', []),
    members=model.get('members', []),
    supports=model.get('supports', []),
    title=model.get('metadata', {}).get('title', 'Exported Model')
)

print(json.dumps({
    'success': True,
    'content': content
}))
`;

        const result = await runPythonScript(script, { model });

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        return res.json(result.data);
    } catch (error) {
        console.error('STAAD export error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Export failed',
        });
    }
});

// ============================================
// DXF IMPORT
// ============================================

/**
 * POST /api/interop/dxf/import
 * Parse DXF file and extract structural geometry
 */
router.post('/dxf/import', async (req: Request, res: Response) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Missing file content' });
        }

        const script = `
import json
import sys
sys.path.insert(0, '.')
from analysis.interop import DXFImporter

input_data = json.loads(sys.stdin.read())
content = input_data['content']

importer = DXFImporter()
result = importer.parse(content)

# Convert to structural model
nodes = []
members = []
node_map = {}

for i, line in enumerate(result.get('lines', [])):
    # Get or create start node
    start_key = f"{line['x1']:.3f},{line['y1']:.3f},{line['z1']:.3f}"
    if start_key not in node_map:
        node_id = f"N{len(node_map) + 1}"
        node_map[start_key] = node_id
        nodes.append({'id': node_id, 'x': line['x1'], 'y': line['y1'], 'z': line['z1']})
    
    # Get or create end node
    end_key = f"{line['x2']:.3f},{line['y2']:.3f},{line['z2']:.3f}"
    if end_key not in node_map:
        node_id = f"N{len(node_map) + 1}"
        node_map[end_key] = node_id
        nodes.append({'id': node_id, 'x': line['x2'], 'y': line['y2'], 'z': line['z2']})
    
    # Create member
    members.append({
        'id': f"M{i + 1}",
        'startNodeId': node_map[start_key],
        'endNodeId': node_map[end_key]
    })

print(json.dumps({
    'success': True,
    'nodes': nodes,
    'members': members,
    'layers': result.get('layers', []),
    'stats': {
        'linesCount': len(result.get('lines', [])),
        'nodesCount': len(nodes),
        'membersCount': len(members)
    }
}))
`;

        const result = await runPythonScript(script, { content });

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        return res.json(result.data);
    } catch (error) {
        console.error('DXF import error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Import failed',
        });
    }
});

// ============================================
// REPORT GENERATION
// ============================================

/**
 * POST /api/interop/report/generate
 * Generate analysis/design report
 */
router.post('/report/generate', async (req: Request, res: Response) => {
    try {
        const { model, results, options } = req.body;

        if (!model || !options) {
            return res.status(400).json({ error: 'Missing model or options' });
        }

        const script = `
import json
import sys
sys.path.insert(0, '.')
from analysis.interop import ReportDataGenerator

input_data = json.loads(sys.stdin.read())
model = input_data['model']
results = input_data.get('results', {})
options = input_data['options']

generator = ReportDataGenerator()
report_data = generator.generate_full_report(
    model=model,
    analysis_results=results,
    design_results=results.get('design', {}),
    title=options.get('title', 'Structural Analysis Report')
)

print(json.dumps({
    'success': True,
    'reportData': report_data,
    'htmlContent': generator.to_html(report_data) if hasattr(generator, 'to_html') else None
}))
`;

        const result = await runPythonScript(script, { model, results, options });

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        return res.json(result.data);
    } catch (error) {
        console.error('Report generation error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Report generation failed',
        });
    }
});

// ============================================
// JSON MODEL VALIDATION
// ============================================

/**
 * POST /api/interop/validate
 * Validate model structure
 */
router.post('/validate', async (req: Request, res: Response) => {
    try {
        const { model } = req.body;

        const errors: string[] = [];
        const warnings: string[] = [];

        // Check nodes
        if (!model.nodes || !Array.isArray(model.nodes)) {
            errors.push('Missing or invalid nodes array');
        } else {
            const nodeIds = new Set<string>();
            for (const node of model.nodes) {
                if (!node.id) errors.push('Node missing ID');
                if (nodeIds.has(node.id)) errors.push(`Duplicate node ID: ${node.id}`);
                nodeIds.add(node.id);
                if (node.x === undefined || node.y === undefined) {
                    errors.push(`Node ${node.id} missing coordinates`);
                }
            }
        }

        // Check members
        if (!model.members || !Array.isArray(model.members)) {
            errors.push('Missing or invalid members array');
        } else {
            const nodeIds = new Set(model.nodes?.map((n: { id: string }) => n.id) || []);
            for (const member of model.members) {
                if (!member.id) errors.push('Member missing ID');
                if (!nodeIds.has(member.startNodeId)) {
                    errors.push(`Member ${member.id} references unknown start node: ${member.startNodeId}`);
                }
                if (!nodeIds.has(member.endNodeId)) {
                    errors.push(`Member ${member.id} references unknown end node: ${member.endNodeId}`);
                }
                if (member.startNodeId === member.endNodeId) {
                    errors.push(`Member ${member.id} has same start and end node`);
                }
            }
        }

        // Check supports
        if (model.supports && Array.isArray(model.supports)) {
            const nodeIds = new Set(model.nodes?.map((n: { id: string }) => n.id) || []);
            for (const support of model.supports) {
                if (!nodeIds.has(support.nodeId)) {
                    warnings.push(`Support references unknown node: ${support.nodeId}`);
                }
            }
        }

        return res.json({
            valid: errors.length === 0,
            errors,
            warnings,
        });
    } catch (error) {
        console.error('Validation error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Validation failed',
        });
    }
});

// ============================================
// SUPPORTED FORMATS
// ============================================

/**
 * GET /api/interop/formats
 * Get list of supported file formats
 */
router.get('/formats', (_req: Request, res: Response) => {
    res.json({
        import: [
            { id: 'json', name: 'JSON Model', extension: '.json', description: 'BeamLab native format' },
            { id: 'std', name: 'STAAD.Pro', extension: '.std', description: 'STAAD.Pro input file' },
            { id: 'dxf', name: 'AutoCAD DXF', extension: '.dxf', description: 'DXF geometry (LINE entities)' },
        ],
        export: [
            { id: 'json', name: 'JSON Model', extension: '.json', description: 'BeamLab native format' },
            { id: 'std', name: 'STAAD.Pro', extension: '.std', description: 'STAAD.Pro input file' },
            { id: 'csv', name: 'CSV', extension: '.csv', description: 'Comma-separated values' },
            { id: 'pdf', name: 'PDF Report', extension: '.pdf', description: 'Analysis report' },
        ],
    });
});

export default router;
