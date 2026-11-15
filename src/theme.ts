import colors from './brand/colors.json';

export type Theme = 'system' | 'light' | 'dark';
export function applyTheme(choice: Theme) {
  const mode = choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
  document.documentElement.dataset.theme = mode;
  for (const [key, value] of Object.entries(colors[mode])) {
    if (Array.isArray(value)) continue;
    if (typeof value === 'object') {
      for (const [part, color] of Object.entries(value)) document.documentElement.style.setProperty(`--${key}-${part}`, color);
    } else document.documentElement.style.setProperty(`--${key}`, String(value));
  }
}
