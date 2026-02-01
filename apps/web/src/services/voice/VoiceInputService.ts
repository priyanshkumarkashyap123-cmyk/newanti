import { useModelStore } from '../../store/model';

/**
 * VoiceInputService.ts
 * 
 * Voice-to-Structure Natural Language Interface
 * 
 * Features:
 * - Speech recognition (Web Speech API)
 * - Real-time transcription
 * - Command parsing
 * - Structural intent extraction
 * - Continuous listening mode
 */

// ============================================
// TYPES
// ============================================

export interface VoiceCommand {
    id: string;
    transcript: string;
    confidence: number;
    timestamp: Date;
    intent?: StructuralIntent;
    processed: boolean;
}

export interface StructuralIntent {
    action: 'add' | 'modify' | 'delete' | 'analyze' | 'check' | 'optimize' | 'query';
    target: 'node' | 'member' | 'load' | 'support' | 'model' | 'section' | 'material';
    parameters: Record<string, any>;
    confidence: number;
}

export interface VoiceInputState {
    isListening: boolean;
    isProcessing: boolean;
    lastCommand?: VoiceCommand;
    error?: string;
}

// ============================================
// STRUCTURAL COMMAND PATTERNS
// ============================================

const COMMAND_PATTERNS: Array<{
    pattern: RegExp;
    action: StructuralIntent['action'];
    target: StructuralIntent['target'];
    extractor: (match: RegExpMatchArray) => Record<string, any>;
}> = [
        // Add member/beam
        {
            pattern: /add (?:a )?(\d+(?:\.\d+)?)\s*(?:meter|m|foot|ft|feet)?\s*(?:long )?(beam|column|member|cantilever)/i,
            action: 'add',
            target: 'member',
            extractor: (m) => ({
                length: parseFloat(m[1]),
                type: m[2].toLowerCase(),
                unit: m[1].includes('f') ? 'ft' : 'm'
            })
        },
        // Add support
        {
            pattern: /add (?:a )?(fixed|pinned|roller) support (?:at )?(?:node )?(\w+)?/i,
            action: 'add',
            target: 'support',
            extractor: (m) => ({
                type: m[1].toLowerCase(),
                nodeId: m[2] || 'last'
            })
        },
        // Add load
        {
            pattern: /(?:add|apply) (?:a )?(\d+(?:\.\d+)?)\s*(?:kN|kips?|pounds?|lbs?)?\s*(?:point )?load/i,
            action: 'add',
            target: 'load',
            extractor: (m) => ({
                magnitude: parseFloat(m[1]),
                type: 'point'
            })
        },
        // Add distributed load
        {
            pattern: /(?:add|apply) (?:a )?(\d+(?:\.\d+)?)\s*(?:kN\/m|kips?\/ft)?\s*(?:distributed|uniform) load/i,
            action: 'add',
            target: 'load',
            extractor: (m) => ({
                magnitude: parseFloat(m[1]),
                type: 'distributed'
            })
        },
        // Change section
        {
            pattern: /(?:change|set|use) (?:the )?section (?:to )?(ISMB|IPE|W|HEB?)\s*(\d+)(?:x(\d+))?/i,
            action: 'modify',
            target: 'section',
            extractor: (m) => ({
                section: `${m[1].toUpperCase()}${m[2]}${m[3] ? 'x' + m[3] : ''}`
            })
        },
        // Analyze
        {
            pattern: /(?:run|perform|do)(?: the)? analysis/i,
            action: 'analyze',
            target: 'model',
            extractor: () => ({})
        },
        // Check design
        {
            pattern: /(?:check|verify) (?:the )?(?:design|code|compliance)/i,
            action: 'check',
            target: 'model',
            extractor: () => ({})
        },
        // Optimize
        {
            pattern: /(?:optimize|improve) (?:the )?(?:design|structure|sections)/i,
            action: 'optimize',
            target: 'model',
            extractor: () => ({})
        },
        // Query
        {
            pattern: /(?:what is|show me|display) (?:the )?(deflection|stress|reaction|moment|shear)/i,
            action: 'query',
            target: 'model',
            extractor: (m) => ({
                queryType: m[1].toLowerCase()
            })
        },
        // Geotech: Footing
        {
            pattern: /(?:design|add|create) (?:a )?(?:spread )?footing (?:width )?(\d+(?:\.\d+)?)?\s*(?:m|meters?)? (?:x|by) (\d+(?:\.\d+)?)?/i,
            action: 'add',
            target: 'section', // Reusing target for simplicity or create new 'civil_element'
            extractor: (m) => ({
                module: 'geotech',
                type: 'footing',
                width: parseFloat(m[1] || '2'),
                length: parseFloat(m[2] || m[1] || '2')
            })
        },
        // Transport: Curve
        {
            pattern: /(?:design|calculate) (?:a )?(?:horizontal )?curve (?:speed )?(\d+)?\s*(?:kmh|km\/h)?/i,
            action: 'add',
            target: 'section',
            extractor: (m) => ({
                module: 'transport',
                type: 'curve',
                speed: parseInt(m[1] || '80')
            })
        },
        // Hydraulics: Channel
        {
            pattern: /(?:calculate|design) (?:channel|flow) (?:flow )?/i,
            action: 'analyze',
            target: 'model',
            extractor: () => ({
                module: 'hydraulics',
                type: 'channel'
            })
        },
        // Construction: CPM
        {
            pattern: /(?:calculate|run) (?:cpm|critical path|schedule)/i,
            action: 'analyze',
            target: 'model',
            extractor: () => ({
                module: 'construction',
                type: 'cpm'
            })
        },
        // GENERATIVE DESIGN (Phase 2)
        {
            pattern: /(?:generate|create|build) (?:a )?(?:warehouse|building|portal frame) (?:width )?(\d+) (?:x|by) (\d+)/i,
            action: 'add',
            target: 'model',
            extractor: (m) => ({
                module: 'generative',
                type: 'portal_frame',
                width: parseFloat(m[1]),
                length: parseFloat(m[2])
            })
        }
    ];

