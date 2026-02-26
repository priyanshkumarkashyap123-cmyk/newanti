/**
 * AIModelExecutor.ts
 *
 * Executes parsed AI commands against the Zustand model store.
 * This is the bridge between the AICommandInterpreter and the actual model store.
 */

import { ParsedCommand, interpretCommand } from "./AICommandInterpreter";
import { useModelStore } from "../../store/model";
import type { Restraints, MemberLoad, NodeLoad } from "../../store/model";

// ============================================
// EXECUTION RESULT
// ============================================

export interface ExecutionResult {
  success: boolean;
  message: string;
  action: string;
  details?: string;
}

// ============================================
// HELPERS
// ============================================

function generateId(prefix: string): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

function getRestraintsForSupport(type: string): Restraints {
  switch (type) {
    case "fixed":
      return { fx: true, fy: true, fz: true, mx: true, my: true, mz: true };
    case "pinned":
      return { fx: true, fy: true, fz: true, mx: false, my: false, mz: false };
    case "roller":
      return {
        fx: false,
        fy: true,
        fz: false,
        mx: false,
        my: false,
        mz: false,
      };
    default:
      return {
        fx: false,
        fy: false,
        fz: false,
        mx: false,
        my: false,
        mz: false,
      };
  }
}

// ============================================
// MAIN EXECUTOR
// ============================================

