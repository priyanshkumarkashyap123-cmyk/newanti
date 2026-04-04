/**
 * AICommandInterpreter.ts
 *
 * Natural Language → Structured Command parser for BeamLab AI Architect.
 * Parses user commands like "select node N1", "apply 20 kN/m UDL on M3",
 * "delete member M5", "add fixed support at N2", etc. into executable actions.
 */

// ============================================
// COMMAND TYPES
// ============================================

export type CommandAction =
  | "select_node"
  | "select_member"
  | "select_all"
  | "clear_selection"
  | "invert_selection"
  | "delete_node"
  | "delete_member"
  | "delete_selection"
  | "add_node"
  | "add_member"
  | "move_node"
  | "move_selection"
  | "add_node_load"
  | "add_member_load"
  | "remove_load"
  | "remove_member_load"
  | "add_support"
  | "remove_support"
  | "change_section"
  | "set_tool"
  | "show_results"
  | "hide_results"
  | "show_bmd"
  | "show_sfd"
  | "show_afd"
  | "show_deflection"
  | "clear_model"
  | "renumber_nodes"
  | "renumber_members"
  | "split_member"
  | "merge_nodes"
  | "duplicate_selection"
  | "copy_selection"
  | "paste_clipboard"
  | "auto_fix"
  | "select_parallel"
  | "select_by_section"
  | "info_node"
  | "info_member"
  | "info_model"
  | "list_nodes"
  | "list_members"
  | "list_loads"
  | "add_load_case"
  | "query_reactions"
  | "query_forces"
  | "query_displacements"
  | "query_max_deflection"
  | "query_stability"
  | "query_supports"
  | "query_sections"
  | "query_member_length"
  | "query_total_weight"
  | "query_equilibrium"
  | "query_analysis_status"
  | "list_plates"
  | "list_supports"
  | "list_load_cases"
  | "help"
  | "knowledge_question"
  | "unknown";

export interface ParsedCommand {
  action: CommandAction;
  confidence: number; // 0–1
  params: Record<string, any>;
  originalText: string;
  description: string; // Human-readable description of what will happen
}

// ============================================
// PATTERN DEFINITIONS
// ============================================

interface CommandPattern {
  action: CommandAction;
  patterns: RegExp[];
  extractParams: (match: RegExpMatchArray, text: string) => Record<string, any>;
  describe: (params: Record<string, any>) => string;
}

// Helper: extract node ID like N1, N02, node 1, node1
function extractNodeId(text: string): string | null {
  const match = text.match(/\b[Nn](?:ode\s*)?(\d+)\b/);
  if (match) return `N${match[1]}`;
  return null;
}

// Helper: extract member ID like M1, M02, member 1, beam 1
function extractMemberId(text: string): string | null {
  const match = text.match(/\b[Mm](?:ember\s*)?(\d+)\b/);
  if (match) return `M${match[1]}`;
  // Also match "beam 3", "column 2" etc
  const beamMatch = text.match(/\b(?:beam|column|brace|strut)\s*(\d+)\b/i);
  if (beamMatch) return `M${beamMatch[1]}`;
  return null;
}

// Helper: extract multiple node IDs
function extractMultipleNodeIds(text: string): string[] {
  const ids: string[] = [];
  const regex = /\b[Nn](?:ode\s*)?(\d+)\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    ids.push(`N${match[1]}`);
  }
  return ids;
}

// Helper: extract multiple member IDs
function extractMultipleMemberIds(text: string): string[] {
  const ids: string[] = [];
  const regex = /\b[Mm](?:ember\s*)?(\d+)\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    ids.push(`M${match[1]}`);
  }
  return ids;
}

// Helper: extract numeric value with optional unit
function extractValue(text: string, keywords: string[] = []): number | null {
  // Try after keywords first
  for (const kw of keywords) {
    const kwRegex = new RegExp(`${kw}\\s*(?:of\\s*)?(-?\\d+(?:\\.\\d+)?)`, "i");
    const match = text.match(kwRegex);
    if (match) return parseFloat(match[1]);
  }
  // Generic number extraction (prefer negative for loads)
  const numMatch = text.match(
    /(-?\d+(?:\\.\\d+)?)\s*(?:kN\/m|kN|kNm|kN·m|N\/m|N|m)/i,
  );
  if (numMatch) return parseFloat(numMatch[1]);
  // Any number
  const anyNum = text.match(/(-?\d+(?:\\.\\d+)?)/);
  if (anyNum) return parseFloat(anyNum[1]);
  return null;
}

// Helper: extract coordinates like (5, 10, 0) or x=5 y=10 z=0
function extractCoordinates(
  text: string,
): { x?: number; y?: number; z?: number } | null {
  // Tuple format: (5, 10, 0)
  const tupleMatch = text.match(
    /\(?\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*(?:[,\s]\s*(-?\d+(?:\.\d+)?))?\s*\)?/,
  );
  if (tupleMatch) {
    return {
      x: parseFloat(tupleMatch[1]),
      y: parseFloat(tupleMatch[2]),
      z: tupleMatch[3] ? parseFloat(tupleMatch[3]) : 0,
    };
  }
  // Named format: x=5 y=10
  const result: { x?: number; y?: number; z?: number } = {};
  const xMatch = text.match(/x\s*[=:]\s*(-?\d+(?:\.\d+)?)/i);
  const yMatch = text.match(/y\s*[=:]\s*(-?\d+(?:\.\d+)?)/i);
  const zMatch = text.match(/z\s*[=:]\s*(-?\d+(?:\.\d+)?)/i);
  if (xMatch) result.x = parseFloat(xMatch[1]);
  if (yMatch) result.y = parseFloat(yMatch[1]);
  if (zMatch) result.z = parseFloat(zMatch[1]);
  if (Object.keys(result).length > 0) return result;
  return null;
}

// Helper: extract support type
function extractSupportType(
  text: string,
): "fixed" | "pinned" | "roller" | null {
  if (/\bfix(?:ed)?\b/i.test(text)) return "fixed";
  if (/\bpin(?:ned)?\b/i.test(text)) return "pinned";
  if (/\broller\b/i.test(text)) return "roller";
  if (/\bhinge[d]?\b/i.test(text)) return "pinned";
  if (/\bclamp(?:ed)?\b/i.test(text)) return "fixed";
  if (/\bbuilt[\s-]?in\b/i.test(text)) return "fixed";
  if (/\bfree\b/i.test(text) && /\bsupport\b/i.test(text)) return null; // free = remove support
  return null;
}

