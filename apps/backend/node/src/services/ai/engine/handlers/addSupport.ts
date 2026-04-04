import type { AIAction, AIResponse, ModelContext } from '../types.js';

export async function handleAddSupport(message: string, context: ModelContext | undefined): Promise<AIResponse> {
  if (!context || context.nodes.length === 0) {
    return { success: false, response: 'No model loaded. Create a structure first.' };
  }

  const isFixed = /fixed/i.test(message);
  const isPinned = /pin/i.test(message);
  const isRoller = /roller/i.test(message);

  const supportType = isFixed ? 'fixed' : isPinned ? 'pinned' : isRoller ? 'roller' : 'fixed';

  const restraints = {
    fixed: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true },
    pinned: { fx: true, fy: true, fz: true, mx: false, my: false, mz: false },
    roller: { fx: false, fy: true, fz: true, mx: false, my: false, mz: false },
  } as const;

  const groundNodes = context.nodes.filter(n => Math.abs(n.y) < 0.1 && !n.hasSupport);

  if (groundNodes.length === 0) {
    return { success: true, response: 'All ground-level nodes already have supports. Specify a node ID to add support to a different node.' };
  }

  const actions: AIAction[] = groundNodes.map(n => ({
    type: 'addSupport' as const,
    params: { nodeId: n.id, type: supportType, restraints: restraints[supportType] },
    description: `Add ${supportType} support at node ${n.id}`,
  }));

  return {
    success: true,
    response: `✅ Adding ${supportType} support to ${groundNodes.length} ground-level node(s): ${groundNodes.map(n => n.id).join(', ')}.\n\nClick **Execute** to apply.`,
    actions,
  };
}