export function executeCommand(command: ParsedCommand): ExecutionResult {
  const store = useModelStore.getState();
  const { action, params } = command;

  try {
    switch (action) {
      // ======= SELECTION =======
      case "select_node": {
        const nodeIds: string[] = params.nodeIds || [];
        let found = 0;
        for (let i = 0; i < nodeIds.length; i++) {
          const id = nodeIds[i];
          if (store.nodes.has(id)) {
            store.selectNode(id, i > 0 || params.multi);
            found++;
          }
        }
        if (found === 0) {
          return {
            success: false,
            message: `Node${nodeIds.length > 1 ? "s" : ""} ${nodeIds.join(", ")} not found in model`,
            action,
          };
        }
        return {
          success: true,
          message: `✓ Selected ${found} node${found > 1 ? "s" : ""}: ${nodeIds.slice(0, found).join(", ")}`,
          action,
        };
      }

      case "select_member": {
        const memberIds: string[] = params.memberIds || [];
        let found = 0;
        for (let i = 0; i < memberIds.length; i++) {
          const id = memberIds[i];
          if (store.members.has(id)) {
            store.selectMember(id, i > 0 || params.multi);
            found++;
          }
        }
        if (found === 0) {
          return {
            success: false,
            message: `Member${memberIds.length > 1 ? "s" : ""} ${memberIds.join(", ")} not found in model`,
            action,
          };
        }
        return {
          success: true,
          message: `✓ Selected ${found} member${found > 1 ? "s" : ""}: ${memberIds.slice(0, found).join(", ")}`,
          action,
        };
      }

      case "select_all": {
        store.selectAll();
        const total = store.nodes.size + store.members.size;
        return {
          success: true,
          message: `✓ Selected all ${total} elements (${store.nodes.size} nodes, ${store.members.size} members)`,
          action,
        };
      }

      case "clear_selection": {
        store.clearSelection();
        return { success: true, message: "✓ Selection cleared", action };
      }

      case "invert_selection": {
        store.invertSelection();
        return { success: true, message: "✓ Selection inverted", action };
      }

      // ======= DELETE =======
      case "delete_node": {
        const nodeIds: string[] = params.nodeIds || [];
        let deleted = 0;
        for (const id of nodeIds) {
          if (store.nodes.has(id)) {
            store.removeNode(id);
            deleted++;
          }
        }
        if (deleted === 0) {
          return {
            success: false,
            message: `Node${nodeIds.length > 1 ? "s" : ""} ${nodeIds.join(", ")} not found`,
            action,
          };
        }
        return {
          success: true,
          message: `✓ Deleted ${deleted} node${deleted > 1 ? "s" : ""}: ${nodeIds.join(", ")}`,
          action,
        };
      }

      case "delete_member": {
        const memberIds: string[] = params.memberIds || [];
        let deleted = 0;
        for (const id of memberIds) {
          if (store.members.has(id)) {
            store.removeMember(id);
            deleted++;
          }
        }
        if (deleted === 0) {
          return {
            success: false,
            message: `Member${memberIds.length > 1 ? "s" : ""} ${memberIds.join(", ")} not found`,
            action,
          };
        }
        return {
          success: true,
          message: `✓ Deleted ${deleted} member${deleted > 1 ? "s" : ""}: ${memberIds.join(", ")}`,
          action,
        };
      }

      case "delete_selection": {
        const beforeNodes = store.nodes.size;
        const beforeMembers = store.members.size;
        store.deleteSelection();
        const deletedNodes = beforeNodes - useModelStore.getState().nodes.size;
        const deletedMembers =
          beforeMembers - useModelStore.getState().members.size;
        if (deletedNodes === 0 && deletedMembers === 0) {
          return {
            success: false,
            message: "Nothing was selected to delete",
            action,
          };
        }
        return {
          success: true,
          message: `✓ Deleted ${deletedNodes} node${deletedNodes !== 1 ? "s" : ""} and ${deletedMembers} member${deletedMembers !== 1 ? "s" : ""}`,
          action,
        };
      }

      // ======= ADD NODE =======
      case "add_node": {
        const coords = params.coordinates || { x: 0, y: 0, z: 0 };
        const existingIds = Array.from(store.nodes.keys());
        const maxNum = existingIds.reduce((max, id) => {
          const num = parseInt(id.replace(/\D/g, ""));
          return num > max ? num : max;
        }, 0);
        const newId = `N${maxNum + 1}`;
        store.addNode({
          id: newId,
          x: coords.x ?? 0,
          y: coords.y ?? 0,
          z: coords.z ?? 0,
        });
        return {
          success: true,
          message: `✓ Added node ${newId} at (${coords.x}, ${coords.y}, ${coords.z})`,
          action,
        };
      }

      // ======= ADD MEMBER =======
      case "add_member": {
        const { startNodeId, endNodeId, sectionId } = params;
        if (!startNodeId || !endNodeId) {
          return {
            success: false,
            message:
              'Please specify two node IDs (e.g., "Add member from N1 to N3")',
            action,
          };
        }
        if (!store.nodes.has(startNodeId)) {
          return {
            success: false,
            message: `Start node ${startNodeId} not found`,
            action,
          };
        }
        if (!store.nodes.has(endNodeId)) {
          return {
            success: false,
            message: `End node ${endNodeId} not found`,
            action,
          };
        }
        const existingMemberIds = Array.from(store.members.keys());
        const maxMemberNum = existingMemberIds.reduce((max, id) => {
          const num = parseInt(id.replace(/\D/g, ""));
          return num > max ? num : max;
        }, 0);
        const newMemberId = `M${maxMemberNum + 1}`;
        store.addMember({
          id: newMemberId,
          startNodeId,
          endNodeId,
          sectionId: sectionId || "ISMB300",
        });
        return {
          success: true,
          message: `✓ Added member ${newMemberId} from ${startNodeId} to ${endNodeId} (${sectionId || "ISMB300"})`,
          action,
        };
      }

      // ======= MOVE NODE =======
      case "move_node": {
        const { nodeId, position } = params;
        if (!nodeId) {
          return {
            success: false,
            message: 'Please specify a node (e.g., "Move N1 to (5, 10, 0)")',
            action,
          };
        }
        if (!store.nodes.has(nodeId)) {
          return {
            success: false,
            message: `Node ${nodeId} not found`,
            action,
          };
        }
        const currentNode = store.nodes.get(nodeId)!;
        const newPos = {
          x: position?.x ?? currentNode.x,
          y: position?.y ?? currentNode.y,
          z: position?.z ?? currentNode.z,
        };
        store.updateNodePosition(nodeId, newPos);
        return {
          success: true,
          message: `✓ Moved ${nodeId} to (${newPos.x}, ${newPos.y}, ${newPos.z})`,
          action,
        };
      }

      // ======= MOVE SELECTION =======
      case "move_selection": {
        const offset = params.offset || { x: 0, y: 0, z: 0 };
        if (store.selectedIds.size === 0) {
          return {
            success: false,
            message: "Nothing selected. Select elements first.",
            action,
          };
        }
        store.moveSelection(offset.x || 0, offset.y || 0, offset.z || 0);
        return {
          success: true,
          message: `✓ Moved ${store.selectedIds.size} elements by (${offset.x}, ${offset.y}, ${offset.z})`,
          action,
        };
      }

      // ======= ADD MEMBER LOAD =======
      case "add_member_load": {
        let targetMemberId = params.memberId;

        // If no member specified, use first selected member
        if (!targetMemberId && params.useSelected) {
          const selectedMemberIds = Array.from(store.selectedIds).filter((id) =>
            store.members.has(id),
          );
          if (selectedMemberIds.length === 0) {
            return {
              success: false,
              message:
                'No member specified or selected. Try "Apply 20 kN/m UDL on M1" or select a member first.',
              action,
            };
          }
          targetMemberId = selectedMemberIds[0];
        }

        if (!targetMemberId) {
          return {
            success: false,
            message:
              'Please specify a member (e.g., "Apply 20 kN/m UDL on M1")',
            action,
          };
        }
        if (!store.members.has(targetMemberId)) {
          return {
            success: false,
            message: `Member ${targetMemberId} not found`,
            action,
          };
        }

        const loadId = generateId("ML-");
        const loadValue = params.value ?? -10;
        const loadType = params.type || "UDL";
        const direction = params.direction || "global_y";

        const memberLoad: MemberLoad = {
          id: loadId,
          memberId: targetMemberId,
          type: loadType,
          direction: direction as any,
        };

        if (loadType === "UDL") {
          memberLoad.w1 = loadValue < 0 ? loadValue : -loadValue;
        } else if (loadType === "UVL") {
          memberLoad.w1 = loadValue < 0 ? loadValue : -loadValue;
          memberLoad.w2 = 0;
        } else if (loadType === "point") {
          memberLoad.P = loadValue < 0 ? loadValue : -loadValue;
          memberLoad.a = 0.5; // midpoint by default
        } else if (loadType === "moment") {
          memberLoad.M = loadValue;
          memberLoad.a = 0.5;
        }

        store.addMemberLoad(memberLoad);
        return {
          success: true,
          message: `✓ Applied ${Math.abs(loadValue)} kN/m ${loadType} on ${targetMemberId} (${direction})`,
          action,
        };
      }

      // ======= ADD NODE LOAD =======
      case "add_node_load": {
        let targetNodeId = params.nodeId;

        if (!targetNodeId && params.useSelected) {
          const selectedNodeIds = Array.from(store.selectedIds).filter((id) =>
            store.nodes.has(id),
          );
          if (selectedNodeIds.length === 0) {
            return {
              success: false,
              message:
                'No node specified or selected. Try "Apply 10 kN load at N1"',
              action,
            };
          }
          targetNodeId = selectedNodeIds[0];
        }

        if (!targetNodeId) {
          return {
            success: false,
            message: 'Please specify a node (e.g., "Apply 10 kN load at N1")',
            action,
          };
        }
        if (!store.nodes.has(targetNodeId)) {
          return {
            success: false,
            message: `Node ${targetNodeId} not found`,
            action,
          };
        }

        const nodeLoadId = generateId("NL-");
        const nodeLoad: NodeLoad = {
          id: nodeLoadId,
          nodeId: targetNodeId,
          fx: params.fx || 0,
          fy: params.fy || -10,
          fz: params.fz || 0,
        };

        store.addLoad(nodeLoad);
        const forces = [];
        if (nodeLoad.fx) forces.push(`Fx=${nodeLoad.fx} kN`);
        if (nodeLoad.fy) forces.push(`Fy=${nodeLoad.fy} kN`);
        if (nodeLoad.fz) forces.push(`Fz=${nodeLoad.fz} kN`);
        return {
          success: true,
          message: `✓ Applied load at ${targetNodeId}: ${forces.join(", ")}`,
          action,
        };
      }

      // ======= REMOVE LOADS =======
      case "remove_load": {
        const nodeId = params.nodeId;
        const currentState = useModelStore.getState();
        const loadsToRemove = currentState.loads.filter(
          (l) => !nodeId || l.nodeId === nodeId,
        );
        if (loadsToRemove.length === 0) {
          return {
            success: false,
            message: nodeId
              ? `No loads found on ${nodeId}`
              : "No node loads to remove",
            action,
          };
        }
        for (const load of loadsToRemove) {
          store.removeLoad(load.id);
        }
        return {
          success: true,
          message: `✓ Removed ${loadsToRemove.length} node load${loadsToRemove.length > 1 ? "s" : ""}`,
          action,
        };
      }

      case "remove_member_load": {
        const memberId = params.memberId;
        const currentState = useModelStore.getState();
        const memberLoadsToRemove = currentState.memberLoads.filter(
          (l) => !memberId || l.memberId === memberId,
        );
        if (memberLoadsToRemove.length === 0) {
          return {
            success: false,
            message: memberId
              ? `No loads found on ${memberId}`
              : "No member loads to remove",
            action,
          };
        }
        for (const load of memberLoadsToRemove) {
          store.removeMemberLoad(load.id);
        }
        return {
          success: true,
          message: `✓ Removed ${memberLoadsToRemove.length} member load${memberLoadsToRemove.length > 1 ? "s" : ""}`,
          action,
        };
      }

      // ======= SUPPORTS =======
      case "add_support": {
        let targetNodeId = params.nodeId;

        if (!targetNodeId && params.useSelected) {
          const selectedNodeIds = Array.from(store.selectedIds).filter((id) =>
            store.nodes.has(id),
          );
          if (selectedNodeIds.length === 0) {
            return {
              success: false,
              message:
                'No node specified or selected. Try "Add fixed support at N1"',
              action,
            };
          }
          targetNodeId = selectedNodeIds[0];
        }

        if (!targetNodeId) {
          return {
            success: false,
            message: 'Please specify a node (e.g., "Add fixed support at N1")',
            action,
          };
        }
        if (!store.nodes.has(targetNodeId)) {
          return {
            success: false,
            message: `Node ${targetNodeId} not found`,
            action,
          };
        }

        const restraints = getRestraintsForSupport(
          params.supportType || "fixed",
        );
        store.setNodeRestraints(targetNodeId, restraints);
        return {
          success: true,
          message: `✓ Applied ${params.supportType || "fixed"} support at ${targetNodeId}`,
          action,
        };
      }

      case "remove_support": {
        let targetNodeId = params.nodeId;

        if (!targetNodeId && params.useSelected) {
          const selectedNodeIds = Array.from(store.selectedIds).filter((id) =>
            store.nodes.has(id),
          );
          if (selectedNodeIds.length > 0) targetNodeId = selectedNodeIds[0];
        }

        if (!targetNodeId) {
          return {
            success: false,
            message: 'Please specify a node (e.g., "Remove support from N1")',
            action,
          };
        }
        if (!store.nodes.has(targetNodeId)) {
          return {
            success: false,
            message: `Node ${targetNodeId} not found`,
            action,
          };
        }

        const freeRestraints: Restraints = {
          fx: false,
          fy: false,
          fz: false,
          mx: false,
          my: false,
          mz: false,
        };
        store.setNodeRestraints(targetNodeId, freeRestraints);
        return {
          success: true,
          message: `✓ Removed support from ${targetNodeId} (now free)`,
          action,
        };
      }

      // ======= CHANGE SECTION =======
      case "change_section": {
        const sectionId = params.sectionId || "ISMB300";
        let memberIds: string[] = params.memberIds || [];

        if (memberIds.length === 0 && params.useSelected) {
          memberIds = Array.from(store.selectedIds).filter((id) =>
            store.members.has(id),
          );
        }

        if (memberIds.length === 0) {
          // Apply to ALL members
          memberIds = Array.from(store.members.keys());
          if (memberIds.length === 0) {
            return { success: false, message: "No members in model", action };
          }
        }

        let changed = 0;
        for (const id of memberIds) {
          if (store.members.has(id)) {
            store.updateMember(id, { sectionId });
            changed++;
          }
        }
        return {
          success: true,
          message: `✓ Changed section of ${changed} member${changed > 1 ? "s" : ""} to ${sectionId}`,
          action,
        };
      }

      // ======= SET TOOL =======
      case "set_tool": {
        const tool = params.tool || "select";
        store.setTool(tool);
        return { success: true, message: `✓ Switched to ${tool} tool`, action };
      }

      // ======= SHOW/HIDE RESULTS =======
      case "show_bmd": {
        store.setShowBMD(true);
        return {
          success: true,
          message: "✓ Bending Moment Diagram enabled",
          action,
        };
      }
      case "show_sfd": {
        store.setShowSFD(true);
        return {
          success: true,
          message: "✓ Shear Force Diagram enabled",
          action,
        };
      }
      case "show_afd": {
        store.setShowAFD(true);
        return {
          success: true,
          message: "✓ Axial Force Diagram enabled",
          action,
        };
      }
      case "show_deflection": {
        store.setShowDeflectedShape(true);
        return {
          success: true,
          message: "✓ Deflected shape display enabled",
          action,
        };
      }
      case "show_results": {
        store.setShowResults(true);
        return {
          success: true,
          message: "✓ Analysis results display enabled",
          action,
        };
      }
      case "hide_results": {
        store.setShowResults(false);
        store.setShowBMD(false);
        store.setShowSFD(false);
        store.setShowAFD(false);
        store.setShowDeflectedShape(false);
        return {
          success: true,
          message: "✓ All result displays hidden",
          action,
        };
      }

      // ======= MODEL OPERATIONS =======
      case "clear_model": {
        store.clearModel();
        return {
          success: true,
          message: "✓ Model cleared. Ready for a fresh start!",
          action,
        };
      }

      case "renumber_nodes": {
        store.renumberNodes();
        return {
          success: true,
          message: "✓ Nodes renumbered sequentially",
          action,
        };
      }

      case "renumber_members": {
        store.renumberMembers();
        return {
          success: true,
          message: "✓ Members renumbered sequentially",
          action,
        };
      }

      case "split_member": {
        const memberId = params.memberId;
        if (!memberId || !store.members.has(memberId)) {
          return {
            success: false,
            message: `Member ${memberId || "?"} not found`,
            action,
          };
        }
        const ratio = params.ratio ?? 0.5;
        store.splitMemberById(memberId, ratio);
        return {
          success: true,
          message: `✓ Split ${memberId} at ${(ratio * 100).toFixed(0)}% of its length`,
          action,
        };
      }

      case "merge_nodes": {
        const { nodeId1, nodeId2 } = params;
        if (!nodeId1 || !nodeId2) {
          return {
            success: false,
            message: 'Please specify two nodes (e.g., "Merge N1 and N3")',
            action,
          };
        }
        if (!store.nodes.has(nodeId1)) {
          return {
            success: false,
            message: `Node ${nodeId1} not found`,
            action,
          };
        }
        if (!store.nodes.has(nodeId2)) {
          return {
            success: false,
            message: `Node ${nodeId2} not found`,
            action,
          };
        }
        store.mergeNodes(nodeId1, nodeId2);
        return {
          success: true,
          message: `✓ Merged ${nodeId2} into ${nodeId1}`,
          action,
        };
      }

      case "duplicate_selection": {
        if (store.selectedIds.size === 0) {
          return {
            success: false,
            message: "Nothing selected to duplicate",
            action,
          };
        }
        const offset = params.offset || { x: 1, y: 0, z: 0 };
        store.duplicateSelection(offset);
        return {
          success: true,
          message: `✓ Duplicated ${store.selectedIds.size} elements with offset (${offset.x}, ${offset.y}, ${offset.z})`,
          action,
        };
      }

      case "copy_selection": {
        if (store.selectedIds.size === 0) {
          return {
            success: false,
            message: "Nothing selected to copy",
            action,
          };
        }
        store.copySelection();
        return {
          success: true,
          message: `✓ Copied ${store.selectedIds.size} elements to clipboard`,
          action,
        };
      }

      case "paste_clipboard": {
        if (!store.clipboard) {
          return {
            success: false,
            message: "Clipboard is empty. Copy something first.",
            action,
          };
        }
        store.pasteClipboard(params.offset);
        return { success: true, message: "✓ Pasted from clipboard", action };
      }

      case "auto_fix": {
        const result = store.autoFixModel();
        if (result.fixed.length === 0 && result.errors.length === 0) {
          return {
            success: true,
            message: "✓ Model is clean - no issues found!",
            action,
          };
        }
        const details = [
          ...result.fixed.map((f) => `Fixed: ${f}`),
          ...result.errors.map((e) => `Error: ${e}`),
        ].join("\n");
        return {
          success: true,
          message: `✓ Auto-fix complete. ${result.fixed.length} fixes, ${result.errors.length} remaining issues.`,
          action,
          details,
        };
      }

      case "select_parallel": {
        const axis = params.axis || "x";
        store.selectParallel(axis);
        return {
          success: true,
          message: `✓ Selected all members parallel to ${axis}-axis`,
          action,
        };
      }

      case "select_by_section": {
        const sectionId = params.sectionId;
        if (!sectionId) {
          return {
            success: false,
            message:
              'Please specify a section (e.g., "Select all ISMB300 members")',
            action,
          };
        }
        store.selectByProperty("sectionId", sectionId);
        return {
          success: true,
          message: `✓ Selected all members with section ${sectionId}`,
          action,
        };
      }

      // ======= INFO / QUERY =======
      case "info_node": {
        const nodeId = params.nodeId;
        if (!nodeId || !store.nodes.has(nodeId)) {
          return {
            success: false,
            message: `Node ${nodeId || "?"} not found`,
            action,
          };
        }
        const node = store.nodes.get(nodeId)!;
        const restraints = node.restraints;
        let supportStr = "Free (no support)";
        if (restraints) {
          if (
            restraints.fx &&
            restraints.fy &&
            restraints.fz &&
            restraints.mx &&
            restraints.my &&
            restraints.mz
          ) {
            supportStr = "Fixed";
          } else if (restraints.fx && restraints.fy && restraints.fz) {
            supportStr = "Pinned";
          } else if (restraints.fy) {
            supportStr = "Roller";
          } else {
            const restrained = Object.entries(restraints)
              .filter(([, v]) => v)
              .map(([k]) => k);
            supportStr =
              restrained.length > 0
                ? `Custom (${restrained.join(", ")})`
                : "Free";
          }
        }

        // Find connected members
        const connectedMembers = Array.from(store.members.values())
          .filter((m) => m.startNodeId === nodeId || m.endNodeId === nodeId)
          .map((m) => m.id);

        // Find loads on this node
        const nodeLoads = store.loads.filter((l) => l.nodeId === nodeId);

        const info = [
          `📍 ${nodeId}: Position (${node.x}, ${node.y}, ${node.z})`,
          `  Support: ${supportStr}`,
          `  Connected members: ${connectedMembers.length > 0 ? connectedMembers.join(", ") : "None"}`,
          `  Applied loads: ${nodeLoads.length > 0 ? nodeLoads.map((l) => `Fy=${l.fy || 0}kN`).join(", ") : "None"}`,
        ].join("\n");

        return { success: true, message: info, action };
      }

      case "info_member": {
        const memberId = params.memberId;
        if (!memberId || !store.members.has(memberId)) {
          return {
            success: false,
            message: `Member ${memberId || "?"} not found`,
            action,
          };
        }
        const member = store.members.get(memberId)!;
        const startNode = store.nodes.get(member.startNodeId);
        const endNode = store.nodes.get(member.endNodeId);

        let length = 0;
        if (startNode && endNode) {
          length = Math.sqrt(
            (endNode.x - startNode.x) ** 2 +
              (endNode.y - startNode.y) ** 2 +
              (endNode.z - startNode.z) ** 2,
          );
        }

        // Find loads on this member
        const mLoads = store.memberLoads.filter((l) => l.memberId === memberId);

        const info = [
          `📐 ${memberId}: ${member.startNodeId} → ${member.endNodeId}`,
          `  Section: ${member.sectionId || "Default"}`,
          `  Length: ${length.toFixed(3)} m`,
          `  E: ${member.E ? `${member.E} kN/m²` : "Default"}`,
          `  Applied loads: ${mLoads.length > 0 ? mLoads.map((l) => `${l.type} w=${l.w1 || l.P || 0}`).join(", ") : "None"}`,
        ].join("\n");

        return { success: true, message: info, action };
      }

      case "info_model": {
        const nNodes = store.nodes.size;
        const nMembers = store.members.size;
        const nLoads = store.loads.length;
        const nMemberLoads = store.memberLoads.length;
        const nSelected = store.selectedIds.size;

        // Count supports
        let nFixed = 0,
          nPinned = 0,
          nRoller = 0;
        store.nodes.forEach((n) => {
          if (n.restraints) {
            if (
              n.restraints.fx &&
              n.restraints.fy &&
              n.restraints.mx &&
              n.restraints.my
            )
              nFixed++;
            else if (n.restraints.fx && n.restraints.fy) nPinned++;
            else if (n.restraints.fy) nRoller++;
          }
        });

        const info = [
          `📊 Model Summary:`,
          `  Nodes: ${nNodes}`,
          `  Members: ${nMembers}`,
          `  Node Loads: ${nLoads}`,
          `  Member Loads: ${nMemberLoads}`,
          `  Supports: ${nFixed} fixed, ${nPinned} pinned, ${nRoller} roller`,
          `  Selected: ${nSelected} elements`,
          `  Load Cases: ${store.loadCases?.length || 0}`,
        ].join("\n");

        return { success: true, message: info, action };
      }

      case "list_nodes": {
        const nodeList = Array.from(store.nodes.values());
        if (nodeList.length === 0) {
          return { success: true, message: "No nodes in model", action };
        }
        const lines = nodeList.slice(0, 20).map((n) => {
          let support = "";
          if (n.restraints) {
            if (
              n.restraints.fx &&
              n.restraints.fy &&
              n.restraints.mx &&
              n.restraints.my &&
              n.restraints.mz
            )
              support = " [Fixed]";
            else if (n.restraints.fx && n.restraints.fy) support = " [Pinned]";
            else if (n.restraints.fy) support = " [Roller]";
          }
          return `  ${n.id}: (${n.x}, ${n.y}, ${n.z})${support}`;
        });
        const truncated =
          nodeList.length > 20
            ? `\n  ... and ${nodeList.length - 20} more`
            : "";
        return {
          success: true,
          message: `📋 Nodes (${nodeList.length}):\n${lines.join("\n")}${truncated}`,
          action,
        };
      }

      case "list_members": {
        const memberList = Array.from(store.members.values());
        if (memberList.length === 0) {
          return { success: true, message: "No members in model", action };
        }
        const lines = memberList.slice(0, 20).map((m) => {
          return `  ${m.id}: ${m.startNodeId} → ${m.endNodeId} (${m.sectionId || "Default"})`;
        });
        const truncated =
          memberList.length > 20
            ? `\n  ... and ${memberList.length - 20} more`
            : "";
        return {
          success: true,
          message: `📋 Members (${memberList.length}):\n${lines.join("\n")}${truncated}`,
          action,
        };
      }

      case "list_loads": {
        const nodeLoads = store.loads;
        const memberLoads = store.memberLoads;
        if (nodeLoads.length === 0 && memberLoads.length === 0) {
          return {
            success: true,
            message: "No loads applied to model",
            action,
          };
        }
        const lines: string[] = [];
        if (nodeLoads.length > 0) {
          lines.push(`Node Loads (${nodeLoads.length}):`);
          nodeLoads.slice(0, 10).forEach((l) => {
            const forces = [];
            if (l.fx) forces.push(`Fx=${l.fx}`);
            if (l.fy) forces.push(`Fy=${l.fy}`);
            if (l.fz) forces.push(`Fz=${l.fz}`);
            lines.push(`  ${l.nodeId}: ${forces.join(", ")} kN`);
          });
        }
        if (memberLoads.length > 0) {
          lines.push(`Member Loads (${memberLoads.length}):`);
          memberLoads.slice(0, 10).forEach((l) => {
            const val =
              l.w1 != null
                ? `w=${l.w1} kN/m`
                : l.P != null
                  ? `P=${l.P} kN`
                  : "";
            lines.push(`  ${l.memberId}: ${l.type} ${val} (${l.direction})`);
          });
        }
        return {
          success: true,
          message: `📋 Loads:\n${lines.join("\n")}`,
          action,
        };
      }

      // ======= LOAD CASE =======
      case "add_load_case": {
        const lcId = generateId("LC-");
        store.addLoadCase({
          id: lcId,
          name: params.name || "New Load Case",
          type: params.type || "custom",
          loads: [],
          memberLoads: [],
        });
        return {
          success: true,
          message: `✓ Added ${params.type} load case "${params.name}"`,
          action,
        };
      }

      // ======= DEEP QUERY: REACTIONS =======
      case "query_reactions": {
        if (!store.analysisResults) {
          return {
            success: false,
            message:
              "⚠ No analysis results available. Run the analysis first (click Analyze in the toolbar).",
            action,
          };
        }
        const reactions = store.analysisResults.reactions;
        if (!reactions || reactions.size === 0) {
          return {
            success: true,
            message: "No support reactions found in results.",
            action,
          };
        }
        const targetNodeId = params.nodeId;
        if (targetNodeId) {
          const r = reactions.get(targetNodeId);
          if (!r) {
            return {
              success: false,
              message: `No reaction data for ${targetNodeId}. It may not be a support node.`,
              action,
            };
          }
          const info = [
            `⚡ Reactions at ${targetNodeId}:`,
            `  Fx = ${r.fx.toFixed(3)} kN`,
            `  Fy = ${r.fy.toFixed(3)} kN`,
            `  Fz = ${r.fz.toFixed(3)} kN`,
            `  Mx = ${r.mx.toFixed(3)} kN·m`,
            `  My = ${r.my.toFixed(3)} kN·m`,
            `  Mz = ${r.mz.toFixed(3)} kN·m`,
          ].join("\n");
          return { success: true, message: info, action };
        }
        // Show all reactions
        const lines: string[] = ["⚡ Support Reactions:"];
        reactions.forEach((r, nodeId) => {
          const nonZero = [];
          if (Math.abs(r.fx) > 0.001) nonZero.push(`Fx=${r.fx.toFixed(2)}`);
          if (Math.abs(r.fy) > 0.001) nonZero.push(`Fy=${r.fy.toFixed(2)}`);
          if (Math.abs(r.fz) > 0.001) nonZero.push(`Fz=${r.fz.toFixed(2)}`);
          if (Math.abs(r.mz) > 0.001) nonZero.push(`Mz=${r.mz.toFixed(2)}`);
          if (nonZero.length > 0) {
            lines.push(`  ${nodeId}: ${nonZero.join(", ")} kN/kN·m`);
          }
        });
        // Sum vertical reactions
        let totalVy = 0;
        reactions.forEach((r) => (totalVy += r.fy));
        lines.push(`  ΣFy = ${totalVy.toFixed(3)} kN`);
        return { success: true, message: lines.join("\n"), action };
      }

      // ======= DEEP QUERY: MEMBER FORCES =======
      case "query_forces": {
        if (!store.analysisResults) {
          return {
            success: false,
            message: "⚠ No analysis results. Run the analysis first.",
            action,
          };
        }
        const memberForces = store.analysisResults.memberForces;
        if (!memberForces || memberForces.size === 0) {
          return {
            success: true,
            message: "No member force data in results.",
            action,
          };
        }
        const targetMemberId = params.memberId;
        if (targetMemberId) {
          const f = memberForces.get(targetMemberId);
          if (!f) {
            return {
              success: false,
              message: `No force data for ${targetMemberId}.`,
              action,
            };
          }
          const info = [
            `🔧 Forces in ${targetMemberId}:`,
            `  Axial: ${f.axial.toFixed(3)} kN`,
            `  Shear Y: ${f.shearY.toFixed(3)} kN`,
            `  Shear Z: ${f.shearZ.toFixed(3)} kN`,
            `  Moment Y: ${f.momentY.toFixed(3)} kN·m`,
            `  Moment Z: ${f.momentZ.toFixed(3)} kN·m`,
            `  Torsion: ${f.torsion.toFixed(3)} kN·m`,
          ];
          if (f.startForces) {
            info.push(
              `  Start → Axial=${f.startForces.axial.toFixed(2)}, Shear=${f.startForces.shearY.toFixed(2)}, Moment=${f.startForces.momentZ.toFixed(2)}`,
            );
          }
          if (f.endForces) {
            info.push(
              `  End   → Axial=${f.endForces.axial.toFixed(2)}, Shear=${f.endForces.shearY.toFixed(2)}, Moment=${f.endForces.momentZ.toFixed(2)}`,
            );
          }
          return { success: true, message: info.join("\n"), action };
        }
        // Summary of all members
        const lines: string[] = ["🔧 Member Force Summary:"];
        let maxMoment = 0,
          maxMomentMember = "";
        let maxShear = 0,
          maxShearMember = "";
        let maxAxial = 0,
          maxAxialMember = "";
        memberForces.forEach((f, mId) => {
          if (Math.abs(f.momentZ) > Math.abs(maxMoment)) {
            maxMoment = f.momentZ;
            maxMomentMember = mId;
          }
          if (Math.abs(f.shearY) > Math.abs(maxShear)) {
            maxShear = f.shearY;
            maxShearMember = mId;
          }
          if (Math.abs(f.axial) > Math.abs(maxAxial)) {
            maxAxial = f.axial;
            maxAxialMember = mId;
          }
        });
        lines.push(
          `  Max Bending Moment: ${maxMoment.toFixed(2)} kN·m (${maxMomentMember})`,
        );
        lines.push(
          `  Max Shear Force: ${maxShear.toFixed(2)} kN (${maxShearMember})`,
        );
        lines.push(
          `  Max Axial Force: ${maxAxial.toFixed(2)} kN (${maxAxialMember})`,
        );
        lines.push(`  Total members analyzed: ${memberForces.size}`);
        return { success: true, message: lines.join("\n"), action };
      }

      // ======= DEEP QUERY: DISPLACEMENTS =======
      case "query_displacements": {
        if (!store.analysisResults) {
          return {
            success: false,
            message: "⚠ No analysis results. Run the analysis first.",
            action,
          };
        }
        const displacements = store.analysisResults.displacements;
        if (!displacements || displacements.size === 0) {
          return {
            success: true,
            message: "No displacement data in results.",
            action,
          };
        }
        const targetNodeId = params.nodeId;
        if (targetNodeId) {
          const d = displacements.get(targetNodeId);
          if (!d)
            return {
              success: false,
              message: `No displacement data for ${targetNodeId}.`,
              action,
            };
          const info = [
            `📏 Displacement at ${targetNodeId}:`,
            `  dx = ${(d.dx * 1000).toFixed(4)} mm`,
            `  dy = ${(d.dy * 1000).toFixed(4)} mm`,
            `  dz = ${(d.dz * 1000).toFixed(4)} mm`,
            `  Resultant = ${(Math.sqrt(d.dx ** 2 + d.dy ** 2 + d.dz ** 2) * 1000).toFixed(4)} mm`,
            `  Rotations: rx=${(d.rx * 1000).toFixed(4)}, ry=${(d.ry * 1000).toFixed(4)}, rz=${(d.rz * 1000).toFixed(4)} mrad`,
          ];
          return { success: true, message: info.join("\n"), action };
        }
        // Summary
        let maxDisp = 0,
          maxDispNode = "";
        displacements.forEach((d, nId) => {
          const r = Math.sqrt(d.dx ** 2 + d.dy ** 2 + d.dz ** 2);
          if (r > maxDisp) {
            maxDisp = r;
            maxDispNode = nId;
          }
        });
        const lines = [
          `📏 Displacement Summary:`,
          `  Nodes analyzed: ${displacements.size}`,
          `  Max displacement: ${(maxDisp * 1000).toFixed(4)} mm at ${maxDispNode}`,
        ];
        return { success: true, message: lines.join("\n"), action };
      }

      // ======= DEEP QUERY: MAX DEFLECTION =======
      case "query_max_deflection": {
        if (!store.analysisResults) {
          return {
            success: false,
            message: "⚠ No analysis results. Run the analysis first.",
            action,
          };
        }
        const displacements = store.analysisResults.displacements;
        if (!displacements || displacements.size === 0) {
          return {
            success: true,
            message: "No displacement data available.",
            action,
          };
        }
        let maxDisp = 0,
          maxDispNode = "",
          maxDy = 0,
          maxDyNode = "";
        displacements.forEach((d, nId) => {
          const resultant = Math.sqrt(d.dx ** 2 + d.dy ** 2 + d.dz ** 2);
          if (resultant > maxDisp) {
            maxDisp = resultant;
            maxDispNode = nId;
          }
          if (Math.abs(d.dy) > Math.abs(maxDy)) {
            maxDy = d.dy;
            maxDyNode = nId;
          }
        });
        // Calculate span/deflection ratio
        let maxSpan = 0;
        store.members.forEach((m) => {
          const s = store.nodes.get(m.startNodeId);
          const e = store.nodes.get(m.endNodeId);
          if (s && e) {
            const len = Math.sqrt(
              (e.x - s.x) ** 2 + (e.y - s.y) ** 2 + (e.z - s.z) ** 2,
            );
            if (len > maxSpan) maxSpan = len;
          }
        });
        const spanDeflRatio =
          maxSpan > 0 && maxDy !== 0 ? Math.abs(maxSpan / maxDy) : Infinity;
        const lines = [
          `📐 Maximum Deflection:`,
          `  Max resultant: ${(maxDisp * 1000).toFixed(4)} mm at ${maxDispNode}`,
          `  Max vertical (dy): ${(maxDy * 1000).toFixed(4)} mm at ${maxDyNode}`,
          `  Longest span: ${maxSpan.toFixed(3)} m`,
          `  Span/Deflection ratio: L/${spanDeflRatio.toFixed(0)}`,
          spanDeflRatio >= 300
            ? "  ✅ Acceptable (L/300 or better)"
            : spanDeflRatio >= 200
              ? "  ⚠ Marginal (check code limits)"
              : "  ❌ Excessive deflection — consider stiffer sections",
        ];
        return { success: true, message: lines.join("\n"), action };
      }

      // ======= QUERY: STABILITY CHECK =======
      case "query_stability": {
        const nNodes = store.nodes.size;
        const nMembers = store.members.size;
        if (nNodes === 0)
          return { success: false, message: "No model to check.", action };

        // Count reactions (DOFs restrained)
        let nReactions = 0;
        store.nodes.forEach((n) => {
          if (n.restraints) {
            if (n.restraints.fx) nReactions++;
            if (n.restraints.fy) nReactions++;
            if (n.restraints.fz) nReactions++;
            if (n.restraints.mx) nReactions++;
            if (n.restraints.my) nReactions++;
            if (n.restraints.mz) nReactions++;
          }
        });

        // 2D frame: DOFs per node = 3 (dx, dy, rz)
        // For a 2D frame: required = 3*nNodes, available = 3*nMembers + nReactions
        // Static determinacy: 3*nMembers + nReactions vs 3*nNodes
        const totalDOFs = 3 * nNodes;
        const provided = 3 * nMembers + nReactions;
        const diff = provided - totalDOFs;

        let stabilityStr: string;
        if (nReactions < 3) {
          stabilityStr =
            "❌ UNSTABLE — Fewer than 3 reaction components. The structure can move as a rigid body.";
        } else if (diff < 0) {
          stabilityStr = `❌ UNSTABLE — Structure is ${Math.abs(diff)} DOF short. Add more members or supports.`;
        } else if (diff === 0) {
          stabilityStr =
            "✅ Statically DETERMINATE — Exactly enough equations. Analysis possible.";
        } else {
          stabilityStr = `✅ Statically INDETERMINATE to degree ${diff}. Matrix analysis required (which BeamLab does!).`;
        }

        const lines = [
          `🏗 Stability Check (2D Frame Assumption):`,
          `  Nodes: ${nNodes}`,
          `  Members: ${nMembers}`,
          `  Reaction DOFs: ${nReactions}`,
          `  Equations: ${totalDOFs}, Unknowns: ${provided}`,
          `  ${stabilityStr}`,
        ];

        if (store.analysisResults?.equilibriumCheck) {
          const eq = store.analysisResults.equilibriumCheck;
          lines.push(
            `  Equilibrium error: ${eq.error_percent.toFixed(4)}% ${eq.pass ? "✅" : "❌"}`,
          );
        }
        return { success: true, message: lines.join("\n"), action };
      }

      // ======= LIST: SUPPORTS =======
      case "list_supports": {
        const supportNodes: string[] = [];
        store.nodes.forEach((n, id) => {
          if (n.restraints) {
            let type = "Custom";
            const r = n.restraints;
            if (r.fx && r.fy && r.fz && r.mx && r.my && r.mz) type = "Fixed";
            else if (r.fx && r.fy && r.fz && !r.mx && !r.my && !r.mz)
              type = "Pinned";
            else if (!r.fx && r.fy && !r.fz) type = "Roller";
            else {
              const restrained = Object.entries(r)
                .filter(([, v]) => v)
                .map(([k]) => k);
              if (restrained.length === 0) return; // free node, skip
              type = `Custom (${restrained.join(",")})`;
            }
            const node = store.nodes.get(id)!;
            supportNodes.push(
              `  ${id}: ${type} at (${node.x}, ${node.y}, ${node.z})`,
            );
          }
        });
        if (supportNodes.length === 0) {
          return {
            success: true,
            message:
              '⚠ No supports defined. Add supports with "Add fixed support at N1".',
            action,
          };
        }
        return {
          success: true,
          message: `🔩 Supports (${supportNodes.length}):\n${supportNodes.join("\n")}`,
          action,
        };
      }

      // ======= QUERY: SECTIONS =======
      case "query_sections": {
        const sectionMap = new Map<string, number>();
        store.members.forEach((m) => {
          const sec = m.sectionId || "Default";
          sectionMap.set(sec, (sectionMap.get(sec) || 0) + 1);
        });
        if (sectionMap.size === 0) {
          return { success: true, message: "No members in model.", action };
        }
        const lines: string[] = [`📋 Sections Used:`];
        sectionMap.forEach((count, sec) => {
          lines.push(`  ${sec}: ${count} member${count > 1 ? "s" : ""}`);
        });
        return { success: true, message: lines.join("\n"), action };
      }

      // ======= QUERY: MEMBER LENGTH =======
      case "query_member_length": {
        const memberId = params.memberId;
        if (memberId) {
          if (!store.members.has(memberId)) {
            return {
              success: false,
              message: `Member ${memberId} not found.`,
              action,
            };
          }
          const m = store.members.get(memberId)!;
          const s = store.nodes.get(m.startNodeId);
          const e = store.nodes.get(m.endNodeId);
          if (!s || !e)
            return {
              success: false,
              message: `Nodes for ${memberId} not found.`,
              action,
            };
          const len = Math.sqrt(
            (e.x - s.x) ** 2 + (e.y - s.y) ** 2 + (e.z - s.z) ** 2,
          );
          return {
            success: true,
            message: `📏 ${memberId}: Length = ${len.toFixed(4)} m (${(len * 1000).toFixed(1)} mm)`,
            action,
          };
        }
        // Total structure length
        let totalLength = 0;
        let minLen = Infinity,
          maxLen = 0;
        store.members.forEach((m) => {
          const s = store.nodes.get(m.startNodeId);
          const e = store.nodes.get(m.endNodeId);
          if (s && e) {
            const len = Math.sqrt(
              (e.x - s.x) ** 2 + (e.y - s.y) ** 2 + (e.z - s.z) ** 2,
            );
            totalLength += len;
            if (len < minLen) minLen = len;
            if (len > maxLen) maxLen = len;
          }
        });
        if (store.members.size === 0)
          return { success: true, message: "No members in model.", action };
        const avgLen = totalLength / store.members.size;
        return {
          success: true,
          message: `📏 Length Summary:\n  Total: ${totalLength.toFixed(3)} m\n  Avg: ${avgLen.toFixed(3)} m\n  Min: ${minLen.toFixed(3)} m\n  Max: ${maxLen.toFixed(3)} m\n  Members: ${store.members.size}`,
          action,
        };
      }

      // ======= QUERY: TOTAL WEIGHT =======
      case "query_total_weight": {
        if (store.members.size === 0)
          return { success: true, message: "No members in model.", action };
        let totalWeight = 0;
        const DEFAULT_DENSITY = 7850; // kg/m³ (steel)
        const DEFAULT_AREA = 0.005; // m² (approx ISMB300)
        store.members.forEach((m) => {
          const s = store.nodes.get(m.startNodeId);
          const e = store.nodes.get(m.endNodeId);
          if (s && e) {
            const len = Math.sqrt(
              (e.x - s.x) ** 2 + (e.y - s.y) ** 2 + (e.z - s.z) ** 2,
            );
            const area = m.A || DEFAULT_AREA;
            const density = m.rho || DEFAULT_DENSITY;
            totalWeight += (len * area * density * 9.81) / 1000; // kN
          }
        });
        return {
          success: true,
          message: `⚖ Estimated Self-Weight:\n  Total: ${totalWeight.toFixed(3)} kN (${((totalWeight / 9.81) * 1000).toFixed(1)} kg)\n  Members: ${store.members.size}\n  Note: Uses assigned or default section areas (A) and density (ρ=7850 kg/m³ for steel)`,
          action,
        };
      }

      // ======= QUERY: EQUILIBRIUM CHECK =======
      case "query_equilibrium": {
        if (!store.analysisResults) {
          return {
            success: false,
            message: "⚠ No analysis results. Run the analysis first.",
            action,
          };
        }
        if (store.analysisResults.equilibriumCheck) {
          const eq = store.analysisResults.equilibriumCheck;
          const lines = [
            `⚖ Equilibrium Check:`,
            `  Applied forces: [${eq.applied_forces.map((f) => f.toFixed(2)).join(", ")}]`,
            `  Reaction forces: [${eq.reaction_forces.map((f) => f.toFixed(2)).join(", ")}]`,
            `  Residual: [${eq.residual.map((f) => f.toFixed(4)).join(", ")}]`,
            `  Error: ${eq.error_percent.toFixed(4)}%`,
            `  ${eq.pass ? "✅ PASS — Model is in equilibrium" : "❌ FAIL — Equilibrium not satisfied"}`,
          ];
          return { success: true, message: lines.join("\n"), action };
        }
        // Manual rough check
        let totalAppliedFy = 0;
        store.loads.forEach((l) => (totalAppliedFy += l.fy || 0));
        store.memberLoads.forEach((l) => {
          if (l.type === "UDL" && l.w1) {
            const m = store.members.get(l.memberId);
            if (m) {
              const s = store.nodes.get(m.startNodeId);
              const e = store.nodes.get(m.endNodeId);
              if (s && e) {
                const len = Math.sqrt(
                  (e.x - s.x) ** 2 + (e.y - s.y) ** 2 + (e.z - s.z) ** 2,
                );
                totalAppliedFy += l.w1 * len;
              }
            }
          }
        });
        let totalReactionFy = 0;
        if (store.analysisResults.reactions) {
          store.analysisResults.reactions.forEach(
            (r) => (totalReactionFy += r.fy),
          );
        }
        const residual = totalAppliedFy + totalReactionFy;
        return {
          success: true,
          message: `⚖ Equilibrium (Approx):\n  ΣFy (applied) ≈ ${totalAppliedFy.toFixed(2)} kN\n  ΣFy (reactions) ≈ ${totalReactionFy.toFixed(2)} kN\n  Residual ≈ ${residual.toFixed(4)} kN ${Math.abs(residual) < 0.1 ? "✅" : "⚠"}`,
          action,
        };
      }

      // ======= QUERY: ANALYSIS STATUS =======
      case "query_analysis_status": {
        if (!store.analysisResults) {
          return {
            success: true,
            message:
              '⚠ Analysis has NOT been run yet.\n\nClick the "Analyze" button in the toolbar, or use the keyboard shortcut to run a structural analysis.',
            action,
          };
        }
        const stats = store.analysisResults.stats;
        const lines = ["✅ Analysis results are available!"];
        if (stats) {
          lines.push(`  Solve time: ${stats.solveTimeMs?.toFixed(0) || "?"}ms`);
          if (stats.method) lines.push(`  Method: ${stats.method}`);
          if (stats.usedCloud) lines.push(`  Computed on: Cloud`);
          if (stats.totalTimeMs)
            lines.push(`  Total time: ${stats.totalTimeMs.toFixed(0)}ms`);
        }
        lines.push(
          `  Nodes: ${store.analysisResults.displacements?.size || 0}`,
        );
        lines.push(
          `  Members: ${store.analysisResults.memberForces?.size || 0}`,
        );
        if (store.analysisResults.reactions) {
          lines.push(
            `  Reactions computed for ${store.analysisResults.reactions.size} support nodes`,
          );
        }
        return { success: true, message: lines.join("\n"), action };
      }

      // ======= LIST: PLATES =======
      case "list_plates": {
        const plates = Array.from(store.plates?.values() || []);
        if (plates.length === 0) {
          return {
            success: true,
            message: "No plate/shell elements in model.",
            action,
          };
        }
        const lines = plates
          .slice(0, 15)
          .map(
            (p) =>
              `  ${p.id}: Nodes=[${p.nodeIds.join(", ")}] t=${p.thickness}m ${p.materialType || "steel"}`,
          );
        return {
          success: true,
          message: `📋 Plates (${plates.length}):\n${lines.join("\n")}`,
          action,
        };
      }

      // ======= LIST: LOAD CASES =======
      case "list_load_cases": {
        const lcs = store.loadCases || [];
        const combos = store.loadCombinations || [];
        if (lcs.length === 0 && combos.length === 0) {
          return {
            success: true,
            message:
              'No load cases or combinations defined.\nTry "Add dead load case" or "Add live load case".',
            action,
          };
        }
        const lines: string[] = [];
        if (lcs.length > 0) {
          lines.push(`Load Cases (${lcs.length}):`);
          lcs.forEach((lc) =>
            lines.push(
              `  ${lc.name} (${lc.type}) — ${lc.loads.length} node loads, ${lc.memberLoads.length} member loads`,
            ),
          );
        }
        if (combos.length > 0) {
          lines.push(`Load Combinations (${combos.length}):`);
          combos.forEach((c) =>
            lines.push(
              `  ${c.name} ${c.code ? `[${c.code}]` : ""} — ${c.factors.length} factors`,
            ),
          );
        }
        return { success: true, message: `📋 ${lines.join("\n")}`, action };
      }

      // ======= HELP =======
      case "help": {
        const helpText = [
          "🤖 BeamLab AI Assistant — Available Commands:",
          "",
          "📌 Selection:",
          "  • Select node N1 / Select member M1",
          "  • Select all / Clear selection / Invert selection",
          "  • Select all beams / Select all columns",
          "  • Select all ISMB300 members",
          "",
          "🔨 Modify:",
          "  • Add node at (5, 3, 0)",
          "  • Add member from N1 to N3",
          "  • Delete member M5 / Delete selected",
          "  • Move N2 to (10, 0, 0)",
          "  • Change section to ISMB400",
          "  • Split member M1",
          "",
          "📏 Loads & Supports:",
          "  • Apply 20 kN/m UDL on M1",
          "  • Add 50 kN load at N3",
          "  • Add fixed/pinned/roller support at N1",
          "  • Remove loads from M2",
          "",
          "📊 Analysis Queries:",
          "  • Show reactions / Reactions at N1",
          "  • Show forces in M1",
          "  • Show displacements / Displacement at N3",
          "  • What is the max deflection?",
          "  • Check stability",
          "  • Check equilibrium",
          "",
          "📋 Info:",
          "  • Show model info / List all nodes",
          "  • List loads / List supports / List sections",
          "  • Info about N1 / Info about M2",
          "  • How much does the structure weigh?",
          "  • What is the length of M3?",
          "",
          "📐 Display:",
          "  • Show BMD / Show SFD / Show AFD",
          "  • Show deflection / Hide results",
          "",
          "🎓 Knowledge:",
          "  • What is a Pratt truss?",
          "  • Explain moment of inertia",
          "  • How does UDL differ from point load?",
          "  • What is IS 800?",
        ];
        return { success: true, message: helpText.join("\n"), action };
      }

      // ======= KNOWLEDGE BASE =======
      case "knowledge_question": {
        const answer = answerKnowledgeQuestion(
          params.question || command.originalText,
        );
        return { success: true, message: answer, action };
      }

      // ======= UNKNOWN =======
      case "unknown":
      default:
        return {
          success: false,
          message: `I couldn't understand that command. Type "help" to see what I can do!\n\nSome examples:\n• "Select node N1"\n• "Apply 20 kN/m UDL on M1"\n• "Add fixed support at N1"\n• "Show model info"\n• "What is a Pratt truss?"`,
          action: "unknown",
        };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[AIModelExecutor] Error executing command:", action, err);
    return {
      success: false,
      message: `Error executing "${action}": ${errMsg}`,
      action,
    };
  }
}

// ============================================
// BUILT-IN KNOWLEDGE BASE
// ============================================

interface KnowledgeEntry {
  keywords: RegExp;
  answer: string;
}

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    keywords: /pratt\s*truss/i,
    answer: `🏗 **Pratt Truss**\nA Pratt truss has diagonal members sloping toward the center. Under gravity loads, the diagonals are in tension and verticals in compression. This is efficient because steel is stronger in tension, allowing lighter diagonal members.\n\n• Span range: 6–30 m\n• Common use: Bridges, roof structures\n• Advantage: Economical for moderate spans\n• Developed by Thomas and Caleb Pratt (1844)`,
  },
  {
    keywords: /warren\s*truss/i,
    answer: `🏗 **Warren Truss**\nA Warren truss uses equilateral triangles with alternating diagonal directions and no vertical members. Under load, diagonals alternate between tension and compression.\n\n• Span range: 12–60 m\n• Common use: Bridges, long-span roofs\n• Advantage: Even stress distribution, fewer members\n• Variation: Warren with verticals for distributed loads`,
  },
  {
    keywords: /howe\s*truss/i,
    answer: `🏗 **Howe Truss**\nA Howe truss has vertical members in tension and diagonal members in compression (opposite of Pratt). Originally designed for timber construction where compression members (wood) are cheaper.\n\n• Span range: 6–30 m\n• Common use: Timber bridges and roofs\n• Less common in steel (Pratt is preferred)`,
  },
  {
    keywords: /moment\s*of\s*inertia|second\s*moment/i,
    answer: `📐 **Moment of Inertia (I)**\nThe second moment of area measures a cross-section's resistance to bending. Higher I = less deflection and lower bending stress.\n\n• Units: m⁴ or mm⁴\n• Formula (rectangle): I = bh³/12\n• Formula (circle): I = πd⁴/64\n• Parallel axis theorem: I = I_c + Ad²\n• σ = My/I (bending stress formula)\n\nFor I-beams, most material is in the flanges (far from neutral axis), maximizing I efficiently.`,
  },
  {
    keywords: /deflection|serviceability/i,
    answer: `📏 **Deflection Limits (Serviceability)**\nDeflection limits prevent visible sagging and damage to finishes.\n\n• Beams (general): L/300 to L/360\n• Cantilevers: L/150 to L/180\n• Floor beams (brittle partitions): L/480\n• Roof purlins: L/150 to L/200\n\nTo reduce deflection:\n1. Increase section depth (I increases as h³)\n2. Use higher grade steel (E is same, so use larger section)\n3. Reduce span or add intermediate supports\n4. Add camber to offset deflection\n5. Use composite action (concrete-steel)`,
  },
  {
    keywords:
      /udl|uniform(?:ly)?\s*distributed\s*load|point\s*load.*differ|differ.*point.*load/i,
    answer: `📏 **UDL vs Point Load**\n\n**UDL (Uniformly Distributed Load):**\n• Spread over entire member length (kN/m)\n• Examples: self-weight, floor loads, snow\n• Max moment (simply supported) = wL²/8\n• Max deflection = 5wL⁴/(384EI)\n\n**Point Load:**\n• Concentrated at one point (kN)\n• Examples: column reactions, machinery\n• Max moment (mid-span) = PL/4\n• Max deflection = PL³/(48EI)\n\nA point load causes higher peak stress at one location, while UDL distributes stress more evenly.`,
  },
  {
    keywords: /p[\s-]*delta|second\s*order|geometric\s*nonlinear/i,
    answer: `🔄 **P-Delta Analysis**\nP-Delta (P-Δ) is a second-order analysis that accounts for the additional moment caused by axial loads acting on deformed geometry.\n\n• P-Δ effect: Column axial load × story drift\n• P-δ effect: Axial load × member curvature\n• Important when: P/Pcr > 0.1 (axial load > 10% of Euler load)\n• Required by: IS 800, AISC 360, Eurocode 3\n\nIgnoring P-Delta can underestimate moments by 10–30% in tall frames. BeamLab's analysis engine handles this automatically.`,
  },
  {
    keywords: /is\s*800|indian\s*standard|indian\s*steel/i,
    answer: `📘 **IS 800:2007 — Indian Steel Design Code**\nGeneral Construction in Steel, based on Limit State Method.\n\n• Design philosophy: Limit state (strength + serviceability)\n• Load factors: DL=1.5, LL=1.5, WL=1.5 (combination-dependent)\n• Steel grades: E250 (Fe410), E300, E350, E450\n• Beam design: Check for bending, shear, deflection, LTB\n• Column design: Buckling curves a, b, c, d\n• Connection design: Bolted (HS friction grip) and welded\n• Section classification: Plastic, Compact, Semi-compact, Slender`,
  },
  {
    keywords: /aisc|american\s*steel|aisc\s*360/i,
    answer: `📘 **AISC 360 — Steel Construction Manual**\nSpecification for Structural Steel Buildings (USA).\n\n• Design methods: LRFD (Load and Resistance Factor) and ASD\n• LRFD: φRn ≥ Σγi·Qi\n• ASD: Rn/Ω ≥ Σ Qi\n• Beam design: Compact, Non-compact, Slender classification\n• Column design: Inelastic/elastic buckling per Chapter E\n• Connection: AISC Manual Part 9-16\n• Deflection: L/360 (live), L/240 (dead+live)`,
  },
  {
    keywords: /eurocode|ec\s*3|en\s*1993/i,
    answer: `📘 **Eurocode 3 (EN 1993) — Steel Structures**\nEuropean standard for the design of steel structures.\n\n• Partial safety factors: γ_M0=1.0, γ_M1=1.0, γ_M2=1.25\n• Cross-section classification: Class 1–4\n• Beam: Moment resistance, shear, lateral-torsional buckling\n• Column: Buckling curves (α = 0.13–0.76)\n• Connections: EN 1993-1-8\n• National Annexes modify some parameters per country`,
  },
  {
    keywords: /fixed\s*support|fixed\s*end|cantilever\s*support/i,
    answer: `🔩 **Fixed Support**\nA fixed support prevents all translation AND rotation. It provides 3 reaction components in 2D (Fx, Fy, Mz) or 6 in 3D.\n\n• Use when: Concrete foundations, welded connections\n• Reactions: Horizontal, vertical, and moment\n• In BeamLab: restraints = {fx, fy, fz, mx, my, mz} all true\n• Command: "Add fixed support at N1"`,
  },
  {
    keywords: /pinned\s*support|pin\s*support|hinge\s*support/i,
    answer: `🔩 **Pinned Support**\nA pinned support prevents translation but allows rotation. It provides 2 reaction components in 2D (Fx, Fy).\n\n• Use when: Bolted connections, theoretical pin joints\n• Reactions: Horizontal and vertical forces, zero moment\n• In BeamLab: restraints = {fx, fy, fz} true, {mx, my, mz} false\n• Command: "Add pinned support at N1"`,
  },
  {
    keywords: /roller\s*support/i,
    answer: `🔩 **Roller Support**\nA roller allows horizontal movement and rotation, preventing only vertical displacement. Provides 1 reaction (Fy).\n\n• Use when: Bridge expansion joints, beam on smooth surface\n• Reactions: Vertical force only\n• In BeamLab: restraints = {fy} true, all others false\n• Command: "Add roller support at N1"`,
  },
  {
    keywords: /shear\s*force\s*diagram|sfd/i,
    answer: `📊 **Shear Force Diagram (SFD)**\nShows the variation of internal shear force along a member.\n\n• Vertical axis: Shear force (kN)\n• Changes suddenly at point loads\n• Changes linearly under UDL\n• V = dM/dx (shear = derivative of moment)\n• Jumps equal to applied point loads/reactions\n\nIn BeamLab, type "Show SFD" to display.`,
  },
  {
    keywords: /bending\s*moment\s*diagram|bmd/i,
    answer: `📊 **Bending Moment Diagram (BMD)**\nShows the distribution of internal bending moment along a member.\n\n• Vertical axis: Bending moment (kN·m)\n• Parabolic under UDL, linear under point loads\n• dM/dx = V (slope of BMD = shear force)\n• Maximum moment occurs where shear = 0\n• σ = My/I (bending stress from moment)\n\nIn BeamLab, type "Show BMD" to display.`,
  },
  {
    keywords: /axial\s*force|afd|axial\s*diagram|tension|compression/i,
    answer: `📊 **Axial Force Diagram (AFD)**\nShows the internal axial (normal) force along a member — positive = tension, negative = compression.\n\n• Constant between nodes if no distributed axial loads\n• Critical for column design (buckling)\n• σ_axial = P/A\n• In trusses, members are either in pure tension or compression\n\nIn BeamLab, type "Show AFD" to display.`,
  },
  {
    keywords: /euler|buckling|critical\s*load|slenderness/i,
    answer: `📐 **Euler Buckling / Column Stability**\nEuler's critical load: Pcr = π²EI / (KL)²\n\n• K = effective length factor:\n  - K=1.0 (pinned-pinned)\n  - K=0.7 (fixed-pinned)\n  - K=0.5 (fixed-fixed)\n  - K=2.0 (fixed-free/cantilever)\n• Slenderness ratio: λ = KL/r (r = √(I/A))\n• For steel: λ < 200 is typical limit\n• Short columns: Material failure (crushing)\n• Long columns: Elastic buckling (Euler)\n• Intermediate: Inelastic buckling (design curves)`,
  },
  {
    keywords: /beam\s*design|design\s*(?:a\s+)?beam|beam\s*check/i,
    answer: `📐 **Beam Design Checks**\n\n1. **Bending**: Md = Z_p × f_y / γ_m0 (plastic) or Z_e × f_y (elastic)\n2. **Shear**: Vd = A_w × f_y / (√3 × γ_m0)\n3. **Deflection**: δ_max ≤ L/300 (live load)\n4. **Lateral-Torsional Buckling (LTB)**: If laterally unsupported\n5. **Web crippling/buckling**: Under concentrated loads\n6. **Combined bending + shear**: If V > 0.6Vd, reduce moment capacity\n\nUse "Show model info" to check your current beam dimensions.`,
  },
  {
    keywords: /what\s*can\s*you|what\s*do\s*you|your\s*capabilit|features/i,
    answer: `🤖 **I'm your BeamLab AI Assistant!** I can:\n\n• **Build models**: Add nodes, members, loads, supports\n• **Select & modify**: Select elements, change sections, move nodes\n• **Query results**: Reactions, forces, displacements, deflections\n• **Check models**: Stability, equilibrium, weight estimation\n• **Display results**: BMD, SFD, AFD, deflected shape\n• **Answer questions**: Structural engineering concepts, design codes\n\nType "help" for a full command list!`,
  },
  {
    keywords: /truss|what.*truss|types?\s*of\s*truss/i,
    answer: `🏗 **Trusses — Overview**\nA truss is a triangulated frame where members carry only axial forces (tension/compression), no bending.\n\n**Common Types:**\n• **Pratt**: Diagonals slope toward center (tension under gravity)\n• **Warren**: Equilateral triangles, no verticals\n• **Howe**: Diagonals slope away from center (compression)\n• **Vierendeel**: Rigid joints, no diagonals (bending-dominant)\n• **K-Truss**: Diagonals meet at mid-height of verticals\n\n**Key formulas:**\n• m + r = 2j (statically determinate, 2D)\n• Method of joints / sections for analysis`,
  },
  {
    keywords: /steel\s*grade|fe\s*410|fe\s*500|e250|e350|yield\s*strength/i,
    answer: `🔩 **Common Steel Grades**\n\n| Grade | Yield (MPa) | Ultimate (MPa) | Use |\n|-------|-------------|----------------|-----|\n| E250 (Fe410) | 250 | 410 | General |\n| E300 | 300 | 440 | Medium duty |\n| E350 (Fe490) | 350 | 490 | Heavy structures |\n| E450 | 450 | 570+ | High-strength |\n| E550 | 550 | 650+ | Special |\n\n• E = 200,000 MPa (all grades)\n• G ≈ 77,000 MPa\n• ρ = 7850 kg/m³\n• ν = 0.3`,
  },
  {
    keywords: /ismb|indian\s*standard\s*(?:medium|beam)|section\s*properties/i,
    answer: `🔩 **ISMB Sections (Indian Standard Medium Beam)**\n\nCommon sections:\n• ISMB150: h=150mm, A=19.0cm², I_xx=726cm⁴\n• ISMB200: h=200mm, A=32.3cm², I_xx=2235cm⁴\n• ISMB250: h=250mm, A=47.5cm², I_xx=5132cm⁴\n• ISMB300: h=300mm, A=58.9cm², I_xx=8986cm⁴\n• ISMB400: h=400mm, A=78.5cm², I_xx=20458cm⁴\n• ISMB500: h=500mm, A=110.7cm², I_xx=45218cm⁴\n• ISMB600: h=600mm, A=156.2cm², I_xx=91813cm⁴\n\nUse "Change section to ISMB400" to assign.`,
  },
  {
    keywords:
      /concrete|rcc|reinforced\s*concrete|m20|m25|grade\s*of\s*concrete/i,
    answer: `🧱 **Concrete Grades**\n\n| Grade | fck (MPa) | Use |\n|-------|-----------|-----|\n| M15 | 15 | Leveling, PCC |\n| M20 | 20 | General RCC |\n| M25 | 25 | Beams, slabs |\n| M30 | 30 | Columns, foundations |\n| M40 | 40 | Prestressed, bridges |\n| M50+ | 50+ | High-rise, special |\n\n• E_c = 5000√fck MPa (IS 456)\n• Density ≈ 24 kN/m³ (plain), 25 kN/m³ (reinforced)\n• Poisson's ratio ≈ 0.15–0.20`,
  },
  {
    keywords: /load\s*combination|load\s*factor|limit\s*state|factored\s*load/i,
    answer: `📋 **Load Combinations (IS 875 / IS 800)**\n\n**Limit State of Strength:**\n• 1.5 DL + 1.5 LL\n• 1.5 DL + 1.5 WL (or EQ)\n• 1.2 DL + 1.2 LL + 1.2 WL\n• 0.9 DL + 1.5 WL (uplift check)\n\n**Serviceability:**\n• 1.0 DL + 1.0 LL\n• 1.0 DL + 1.0 WL\n\nIn BeamLab, use "Add dead load case" or "Add live load case" to create cases.`,
  },
  {
    keywords: /finite\s*element|fem|fea|stiffness\s*method|direct\s*stiffness/i,
    answer: `🔬 **Finite Element Method (FEM) / Direct Stiffness Method**\n\nThe stiffness method is the backbone of structural analysis software:\n\n1. **Discretize**: Divide structure into elements (beams, plates)\n2. **Element stiffness**: k = [K_local] for each element\n3. **Transform**: Rotate to global coordinates\n4. **Assemble**: Global K = Σ T^T · k · T\n5. **Apply BCs**: Modify K for supports\n6. **Solve**: {F} = [K]{d} → {d} = [K]⁻¹{F}\n7. **Post-process**: Member forces, reactions, stresses\n\nBeamLab uses this exact method with 6-DOF beam elements!`,
  },
];

