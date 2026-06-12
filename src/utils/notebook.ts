export interface NotebookCell {
  id: string;
  cell_type: 'code' | 'markdown';
  source: string;
  execution_count: number | null;
  outputs: string[];
}

export interface ParsedNotebook {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
  defaultKernel: string;
}

function cellId(index: number): string {
  return `cell-${index}`;
}

function sourceToString(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.map(String).join('');
  return '';
}

export function isNotebookEntry(entry: { name: string; node_type?: string }): boolean {
  return entry.node_type === 'notebook' || entry.name.toLowerCase().endsWith('.ipynb');
}

export function parseNotebookJson(raw: string): ParsedNotebook {
  const doc = JSON.parse(raw) as Record<string, unknown>;
  const metadata = (doc.metadata as Record<string, unknown>) || {};
  const ks = metadata.kernelspec as { name?: string } | undefined;
  const cellsRaw = Array.isArray(doc.cells) ? doc.cells : [];
  const cells: NotebookCell[] = cellsRaw.map((c, i) => {
    const cell = c as Record<string, unknown>;
    const outputs = Array.isArray(cell.outputs)
      ? (cell.outputs as Record<string, unknown>[]).map((o) => {
          if (o.text) return sourceToString(o.text);
          if (o.data && typeof o.data === 'object') {
            const d = o.data as Record<string, unknown>;
            return sourceToString(d['text/plain'] ?? d['text/html'] ?? '');
          }
          return String(o.output_type || 'output');
        })
      : [];
    return {
      id: cellId(i),
      cell_type: cell.cell_type === 'markdown' ? 'markdown' : 'code',
      source: sourceToString(cell.source),
      execution_count: typeof cell.execution_count === 'number' ? cell.execution_count : null,
      outputs,
    };
  });
  if (cells.length === 0) {
    cells.push({ id: cellId(0), cell_type: 'code', source: '', execution_count: null, outputs: [] });
  }
  return {
    cells,
    metadata,
    nbformat: typeof doc.nbformat === 'number' ? doc.nbformat : 4,
    nbformat_minor: typeof doc.nbformat_minor === 'number' ? doc.nbformat_minor : 5,
    defaultKernel: ks?.name || 'python3',
  };
}

export function serializeNotebook(parsed: ParsedNotebook): string {
  const doc = {
    cells: parsed.cells.map((c) => ({
      cell_type: c.cell_type,
      metadata: {},
      source: c.source.split('\n').length <= 1 ? c.source : c.source.split('\n').map((l, i, a) => (i < a.length - 1 ? `${l}\n` : l)),
      ...(c.cell_type === 'code'
        ? { execution_count: c.execution_count, outputs: [] }
        : {}),
    })),
    metadata: parsed.metadata,
    nbformat: parsed.nbformat,
    nbformat_minor: parsed.nbformat_minor,
  };
  return JSON.stringify(doc, null, 1);
}
