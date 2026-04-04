import type { AIResponse, ModelContext } from '../types.js';

export function handleReviewModel(context: ModelContext | undefined): AIResponse {
  if (!context || context.nodes.length === 0) {
    return {
      success: true,
      response: '📋 **Current Model: Empty**\n\nNo structure loaded. Try:\n- "Create a portal frame"\n- "Build a 2-story frame"\n- "Make a truss bridge"',
    };
  }

  const supports = context.nodes.filter(n => n.hasSupport);
  const sections = [...new Set(context.members.map(m => m.section).filter(Boolean))];

  const xs = context.nodes.map(n => n.x);
  const ys = context.nodes.map(n => n.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);

  let response = `## 📋 Model Summary\n\n`;
  response += `| Property | Value |\n|---|---|\n`;
  response += `| Nodes | ${context.nodes.length} |\n`;
  response += `| Members | ${context.members.length} |\n`;
  response += `| Supports | ${supports.length} |\n`;
  response += `| Loads | ${context.loads?.length || 0} |\n`;
  response += `| Overall Width | ${width.toFixed(2)} m |\n`;
  response += `| Overall Height | ${height.toFixed(2)} m |\n`;
  response += `| Sections Used | ${sections.length > 0 ? sections.join(', ') : 'Default'} |\n`;

  if (context.analysisResults) {
    response += `\n### Analysis Results\n`;
    if (context.analysisResults.maxDisplacement !== undefined)
      response += `- Max Displacement: ${context.analysisResults.maxDisplacement.toFixed(3)} mm\n`;
    if (context.analysisResults.maxStress !== undefined)
      response += `- Max Stress: ${context.analysisResults.maxStress.toFixed(1)} MPa\n`;
    if (context.analysisResults.maxMoment !== undefined)
      response += `- Max Moment: ${context.analysisResults.maxMoment.toFixed(1)} kN·m\n`;
  }

  return { success: true, response };
}

export function handleAboutModel(context: ModelContext | undefined): AIResponse {
  if (!context || context.nodes.length === 0) {
    return { success: true, response: 'No model loaded.' };
  }

  return {
    success: true,
    response: `The current model has **${context.nodes.length} nodes**, **${context.members.length} members**, **${context.nodes.filter(n => n.hasSupport).length} supports**, and **${context.loads?.length || 0} loads**.`,
  };
}
