/**
 * ============================================================================
 * API DOCUMENTATION GENERATOR
 * ============================================================================
 * 
 * Utilities for generating API documentation:
 * - OpenAPI/Swagger specification generation
 * - Endpoint documentation
 * - Request/response examples
 * - Authentication documentation
 * 
 * @version 1.0.0
 */

// ============================================================================
// OPENAPI SPECIFICATION
// ============================================================================

export interface OpenAPIInfo {
  title: string;
  version: string;
  description: string;
  contact?: {
    name: string;
    email: string;
    url: string;
  };
}

export interface OpenAPIEndpoint {
  path: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<number, OpenAPIResponse>;
  security?: Array<Record<string, string[]>>;
}

export interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  description?: string;
  schema: {
    type: string;
    format?: string;
    example?: any;
  };
}

export interface OpenAPIRequestBody {
  required: boolean;
  content: {
    'application/json': {
      schema: any;
      example?: any;
    };
  };
}

export interface OpenAPIResponse {
  description: string;
  content?: {
    'application/json': {
      schema: any;
      example?: any;
    };
  };
}

/**
 * Generate OpenAPI 3.0 specification
 */
export function generateOpenAPISpec(
  info: OpenAPIInfo,
  endpoints: OpenAPIEndpoint[]
): any {
  const paths: Record<string, any> = {};

  for (const endpoint of endpoints) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }

    paths[endpoint.path][endpoint.method] = {
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags || [],
      parameters: endpoint.parameters || [],
      requestBody: endpoint.requestBody,
      responses: endpoint.responses,
      security: endpoint.security || [],
    };
  }

  return {
    openapi: '3.0.0',
    info,
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://beamlab-backend-node.azurewebsites.net',
        description: 'Production server',
      },
    ],
    paths,
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        ClerkAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
        },
      },
      schemas: generateSchemas(),
    },
  };
}

/**
 * Generate common schemas
 */
function generateSchemas(): Record<string, any> {
  return {
    Error: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        code: { type: 'string' },
        status: { type: 'integer' },
        details: { type: 'object' },
      },
      required: ['message', 'code', 'status'],
    },
    Node: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        x: { type: 'number', format: 'double' },
        y: { type: 'number', format: 'double' },
        z: { type: 'number', format: 'double' },
        restraints: {
          type: 'array',
          items: { type: 'boolean' },
          minItems: 6,
          maxItems: 6,
        },
      },
      required: ['id', 'x', 'y', 'z'],
    },
    Member: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        nodeI: { type: 'string' },
        nodeJ: { type: 'string' },
        section: { type: 'string' },
        material: { type: 'string', enum: ['STEEL', 'CONCRETE'] },
        E: { type: 'number', description: 'Youngs modulus (MPa)' },
        A: { type: 'number', description: 'Cross-sectional area (mm²)' },
        Iz: { type: 'number', description: 'Moment of inertia about z-axis (mm⁴)' },
        Iy: { type: 'number', description: 'Moment of inertia about y-axis (mm⁴)' },
      },
      required: ['id', 'nodeI', 'nodeJ', 'E', 'A'],
    },
    AnalysisRequest: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          items: { $ref: '#/components/schemas/Node' },
        },
        members: {
          type: 'array',
          items: { $ref: '#/components/schemas/Member' },
        },
        loads: {
          type: 'array',
          items: { $ref: '#/components/schemas/Load' },
        },
      },
      required: ['nodes', 'members', 'loads'],
    },
    AnalysisResult: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        displacements: { type: 'array', items: { type: 'object' } },
        forces: { type: 'array', items: { type: 'object' } },
        error: { type: 'string', nullable: true },
      },
      required: ['success'],
    },
  };
}

// ============================================================================
// BEAMLAB API ENDPOINTS
// ============================================================================

/**
 * BeamLab API endpoint definitions
 */
