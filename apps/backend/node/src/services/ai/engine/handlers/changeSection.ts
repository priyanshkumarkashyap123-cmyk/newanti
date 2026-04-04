import { IS_SECTIONS } from '../sectionsDb.js';
import type { AIAction, AIResponse, ModelContext } from '../types.js';

export async function handleChangeSection(message: string, context: ModelContext | undefined): Promise<AIResponse> {
  if (!context || context.members.length === 0) {
    return { success: false, response: 'No members in the model. Create a structure first.' };
  }

  const sectionMatch = message.match(/\b(ISMB\d+|ISMC\d+|ISA\d+x\d+x\d+|ISHB\d+)/i);

  if (sectionMatch) {
    const newSection = sectionMatch[1].toUpperCase();
    const sectionData = IS_SECTIONS[newSection];

    if (!sectionData) {
      return {
        success: true,
        response: 'Section "' + newSection + '" not found. Available sections:\n- ISMB: 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600\n- ISMC: 100, 150, 200, 250, 300\n- ISA: 50x50x5, 65x65x6, 75x75x6, 80x80x8, 100x100x10',
      };
    }

    const isColumn = /\bcolumn/i.test(message);
    const isBeam = /\bbeam/i.test(message);

    let targetMembers = context.members;
    if (isColumn) {
      targetMembers = context.members.filter(m => {
        const sn = context.nodes.find(n => n.id === m.startNode);
        const en = context.nodes.find(n => n.id === m.endNode);
        if (sn && en) return Math.abs(sn.x - en.x) < 0.1;
        return false;
      });
    } else if (isBeam) {
      targetMembers = context.members.filter(m => {
        const sn = context.nodes.find(n => n.id === m.startNode);
        const en = context.nodes.find(n => n.id === m.endNode);
        if (sn && en) return Math.abs(sn.y - en.y) < 0.1;
        return false;
      });
    }

    const actions: AIAction[] = targetMembers.map(m => ({
      type: 'changeSection' as const,
      params: { memberId: m.id, section: newSection },
      description: `Change ${m.id} from ${m.section || 'default'} to ${newSection}`,
    }));

    return {
      success: true,
      response: `✅ Changing ${targetMembers.length} member(s) to **${newSection}** (weight: ${sectionData.weight} kg/m).\n\nClick **Execute** to apply.`,
      actions,
    };
  }

  return {
    success: true,
    response: 'Please specify the section. Example:\n- "Change all columns to ISMB500"\n- "Set beams to ISMB300"\n- "Change all sections to ISMB400"',
  };
}
