export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "BeamLab Ultimate Node API",
    version: process.env.npm_package_version || "2.1.0",
    description:
      "Authentication, project, billing, and collaboration APIs for BeamLab Ultimate.",
  },
  servers: [
    { url: "/api", description: "Legacy API base path" },
    { url: "/api/v1", description: "Versioned API base path" },
  ],
  paths: {
    "/health": {
      get: {
        operationId: "getHealth",
        summary: "Service health check",
        responses: {
          "200": { description: "Service healthy" },
          "503": { description: "Service degraded" },
        },
      },
    },
    "/auth/signup": {
      post: {
        operationId: "signUpUser",
        summary: "Register a new user account",
        responses: {
          "201": { description: "User created" },
          "400": { description: "Validation failed" },
          "409": { description: "Email already exists" },
        },
      },
    },
    "/auth/signin": {
      post: {
        operationId: "signInUser",
        summary: "Authenticate user and return tokens",
        responses: {
          "200": { description: "Signed in" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/project": {
      get: {
        operationId: "listProjects",
        summary: "List projects for current user",
        responses: {
          "200": { description: "Project list" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/billing/create-order": {
      post: {
        operationId: "createBillingOrder",
        summary: "Create payment order",
        responses: {
          "200": {
            description: "Order created with orderId, amount, currency, keyId",
          },
          "429": { description: "Rate limited" },
          "503": { description: "Payment service unavailable" },
        },
      },
    },
  },
} as const;