// ============================================
// SHORT COMMANDS (O(1) LOOKUP)
// ============================================

const SHORT_COMMANDS: Record<string, StructuralIntent> = {
    // Analysis commands
    'run': { action: 'analyze', target: 'model', parameters: {}, confidence: 1.0 },
    'analyze': { action: 'analyze', target: 'model', parameters: {}, confidence: 1.0 },
    'analysis': { action: 'analyze', target: 'model', parameters: {}, confidence: 1.0 },
    'run analysis': { action: 'analyze', target: 'model', parameters: {}, confidence: 1.0 },
    
    // Check commands
    'check': { action: 'check', target: 'model', parameters: {}, confidence: 1.0 },
    'verify': { action: 'check', target: 'model', parameters: {}, confidence: 1.0 },
    
    // Optimization commands
    'optimize': { action: 'optimize', target: 'model', parameters: {}, confidence: 1.0 },
    'optimise': { action: 'optimize', target: 'model', parameters: {}, confidence: 1.0 },
    
    // Element type shortcuts
    'beam': { action: 'add', target: 'member', parameters: { type: 'beam' }, confidence: 0.8 },
    'column': { action: 'add', target: 'member', parameters: { type: 'column' }, confidence: 0.8 },
    'footing': { action: 'add', target: 'section', parameters: { module: 'geotech', type: 'footing' }, confidence: 0.8 },
    'road': { action: 'add', target: 'section', parameters: { module: 'transport', type: 'road' }, confidence: 0.8 },
    'channel': { action: 'add', target: 'section', parameters: { module: 'hydraulics', type: 'channel' }, confidence: 0.8 },
    
    // Support shortcuts
    'fixed': { action: 'add', target: 'support', parameters: { type: 'fixed' }, confidence: 0.8 },
    'pinned': { action: 'add', target: 'support', parameters: { type: 'pinned' }, confidence: 0.8 },
    'roller': { action: 'add', target: 'support', parameters: { type: 'roller' }, confidence: 0.8 },
    
    // Action shortcuts
    'delete': { action: 'delete', target: 'member', parameters: {}, confidence: 0.8 },
    'remove': { action: 'delete', target: 'member', parameters: {}, confidence: 0.8 },
    'add': { action: 'add', target: 'member', parameters: {}, confidence: 0.6 },
    'modify': { action: 'modify', target: 'member', parameters: {}, confidence: 0.6 },
};

// ============================================
// VOICE INPUT SERVICE
// ============================================

class VoiceInputServiceClass {
    private recognition: any = null;
    private isSupported: boolean = false;
    private state: VoiceInputState = {
        isListening: false,
        isProcessing: false
    };
    private commandHistory: VoiceCommand[] = [];
    private listeners: Array<(command: VoiceCommand) => void> = [];
    private stateListeners: Array<(state: VoiceInputState) => void> = [];

    constructor() {
        this.initRecognition();
    }

    /**
     * Initialize speech recognition
     */
    private initRecognition(): void {
        if (typeof window === 'undefined') return;

        const SpeechRecognition = (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('[VoiceInput] Speech recognition not supported');
            return;
        }

        this.isSupported = true;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.updateState({ isListening: true, error: undefined });
            console.log('[VoiceInput] Started listening');
        };

        this.recognition.onend = () => {
            this.updateState({ isListening: false });
            console.log('[VoiceInput] Stopped listening');
        };

        this.recognition.onerror = (event: { error: string }) => {
            console.error('[VoiceInput] Error:', event.error);
            this.updateState({ error: event.error, isListening: false });
        };

