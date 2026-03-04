const description = "Add missing performance indexes on users, projects, and tokens";
const up = async (db) => {
  await db.collection("users").createIndex(
    { email: 1 },
    { unique: true, name: "idx_users_email_unique" }
  );
  await db.collection("users").createIndex(
    { role: 1, subscriptionTier: 1 },
    { name: "idx_users_role_tier" }
  );
  await db.collection("users").createIndex(
    { createdAt: -1 },
    { name: "idx_users_created_desc" }
  );
  await db.collection("projects").createIndex(
    { owner: 1, updatedAt: -1 },
    { name: "idx_projects_owner_updated" }
  );
  await db.collection("projects").createIndex(
    { isPublic: 1, updatedAt: -1 },
    { name: "idx_projects_public_updated" }
  );
  await db.collection("refreshtokens").createIndex(
    { token: 1 },
    { unique: true, name: "idx_refreshtokens_token_unique" }
  );
  await db.collection("refreshtokens").createIndex(
    { userId: 1 },
    { name: "idx_refreshtokens_userid" }
  );
  await db.collection("refreshtokens").createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "idx_refreshtokens_expire" }
  );
  await db.collection("verificationcodes").createIndex(
    { userId: 1, type: 1 },
    { name: "idx_verificationcodes_user_type" }
  );
  await db.collection("verificationcodes").createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "idx_verificationcodes_expire" }
  );
  const collections = await db.db.listCollections().toArray();
  const collNames = collections.map((c) => c.name);
  if (collNames.includes("analysisresults")) {
    await db.collection("analysisresults").createIndex(
      { projectId: 1, createdAt: -1 },
      { name: "idx_analysisresults_project_created" }
    );
  }
};
const down = async (db) => {
  const tryDrop = async (coll, name) => {
    try {
      await db.collection(coll).dropIndex(name);
    } catch {
    }
  };
  await tryDrop("users", "idx_users_email_unique");
  await tryDrop("users", "idx_users_role_tier");
  await tryDrop("users", "idx_users_created_desc");
  await tryDrop("projects", "idx_projects_owner_updated");
  await tryDrop("projects", "idx_projects_public_updated");
  await tryDrop("refreshtokens", "idx_refreshtokens_token_unique");
  await tryDrop("refreshtokens", "idx_refreshtokens_userid");
  await tryDrop("refreshtokens", "idx_refreshtokens_expire");
  await tryDrop("verificationcodes", "idx_verificationcodes_user_type");
  await tryDrop("verificationcodes", "idx_verificationcodes_expire");
  await tryDrop("analysisresults", "idx_analysisresults_project_created");
};
var add_indexes_default = { description, up, down };
export {
  add_indexes_default as default,
  description,
  down,
  up
};
//# sourceMappingURL=20250101000000_add_indexes.js.map
