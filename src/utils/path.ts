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

/** Remap a path when an ancestor (or itself) was renamed/moved. */
export function remapPath(path: string, oldPrefix: string, newPrefix: string): string {
  if (!oldPrefix) return path;
  if (path === oldPrefix) return newPrefix;
  const childPrefix = `${oldPrefix}/`;
  if (path.startsWith(childPrefix)) return newPrefix + path.slice(oldPrefix.length);
  return path;
}