// Helper: extract section name like ISMB300, ISMB 400, W12x26
function extractSectionId(text: string): string | null {
  // Indian sections: ISMB300, ISLB 250, ISMC150
  const isMatch = text.match(/\b(IS[MLHWC][BCPFA]?\s*\d+)\b/i);
  if (isMatch) return isMatch[1].replace(/\s/g, "").toUpperCase();
  // American sections: W12x26, HSS8x4x0.5
  const amMatch = text.match(
    /\b([WHS]{1,3}\d+[xX]\d+(?:[xX]\d+(?:\.\d+)?)?)\b/i,
  );
  if (amMatch) return amMatch[1].toUpperCase();
  // Generic: if quoted
  const quoteMatch = text.match(/["']([^"']+)["']/);
  if (quoteMatch) return quoteMatch[1];
  return null;
}

// Helper: extract load direction
function extractLoadDirection(text: string): string {
  if (/\bdownward|vertical|gravity\b/i.test(text)) return "global_y";
  if (/\bhorizontal|lateral|wind\b/i.test(text)) return "global_x";
  if (/\baxial|along\b/i.test(text)) return "axial";
  if (/\blocal[\s_]?y\b/i.test(text)) return "local_y";
  if (/\blocal[\s_]?z\b/i.test(text)) return "local_z";
  if (/\bglobal[\s_]?x\b/i.test(text)) return "global_x";
  if (/\bglobal[\s_]?y\b/i.test(text)) return "global_y";
  if (/\bglobal[\s_]?z\b/i.test(text)) return "global_z";
  return "global_y"; // default for most structural loads
}

// ============================================
// COMMAND PATTERN REGISTRY
// ============================================