/**
 * Answer a knowledge / engineering question using the built-in knowledge base
 */
function answerKnowledgeQuestion(question: string): string {
  const lower = question.toLowerCase();

  // Try to match against knowledge base
  for (const entry of KNOWLEDGE_BASE) {
    if (entry.keywords.test(lower)) {
      return entry.answer;
    }
  }

  // Check if asking about the current model specifically
  const store = useModelStore.getState();
  if (/\b(my|current|this)\s+(model|structure|frame|beam)\b/i.test(lower)) {
    if (store.nodes.size === 0) {
      return '📋 Your model is currently empty. Use the Generate tab to create a structure, or start adding nodes with "Add node at (0, 0, 0)".';
    }
    // Give a summary
    let nFixed = 0,
      nPinned = 0,
      nRoller = 0;
    store.nodes.forEach((n) => {
      if (n.restraints) {
        if (
          n.restraints.fx &&
          n.restraints.fy &&
          n.restraints.mx &&
          n.restraints.my
        )
          nFixed++;
        else if (n.restraints.fx && n.restraints.fy) nPinned++;
        else if (n.restraints.fy) nRoller++;
      }
    });
    let summary = `📋 Your current model:\n  ${store.nodes.size} nodes, ${store.members.size} members\n  Supports: ${nFixed} fixed, ${nPinned} pinned, ${nRoller} roller\n  Node loads: ${store.loads.length}, Member loads: ${store.memberLoads.length}`;
    if (store.analysisResults) {
      summary +=
        '\n  ✅ Analysis results available — try "Show reactions" or "Max deflection?"';
    } else {
      summary += "\n  ⚠ Not yet analyzed — click Analyze in the toolbar.";
    }
    return summary;
  }

  // Generic engineering fallback
  return `🤔 I don't have a specific answer for "${question}" in my knowledge base, but I can help you with:\n\n• **Structural concepts**: trusses, beams, columns, buckling, P-Delta\n• **Design codes**: IS 800, AISC 360, Eurocode 3\n• **Materials**: Steel grades, concrete, section properties\n• **Analysis**: FEM, deflection, moment of inertia, load combinations\n• **Model commands**: Type "help" to see all available commands\n\nOr try asking the Chat tab when the AI backend is connected for detailed answers!`;
}

/**
 * Execute a raw text command (interpret + execute in one step)
 */
export function executeTextCommand(
  text: string,
): ExecutionResult & { parsed: ParsedCommand } {
  const parsed = interpretCommand(text);
  const result = executeCommand(parsed);
  return { ...result, parsed };
}