        this.recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
            this.handleResult(event);
        };
    }

    /**
     * Check if voice input is supported
     */
    isVoiceSupported(): boolean {
        return this.isSupported;
    }

    /**
     * Start listening
     */
    startListening(): void {
        if (!this.recognition || this.state.isListening) return;

        try {
            this.recognition.start();
        } catch (e) {
            console.error('[VoiceInput] Failed to start:', e);
        }
    }

    /**
     * Stop listening
     */
    stopListening(): void {
        if (!this.recognition || !this.state.isListening) return;
        this.recognition.stop();
    }

    /**
     * Toggle listening
     */
    toggleListening(): void {
        if (this.state.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    /**
     * Handle speech recognition result
     */
    private handleResult(event: any): void {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        if (finalTranscript) {
            this.processCommand(finalTranscript, event.results[event.results.length - 1][0].confidence);
        }
    }

    /**
     * Process a voice command
     */
    private async processCommand(transcript: string, confidence: number): Promise<void> {
        this.updateState({ isProcessing: true });

        const command: VoiceCommand = {
            id: `vc_${Date.now()}`,
            transcript: transcript.trim(),
            confidence,
            timestamp: new Date(),
            processed: false
        };

        // Parse intent
        const intent = this.parseIntent(command.transcript);
        if (intent) {
            command.intent = intent;
            command.processed = true;
        }

        this.commandHistory.push(command);
        this.updateState({ isProcessing: false, lastCommand: command });

        // Notify listeners
        for (const listener of this.listeners) {
            listener(command);
        }

        console.log('[VoiceInput] Command:', command);
    }

    /**
     * Parse structural intent from transcript
     */
    private parseIntent(transcript: string): StructuralIntent | undefined {
        const lower = transcript.toLowerCase().trim();

        // 1. FAST TRACK: Check Short Commands (O(1) lookup)
        // Check exact match
        if (SHORT_COMMANDS[lower]) {
            return SHORT_COMMANDS[lower];
        }
        // Check "two words" fuzzy match (e.g. "run analysis" -> "run")
        const words = lower.split(' ');
        if (words.length <= 2) {
            for (const word of words) {
                if (SHORT_COMMANDS[word]) {
                    // Start broad, but maybe refine? 
                    // For now, if user says "Design Footing", 'footing' is more specific than 'design'
                    // We can prioritize the noun.
                    if (['footing', 'road', 'channel', 'beam', 'column'].includes(word)) {
                        return SHORT_COMMANDS[word];
                    }
                }
            }
            // If no noun found, check verbs
            if (SHORT_COMMANDS[words[0]]) return SHORT_COMMANDS[words[0]];
        }

        // 3. CONTEXT RESOLUTION (Phase 2)
        // Check for pronouns "it", "this", "that", "selection"
        if (lower.includes('it') || lower.includes('this') || lower.includes('selection')) {
            const state = useModelStore.getState();
            const selectionCount = state.selectedIds.size;

            if (selectionCount > 0) {
                // User is referring to selection
                // Mapping actions based on verb
                if (lower.includes('check') || lower.includes('verify')) {
                    return { action: 'check', target: 'model', parameters: { context: 'selection' }, confidence: 0.95 };
                }
                if (lower.includes('delete') || lower.includes('remove')) {
                    return { action: 'delete', target: 'model', parameters: { context: 'selection' }, confidence: 0.95 };
                }
                if (lower.includes('optimize')) {
                    return { action: 'optimize', target: 'model', parameters: { context: 'selection' }, confidence: 0.95 };
                }
            } else {
                // Ambiguous - ask for clarification (Future feature)
                console.warn('[Voice] Context request but no selection');
            }
        }

        // 2. REGEX PATTERNS
        for (const { pattern, action, target, extractor } of COMMAND_PATTERNS) {
            const match = lower.match(pattern);
            if (match) {
                return {
                    action,
                    target,
                    parameters: extractor(match),
                    confidence: 0.9
                };
            }
        }

        // Fallback: Let AI interpret
        return {
            action: 'query',
            target: 'model',
            parameters: { rawQuery: transcript },
            confidence: 0.5
        };
    }

    /**
     * Subscribe to commands
     */
    onCommand(listener: (command: VoiceCommand) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Subscribe to state changes
     */
    onStateChange(listener: (state: VoiceInputState) => void): () => void {
        this.stateListeners.push(listener);
        listener(this.state);
        return () => {
            this.stateListeners = this.stateListeners.filter(l => l !== listener);
        };
    }

    private updateState(updates: Partial<VoiceInputState>): void {
        this.state = { ...this.state, ...updates };
        for (const listener of this.stateListeners) {
            listener(this.state);
        }
    }

    /**
     * Get current state
     */
    getState(): VoiceInputState {
        return { ...this.state };
    }

    /**
     * Get command history
     */
    getHistory(limit: number = 50): VoiceCommand[] {
        return this.commandHistory.slice(-limit);
    }

    /**
     * Clear history
     */
    clearHistory(): void {
        this.commandHistory = [];
    }
}

// ============================================
// SINGLETON
// ============================================

export const voiceInput = new VoiceInputServiceClass();

export default VoiceInputServiceClass;
