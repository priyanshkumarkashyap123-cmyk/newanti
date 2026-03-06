import { useEffect } from 'react';
import { useModelStore } from '../store/model';
import { useUIStore } from '../store/uiStore';

export function useKeyboardShortcuts() {
    const setTool = useModelStore((state) => state.setTool);
    const clearSelection = useModelStore((state) => state.clearSelection);
    const toggleGrid = useUIStore((state) => state.toggleGrid);
    const showNotification = useUIStore((state) => state.showNotification);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input/textarea or contentEditable
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                return;
            }
            // Ignore if a dialog/modal is open
            if (document.querySelector('[role="dialog"], [role="alertdialog"], .modal-overlay')) return;

            // Don't interfere with Ctrl/Cmd combos (except specific ones)
            if (e.ctrlKey || e.metaKey) return;

            switch (e.key.toLowerCase()) {
                // ─── Tool Shortcuts ───
                case 'v':
                    setTool('select');
                    showNotification('info', 'Select tool — click to select elements');
                    break;
                case 'n':
                    setTool('node');
                    showNotification('info', 'Node tool — click on grid to place nodes');
                    break;
                case 'm':
                    setTool('member');
                    showNotification('info', 'Beam tool — click two points to draw a beam');
                    break;
                case 'b':
                    setTool('select_range');
                    showNotification('info', 'Box select — drag to select a region');
                    break;
                case 'l':
                    setTool('load');
                    showNotification('info', 'Load tool — click on a node to apply force');
                    break;
                case 'u':
                    setTool('memberLoad');
                    showNotification('info', 'Member load — click on a member to apply UDL');
                    break;
                case 'p':
                    useUIStore.getState().openModal('plateDialog');
                    break;
                case 's':
                    setTool('support');
                    showNotification('info', 'Support tool — click on a node to assign restraint');
                    break;

                // ─── Utility Shortcuts ───
                case 'g':
                    toggleGrid();
                    break;
                case 'escape':
                    setTool('select');
                    clearSelection();
                    break;
                case 'delete':
                    useModelStore.getState().deleteSelection();
                    break;
            }

            // Function keys
            if (e.key === 'F5') {
                e.preventDefault();
                document.dispatchEvent(new CustomEvent('trigger-analysis'));
                showNotification('info', 'Running analysis...');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setTool, clearSelection, toggleGrid, showNotification]);
}
