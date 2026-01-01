/**
 * useKeyboardShortcuts - Keyboard Shortcuts Hook for PathwayMapBuilder
 *
 * Implements Escher-like keyboard shortcuts for efficient map editing.
 */

import { useEffect, useCallback } from 'react';

// Shortcut definitions
export const SHORTCUTS = {
  // Mode switching
  'v': { action: 'mode_select', label: 'Select mode' },
  'p': { action: 'mode_pan', label: 'Pan mode' },
  'a': { action: 'mode_add', label: 'Add reaction mode' },
  'r': { action: 'mode_rotate', label: 'Rotate mode' },
  't': { action: 'mode_text', label: 'Text annotation mode' },

  // Edit operations
  'Delete': { action: 'delete', label: 'Delete selected' },
  'Backspace': { action: 'delete', label: 'Delete selected' },
  'd': { action: 'duplicate', label: 'Duplicate selected' },

  // History
  'z': { action: 'undo', label: 'Undo', modifier: 'ctrl' },
  'y': { action: 'redo', label: 'Redo', modifier: 'ctrl' },
  'Z': { action: 'redo', label: 'Redo', modifier: 'ctrlShift' },

  // View
  '0': { action: 'zoom_reset', label: 'Reset zoom' },
  '=': { action: 'zoom_in', label: 'Zoom in' },
  '+': { action: 'zoom_in', label: 'Zoom in' },
  '-': { action: 'zoom_out', label: 'Zoom out' },
  'f': { action: 'fit_view', label: 'Fit to view' },

  // Selection
  'Escape': { action: 'deselect', label: 'Deselect all' },

  // Search
  '/': { action: 'search', label: 'Open search' },
  'f': { action: 'search', label: 'Open search', modifier: 'ctrl' },
  'Enter': { action: 'search_next', label: 'Next result' },
  'n': { action: 'search_next', label: 'Next result', modifier: 'ctrl' },
  'N': { action: 'search_prev', label: 'Previous result', modifier: 'ctrlShift' },

  // Toggle overlays
  'l': { action: 'toggle_labels', label: 'Toggle labels' },
  'g': { action: 'toggle_gpr', label: 'Toggle GPR' },
  ' ': { action: 'toggle_animation', label: 'Toggle animation' },

  // Export
  's': { action: 'save', label: 'Save map', modifier: 'ctrl' },
  'e': { action: 'export_svg', label: 'Export SVG', modifier: 'ctrl' },
  'E': { action: 'export_png', label: 'Export PNG', modifier: 'ctrlShift' },

  // Secondary metabolites
  'h': { action: 'toggle_secondary', label: 'Toggle secondary metabolites' }
};

export function useKeyboardShortcuts(handlers, enabled = true, containerRef = null) {
  const handleKeyDown = useCallback((e) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      // Allow Escape in inputs
      if (e.key !== 'Escape') return;
    }

    const key = e.key;
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    // Find matching shortcut
    let matchedShortcut = null;
    let action = null;

    for (const [shortcutKey, shortcut] of Object.entries(SHORTCUTS)) {
      const needsCtrl = shortcut.modifier === 'ctrl' || shortcut.modifier === 'ctrlShift';
      const needsShift = shortcut.modifier === 'ctrlShift';

      if (shortcutKey === key) {
        if (!shortcut.modifier && !isCtrl && !isShift) {
          matchedShortcut = shortcut;
          action = shortcut.action;
          break;
        }
        if (shortcut.modifier === 'ctrl' && isCtrl && !isShift) {
          matchedShortcut = shortcut;
          action = shortcut.action;
          break;
        }
        if (shortcut.modifier === 'ctrlShift' && isCtrl && isShift) {
          matchedShortcut = shortcut;
          action = shortcut.action;
          break;
        }
      }
    }

    if (action && handlers[action]) {
      e.preventDefault();
      handlers[action](e);
    }
  }, [enabled, handlers]);

  useEffect(() => {
    const target = containerRef?.current || window;
    target.addEventListener('keydown', handleKeyDown);
    return () => target.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, containerRef]);

  // Return shortcut info for help display
  const getShortcutLabel = useCallback((action) => {
    for (const [key, shortcut] of Object.entries(SHORTCUTS)) {
      if (shortcut.action === action) {
        let label = '';
        if (shortcut.modifier === 'ctrl') label = 'Ctrl+';
        if (shortcut.modifier === 'ctrlShift') label = 'Ctrl+Shift+';
        return label + (key === ' ' ? 'Space' : key);
      }
    }
    return '';
  }, []);

  const shortcutGroups = {
    'Mode': ['mode_select', 'mode_pan', 'mode_add', 'mode_rotate', 'mode_text'],
    'Edit': ['delete', 'duplicate', 'undo', 'redo'],
    'View': ['zoom_reset', 'zoom_in', 'zoom_out', 'fit_view'],
    'Search': ['search', 'search_next', 'search_prev'],
    'Toggle': ['toggle_labels', 'toggle_animation', 'toggle_secondary'],
    'File': ['save', 'export_svg', 'export_png']
  };

  return {
    getShortcutLabel,
    shortcutGroups,
    shortcuts: SHORTCUTS
  };
}

export default useKeyboardShortcuts;
