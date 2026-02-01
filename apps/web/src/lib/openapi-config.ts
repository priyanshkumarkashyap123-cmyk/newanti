/**
 * OpenAPI Client Generator Configuration
 * Industry-standard API client generation from OpenAPI specs
 * 
 * Features:
 * - Type-safe API clients
 * - Auto-generation from OpenAPI/Swagger specs
 * - Runtime validation
 * - Request/response typing
 */

export interface OpenAPIConfig {
  input: string;
  output: string;
  client?: 'fetch' | 'axios';
  useTypeScript?: boolean;
  generateModels?: boolean;
  generateServices?: boolean;
}

/**
 * Default configuration for OpenAPI code generation
 */
export const openApiConfig: OpenAPIConfig = {
  input: './api/openapi.yaml',
  output: './src/api/generated',
  client: 'fetch',
  useTypeScript: true,
  generateModels: true,
  generateServices: true,
};

/**
 * Package.json script to add for OpenAPI generation:
 * "generate:api": "openapi-generator-cli generate -i ./api/openapi.yaml -g typescript-fetch -o ./src/api/generated"
 */

/**
 * Sample OpenAPI specification structure
 */
export const sampleOpenApiSpec = `
openapi: 3.0.3
info:
  title: Structura AI API
  version: 1.0.0
  description: Structural engineering analysis platform API

servers:
  - url: https://api.structura.ai/v1
    description: Production server
  - url: https://api-staging.structura.ai/v1
    description: Staging server

paths:
  /health:
    get:
      summary: Health check
      operationId: getHealth
      responses:
        '200':
          description: API is healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'

  /projects:
    get:
      summary: List all projects
      operationId: getProjects
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: List of projects
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProjectListResponse'

    post:
      summary: Create a new project
      operationId: createProject
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateProjectRequest'
      responses:
        '201':
          description: Project created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProjectResponse'

components:
  schemas:
    HealthResponse:
      type: object
      properties:
        status:
          type: string
          enum: [healthy, degraded, unhealthy]
        version:
          type: string
        timestamp:
          type: string
          format: date-time

    Project:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        description:
          type: string
        status:
          type: string
          enum: [draft, active, completed, archived]
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    ProjectListResponse:
      type: object
      properties:
        projects:
          type: array
          items:
            $ref: '#/components/schemas/Project'
        total:
          type: integer
        page:
          type: integer
        limit:
          type: integer

    CreateProjectRequest:
      type: object
      required:
        - name
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        description:
          type: string
          maxLength: 500

    ProjectResponse:
      type: object
      properties:
        project:
          $ref: '#/components/schemas/Project'

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []
`;
