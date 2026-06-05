export function joinPath(parent: string, name: string): string {
  const base = parent.replace(/\/+$/, '');
  const child = name.replace(/^\/+/, '');
  return base ? `${base}/${child}` : child;
}

export function basename(path: string): string {
  const p = path.replace(/\/+$/, '');
  const i = p.lastIndexOf('/');
  return i < 0 ? p : p.slice(i + 1);
}

export function dirname(path: string): string {
  const p = path.replace(/\/+$/, '');
  const i = p.lastIndexOf('/');
  return i <= 0 ? '' : p.slice(0, i);
}
