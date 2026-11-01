/** Colours from GitHub Linguist for the most common languages. */
export const LANGUAGE_COLORS: Readonly<Record<string, string>> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  'C#': '#178600',
  'C++': '#f34b7d',
  C: '#555555',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Scala: '#c22d40',
  Elixir: '#6e4a7e',
  Erlang: '#B83998',
  Haskell: '#5e5086',
  Clojure: '#db5855',
  Lua: '#000080',
  Perl: '#0298c3',
  R: '#198CE7',
  Julia: '#a270ba',
  'Objective-C': '#438eff',
  Shell: '#89e051',
  PowerShell: '#012456',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Astro: '#ff5a03',
  'Jupyter Notebook': '#DA5B0B',
  Dockerfile: '#384d54',
  Makefile: '#427819',
  Nix: '#7e7eff',
  Zig: '#ec915c',
  OCaml: '#ef7a08',
  'F#': '#b845fc',
  Elm: '#60B5CC',
  Solidity: '#AA6746',
  'Vim Script': '#199f4b',
  'Emacs Lisp': '#c065db',
  TeX: '#3D6117',
  MDX: '#fcb32c',
  Assembly: '#6E4C13',
  Groovy: '#4298b8',
  CoffeeScript: '#244776',
  Crystal: '#000100',
  Nim: '#ffc200',
};

export const FALLBACK_LANGUAGE_COLOR = '#8b8b8b';

export function getLanguageColor(language: string | null | undefined): string {
  if (!language) return FALLBACK_LANGUAGE_COLOR;
  return LANGUAGE_COLORS[language] ?? FALLBACK_LANGUAGE_COLOR;
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rgb` / `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  let value = hex.replace('#', '');
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return 0;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

const DARK_TEXT = '#111111';
const LIGHT_TEXT = '#ffffff';

/** Picks whichever of near-black or white reads better on the given background. */
export function getReadableTextColor(background: string): string {
  return contrastRatio(background, DARK_TEXT) >= contrastRatio(background, LIGHT_TEXT)
    ? DARK_TEXT
    : LIGHT_TEXT;
}

