import type { FileEntry } from '../types';

export function formatSize(size: number, isDir: boolean): string {
  if (isDir) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatModified(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/** Databricks browse table uses "Created at" with short month format */
export function formatCreated(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function entryIcon(entry: FileEntry): string {
  if (entry.in_recycle) return 'trash';
  if (entry.is_git_folder || entry.node_type === 'git_folder') return 'git';
  if (entry.node_type === 'notebook' || entry.name.endsWith('.ipynb')) return 'notebook';
  if (entry.is_dir) return 'folder';
  if (entry.name.endsWith('.py')) return 'python';
  if (entry.name.endsWith('.sql')) return 'sql';
  if (/\.(md|markdown)$/i.test(entry.name)) return 'markdown';
  return 'file';
}

export function entryTypeLabel(entry: FileEntry): string {
  if (entry.in_recycle) return 'Trash item';
  if (entry.is_git_folder || entry.node_type === 'git_folder') return 'Git folder';
  if (entry.is_dir) return 'Folder';
  if (entry.node_type === 'notebook' || entry.name.endsWith('.ipynb')) return 'Notebook';
  if (entry.name.endsWith('.r') || entry.name.endsWith('.sql')) return 'Query';
  return 'File';
}

export const FILE_TYPE_OPTIONS = ['All', 'Folder', 'File', 'Git folder', 'Notebook', 'Query'] as const;
export type FileTypeFilter = (typeof FILE_TYPE_OPTIONS)[number];
