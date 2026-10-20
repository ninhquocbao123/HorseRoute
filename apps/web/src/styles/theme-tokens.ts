export const themeTokens = {
  colorBrand: '#193e32',
  colorBrandHover: '#2c5846',
  colorTextMuted: '#68756e',
  colorBackground: '#fbfaf6',
  colorSurface: '#fffefa',
  colorSurfaceMuted: '#f0f1e9',
  colorBorder: '#d7dcd1',
  colorAccent: '#b09050',
  colorSuccess: '#275338',
  colorError: '#a32d28',
  borderRadius: 4,
  controlHeight: 44,
  fontSans: '"Segoe UI", Arial, Helvetica, sans-serif',
  fontSerif: 'Georgia, "Times New Roman", serif',
} as const;

export function applyThemeCssVariables() {
  const root = document.documentElement;

  root.style.setProperty('--color-brand', themeTokens.colorBrand);
  root.style.setProperty('--color-brand-hover', themeTokens.colorBrandHover);
  root.style.setProperty('--color-text-muted', themeTokens.colorTextMuted);
  root.style.setProperty('--color-background', themeTokens.colorBackground);
  root.style.setProperty('--color-surface', themeTokens.colorSurface);
  root.style.setProperty('--color-surface-muted', themeTokens.colorSurfaceMuted);
  root.style.setProperty('--color-border', themeTokens.colorBorder);
  root.style.setProperty('--color-accent', themeTokens.colorAccent);
  root.style.setProperty('--color-success', themeTokens.colorSuccess);
  root.style.setProperty('--color-error', themeTokens.colorError);
  root.style.setProperty('--radius-control', `${themeTokens.borderRadius}px`);
  root.style.setProperty('--control-height', `${themeTokens.controlHeight}px`);
  root.style.setProperty('--font-sans', themeTokens.fontSans);
  root.style.setProperty('--font-serif', themeTokens.fontSerif);

  // Backward-compatible aliases for legacy workspace styles.
  root.style.setProperty('--green', themeTokens.colorBrand);
  root.style.setProperty('--muted', themeTokens.colorTextMuted);
  root.style.setProperty('--cream', themeTokens.colorBackground);
}