const COMMAND_PATTERNS: CommandPattern[] = [
  // ---- SELECT NODE ----
  {
    action: "select_node",
    patterns: [
      /select\s+(?:node\s*)?[Nn](\d+)/i,
      /pick\s+(?:node\s*)?[Nn](\d+)/i,
      /choose\s+(?:node\s*)?[Nn](\d+)/i,
      /highlight\s+(?:node\s*)?[Nn](\d+)/i,
      /click\s+(?:on\s+)?(?:node\s*)?[Nn](\d+)/i,
      /go\s+to\s+(?:node\s*)?[Nn](\d+)/i,
      /show\s+(?:me\s+)?(?:node\s*)?[Nn](\d+)/i,
      /select\s+node\s+(\d+)/i,
    ],
    extractParams: (match, text) => {
      const ids = extractMultipleNodeIds(text);
      return {
        nodeIds: ids.length > 0 ? ids : [`N${match[1]}`],
        multi: ids.length > 1,
      };
    },
    describe: (p) =>
      `Select node${p.nodeIds.length > 1 ? "s" : ""} ${p.nodeIds.join(", ")}`,
  },

  // ---- SELECT MEMBER ----
  {
    action: "select_member",
    patterns: [
      /select\s+(?:member\s*|beam\s*|column\s*)?[Mm](\d+)/i,
      /pick\s+(?:member\s*|beam\s*)?[Mm](\d+)/i,
      /choose\s+(?:member\s*)?[Mm](\d+)/i,
      /highlight\s+(?:member\s*)?[Mm](\d+)/i,
      /click\s+(?:on\s+)?(?:member\s*)?[Mm](\d+)/i,
      /select\s+(?:beam|column|brace|strut)\s+(\d+)/i,
      /select\s+member\s+(\d+)/i,
    ],
    extractParams: (match, text) => {
      const ids = extractMultipleMemberIds(text);
      return {
        memberIds: ids.length > 0 ? ids : [`M${match[1]}`],
        multi: ids.length > 1,
      };
    },
    describe: (p) =>
      `Select member${p.memberIds.length > 1 ? "s" : ""} ${p.memberIds.join(", ")}`,
  },

  // ---- SELECT ALL ----
  {
    action: "select_all",
    patterns: [
      /select\s+all/i,
      /select\s+everything/i,
      /highlight\s+all/i,
      /pick\s+all/i,
    ],
    extractParams: () => ({}),
    describe: () => "Select all nodes and members",
  },

  // ---- CLEAR SELECTION ----
  {
    action: "clear_selection",
    patterns: [
      /clear\s+selection/i,
      /deselect\s+(?:all|everything)/i,
      /deselect/i,
      /unselect/i,
      /select\s+none/i,
      /remove\s+selection/i,
    ],
    extractParams: () => ({}),
    describe: () => "Clear selection",
  },

  // ---- INVERT SELECTION ----
  {
    action: "invert_selection",
    patterns: [
      /invert\s+selection/i,
      /reverse\s+selection/i,
      /select\s+inverse/i,
    ],
    extractParams: () => ({}),
    describe: () => "Invert current selection",
  },

  // ---- DELETE NODE ----
  {
    action: "delete_node",
    patterns: [
      /(?:delete|remove|erase)\s+(?:node\s*)?[Nn](\d+)/i,
      /(?:delete|remove|erase)\s+node\s+(\d+)/i,
    ],
    extractParams: (match, text) => {
      const ids = extractMultipleNodeIds(text);
      return { nodeIds: ids.length > 0 ? ids : [`N${match[1]}`] };
    },
    describe: (p) =>
      `Delete node${p.nodeIds.length > 1 ? "s" : ""} ${p.nodeIds.join(", ")}`,
  },

  // ---- DELETE MEMBER ----
  {
    action: "delete_member",
    patterns: [
      /(?:delete|remove|erase)\s+(?:member\s*|beam\s*|column\s*)?[Mm](\d+)/i,
      /(?:delete|remove|erase)\s+(?:member|beam|column)\s+(\d+)/i,
    ],
    extractParams: (match, text) => {
      const ids = extractMultipleMemberIds(text);
      return { memberIds: ids.length > 0 ? ids : [`M${match[1]}`] };
    },
    describe: (p) =>
      `Delete member${p.memberIds.length > 1 ? "s" : ""} ${p.memberIds.join(", ")}`,
  },

  // ---- DELETE SELECTION ----
  {
    action: "delete_selection",
    patterns: [
      /delete\s+(?:the\s+)?select(?:ed|ion)/i,
      /remove\s+(?:the\s+)?select(?:ed|ion)/i,
      /erase\s+(?:the\s+)?select(?:ed|ion)/i,
      /delete\s+(?:the\s+)?(?:current|this)\b/i,
    ],
    extractParams: () => ({}),
    describe: () => "Delete all selected elements",
  },

  // ---- ADD NODE ----
  {
    action: "add_node",
    patterns: [
      /add\s+(?:a\s+)?node\s+(?:at\s+)?/i,
      /create\s+(?:a\s+)?node\s+(?:at\s+)?/i,
      /place\s+(?:a\s+)?node\s+(?:at\s+)?/i,
      /new\s+node\s+(?:at\s+)?/i,
      /insert\s+(?:a\s+)?node\s+(?:at\s+)?/i,
    ],
    extractParams: (_match, text) => {
      const coords = extractCoordinates(text);
      return { coordinates: coords || { x: 0, y: 0, z: 0 } };
    },
    describe: (p) =>
      `Add node at (${p.coordinates?.x ?? 0}, ${p.coordinates?.y ?? 0}, ${p.coordinates?.z ?? 0})`,
  },

  // ---- ADD MEMBER ----
  {
    action: "add_member",
    patterns: [
      /add\s+(?:a\s+)?(?:member|beam|column)\s+(?:from\s+|between\s+)?/i,
      /create\s+(?:a\s+)?(?:member|beam|column)\s+(?:from\s+|between\s+)?/i,
      /connect\s+[Nn](?:ode\s*)?(\d+)\s+(?:to|and)\s+[Nn](?:ode\s*)?(\d+)/i,
    ],
    extractParams: (_match, text) => {
      const nodeIds = extractMultipleNodeIds(text);
      const section = extractSectionId(text);
      return {
        startNodeId: nodeIds[0] || null,
        endNodeId: nodeIds[1] || null,
        sectionId: section || "ISMB300",
      };
    },
    describe: (p) =>
      `Add member from ${p.startNodeId} to ${p.endNodeId} (${p.sectionId})`,
  },

  // ---- MOVE NODE ----
  {
    action: "move_node",
    patterns: [
      /move\s+(?:node\s*)?[Nn](\d+)\s+(?:to\s+)?/i,
      /relocate\s+(?:node\s*)?[Nn](\d+)/i,
      /set\s+(?:node\s*)?[Nn](\d+)\s+(?:position|coordinates?|coords?)\s+(?:to\s+)?/i,
      /change\s+(?:node\s*)?[Nn](\d+)\s+(?:position|location)\s+(?:to\s+)?/i,
    ],
    extractParams: (match, text) => {
      const nodeId = `N${match[1]}`;
      const coords = extractCoordinates(text);
      return { nodeId, position: coords || {} };
    },
    describe: (p) =>
      `Move ${p.nodeId} to (${p.position?.x ?? "?"}, ${p.position?.y ?? "?"}, ${p.position?.z ?? "?"})`,
  },

  // ---- MOVE SELECTION ----
  {
    action: "move_selection",
    patterns: [
      /move\s+(?:the\s+)?select(?:ed|ion)\s+(?:by\s+)?/i,
      /translate\s+(?:the\s+)?select(?:ed|ion)/i,
      /shift\s+(?:the\s+)?select(?:ed|ion)/i,
    ],
    extractParams: (_match, text) => {
      const coords = extractCoordinates(text);
      return { offset: coords || { x: 0, y: 0, z: 0 } };
    },
    describe: (p) =>
      `Move selection by (${p.offset?.x ?? 0}, ${p.offset?.y ?? 0}, ${p.offset?.z ?? 0})`,
  },

  // ---- ADD MEMBER LOAD (UDL) ----
  {
    action: "add_member_load",
    patterns: [
      /(?:add|apply|put)\s+(?:a\s+)?(?:UDL|udl|uniform(?:ly)?\s+distributed\s+load)\s+(?:of\s+)?/i,
      /(?:add|apply|put)\s+(?:a\s+)?(?:distributed\s+)?load\s+(?:of\s+)?.*(?:on|to)\s+(?:member\s*|beam\s*)?[Mm](\d+)/i,
      /(?:add|apply|put)\s+.*(?:kN\/m|kn\/m).*(?:on|to)\s+(?:member\s*|beam\s*)?[Mm](\d+)/i,
      /(?:add|apply|put)\s+(?:a\s+)?load\s+(?:on|to)\s+(?:member\s*|beam\s*)?[Mm](\d+)/i,
      /load\s+(?:member\s*|beam\s*)?[Mm](\d+)\s+(?:with\s+)?/i,
      /(?:add|apply)\s+(?:a\s+)?(?:point\s+)?load\s+(?:on|to)\s+(?:this\s+)?(?:member|beam)/i,
    ],
    extractParams: (_match, text) => {
      const memberId = extractMemberId(text);
      const value = extractValue(text, [
        "UDL",
        "udl",
        "load",
        "intensity",
        "of",
      ]);
      const direction = extractLoadDirection(text);
      const isPoint = /\bpoint\b/i.test(text);
      const isMoment = /\bmoment\b/i.test(text);

      let loadType: "UDL" | "point" | "moment" | "UVL" = "UDL";
      if (isPoint) loadType = "point";
      if (isMoment) loadType = "moment";
      if (/\buvl\b|\bvarying\b|\btriangular\b/i.test(text)) loadType = "UVL";

      return {
        memberId,
        type: loadType,
        value: value ?? -10, // default 10 kN/m downward
        direction,
        useSelected: !memberId, // if no member ID specified, use selected
      };
    },
    describe: (p) => {
      const target = p.memberId || "selected member";
      return `Apply ${Math.abs(p.value)} kN/m ${p.type} on ${target} (${p.direction})`;
    },
  },

  // ---- ADD NODE LOAD ----
  {
    action: "add_node_load",
    patterns: [
      /(?:add|apply|put)\s+(?:a\s+)?(?:point\s+)?(?:force|load)\s+(?:of\s+)?.*(?:at|on|to)\s+(?:node\s*)?[Nn](\d+)/i,
      /(?:add|apply)\s+(?:a\s+)?(?:point\s+)?load\s+(?:at|on|to)\s+(?:node\s*)?[Nn](\d+)/i,
      /(?:add|apply)\s+.*(?:kN|kNm).*(?:at|on|to)\s+(?:node\s*)?[Nn](\d+)/i,
      /load\s+(?:node\s*)?[Nn](\d+)\s+(?:with\s+)?/i,
      /(?:add|apply)\s+(?:a\s+)?(?:nodal|node|point)\s+load/i,
    ],
    extractParams: (_match, text) => {
      const nodeId = extractNodeId(text);
      const value = extractValue(text, ["force", "load", "of"]);

      // Parse directional components
      const fxMatch = text.match(/[Ff][Xx]\s*[=:]\s*(-?\d+(?:\.\d+)?)/);
      const fyMatch = text.match(/[Ff][Yy]\s*[=:]\s*(-?\d+(?:\.\d+)?)/);
      const fzMatch = text.match(/[Ff][Zz]\s*[=:]\s*(-?\d+(?:\.\d+)?)/);

      let fx = fxMatch ? parseFloat(fxMatch[1]) : 0;
      let fy = fyMatch
        ? parseFloat(fyMatch[1])
        : value
          ? -Math.abs(value)
          : -10;
      const fz = fzMatch ? parseFloat(fzMatch[1]) : 0;

      // If "horizontal" or "lateral" specified, swap to fx
      if (/\bhorizontal|lateral\b/i.test(text) && value) {
        fx = value;
        fy = 0;
      }

      return { nodeId, fx, fy, fz, useSelected: !nodeId };
    },
    describe: (p) => {
      const target = p.nodeId || "selected node";
      const forces = [];
      if (p.fx) forces.push(`Fx=${p.fx} kN`);
      if (p.fy) forces.push(`Fy=${p.fy} kN`);
      if (p.fz) forces.push(`Fz=${p.fz} kN`);
      return `Apply load at ${target}: ${forces.join(", ") || "Fy=-10 kN"}`;
    },
  },

  // ---- REMOVE LOAD ----
  {
    action: "remove_load",
    patterns: [
      /(?:remove|delete|clear)\s+(?:all\s+)?load(?:s)?\s+(?:from|on|at)\s+(?:node\s*)?[Nn](\d+)/i,
      /(?:remove|delete|clear)\s+(?:the\s+)?(?:node\s+)?load/i,
    ],
    extractParams: (match, text) => {
      const nodeId = extractNodeId(text);
      return { nodeId, all: /\ball\b/i.test(text) };
    },
    describe: (p) =>
      p.nodeId ? `Remove loads from ${p.nodeId}` : "Remove selected loads",
  },

  // ---- REMOVE MEMBER LOAD ----
  {
    action: "remove_member_load",
    patterns: [
      /(?:remove|delete|clear)\s+(?:all\s+)?(?:member\s+)?load(?:s)?\s+(?:from|on)\s+(?:member\s*|beam\s*)?[Mm](\d+)/i,
      /(?:remove|delete|clear)\s+(?:udl|UDL|distributed\s+load)\s+(?:from|on)\s+/i,
      /(?:remove|delete|clear)\s+(?:the\s+)?member\s+load/i,
    ],
    extractParams: (match, text) => {
      const memberId = extractMemberId(text);
      return { memberId, all: /\ball\b/i.test(text) };
    },
    describe: (p) =>
      p.memberId ? `Remove loads from ${p.memberId}` : "Remove member loads",
  },

  // ---- ADD SUPPORT ----
  {
    action: "add_support",
    patterns: [
      /(?:add|apply|set|make|assign)\s+(?:a\s+)?(?:fixed|pinned|roller|hinge[d]?|clamp(?:ed)?|built[\s-]?in)\s+(?:support\s+)?(?:at|to|on)\s+/i,
      /(?:add|apply|set)\s+(?:a\s+)?support\s+(?:at|to|on)\s+/i,
      /fix\s+(?:node\s*)?[Nn](\d+)/i,
      /pin\s+(?:node\s*)?[Nn](\d+)/i,
      /(?:make|set)\s+(?:node\s*)?[Nn](\d+)\s+(?:as\s+)?(?:fixed|pinned|roller)/i,
      /support\s+(?:node\s*)?[Nn](\d+)\s+(?:as\s+|with\s+)?(?:fixed|pinned|roller)/i,
      /(?:add|apply)\s+(?:fixed|pinned|roller)\s+(?:at|to)\s+(?:node\s+)?[Nn](\d+)/i,
    ],
    extractParams: (_match, text) => {
      const nodeId = extractNodeId(text);
      const supportType = extractSupportType(text) || "fixed";
      return { nodeId, supportType, useSelected: !nodeId };
    },
    describe: (p) => {
      const target = p.nodeId || "selected node";
      return `Add ${p.supportType} support at ${target}`;
    },
  },

  // ---- REMOVE SUPPORT ----
  {
    action: "remove_support",
    patterns: [
      /(?:remove|delete|clear)\s+support\s+(?:at|from|on)\s+(?:node\s*)?[Nn](\d+)/i,
      /(?:free|release)\s+(?:node\s*)?[Nn](\d+)/i,
      /(?:remove|delete|clear)\s+(?:the\s+)?support/i,
      /make\s+(?:node\s*)?[Nn](\d+)\s+free/i,
    ],
    extractParams: (_match, text) => {
      const nodeId = extractNodeId(text);
      return { nodeId, useSelected: !nodeId };
    },
    describe: (p) => `Remove support from ${p.nodeId || "selected node"}`,
  },

  // ---- CHANGE SECTION ----
  {
    action: "change_section",
    patterns: [
      /(?:change|set|modify|update|assign)\s+(?:the\s+)?section\s+(?:of\s+)?(?:member\s*|beam\s*)?(?:[Mm]\d+)?\s*(?:to\s+)?/i,
      /(?:change|set|modify|use)\s+(?:profile|section)\s+(?:to\s+)?/i,
      /(?:make|change)\s+(?:member\s*|beam\s*|column\s*)?(?:[Mm]\d+)?\s*(?:to\s+)?(?:ISM?[BLHWC]|W\d|HSS)/i,
      /(?:assign|apply)\s+(?:ISM?[BLHWC]|W\d|HSS)\S*/i,
      /(?:use|set)\s+(?:ISM?[BLHWC]|W\d|HSS)\S*\s+(?:for|on)\s+/i,
    ],
    extractParams: (_match, text) => {
      const memberId = extractMemberId(text);
      const memberIds = extractMultipleMemberIds(text);
      const sectionId = extractSectionId(text);
      return {
        memberIds:
          memberIds.length > 0 ? memberIds : memberId ? [memberId] : [],
        sectionId: sectionId || "ISMB300",
        useSelected: memberIds.length === 0 && !memberId,
      };
    },
    describe: (p) => {
      const target =
        p.memberIds?.length > 0 ? p.memberIds.join(", ") : "selected members";
      return `Change section of ${target} to ${p.sectionId}`;
    },
  },

  // ---- SET TOOL ----
  {
    action: "set_tool",
    patterns: [
      /(?:switch|change|set)\s+(?:to\s+)?(?:the\s+)?(?:select|node|member|support|load)\s+tool/i,
      /(?:activate|enable)\s+(?:the\s+)?(?:select|node|member|support|load)\s+tool/i,
      /tool\s*:\s*(?:select|node|member|support|load)/i,
    ],
    extractParams: (_match, text) => {
      if (/\bnode\b/i.test(text)) return { tool: "node" };
      if (/\bmember\b/i.test(text)) return { tool: "member" };
      if (/\bsupport\b/i.test(text)) return { tool: "support" };
      if (/\b(member\s*)?load\b/i.test(text)) return { tool: "load" };
      return { tool: "select" };
    },
    describe: (p) => `Switch to ${p.tool} tool`,
  },

  // ---- SHOW RESULTS / DIAGRAMS ----
  {
    action: "show_bmd",
    patterns: [
      /show\s+(?:the\s+)?(?:BMD|bending\s+moment\s+diagram)/i,
      /(?:display|toggle)\s+(?:the\s+)?BMD/i,
    ],
    extractParams: () => ({}),
    describe: () => "Show Bending Moment Diagram",
  },
  {
    action: "show_sfd",
    patterns: [
      /show\s+(?:the\s+)?(?:SFD|shear\s+force\s+diagram)/i,
      /(?:display|toggle)\s+(?:the\s+)?SFD/i,
    ],
    extractParams: () => ({}),
    describe: () => "Show Shear Force Diagram",
  },
  {
    action: "show_afd",
    patterns: [
      /show\s+(?:the\s+)?(?:AFD|axial\s+force\s+diagram)/i,
      /(?:display|toggle)\s+(?:the\s+)?AFD/i,
    ],
    extractParams: () => ({}),
    describe: () => "Show Axial Force Diagram",
  },
  {
    action: "show_deflection",
    patterns: [
      /show\s+(?:the\s+)?(?:deflection|deflected\s+shape|deformed\s+shape)/i,
      /(?:display|toggle)\s+(?:the\s+)?deflect(?:ion|ed)/i,
    ],
    extractParams: () => ({}),
    describe: () => "Show deflected shape",
  },
  {
    action: "show_results",
    patterns: [
      /show\s+(?:the\s+)?(?:analysis\s+)?results/i,
      /(?:display|toggle)\s+results/i,
    ],
    extractParams: () => ({}),
    describe: () => "Show analysis results",
  },
  {
    action: "hide_results",
    patterns: [
      /hide\s+(?:the\s+)?(?:analysis\s+)?results/i,
      /(?:clear|remove)\s+(?:the\s+)?results\s+display/i,
    ],
    extractParams: () => ({}),
    describe: () => "Hide analysis results",
  },

  // ---- CLEAR MODEL ----
  {
    action: "clear_model",
    patterns: [
      /clear\s+(?:the\s+)?(?:entire\s+)?model/i,
      /(?:delete|remove)\s+(?:the\s+)?(?:entire\s+)?model/i,
      /start\s+(?:a\s+)?(?:new|fresh|clean)\s+model/i,
      /new\s+model/i,
      /reset\s+(?:the\s+)?model/i,
    ],
    extractParams: () => ({}),
    describe: () => "Clear entire model and start fresh",
  },

  // ---- RENUMBER ----
  {
    action: "renumber_nodes",
    patterns: [/renumber\s+(?:the\s+)?nodes/i, /reorder\s+(?:the\s+)?nodes/i],
    extractParams: () => ({}),
    describe: () => "Renumber all nodes sequentially",
  },
  {
    action: "renumber_members",
    patterns: [
      /renumber\s+(?:the\s+)?members/i,
      /reorder\s+(?:the\s+)?members/i,
    ],
    extractParams: () => ({}),
    describe: () => "Renumber all members sequentially",
  },

  // ---- SPLIT MEMBER ----
  {
    action: "split_member",
    patterns: [
      /split\s+(?:member\s*)?[Mm](\d+)/i,
      /divide\s+(?:member\s*)?[Mm](\d+)/i,
      /insert\s+(?:a\s+)?node\s+(?:in|on|into)\s+(?:member\s*)?[Mm](\d+)/i,
    ],
    extractParams: (match, text) => {
      const memberId = extractMemberId(text);
      const ratioMatch = text.match(/(?:at\s+)?(\d+(?:\.\d+)?)\s*%/);
      const ratio = ratioMatch ? parseFloat(ratioMatch[1]) / 100 : 0.5;
      return { memberId, ratio };
    },
    describe: (p) => `Split ${p.memberId} at ${(p.ratio * 100).toFixed(0)}%`,
  },

  // ---- MERGE NODES ----
  {
    action: "merge_nodes",
    patterns: [
      /merge\s+(?:nodes?\s*)?[Nn](\d+)\s+(?:and|with|&)\s+[Nn](\d+)/i,
      /combine\s+(?:nodes?\s*)?[Nn](\d+)\s+(?:and|with)\s+[Nn](\d+)/i,
    ],
    extractParams: (_match, text) => {
      const ids = extractMultipleNodeIds(text);
      return { nodeId1: ids[0], nodeId2: ids[1] };
    },
    describe: (p) => `Merge ${p.nodeId1} and ${p.nodeId2}`,
  },

  // ---- DUPLICATE ----
  {
    action: "duplicate_selection",
    patterns: [
      /duplicate\s+(?:the\s+)?select(?:ed|ion)/i,
      /copy\s+(?:the\s+)?select(?:ed|ion)/i,
      /clone\s+(?:the\s+)?select(?:ed|ion)/i,
    ],
    extractParams: (_match, text) => {
      const coords = extractCoordinates(text);
      return { offset: coords || { x: 1, y: 0, z: 0 } };
    },
    describe: (p) =>
      `Duplicate selection with offset (${p.offset?.x}, ${p.offset?.y}, ${p.offset?.z})`,
  },

  // ---- COPY / PASTE ----
  {
    action: "copy_selection",
    patterns: [/^copy$/i, /copy\s+(?:to\s+)?clipboard/i],
    extractParams: () => ({}),
    describe: () => "Copy selection to clipboard",
  },
  {
    action: "paste_clipboard",
    patterns: [/^paste$/i, /paste\s+(?:from\s+)?clipboard/i],
    extractParams: (_match, text) => {
      const coords = extractCoordinates(text);
      return { offset: coords };
    },
    describe: (p) =>
      `Paste from clipboard${p.offset ? ` at offset (${p.offset.x}, ${p.offset.y}, ${p.offset.z})` : ""}`,
  },

  // ---- AUTO FIX ----
  {
    action: "auto_fix",
    patterns: [
      /auto[\s-]?fix/i,
      /fix\s+(?:the\s+)?model/i,
      /repair\s+(?:the\s+)?model/i,
      /clean\s+(?:up\s+)?(?:the\s+)?model/i,
    ],
    extractParams: () => ({}),
    describe: () =>
      "Auto-fix model errors (duplicate nodes, disconnected members)",
  },

  // ---- SELECT PARALLEL ----
  {
    action: "select_parallel",
    patterns: [
      /select\s+(?:all\s+)?(?:members\s+)?parallel\s+to\s+([xyz])/i,
      /select\s+(?:all\s+)?(?:horizontal|vertical)\s+members/i,
      /select\s+(?:all\s+)?columns/i,
      /select\s+(?:all\s+)?beams/i,
    ],
    extractParams: (_match, text) => {
      if (/\bhorizontal|beams?\b/i.test(text)) return { axis: "x" };
      if (/\bvertical|columns?\b/i.test(text)) return { axis: "y" };
      const axisMatch = text.match(/parallel\s+to\s+([xyz])/i);
      return { axis: axisMatch ? axisMatch[1].toLowerCase() : "x" };
    },
    describe: (p) => `Select all members parallel to ${p.axis}-axis`,
  },

  // ---- SELECT BY SECTION ----
  {
    action: "select_by_section",
    patterns: [
      /select\s+(?:all\s+)?(?:members?\s+)?(?:with|using|having)\s+(?:section\s+)?(?:ISM?[BLHWC]|W\d|HSS)\S*/i,
      /select\s+(?:all\s+)?(?:ISM?[BLHWC]|W\d|HSS)\S*\s+members?/i,
    ],
    extractParams: (_match, text) => {
      const sectionId = extractSectionId(text);
      return { sectionId };
    },
    describe: (p) => `Select all members with section ${p.sectionId}`,
  },

  // ---- INFO QUERIES ----
  {
    action: "info_node",
    patterns: [
      /(?:info|information|details?|properties|props)\s+(?:of\s+|for\s+|about\s+)?(?:node\s*)?[Nn](\d+)/i,
      /what(?:'s| is)\s+(?:node\s*)?[Nn](\d+)/i,
      /(?:show|tell|give)\s+(?:me\s+)?(?:node\s*)?[Nn](\d+)\s+(?:info|details|properties)/i,
    ],
    extractParams: (match, text) => {
      const nodeId = extractNodeId(text);
      return { nodeId: nodeId || `N${match[1]}` };
    },
    describe: (p) => `Show information about ${p.nodeId}`,
  },
  {
    action: "info_member",
    patterns: [
      /(?:info|information|details?|properties|props)\s+(?:of\s+|for\s+|about\s+)?(?:member\s*|beam\s*)?[Mm](\d+)/i,
      /what(?:'s| is)\s+(?:member\s*)?[Mm](\d+)/i,
      /(?:show|tell|give)\s+(?:me\s+)?(?:member\s*)?[Mm](\d+)\s+(?:info|details|properties)/i,
    ],
    extractParams: (match, text) => {
      const memberId = extractMemberId(text);
      return { memberId: memberId || `M${match[1]}` };
    },
    describe: (p) => `Show information about ${p.memberId}`,
  },
  {
    action: "info_model",
    patterns: [
      /(?:model|structure)\s+(?:info|information|summary|status|details)/i,
      /(?:show|tell|give)\s+(?:me\s+)?(?:model|structure)\s+(?:info|summary)/i,
      /(?:how\s+many)\s+(?:nodes?|members?|elements?)/i,
      /(?:what|describe)\s+(?:is\s+)?(?:the\s+)?(?:current\s+)?model/i,
    ],
    extractParams: () => ({}),
    describe: () => "Show model summary",
  },

  // ---- LIST QUERIES ----
  {
    action: "list_nodes",
    patterns: [
      /(?:list|show)\s+(?:all\s+)?nodes/i,
      /(?:print|display)\s+nodes/i,
    ],
    extractParams: () => ({}),
    describe: () => "List all nodes",
  },
  {
    action: "list_members",
    patterns: [
      /(?:list|show)\s+(?:all\s+)?members/i,
      /(?:print|display)\s+members/i,
    ],
    extractParams: () => ({}),
    describe: () => "List all members",
  },
  {
    action: "list_loads",
    patterns: [
      /(?:list|show)\s+(?:all\s+)?loads/i,
      /(?:print|display)\s+loads/i,
      /(?:what|which)\s+loads?\s+(?:are|do)/i,
    ],
    extractParams: () => ({}),
    describe: () => "List all loads",
  },

  // ---- ADD LOAD CASE ----
  {
    action: "add_load_case",
    patterns: [
      /(?:add|create)\s+(?:a\s+)?(?:new\s+)?load\s+case/i,
      /(?:add|create)\s+(?:a\s+)?(?:dead|live|wind|seismic|snow)\s+(?:load\s+)?case/i,
    ],
    extractParams: (_match, text) => {
      let type: string = "custom";
      if (/\bdead\b/i.test(text)) type = "dead";
      else if (/\blive\b/i.test(text)) type = "live";
      else if (/\bwind\b/i.test(text)) type = "wind";
      else if (/\bseismic\b/i.test(text)) type = "seismic";
      else if (/\bsnow\b/i.test(text)) type = "snow";
      const nameMatch = text.match(/(?:named?|called?)\s+["']?([^"']+)["']?/i);
      return {
        type,
        name:
          nameMatch?.[1] ||
          `${type.charAt(0).toUpperCase() + type.slice(1)} Load`,
      };
    },
    describe: (p) => `Add ${p.type} load case "${p.name}"`,
  },

  // ---- QUERY: REACTIONS ----
  {
    action: "query_reactions",
    patterns: [
      /(?:show|what|get|display|list|give)\s+(?:me\s+)?(?:the\s+)?(?:support\s+)?reactions/i,
      /reactions?\s+(?:at|for|of)\s+(?:node\s*)?[Nn](\d+)/i,
      /(?:what|how\s+much)\s+(?:is\s+|are\s+)?(?:the\s+)?reaction/i,
    ],
    extractParams: (_match, text) => {
      const nodeId = extractNodeId(text);
      return { nodeId };
    },
    describe: (p) =>
      p.nodeId ? `Show reactions at ${p.nodeId}` : "Show all support reactions",
  },

  // ---- QUERY: MEMBER FORCES ----
  {
    action: "query_forces",
    patterns: [
      /(?:show|what|get|display)\s+(?:me\s+)?(?:the\s+)?(?:member\s+)?forces?\s+(?:in|on|of|for)\s+(?:member\s*)?[Mm](\d+)/i,
      /(?:axial|shear|moment|bending)\s+(?:force\s+)?(?:in|on|of)\s+(?:member\s*)?[Mm](\d+)/i,
      /(?:what|how\s+much)\s+(?:is|are)\s+(?:the\s+)?(?:forces?|moment|shear|axial)\s+(?:in|on)/i,
      /[Mm](\d+)\s+forces?/i,
    ],
    extractParams: (_match, text) => {
      const memberId = extractMemberId(text);
      return { memberId };
    },
    describe: (p) =>
      p.memberId ? `Show forces in ${p.memberId}` : "Show all member forces",
  },

  // ---- QUERY: DISPLACEMENTS ----
  {
    action: "query_displacements",
    patterns: [
      /(?:show|what|get|display)\s+(?:me\s+)?(?:the\s+)?displacement(?:s)?/i,
      /displacement\s+(?:at|of|for)\s+(?:node\s*)?[Nn](\d+)/i,
      /(?:how\s+much)\s+(?:did|does|has)\s+(?:node\s*)?[Nn](\d+)\s+(?:move|displace|deflect)/i,
    ],
    extractParams: (_match, text) => {
      const nodeId = extractNodeId(text);
      return { nodeId };
    },
    describe: (p) =>
      p.nodeId ? `Show displacement at ${p.nodeId}` : "Show all displacements",
  },

  // ---- QUERY: MAX DEFLECTION ----
  {
    action: "query_max_deflection",
    patterns: [
      /(?:what|show|get)\s+(?:is\s+)?(?:the\s+)?max(?:imum)?\s+(?:deflection|displacement)/i,
      /(?:largest|biggest|worst|peak)\s+(?:deflection|displacement)/i,
      /(?:how\s+much)\s+(?:does\s+(?:it|the\s+(?:beam|structure|model))\s+)?deflect/i,
    ],
    extractParams: () => ({}),
    describe: () => "Show maximum deflection in model",
  },

  // ---- QUERY: STABILITY CHECK ----
  {
    action: "query_stability",
    patterns: [
      /(?:is\s+(?:the\s+)?(?:model|structure)\s+)?stabl[ey]/i,
      /(?:check|verify)\s+(?:model\s+)?stability/i,
      /(?:is\s+(?:it|this)\s+)?(?:statically\s+)?(?:stable|determinate|indeterminate)/i,
      /degree(?:s)?\s+of\s+(?:freedom|indeterminacy)/i,
      /(?:check|verify)\s+(?:the\s+)?(?:model|structure)/i,
    ],
    extractParams: () => ({}),
    describe: () => "Check model stability and determinacy",
  },

  // ---- QUERY: SUPPORTS ----
  {
    action: "list_supports",
    patterns: [
      /(?:list|show|what|where)\s+(?:me\s+)?(?:are\s+)?(?:the\s+)?supports/i,
      /(?:which|what)\s+nodes?\s+(?:have|are)\s+support/i,
      /(?:show|list)\s+(?:all\s+)?(?:boundary\s+)?conditions/i,
    ],
    extractParams: () => ({}),
    describe: () => "List all supports",
  },

  // ---- QUERY: SECTIONS ----
  {
    action: "query_sections",
    patterns: [
      /(?:list|show|what)\s+(?:me\s+)?(?:are\s+)?(?:the\s+)?(?:all\s+)?sections/i,
      /(?:which|what)\s+section(?:s)?\s+(?:are|do)/i,
      /(?:show|list)\s+(?:all\s+)?(?:section|profile)\s+(?:types|used)/i,
    ],
    extractParams: () => ({}),
    describe: () => "List all sections used in model",
  },

  // ---- QUERY: MEMBER LENGTH ----
  {
    action: "query_member_length",
    patterns: [
      /(?:what|how\s+long)\s+(?:is\s+)?(?:the\s+)?(?:length\s+of\s+)?(?:member\s*)?[Mm](\d+)/i,
      /length\s+(?:of\s+)?(?:member\s*)?[Mm](\d+)/i,
      /(?:member\s*)?[Mm](\d+)\s+(?:length|span)/i,
      /(?:total|overall)\s+(?:length|span)\s+(?:of\s+)?(?:the\s+)?(?:model|structure)/i,
    ],
    extractParams: (_match, text) => {
      const memberId = extractMemberId(text);
      return { memberId };
    },
    describe: (p) =>
      p.memberId
        ? `Show length of ${p.memberId}`
        : "Show total structure length",
  },

  // ---- QUERY: TOTAL WEIGHT ----
  {
    action: "query_total_weight",
    patterns: [
      /(?:what|show|calculate|compute)\s+(?:is\s+)?(?:the\s+)?(?:total\s+)?(?:weight|mass|self[\s-]?weight)/i,
      /(?:how\s+(?:much|heavy))\s+(?:does|is)\s+(?:the\s+)?(?:structure|model|frame)/i,
      /(?:estimate|calc)\s+(?:the\s+)?(?:total\s+)?weight/i,
    ],
    extractParams: () => ({}),
    describe: () => "Calculate total weight of structure",
  },

  // ---- QUERY: EQUILIBRIUM CHECK ----
  {
    action: "query_equilibrium",
    patterns: [
      /(?:check|verify|show)\s+(?:the\s+)?equilibrium/i,
      /(?:is\s+(?:the\s+)?(?:model|structure)\s+)?in\s+equilibrium/i,
      /(?:force|load)\s+balance/i,
      /(?:sum\s+of\s+)?(?:forces|reactions)/i,
    ],
    extractParams: () => ({}),
    describe: () => "Check force equilibrium",
  },

  // ---- QUERY: ANALYSIS STATUS ----
  {
    action: "query_analysis_status",
    patterns: [
      /(?:has\s+|was\s+)?(?:the\s+)?(?:analysis|solve)\s+(?:been\s+)?(?:run|done|completed|performed)/i,
      /(?:is\s+(?:there|it)\s+)?analyz?e?s?i?s?\s+(?:results?|data|available)/i,
      /(?:show|check)\s+(?:the\s+)?analysis\s+(?:status|state)/i,
      /(?:did|have)\s+(?:you\s+)?(?:run|do)\s+(?:the\s+)?analysis/i,
    ],
    extractParams: () => ({}),
    describe: () => "Check analysis status",
  },

  // ---- LIST: PLATES ----
  {
    action: "list_plates",
    patterns: [
      /(?:list|show)\s+(?:all\s+)?plates?/i,
      /(?:list|show)\s+(?:all\s+)?(?:shell|slab)\s+elements?/i,
    ],
    extractParams: () => ({}),
    describe: () => "List all plate/shell elements",
  },

  // ---- LIST: LOAD CASES ----
  {
    action: "list_load_cases",
    patterns: [
      /(?:list|show)\s+(?:all\s+)?load\s+cases?/i,
      /(?:what|which)\s+load\s+cases?/i,
      /(?:list|show)\s+(?:all\s+)?load\s+combos?/i,
      /(?:list|show)\s+(?:all\s+)?load\s+combinations?/i,
    ],
    extractParams: () => ({}),
    describe: () => "List all load cases and combinations",
  },

  // ---- HELP ----
  {
    action: "help",
    patterns: [
      /^help$/i,
      /(?:what|which)\s+commands?\s+(?:can|do)/i,
      /(?:show|list)\s+(?:available\s+)?commands/i,
      /what\s+can\s+you\s+do/i,
      /how\s+(?:do\s+I|to)\s+use\s+(?:this|you)/i,
      /capabilities/i,
    ],
    extractParams: () => ({}),
    describe: () => "Show available commands",
  },
];

// ============================================
// MAIN INTERPRETER
// ============================================

export function interpretCommand(text: string): ParsedCommand {
  const normalized = text.trim();

  for (const pattern of COMMAND_PATTERNS) {
    for (const regex of pattern.patterns) {
      const match = normalized.match(regex);
      if (match) {
        const params = pattern.extractParams(match, normalized);
        const description = pattern.describe(params);
        return {
          action: pattern.action,
          confidence: 0.9,
          params,
          originalText: text,
          description,
        };
      }
    }
  }

  // ---- FUZZY FALLBACK ----
  // Try to detect intent from keywords even if no pattern matched exactly
  const lower = normalized.toLowerCase();

  // Select-like commands
  if (/\bselect\b/.test(lower)) {
    const nodeId = extractNodeId(normalized);
    const memberId = extractMemberId(normalized);
    if (nodeId) {
      return {
        action: "select_node",
        confidence: 0.6,
        params: { nodeIds: [nodeId], multi: false },
        originalText: text,
        description: `Select ${nodeId}`,
      };
    }
    if (memberId) {
      return {
        action: "select_member",
        confidence: 0.6,
        params: { memberIds: [memberId], multi: false },
        originalText: text,
        description: `Select ${memberId}`,
      };
    }
  }

  // Load-like commands
  if (/\b(load|udl|force|pressure)\b/.test(lower)) {
    const memberId = extractMemberId(normalized);
    const nodeId = extractNodeId(normalized);
    const value = extractValue(normalized, ["load", "force", "udl"]);

    if (memberId) {
      return {
        action: "add_member_load",
        confidence: 0.5,
        params: {
          memberId,
          type: "UDL",
          value: value ?? -10,
          direction: extractLoadDirection(normalized),
          useSelected: false,
        },
        originalText: text,
        description: `Apply ${Math.abs(value ?? 10)} kN/m UDL on ${memberId}`,
      };
    }
    if (nodeId) {
      return {
        action: "add_node_load",
        confidence: 0.5,
        params: { nodeId, fx: 0, fy: value ? -Math.abs(value) : -10, fz: 0 },
        originalText: text,
        description: `Apply ${Math.abs(value ?? 10)} kN load at ${nodeId}`,
      };
    }
  }

  // Delete-like commands
  if (/\b(delete|remove|erase)\b/.test(lower)) {
    const nodeId = extractNodeId(normalized);
    const memberId = extractMemberId(normalized);
    if (nodeId) {
      return {
        action: "delete_node",
        confidence: 0.6,
        params: { nodeIds: [nodeId] },
        originalText: text,
        description: `Delete ${nodeId}`,
      };
    }
    if (memberId) {
      return {
        action: "delete_member",
        confidence: 0.6,
        params: { memberIds: [memberId] },
        originalText: text,
        description: `Delete ${memberId}`,
      };
    }
  }

  // Support-like commands
  if (/\b(support|fixed|pinned|roller|hinge|clamp)\b/.test(lower)) {
    const nodeId = extractNodeId(normalized);
    const supportType = extractSupportType(normalized) || "fixed";
    if (nodeId) {
      return {
        action: "add_support",
        confidence: 0.5,
        params: { nodeId, supportType, useSelected: false },
        originalText: text,
        description: `Add ${supportType} support at ${nodeId}`,
      };
    }
  }

  // Section change commands
  const sectionId = extractSectionId(normalized);
  if (sectionId && /\b(change|set|modify|assign|use)\b/.test(lower)) {
    const memberIds = extractMultipleMemberIds(normalized);
    return {
      action: "change_section",
      confidence: 0.5,
      params: { memberIds, sectionId, useSelected: memberIds.length === 0 },
      originalText: text,
      description: `Change section to ${sectionId}`,
    };
  }

  // ---- KNOWLEDGE QUESTION DETECTION ----
  // If it looks like a question about structural engineering, route to knowledge base
  if (
    /^(?:what|how|why|when|where|which|explain|describe|define|tell|can you|could you|is |are |do |does |will )/i.test(
      lower,
    ) ||
    /\?$/.test(lower)
  ) {
    return {
      action: "knowledge_question",
      confidence: 0.7,
      params: { question: normalized },
      originalText: text,
      description: "Answer engineering question",
    };
  }

  // No match at all
  return {
    action: "unknown",
    confidence: 0,
    params: {},
    originalText: text,
    description: "Could not understand command",
  };
}

/**
 * Check if a command text looks like an interactive/action command
 * vs a conversational/knowledge question
 */
export function isActionCommand(text: string): boolean {
  const lower = text.toLowerCase().trim();

  const actionKeywords = [
    "select",
    "pick",
    "choose",
    "highlight",
    "click",
    "delete",
    "remove",
    "erase",
    "clear",
    "add",
    "apply",
    "put",
    "create",
    "insert",
    "place",
    "move",
    "shift",
    "translate",
    "relocate",
    "change",
    "set",
    "modify",
    "update",
    "assign",
    "show",
    "hide",
    "display",
    "toggle",
    "fix",
    "pin",
    "support",
    "free",
    "release",
    "split",
    "merge",
    "combine",
    "connect",
    "duplicate",
    "copy",
    "paste",
    "clone",
    "renumber",
    "reorder",
    "reset",
    "load",
    "udl",
    "force",
    "info",
    "list",
    "properties",
    "details",
    "auto-fix",
    "autofix",
    "clean",
    "deselect",
    "unselect",
    "invert",
    // Query keywords:
    "reaction",
    "displacement",
    "deflection",
    "equilibrium",
    "stability",
    "determinate",
    "indeterminate",
    "weight",
    "mass",
    "section",
    "length",
    "span",
    "height",
    "analysis",
    "solve",
    "result",
    "forces",
    "help",
    "capabilities",
    "commands",
    // Knowledge question indicators:
    "what is",
    "what are",
    "how to",
    "how does",
    "explain",
    "define",
    "describe",
    "difference between",
    "why",
    "tell me",
    "can you",
  ];

  // Also catch questions ending with ?
  if (lower.endsWith("?")) return true;

  return actionKeywords.some((kw) => lower.includes(kw));
}

/**
 * Get suggested commands based on current model state
 */
export function getSuggestedCommands(
  hasModel: boolean,
  hasSelection: boolean,
): string[] {
  if (!hasModel) {
    return [
      "Generate a simple beam first, then try commands like:",
      '"Select node N1"',
      '"Apply 20 kN/m UDL on M1"',
      '"Add fixed support at N1"',
    ];
  }

  const suggestions = [
    "Select node N1",
    "Select member M1",
    "Apply 20 kN/m UDL on M1",
    "Add fixed support at N1",
    "Add pinned support at N2",
    "Change section of M1 to ISMB400",
    "Show model info",
    "List all nodes",
    "List all loads",
  ];

  if (hasSelection) {
    suggestions.unshift(
      "Delete selected",
      "Change section to ISMB400",
      "Apply load to selected member",
      "Add support to selected node",
    );
  }

  return suggestions;
}
