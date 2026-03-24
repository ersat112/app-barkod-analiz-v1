export function withAlpha(color: string, alphaHex: string): string {
  const normalizedAlpha = alphaHex.replace('#', '').slice(0, 2);

  if (!color.startsWith('#') || normalizedAlpha.length !== 2) {
    return color;
  }

  if (color.length === 4) {
    const r = color[1];
    const g = color[2];
    const b = color[3];

    return `#${r}${r}${g}${g}${b}${b}${normalizedAlpha}`;
  }

  if (color.length === 7 || color.length === 9) {
    return `${color.slice(0, 7)}${normalizedAlpha}`;
  }

  return color;
}
