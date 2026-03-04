import { z } from "zod";
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code
      }));
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
const restraintsSchema = z.object({
  fx: z.boolean().optional().default(false),
  fy: z.boolean().optional().default(false),
  fz: z.boolean().optional().default(false),
  mx: z.boolean().optional().default(false),
  my: z.boolean().optional().default(false),
  mz: z.boolean().optional().default(false)
}).optional();
const nodeSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite().optional().default(0),
  restraints: restraintsSchema
});
const memberSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  startNodeId: z.union([z.string(), z.number()]).transform(String),
  endNodeId: z.union([z.string(), z.number()]).transform(String),
  E: z.number().positive().optional().default(2e8),
  A: z.number().positive().optional().default(0.01),
  I: z.number().positive().optional().default(1e-4)
}).refine((data) => data.startNodeId !== data.endNodeId, {
  message: "Start and end nodes cannot be the same",
  path: ["endNodeId"]
});
const loadSchema = z.object({
  nodeId: z.union([z.string(), z.number()]).transform(String),
  fx: z.number().finite().optional().default(0),
  fy: z.number().finite().optional().default(0),
  fz: z.number().finite().optional().default(0),
  mx: z.number().finite().optional().default(0),
  my: z.number().finite().optional().default(0),
  mz: z.number().finite().optional().default(0)
});
const analyzeRequestSchema = z.object({
  nodes: z.array(nodeSchema).min(2, "At least 2 nodes are required"),
  members: z.array(memberSchema).min(1, "At least 1 member is required"),
  loads: z.array(loadSchema).optional().default([]),
  dofPerNode: z.number().int().min(1).max(6).optional().default(3),
  options: z.object({
    method: z.enum(["spsolve", "cg", "gmres"]).optional().default("spsolve")
  }).optional()
});
const sectionPropertiesSchema = z.object({
  name: z.string().min(1),
  area: z.number().positive(),
  depth: z.number().positive(),
  width: z.number().positive(),
  webThickness: z.number().positive(),
  flangeThickness: z.number().positive(),
  Iy: z.number().positive(),
  Iz: z.number().positive(),
  Zy: z.number().positive().optional(),
  Zz: z.number().positive().optional(),
  ry: z.number().positive(),
  rz: z.number().positive()
});
const designForcesSchema = z.object({
  N: z.number().finite(),
  Vy: z.number().finite(),
  Vz: z.number().finite(),
  My: z.number().finite(),
  Mz: z.number().finite()
});
const steelDesignSchema = z.object({
  code: z.enum(["IS800", "AISC360"]),
  section: sectionPropertiesSchema,
  geometry: z.object({
    length: z.number().positive(),
    effectiveLengthY: z.number().positive().optional(),
    effectiveLengthZ: z.number().positive().optional(),
    unbracedLength: z.number().positive().optional(),
    Cb: z.number().positive().optional().default(1)
  }),
  forces: designForcesSchema,
  material: z.object({
    fy: z.number().positive(),
    fu: z.number().positive(),
    E: z.number().positive().optional().default(2e5)
  }),
  designMethod: z.enum(["LRFD", "ASD"]).optional().default("LRFD")
});
const concreteBeamSchema = z.object({
  section: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    effectiveDepth: z.number().positive(),
    cover: z.number().positive().optional().default(40)
  }),
  forces: z.object({
    Mu: z.number().finite(),
    Vu: z.number().finite()
  }),
  material: z.object({
    fck: z.number().positive(),
    fy: z.number().positive()
  })
});
const concreteColumnSchema = z.object({
  section: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    cover: z.number().positive().optional().default(40)
  }),
  forces: z.object({
    Pu: z.number().finite(),
    Mux: z.number().finite(),
    Muy: z.number().finite()
  }),
  geometry: z.object({
    unsupportedLength: z.number().positive(),
    effectiveLengthFactor: z.number().positive().optional().default(1)
  }),
  material: z.object({
    fck: z.number().positive(),
    fy: z.number().positive()
  })
});
const connectionDesignSchema = z.object({
  type: z.enum(["bolted_shear", "bolted_moment", "welded", "base_plate"]),
  forces: z.object({
    shear: z.number().finite().optional(),
    tension: z.number().finite().optional(),
    moment: z.number().finite().optional(),
    axial: z.number().finite().optional()
  }),
  bolt: z.object({
    diameter: z.number().positive(),
    grade: z.string(),
    numBolts: z.number().int().positive().optional(),
    rows: z.number().int().positive().optional(),
    columns: z.number().int().positive().optional(),
    pitch: z.number().positive().optional(),
    gauge: z.number().positive().optional()
  }).optional(),
  weld: z.object({
    size: z.number().positive(),
    length: z.number().positive(),
    type: z.enum(["fillet", "butt"])
  }).optional(),
  plate: z.object({
    thickness: z.number().positive(),
    fy: z.number().positive(),
    width: z.number().positive().optional(),
    length: z.number().positive().optional()
  }).optional(),
  material: z.object({
    fu: z.number().positive(),
    fy: z.number().positive()
  }).optional()
});
const foundationDesignSchema = z.object({
  type: z.enum(["isolated", "combined", "mat"]),
  loads: z.array(z.object({
    P: z.number().finite(),
    Mx: z.number().finite().optional().default(0),
    My: z.number().finite().optional().default(0),
    x: z.number().finite().optional(),
    y: z.number().finite().optional()
  })).min(1),
  columnSize: z.object({
    width: z.number().positive(),
    depth: z.number().positive()
  }),
  soil: z.object({
    bearingCapacity: z.number().positive(),
    soilType: z.string().optional()
  }),
  material: z.object({
    fck: z.number().positive(),
    fy: z.number().positive()
  }),
  minDepth: z.number().positive().optional()
});
const advancedNodeSchema = z.object({
  id: z.number(),
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite().optional().default(0)
});
const advancedMemberSchema = z.object({
  id: z.number(),
  startNode: z.number(),
  endNode: z.number(),
  E: z.number().positive(),
  A: z.number().positive(),
  I: z.number().positive(),
  J: z.number().positive().optional(),
  behavior: z.enum(["normal", "tension_only", "compression_only", "cable"]).optional().default("normal")
});
const supportSchema = z.object({
  nodeId: z.number(),
  fx: z.boolean(),
  fy: z.boolean(),
  fz: z.boolean(),
  mx: z.boolean().optional().default(false),
  my: z.boolean().optional().default(false),
  mz: z.boolean().optional().default(false)
});
const pDeltaSchema = z.object({
  nodes: z.array(advancedNodeSchema).min(2),
  members: z.array(advancedMemberSchema).min(1),
  supports: z.array(supportSchema).min(1),
  loads: z.array(z.object({
    nodeId: z.number(),
    fx: z.number().finite().optional(),
    fy: z.number().finite().optional(),
    fz: z.number().finite().optional()
  })),
  options: z.object({
    maxIterations: z.number().int().positive().optional().default(10),
    tolerance: z.number().positive().optional().default(1e-4)
  }).optional().default({})
});
const modalSchema = z.object({
  nodes: z.array(advancedNodeSchema).min(2),
  members: z.array(advancedMemberSchema).min(1),
  supports: z.array(supportSchema).min(1),
  masses: z.array(z.object({
    nodeId: z.number(),
    mass: z.number().positive()
  })).optional().default([]),
  numModes: z.number().int().positive().optional().default(5),
  massType: z.enum(["lumped", "consistent"]).optional().default("lumped")
});
const bucklingSchema = z.object({
  nodes: z.array(advancedNodeSchema).min(2),
  members: z.array(advancedMemberSchema).min(1),
  supports: z.array(supportSchema).min(1),
  loads: z.array(z.object({
    nodeId: z.number(),
    fx: z.number().finite().optional(),
    fy: z.number().finite().optional(),
    fz: z.number().finite().optional()
  })).min(1),
  numModes: z.number().int().positive().optional().default(3)
});
const cableSchema = z.object({
  nodes: z.array(advancedNodeSchema).min(2),
  members: z.array(advancedMemberSchema).min(1),
  supports: z.array(supportSchema).min(1),
  cables: z.array(z.object({
    memberId: z.number(),
    weight: z.number().positive().optional().default(10),
    pretension: z.number().finite().optional().default(0),
    sagRatio: z.number().positive().optional()
  })).min(1),
  loads: z.array(z.object({
    nodeId: z.number(),
    fx: z.number().finite().optional(),
    fy: z.number().finite().optional(),
    fz: z.number().finite().optional()
  })).optional().default([])
});
const spectrumSchema = z.object({
  nodes: z.array(advancedNodeSchema).min(2),
  members: z.array(advancedMemberSchema).min(1),
  supports: z.array(supportSchema).min(1),
  numModes: z.number().int().positive().optional().default(12),
  spectrum: z.object({
    type: z.enum(["IS1893", "custom"]),
    zoneLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    soilType: z.enum(["I", "II", "III"]).optional(),
    dampingRatio: z.number().min(0).max(1).optional().default(0.05),
    customCurve: z.array(z.object({
      period: z.number().positive(),
      acceleration: z.number().positive()
    })).optional()
  }),
  combinationMethod: z.enum(["CQC", "SRSS"]).optional().default("CQC")
});
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").regex(/[A-Z]/, "Password must contain an uppercase letter").regex(/[a-z]/, "Password must contain a lowercase letter").regex(/[0-9]/, "Password must contain a number");
const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address").transform((e) => e.toLowerCase().trim()),
  password: passwordSchema,
  firstName: z.string().min(1, "First name is required").trim(),
  lastName: z.string().min(1, "Last name is required").trim(),
  company: z.string().trim().optional(),
  phone: z.string().trim().optional()
});
const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address").transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false)
});
const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address").transform((e) => e.toLowerCase().trim())
});
const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema
});
const verifyEmailSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  code: z.string().length(6, "Verification code must be 6 digits")
});
const updateProfileSchema = z.object({
  firstName: z.string().min(1).trim().optional(),
  lastName: z.string().min(1).trim().optional(),
  company: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  avatarUrl: z.string().url().optional()
});
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code
      }));
      res.status(400).json({ success: false, error: "Query validation failed", details: errors });
      return;
    }
    req.query = result.data;
    next();
  };
}
export {
  analyzeRequestSchema,
  bucklingSchema,
  cableSchema,
  changePasswordSchema,
  concreteBeamSchema,
  concreteColumnSchema,
  connectionDesignSchema,
  forgotPasswordSchema,
  foundationDesignSchema,
  modalSchema,
  pDeltaSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  spectrumSchema,
  steelDesignSchema,
  updateProfileSchema,
  validateBody,
  validateQuery,
  verifyEmailSchema,
  z
};
//# sourceMappingURL=validation.js.map
