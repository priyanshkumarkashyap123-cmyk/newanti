export type Intent =
  | 'create_structure'
  | 'modify_model'
  | 'run_analysis'
  | 'diagnose'
  | 'optimize'
  | 'code_check'
  | 'explain'
  | 'review_model'
  | 'troubleshoot'
  | 'greeting'
  | 'thanks'
  | 'help'
  | 'about_model'
  | 'conversation'
  | 'add_load'
  | 'add_support'
  | 'change_section'
  | 'clear_model';

export function classifyIntent(query: string): { intent: Intent; confidence: number } {
  const q = query.toLowerCase().trim();

  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|greetings|namaste)/i.test(q)) {
    return { intent: 'greeting', confidence: 0.95 };
  }

  if (/^(thanks|thank\s*you|thx|appreciate|great\s*job|awesome|perfect)/i.test(q)) {
    return { intent: 'thanks', confidence: 0.95 };
  }

  if (/^(help|what can you do|capabilities|features|commands|how to use)/i.test(q)) {
    return { intent: 'help', confidence: 0.95 };
  }

  if (/\b(create|build|make|design|generate|draw|model)\b.*\b(beam|frame|truss|bridge|building|tower|shed|structure|warehouse|cantilever|portal|slab|column|foundation)/i.test(q) ||
      /\b(beam|frame|truss|bridge|building|tower|shed|structure|warehouse|cantilever|portal)\b.*\b(of|with|having|span|height|story|storey|floor|bay|meter|metre|m\b|ft\b)/i.test(q)) {
    return { intent: 'create_structure', confidence: 0.9 };
  }

  if (/\b(modify|change|update|edit|move|shift|extend|shorten|resize|add\s*(a\s*)?(bay|story|storey|floor|span|column|beam|member|node))\b/i.test(q)) {
    return { intent: 'modify_model', confidence: 0.85 };
  }

  if (/\b(add|apply|put)\b.*\b(load|force|moment|pressure|udl|point\s*load|distributed)/i.test(q)) {
    return { intent: 'add_load', confidence: 0.9 };
  }

  if (/\b(add|set|make|apply)\b.*\b(support|restraint|fix|pin|roller|fixed|hinge)\b/i.test(q)) {
    return { intent: 'add_support', confidence: 0.9 };
  }

  if (/\b(change|set|assign|update)\b.*\b(section|profile|size|ismb|ismc|isa)\b/i.test(q)) {
    return { intent: 'change_section', confidence: 0.9 };
  }

  if (/\b(run|perform|execute|do|start)\b.*\b(analysis|analyze|solve|calculate|compute)/i.test(q) ||
      /\b(static|modal|dynamic|buckling|p-delta|pushover|seismic)\b.*\b(analysis)/i.test(q)) {
    return { intent: 'run_analysis', confidence: 0.9 };
  }

  if (/\b(diagnose|check|inspect|find\s*issues|find\s*problems|what.*wrong|debug|validate|verify)/i.test(q)) {
    return { intent: 'diagnose', confidence: 0.85 };
  }

  if (/\b(optimize|optimise|reduce\s*weight|minimize|minimise|lighten|economize|economise|efficient)/i.test(q)) {
    return { intent: 'optimize', confidence: 0.85 };
  }

  if (/\b(code\s*check|is\s*800|is\s*456|aisc|eurocode|design\s*check|compliance|capacity|strength\s*check)/i.test(q)) {
    return { intent: 'code_check', confidence: 0.9 };
  }

  if (/\b(explain|what\s*is|define|tell\s*me\s*about|how\s*does|why|difference\s*between|concept|theory)/i.test(q)) {
    return { intent: 'explain', confidence: 0.8 };
  }

  if (/\b(review|summary|describe|show|current\s*model|model\s*info|overview|status)\b/i.test(q)) {
    return { intent: 'review_model', confidence: 0.8 };
  }

  if (/\b(fix|repair|resolve|troubleshoot|solve|error|fail|crash|not\s*working|broken|unstable)/i.test(q)) {
    return { intent: 'troubleshoot', confidence: 0.85 };
  }

  if (/\b(how\s*many|count|list|show\s*all)\b.*\b(node|member|element|support|load)/i.test(q)) {
    return { intent: 'about_model', confidence: 0.8 };
  }

  if (/\b(clear|reset|delete\s*all|remove\s*all|start\s*over|new\s*model|fresh)/i.test(q)) {
    return { intent: 'clear_model', confidence: 0.85 };
  }

  return { intent: 'conversation', confidence: 0.5 };
}