export const BEAMLAB_API_ENDPOINTS: OpenAPIEndpoint[] = [
  // Health check
  {
    path: '/health',
    method: 'get',
    summary: 'Health check',
    description: 'Check if the API is healthy and responsive',
    tags: ['System'],
    responses: {
      200: {
        description: 'API is healthy',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'ok' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
  },

  // Analysis
  {
    path: '/api/analyze',
    method: 'post',
    summary: 'Run structural analysis',
    description: 'Perform linear static analysis on a structural model using Direct Stiffness Method',
    tags: ['Analysis'],
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/AnalysisRequest' },
          example: {
            nodes: [
              { id: 'N1', x: 0, y: 0, z: 0, restraints: [true, true, true, false, false, false] },
              { id: 'N2', x: 5000, y: 0, z: 0, restraints: [false, true, true, false, false, false] },
            ],
            members: [
              {
                id: 'M1',
                nodeI: 'N1',
                nodeJ: 'N2',
                section: 'ISMB 300',
                material: 'STEEL',
                E: 200000,
                A: 5626,
                Iz: 8603e4,
              },
            ],
            loads: [{ id: 'L1', nodeId: 'N2', Fx: 0, Fy: -50, Fz: 0, Mx: 0, My: 0, Mz: 0 }],
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Analysis completed successfully',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AnalysisResult' },
          },
        },
      },
      400: {
        description: 'Invalid input data',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      401: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },

  // Design codes
  {
    path: '/api/design/is456/flexural-capacity',
    method: 'post',
    summary: 'Calculate flexural capacity (IS 456)',
    description: 'Calculate flexural capacity of concrete beam per IS 456',
    tags: ['Design Codes', 'IS 456'],
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              b: { type: 'number', description: 'Width of beam (mm)' },
              d: { type: 'number', description: 'Effective depth (mm)' },
              fck: { type: 'number', description: 'Characteristic compressive strength (MPa)' },
              fy: { type: 'number', description: 'Yield strength of steel (MPa)' },
              Ast: { type: 'number', description: 'Area of tension steel (mm²)' },
            },
            required: ['b', 'd', 'fck', 'fy', 'Ast'],
          },
          example: {
            b: 300,
            d: 500,
            fck: 25,
            fy: 415,
            Ast: 1256,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Capacity calculated successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                Mu: { type: 'number', description: 'Ultimate moment capacity (kN·m)' },
                xu: { type: 'number', description: 'Depth of neutral axis (mm)' },
                xu_max: { type: 'number', description: 'Maximum allowed depth (mm)' },
                pt: { type: 'number', description: 'Percentage of tensile reinforcement' },
                passed: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  },

  // Sections database
  {
    path: '/api/sections',
    method: 'get',
    summary: 'List steel sections',
    description: 'Get list of available steel sections from database',
    tags: ['Sections'],
    parameters: [
      {
        name: 'type',
        in: 'query',
        required: false,
        description: 'Section type (ISMB, ISMC, etc.)',
        schema: { type: 'string' },
      },
      {
        name: 'limit',
        in: 'query',
        required: false,
        description: 'Maximum number of results',
        schema: { type: 'integer', example: 50 },
      },
    ],
    responses: {
      200: {
        description: 'List of sections',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  designation: { type: 'string' },
                  type: { type: 'string' },
                  mass: { type: 'number' },
                  area: { type: 'number' },
                  Iz: { type: 'number' },
                  Iy: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  },
];

/**
 * Generate BeamLab API specification
 */
export function generateBeamLabAPISpec(): any {
  return generateOpenAPISpec(
    {
      title: 'BeamLab API',
      version: '2.0.0',
      description: `
BeamLab Structural Engineering API

This API provides:
- **Structural Analysis**: Linear static, P-Delta, modal, buckling analysis
- **Design Codes**: IS 456 (concrete), IS 800 (steel), ACI 318, AISC 360, Eurocode 2/3
- **Sections Database**: Steel and concrete section properties
- **AI-Assisted Design**: AI-powered structural model generation

All endpoints require authentication via Clerk JWT tokens unless otherwise specified.
      `.trim(),
      contact: {
        name: 'BeamLab Support',
        email: 'support@beamlabultimate.tech',
        url: 'https://beamlabultimate.tech/contact',
      },
    },
    BEAMLAB_API_ENDPOINTS
  );
}

/**
 * Export OpenAPI spec as JSON
 */
export function exportOpenAPIJSON(): string {
  const spec = generateBeamLabAPISpec();
  return JSON.stringify(spec, null, 2);
}

/**
 * Export OpenAPI spec as YAML (simplified)
 */
export function exportOpenAPIYAML(): string {
  const spec = generateBeamLabAPISpec();
  // Basic YAML conversion (for full YAML, use a proper library)
  return JSON.stringify(spec, null, 2)
    .replace(/"([^"]+)":/g, '$1:')
    .replace(/,\n/g, '\n');
}
