import { useEffect } from 'react';
import { useModelStore } from '../store/model';
import { useUIStore } from '../store/uiStore';

export function useKeyboardShortcuts() {
    const setTool = useModelStore((state) => state.setTool);
    const clearSelection = useModelStore((state) => state.clearSelection);
    const toggleGrid = useUIStore((state) => state.toggleGrid);

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

            // Global Shortcuts
            switch (e.key.toLowerCase()) {
                case 'n':
                    setTool('node');
                    break;
                case 'b':
                    setTool('member');
                    break;
                case 'g':
                    toggleGrid();
                    break;
                case 'escape':
                    setTool('select');
                    clearSelection();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setTool, clearSelection, toggleGrid]);
}
