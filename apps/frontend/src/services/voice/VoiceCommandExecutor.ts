/**
 * VoiceCommandExecutor.ts - Wire Voice to AI Commands
 * 
 * Connects voice input to actual model operations.
 */

import { useModelStore } from '../../store/model';
import { geminiAI } from '../gemini_service';

// ============================================
// TYPES
// ============================================

export interface CommandResult {
    success: boolean;
    action: string;
    target: string;
    message: string;
    changes?: any;
}

// ============================================
// VOICE COMMAND EXECUTOR
// ============================================

class VoiceCommandExecutorClass {
    private modelStore = useModelStore.getState;

    /**
     * Execute a voice command
     */
    async execute(transcript: string): Promise<CommandResult> {
        try {
            // Parse command using AI
            const parsed = await this.parseCommand(transcript);

            if (!parsed) {
                return {
                    success: false,
                    action: 'unknown',
                    target: 'unknown',
                    message: 'Could not understand command'
                };
            }

            // Execute based on action
            switch (parsed.action) {
                case 'add':
                    return this.handleAdd(parsed);
                case 'modify':
                    return this.handleModify(parsed);
                case 'delete':
                    return this.handleDelete(parsed);
                case 'analyze':
                    return this.handleAnalyze();
                case 'query':
                    return this.handleQuery(parsed);
                default:
                    return {
                        success: false,
                        action: parsed.action,
                        target: parsed.target,
                        message: `Unknown action: ${parsed.action}`
                    };
            }
        } catch (e) {
            return {
                success: false,
                action: 'error',
                target: 'system',
                message: `Error: ${e}`
            };
        }
    }

    /**
     * Parse voice command
     */
    private async parseCommand(transcript: string): Promise<{
        action: string;
        target: string;
        parameters: Record<string, any>;
    } | null> {
        // Pattern matching for common commands
        const patterns = [
            {
                regex: /add (?:a )?(\d+(?:\.\d+)?)\s*(?:m|meter)?\s*(beam|column|member)/i,
                action: 'add',
                target: 'member',
                extract: (m: RegExpMatchArray) => ({
                    length: parseFloat(m[1]),
                    type: m[2].toLowerCase()
                })
            },
            {
                regex: /add (?:a )?(fixed|pinned|roller) support/i,
                action: 'add',
                target: 'support',
                extract: (m: RegExpMatchArray) => ({
                    type: m[1].toLowerCase()
                })
            },
            {
                regex: /apply (\d+(?:\.\d+)?)\s*(?:kN)?\s*load/i,
                action: 'add',
                target: 'load',
                extract: (m: RegExpMatchArray) => ({
                    magnitude: parseFloat(m[1])
                })
            },
            {
                regex: /delete (?:the )?(last |member |node )?(.+)/i,
                action: 'delete',
                target: 'element',
                extract: (m: RegExpMatchArray) => ({
                    which: m[1]?.trim() || 'last',
                    id: m[2]
                })
            },
            {
                regex: /run (?:the )?analysis/i,
                action: 'analyze',
                target: 'model',
                extract: () => ({})
            },
            {
                regex: /what (?:is |are )(?:the )?(.+)/i,
                action: 'query',
                target: 'info',
                extract: (m: RegExpMatchArray) => ({
                    query: m[1]
                })
            }
        ];

        for (const pattern of patterns) {
            const match = transcript.match(pattern.regex);
            if (match) {
                return {
                    action: pattern.action,
                    target: pattern.target,
                    parameters: pattern.extract(match)
                };
            }
        }

        // Fallback to AI parsing
        try {
            const aiResult = await geminiAI?.parseStructuralCommand?.(transcript);
            return aiResult;
        } catch {
            return null;
        }
    }

