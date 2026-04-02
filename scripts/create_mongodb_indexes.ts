/**
 * MongoDB Index Creation Script - Phase 1.2
 * Creates compound indexes on hot query patterns for 10K concurrent user scalability
 * Run with: npx tsx scripts/create_mongodb_indexes.ts
 */

import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { logger } from "../src/utils/logger.js";

// MongoDB connection string from environment
const mongoUri = process.env.MONGODB_URI || env.MONGODB_URI || "";

interface IndexDefinition {
  collection: string;
  fields: Record<string, 1 | -1>;
  options?: Record<string, any>;
  description: string;
}

/**
 * Index definitions optimized for common query patterns in 10K+ concurrent user scenarios
 */
const INDEXES_TO_CREATE: IndexDefinition[] = [
  // ============================================================================
  // PROJECTS COLLECTION
  // ============================================================================
  {
    collection: "projects",
    fields: { userId: 1, createdAt: -1 },
    options: { name: "idx_user_created" },
    description: "User projects list (pagination by creation date)",
  },
  {
    collection: "projects",
    fields: { emailAddress: 1, createdAt: -1 },
    options: { name: "idx_email_created" },
    description: "Projects by email with sorting",
  },
  {
    collection: "projects",
    fields: { status: 1, createdAt: -1 },
    options: { name: "idx_status_created" },
    description: "Filter projects by status (archived, active, etc.)",
  },
  {
    collection: "projects",
    fields: { "owners.userId": 1 },
    options: { name: "idx_owner_lookup" },
    description: "Find projects by owner ID",
  },

  // ============================================================================
  // STRUCTURES COLLECTION
  // ============================================================================
  {
    collection: "structures",
    fields: { projectId: 1, createdAt: -1 },
    options: { name: "idx_project_created" },
    description: "Structures in a project (pagination)",
  },
  {
    collection: "structures",
    fields: { projectId: 1, type: 1 },
    options: { name: "idx_project_type" },
    description: "Find structures by type within project",
  },
  {
    collection: "structures",
    fields: { name: 1, projectId: 1 },
    options: { name: "idx_name_project" },
    description: "Search structures by name in project",
  },

  // ============================================================================
  // ANALYSES COLLECTION (HOT — critical for design/buckling requests)
  // ============================================================================
  {
    collection: "analyses",
    fields: { projectId: 1, createdAt: -1 },
    options: { name: "idx_project_created", sparse: true },
    description: "List analyses in project (most queried pattern)",
  },
  {
    collection: "analyses",
    fields: { structureId: 1, createdAt: -1 },
    options: { name: "idx_struct_created" },
    description: "Analyses for a structure",
  },
  {
    collection: "analyses",
    fields: { status: 1, createdAt: -1 },
    options: { name: "idx_status_created", sparse: true },
    description: "Find pending/completed analyses",
  },
  {
    collection: "analyses",
    fields: { projectId: 1, status: 1, createdAt: -1 },
    options: { name: "idx_project_status_created" },
    description: "Filter analyses by project + status (for dashboards)",
  },
  {
    collection: "analyses",
    fields: { type: 1, createdAt: -1 },
    options: { name: "idx_type_created", sparse: true },
    description: "Find specific analysis types (static, dynamic, buckling)",
  },

  // ============================================================================
  // SECTIONS COLLECTION (Design code lookups)
  // ============================================================================
  {
    collection: "sections",
    fields: { name: 1 },
    options: { name: "idx_section_name" },
    description: "Lookup section by name (for design tables)",
  },
  {
    collection: "sections",
    fields: { materialType: 1, sizeCategory: 1 },
    options: { name: "idx_material_size", sparse: true },
    description: "Filter sections by material and size",
  },
  {
    collection: "sections",
    fields: { designation: 1 },
    options: { name: "idx_section_designation", unique: false },
    description: "Lookup section by standard designation (IS, AISC, etc.)",
  },

  // ============================================================================
  // USERS COLLECTION
  // ============================================================================
  {
    collection: "users",
    fields: { email: 1 },
    options: { name: "idx_email", sparse: true, unique: true },
    description: "Email lookups for auth + profile",
  },
  {
    collection: "users",
    fields: { clerkId: 1 },
    options: { name: "idx_clerk_id", sparse: true },
    description: "Map Clerk IDs to user documents",
  },
  {
    collection: "users",
    fields: { createdAt: -1 },
    options: { name: "idx_created", sparse: true },
    description: "User analytics (new signups)",
  },

  // ============================================================================
  // AUDIT LOGS COLLECTION
  // ============================================================================
  {
    collection: "audit_logs",
    fields: { userId: 1, createdAt: -1 },
    options: { name: "idx_user_created", sparse: true },
    description: "User audit trail (compliance)",
  },
  {
    collection: "audit_logs",
    fields: { projectId: 1, createdAt: -1 },
    options: { name: "idx_project_created", sparse: true },
    description: "Project audit trail (changes history)",
  },
  {
    collection: "audit_logs",
    fields: { action: 1, createdAt: -1 },
    options: { name: "idx_action_created", sparse: true },
    description: "Filter logs by action type",
  },

  // ============================================================================
  // QUOTA/USAGE TRACKING (for rate limiting)
  // ============================================================================
  {
    collection: "users",
    fields: { "quota.resetAt": 1 },
    options: { name: "idx_quota_reset", sparse: true },
    description: "Find users needing quota reset",
  },
];

