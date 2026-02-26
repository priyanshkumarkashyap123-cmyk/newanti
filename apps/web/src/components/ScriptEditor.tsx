/**
 * ScriptEditor - Monaco-based text editor for STAAD-like commands
 * Custom language highlighting and CommandParser integration
 */

import React from 'react';
import { FC, useRef, useState, useCallback } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { CommandParser, ParsedAction } from '../utils/CommandParser';
import { useModelStore } from '../store/model';

// ============================================
// STAAD LANGUAGE DEFINITION
// ============================================

const registerStaadLanguage = (monaco: Monaco) => {
    // Register the language
    monaco.languages.register({ id: 'staad' });

    // Define tokenizer rules
    monaco.languages.setMonarchTokensProvider('staad', {
        defaultToken: '',
        ignoreCase: true,

        keywords: [
            'JOINT', 'COORDINATES', 'MEMBER', 'INCIDENCES', 'PROPERTY',
            'AMERICAN', 'INDIAN', 'TABLE', 'ST', 'SUPPORT', 'SUPPORTS',
            'FIXED', 'PINNED', 'ROLLER', 'HINGED', 'LOAD', 'JOINT LOAD',
            'MEMBER LOAD', 'UNI', 'UNIFORM', 'CON', 'CONCENTRATED',
            'FX', 'FY', 'FZ', 'MX', 'MY', 'MZ', 'GX', 'GY', 'GZ', 'LX', 'LY', 'LZ',
            'CONSTANTS', 'PERFORM', 'ANALYSIS', 'FINISH', 'START', 'END',
            'LOADING', 'TO', 'ALL'
        ],

        operators: [';', ','],

        tokenizer: {
            root: [
                // Comments (lines starting with * ; or #)
                [/^\s*[*;#].*$/, 'comment'],

                // Keywords
                [/\b(JOINT|COORDINATES?|MEMBER|INCIDENCES?|PROPERTY)\b/i, 'keyword.control'],
                [/\b(AMERICAN|INDIAN|TABLE|ST)\b/i, 'keyword.type'],
                [/\b(SUPPORT|SUPPORTS?|FIXED|PINNED|ROLLER|HINGED)\b/i, 'keyword.support'],
                [/\b(LOAD|UNIFORM|UNI|CON|CONCENTRATED)\b/i, 'keyword.load'],
                [/\b(PERFORM|ANALYSIS|FINISH|START|END)\b/i, 'keyword.command'],
                [/\b(FX|FY|FZ|MX|MY|MZ|GX|GY|GZ|LX|LY|LZ)\b/i, 'keyword.direction'],
                [/\b(TO|ALL|CONSTANTS)\b/i, 'keyword'],

                // Section names (W14X30, ISMB200)
                [/\b(W\d+X\d+|ISMB\s*\d+|ISHB\s*\d+|ISLB\s*\d+|ISMC\s*\d+)\b/i, 'type.section'],

                // Numbers (integers and floats)
                [/-?\d+\.?\d*([eE][+-]?\d+)?/, 'number'],

                // Identifiers
                [/[a-zA-Z_]\w*/, 'identifier'],

                // Operators and delimiters
                [/[;,]/, 'delimiter'],

                // Whitespace
                [/\s+/, 'white'],
            ],
        },
    });

    // Define custom theme
    monaco.editor.defineTheme('staad-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
            { token: 'keyword.control', foreground: '569CD6', fontStyle: 'bold' },
            { token: 'keyword.type', foreground: '4EC9B0' },
            { token: 'keyword.support', foreground: 'C586C0' },
            { token: 'keyword.load', foreground: 'DCDCAA' },
            { token: 'keyword.command', foreground: 'FF6B6B', fontStyle: 'bold' },
            { token: 'keyword.direction', foreground: '9CDCFE' },
            { token: 'keyword', foreground: '569CD6' },
            { token: 'number', foreground: 'B5CEA8' },  // Green for numbers
            { token: 'type.section', foreground: '4FC1FF', fontStyle: 'bold' },
            { token: 'identifier', foreground: 'D4D4D4' },
            { token: 'delimiter', foreground: 'D4D4D4' },
        ],
        colors: {
            'editor.background': '#1E1E2E',
            'editor.foreground': '#D4D4D4',
            'editor.lineHighlightBackground': '#2A2A3E',
            'editorLineNumber.foreground': '#858585',
            'editorCursor.foreground': '#FFCC00',
        },
    });

    // Register completion provider
    monaco.languages.registerCompletionItemProvider('staad', {
        provideCompletionItems: (_model: any, position: any) => {
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: 1,
                endColumn: position.column,
            };

            const suggestions = [
                { label: 'JOINT COORDINATES', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'JOINT COORDINATES\n${1:1} ${2:0} ${3:0} ${4:0}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                { label: 'MEMBER INCIDENCES', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'MEMBER INCIDENCES\n${1:1} ${2:1} ${3:2}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                { label: 'MEMBER PROPERTY AMERICAN', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'MEMBER PROPERTY AMERICAN ${1:1} TO ${2:5} TABLE ST ${3:W14X30}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                { label: 'MEMBER PROPERTY INDIAN', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'MEMBER PROPERTY INDIAN ${1:1} TO ${2:5} TABLE ST ${3:ISMB200}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                { label: 'SUPPORT FIXED', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'SUPPORT ${1:1} FIXED', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                { label: 'SUPPORT PINNED', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'SUPPORT ${1:1} PINNED', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                { label: 'JOINT LOAD', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'JOINT LOAD\n${1:1} FY ${2:-10}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                { label: 'MEMBER LOAD UNI', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'MEMBER LOAD\n${1:1} UNI GY ${2:-5}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                { label: 'PERFORM ANALYSIS', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'PERFORM ANALYSIS', range },
                { label: 'FINISH', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'FINISH', range },
            ];

            return { suggestions };
        },
    });
};

// ============================================
// SCRIPT EDITOR COMPONENT
// ============================================

interface ScriptEditorProps {
    initialValue?: string;
    onRun?: (actions: ParsedAction[]) => void;
    onValidate?: (errors: Array<{ line: number; message: string }>) => void;
    height?: string;
}

export const ScriptEditor: FC<ScriptEditorProps> = ({
    initialValue = `* BeamLab Script Example
* Define joints, members, supports, and loads

JOINT COORDINATES
1 0.0 0.0 0.0
2 5.0 0.0 0.0
3 10.0 0.0 0.0

MEMBER INCIDENCES
1 1 2
2 2 3

SUPPORTS
1 FIXED
3 PINNED

JOINT LOAD
2 FY -10

PERFORM ANALYSIS
`,
    onRun,
    onValidate,
    height = '500px'
}) => {
    const editorRef = useRef<any>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [lastResult, setLastResult] = useState<string>('');

    // Store actions
    const addNode = useModelStore((s) => s.addNode);
    const addMember = useModelStore((s) => s.addMember);
    const addLoad = useModelStore((s) => s.addLoad);
    const setNodeRestraints = useModelStore((s) => s.setNodeRestraints);

    const handleEditorMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;

        // Register STAAD language
        registerStaadLanguage(monaco);

        // Set theme
        monaco.editor.setTheme('staad-dark');

        // Add keyboard shortcut for Run (Ctrl+Enter)
        editor.addAction({
            id: 'run-script',
            label: 'Run Script',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
            run: () => handleRun(),
        });
    };

    const handleRun = useCallback(() => {
        const parser = new CommandParser();
        const content = editorRef.current?.getValue() ?? '';

        setIsRunning(true);

        try {
            // Validate first
            const validation = parser.validate(content);
            if (!validation.valid) {
                onValidate?.(validation.errors);
                setLastResult(`❌ Validation failed:\n${validation.errors.map(e => `Line ${e.line}: ${e.message}`).join('\n')}`);
                setIsRunning(false);
                return;
            }

            // Parse actions
            const actions = parser.parse(content);

            // Execute actions on store
            let nodesAdded = 0;
            let membersAdded = 0;
            let loadsAdded = 0;
            let supportsAdded = 0;

            for (const action of actions) {
                switch (action.type) {
                    case 'ADD_NODE':
                        addNode({
                            id: action.data['id'] as string,
                            x: action.data['x'] as number,
                            y: action.data['y'] as number,
                            z: action.data['z'] as number,
                        });
                        nodesAdded++;
                        break;

                    case 'ADD_MEMBER':
                        addMember({
                            id: action.data['id'] as string,
                            startNodeId: action.data['startNodeId'] as string,
                            endNodeId: action.data['endNodeId'] as string,
                            sectionId: 'default',
                        });
                        membersAdded++;
                        break;

                    case 'SET_SUPPORT': {
                        const supportType = action.data['type'] as string;
                        const isFixed = supportType === 'FIXED';
                        const isPinned = supportType === 'PINNED' || supportType === 'HINGED';
                        setNodeRestraints(action.data['nodeId'] as string, {
                            fx: isFixed || isPinned,
                            fy: true,
                            fz: isFixed || isPinned,
                            mx: isFixed,
                            my: isFixed,
                            mz: isFixed,
                        });
                        supportsAdded++;
                        break;
                    }

                    case 'ADD_LOAD':
                        addLoad({
                            id: `load-${Date.now()}-${Math.random()}`,
                            nodeId: action.data['nodeId'] as string,
                            fx: action.data['fx'] as number,
                            fy: action.data['fy'] as number,
                            fz: action.data['fz'] as number,
                            mx: action.data['mx'] as number,
                            my: action.data['my'] as number,
                            mz: action.data['mz'] as number,
                        });
                        loadsAdded++;
                        break;
                }
            }

            const summary = `✅ Script executed successfully:
• ${nodesAdded} nodes added
• ${membersAdded} members added  
• ${supportsAdded} supports applied
• ${loadsAdded} loads added`;

            setLastResult(summary);
            onRun?.(actions);

        } catch (error) {
            setLastResult(`❌ Error: ${error}`);
        } finally {
            setIsRunning(false);
        }
    }, [addNode, addMember, addLoad, setNodeRestraints, onRun, onValidate]);

    // Container styles
    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#1E1E2E',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid rgba(100, 150, 255, 0.2)',
    };

    const toolbarStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'rgba(30, 30, 50, 0.95)',
        borderBottom: '1px solid rgba(100, 150, 255, 0.2)',
    };

    const buttonStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        background: isRunning
            ? 'rgba(100, 100, 100, 0.5)'
            : 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
        border: 'none',
        borderRadius: '6px',
        color: 'white',
        fontWeight: 600,
        cursor: isRunning ? 'wait' : 'pointer',
        fontSize: '13px',
    };

    const statusStyle: React.CSSProperties = {
        padding: '8px 12px',
        background: 'rgba(20, 20, 30, 0.9)',
        borderTop: '1px solid rgba(100, 150, 255, 0.2)',
        fontSize: '12px',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        color: lastResult.startsWith('✅') ? '#4CAF50' :
            lastResult.startsWith('❌') ? '#ff6b6b' : '#9CA3AF',
        maxHeight: '100px',
        overflowY: 'auto',
    };

    return (
        <div style={containerStyle}>
            <div style={toolbarStyle}>
                <span style={{ color: '#9CA3AF', fontSize: '13px' }}>
                    📝 Script Editor (STAAD Format)
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: '#6B7280', fontSize: '11px' }}>
                        Ctrl+Enter to run
                    </span>
                    <button style={buttonStyle} onClick={handleRun} disabled={isRunning}>
                        {isRunning ? '⏳ Running...' : '▶️ Run'}
                    </button>
                </div>
            </div>

            <div style={{ flex: 1 }}>
                <Editor
                    height={height}
                    defaultLanguage="staad"
                    defaultValue={initialValue}
                    onMount={handleEditorMount}
                    options={{
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                        lineNumbers: 'on',
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: 'on',
                        renderWhitespace: 'selection',
                        bracketPairColorization: { enabled: true },
                    }}
                />
            </div>

            {lastResult && (
                <div style={statusStyle}>
                    {lastResult}
                </div>
            )}
        </div>
    );
};

export default ScriptEditor;