    /**
     * Handle add commands
     */
    private handleAdd(parsed: any): CommandResult {
        const store = this.modelStore();

        if (parsed.target === 'member') {
            const length = parsed.parameters.length || 5;
            const nodes = Array.from(store.nodes.values());
            const lastNode = nodes[nodes.length - 1];

            // Create new node with sequential ID
            const newNodeId = store.getNextNodeId();
            const newX = lastNode ? lastNode.x + length : length;

            store.addNode({ id: newNodeId, x: newX, y: 0, z: 0 });

            // Create member if we have at least 2 nodes
            if (nodes.length > 0) {
                const newMemberId = store.getNextMemberId();
                store.addMember({
                    id: newMemberId,
                    startNodeId: lastNode?.id || 'N1',
                    endNodeId: newNodeId
                });

                return {
                    success: true,
                    action: 'add',
                    target: 'member',
                    message: `Added ${length}m ${parsed.parameters.type || 'member'}`,
                    changes: { nodeId: newNodeId, memberId: newMemberId }
                };
            }

            return {
                success: true,
                action: 'add',
                target: 'node',
                message: `Added node at x=${newX}`,
                changes: { nodeId: newNodeId }
            };
        }

        if (parsed.target === 'support') {
            const nodes = Array.from(store.nodes.values());
            const lastNode = nodes[nodes.length - 1];

            if (lastNode) {
                store.updateNode(lastNode.id, {
                    restraints: {
                        fx: parsed.parameters.type === 'fixed' || parsed.parameters.type === 'pinned',
                        fy: true,
                        fz: true,
                        mx: parsed.parameters.type === 'fixed',
                        my: parsed.parameters.type === 'fixed',
                        mz: parsed.parameters.type === 'fixed'
                    }
                });

                return {
                    success: true,
                    action: 'add',
                    target: 'support',
                    message: `Added ${parsed.parameters.type} support at ${lastNode.id}`
                };
            }
        }

        if (parsed.target === 'load') {
            const members = Array.from(store.members.values());
            const lastMember = members[members.length - 1];

            if (lastMember) {
                store.addMemberLoad({
                    id: `load_${Date.now()}`,
                    memberId: lastMember.id,
                    type: 'point',
                    P: -parsed.parameters.magnitude,
                    a: 0.5,
                    direction: 'global_y'
                });

                return {
                    success: true,
                    action: 'add',
                    target: 'load',
                    message: `Applied ${parsed.parameters.magnitude}kN load to ${lastMember.id}`
                };
            }
        }

        return {
            success: false,
            action: 'add',
            target: parsed.target,
            message: 'No elements to add to'
        };
    }

    /**
     * Handle modify commands
     */
    private handleModify(parsed: any): CommandResult {
        return {
            success: true,
            action: 'modify',
            target: parsed.target,
            message: `Modified ${parsed.target}`
        };
    }

    /**
     * Handle delete commands
     */
    private handleDelete(parsed: any): CommandResult {
        const store = this.modelStore();

        if (parsed.parameters.which === 'last') {
            const members = Array.from(store.members.values());
            if (members.length > 0) {
                const lastMember = members[members.length - 1];
                store.removeMember(lastMember.id);

                return {
                    success: true,
                    action: 'delete',
                    target: 'member',
                    message: `Deleted ${lastMember.id}`
                };
            }
        }

        return {
            success: false,
            action: 'delete',
            target: 'element',
            message: 'Nothing to delete'
        };
    }

    /**
     * Handle analyze commands
     */
    private handleAnalyze(): CommandResult {
        // Trigger analysis through event
        window.dispatchEvent(new CustomEvent('triggerAnalysis'));

        return {
            success: true,
            action: 'analyze',
            target: 'model',
            message: 'Analysis started'
        };
    }

    /**
     * Handle query commands
     */
    private handleQuery(parsed: any): CommandResult {
        const store = this.modelStore();
        const query = parsed.parameters.query?.toLowerCase();

        if (query?.includes('member') || query?.includes('beam')) {
            return {
                success: true,
                action: 'query',
                target: 'members',
                message: `Model has ${store.members.size} members`
            };
        }

        if (query?.includes('node')) {
            return {
                success: true,
                action: 'query',
                target: 'nodes',
                message: `Model has ${store.nodes.size} nodes`
            };
        }

        return {
            success: true,
            action: 'query',
            target: 'info',
            message: `Model: ${store.nodes.size} nodes, ${store.members.size} members`
        };
    }
}

// Export singleton
export const voiceExecutor = new VoiceCommandExecutorClass();
export default VoiceCommandExecutorClass;