/**
 * Create all indexes on MongoDB
 */
async function createIndexes() {
  try {
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable not set");
    }

    console.log("[INDEX] Connecting to MongoDB...");
    await mongoose.connect(mongoUri, {
      retryWrites: true,
      w: "majority",
    });
    console.log("[INDEX] ✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Failed to get database instance");
    }

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const indexDef of INDEXES_TO_CREATE) {
      try {
        const collection = db.collection(indexDef.collection);
        const indexName = indexDef.options?.name || `idx_${Date.now()}`;

        // Check if index already exists
        const existingIndexes = await collection.listIndexes().toArray();
        const indexExists = existingIndexes.some(
          (idx) => idx.name === indexName || idx.name === `${indexName}_1`
        );

        if (indexExists) {
          console.log(
            `[INDEX] ⏭️  Skipped: ${indexDef.collection}.${indexName} (already exists)`
          );
          skipped++;
        } else {
          // Create index
          await collection.createIndex(indexDef.fields, indexDef.options);
          console.log(`[INDEX] ✅ Created: ${indexDef.collection}.${indexName}`);
          console.log(`         └─ Fields: ${JSON.stringify(indexDef.fields)}`);
          console.log(`         └─ Purpose: ${indexDef.description}`);
          created++;
        }
      } catch (err) {
        console.error(
          `[INDEX] ❌ Error creating index on ${indexDef.collection}:`,
          err
        );
        errors++;
      }
    }

    console.log("\n[INDEX] ════════════════════════════════════════");
    console.log(`[INDEX] 📊 Index Creation Summary`);
    console.log(`[INDEX] ════════════════════════════════════════`);
    console.log(`[INDEX] Created:  ${created} new indexes`);
    console.log(`[INDEX] Skipped:  ${skipped} existing indexes`);
    console.log(`[INDEX] Errors:   ${errors} failed indexes`);
    console.log(`[INDEX] ════════════════════════════════════════`);

    if (errors === 0) {
      console.log("[INDEX] ✅ All indexes created successfully!");
    } else {
      console.log(`[INDEX] ⚠️  ${errors} index(es) failed — check logs above`);
    }

    await mongoose.connection.close();
    console.log("[INDEX] Closed MongoDB connection");
    process.exit(errors > 0 ? 1 : 0);
  } catch (err) {
    console.error("[INDEX] Fatal error:", err);
    process.exit(1);
  }
}

// Run if called directly
createIndexes();
