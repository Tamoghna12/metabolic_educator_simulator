import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  const [mounted, setMounted] = useState(false);
  const [colorBlindMode, setColorBlindMode] = useState(() => {
    return localStorage.getItem('colorBlindMode') === 'true';
  });

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme');
    const initialTheme = (saved === 'dark' || saved === 'light') ? saved : 'light';
    
    document.documentElement.setAttribute('data-theme', initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newTheme;
    });
  }, []);

  // IBM Design Library Color Blind Safe Palette (Blue/Orange/Purple/Magenta)
  const colorBlindPaletteLight = {
    success: '#648fff',      // Blue
    successBg: '#e8f0ff',
    successText: '#1e3a5f',
    warning: '#ffb000',      // Gold
    warningBg: '#fff8e1',
    warningText: '#5c4813',
    danger: '#dc267f',       // Magenta
    dangerBg: '#fce4f0',
    dangerText: '#6b1039',
    info: '#785ef0',         // Purple
    infoBg: '#f0ecff',
    infoText: '#2d1f5e'
  };

  const colorBlindPaletteDark = {
    success: '#97c4ff',      // Lighter Blue for dark bg
    successBg: '#1e3a5f',
    successText: '#c5dbff',
    warning: '#ffd666',      // Lighter Gold for dark bg
    warningBg: '#5c4813',
    warningText: '#fff0c7',
    danger: '#ff6eb4',       // Lighter Magenta for dark bg
    dangerBg: '#6b1039',
    dangerText: '#ffcce4',
    info: '#a799ff',         // Lighter Purple for dark bg
    infoBg: '#2d1f5e',
    infoText: '#d4cfff'
  };

  // Update CSS custom properties when colorblind mode or theme changes
  useEffect(() => {
    const palette = theme === 'dark' ? colorBlindPaletteDark : colorBlindPaletteLight;

    if (colorBlindMode) {
      document.documentElement.style.setProperty('--success', palette.success);
      document.documentElement.style.setProperty('--success-bg', palette.successBg);
      document.documentElement.style.setProperty('--success-text', palette.successText);
      document.documentElement.style.setProperty('--warning', palette.warning);
      document.documentElement.style.setProperty('--warning-bg', palette.warningBg);
      document.documentElement.style.setProperty('--warning-text', palette.warningText);
      document.documentElement.style.setProperty('--danger', palette.danger);
      document.documentElement.style.setProperty('--danger-bg', palette.dangerBg);
      document.documentElement.style.setProperty('--danger-text', palette.dangerText);
      document.documentElement.style.setProperty('--info', palette.info);
      document.documentElement.style.setProperty('--info-bg', palette.infoBg);
      document.documentElement.style.setProperty('--info-text', palette.infoText);
    } else {
      // Reset to theme defaults by removing inline styles
      ['success', 'success-bg', 'success-text', 'warning', 'warning-bg', 'warning-text',
       'danger', 'danger-bg', 'danger-text', 'info', 'info-bg', 'info-text'].forEach(prop => {
        document.documentElement.style.removeProperty(`--${prop}`);
      });
    }
  }, [colorBlindMode, theme]);

  const toggleColorBlindMode = useCallback(() => {
    setColorBlindMode(prev => {
      const newState = !prev;
      localStorage.setItem('colorBlindMode', String(newState));
      return newState;
    });
  }, []);

  // Accessible colors object for direct use in components
  const currentPalette = theme === 'dark' ? colorBlindPaletteDark : colorBlindPaletteLight;
  const accessibleColors = {
    success: colorBlindMode ? currentPalette.success : 'var(--success)',
    warning: colorBlindMode ? currentPalette.warning : 'var(--warning)',
    danger: colorBlindMode ? currentPalette.danger : 'var(--danger)',
    info: colorBlindMode ? currentPalette.info : 'var(--info)',
    neutral: 'var(--text-secondary)'
  };

  const value = {
    theme,
    toggleTheme,
    colorBlindMode,
    toggleColorBlindMode,
    accessibleColors,
    isLight: theme === 'light',
    isDark: theme === 'dark',
    mounted
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

