/** Simple line diff for Git editor (not a full unified diff). */
export function buildLineDiff(oldText: string, newText: string): string[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const lines: string[] = [];
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i += 1) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      if (o !== undefined) lines.push(` ${o}`);
    } else {
      if (o !== undefined) lines.push(`-${o}`);
      if (n !== undefined) lines.push(`+${n}`);
    }
  }
  return lines;
}
