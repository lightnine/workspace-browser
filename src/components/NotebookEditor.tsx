import { useCallback, useEffect, useRef, useState } from 'react';
import { gatewayApi } from '../api/gatewayClient';
import { KernelConnection } from '../api/kernelConnection';
import type { NotebookTab, WorkspaceContext } from '../types';
import { formatLastEdit } from '../utils/format';
import type { NotebookCell } from '../utils/notebook';

interface Props {
  ctx: WorkspaceContext;
  tab: NotebookTab;
  onChangeCells: (path: string, cells: NotebookCell[]) => void;
  onKernelUpdate: (path: string, patch: Partial<NotebookTab['kernel']>) => void;
  onSave: () => void;
}

const MENU_ITEMS = ['File', 'Edit', 'View', 'Run', 'Help'] as const;

export function NotebookEditor({ ctx, tab, onChangeCells, onKernelUpdate, onSave }: Props) {
  const [specs, setSpecs] = useState<string[]>([tab.kernel.kernelName]);
  const [specsError, setSpecsError] = useState<string | null>(null);
  const [runningCellId, setRunningCellId] = useState<string | null>(null);
  const connRef = useRef<KernelConnection | null>(null);

  useEffect(() => {
    void gatewayApi
      .listKernelSpecs(ctx)
      .then((names) => {
        setSpecs(names);
        setSpecsError(null);
      })
      .catch((e) => setSpecsError(e instanceof Error ? e.message : String(e)));
  }, [ctx]);

  const pollKernel = useCallback(
    (kernelId: string) => {
      const timer = window.setInterval(() => {
        void gatewayApi
          .getKernel(ctx, kernelId)
          .then((k) => onKernelUpdate(tab.path, { executionState: k.execution_state || 'unknown' }))
          .catch(() => undefined);
      }, 3000);
      return () => window.clearInterval(timer);
    },
    [ctx, onKernelUpdate, tab.path],
  );

  useEffect(() => {
    if (tab.kernel.state !== 'connected' || !tab.kernel.kernelId) return;
    return pollKernel(tab.kernel.kernelId);
  }, [tab.kernel.kernelId, tab.kernel.state, pollKernel]);

  useEffect(
    () => () => {
      void connRef.current?.shutdown();
      connRef.current = null;
    },
    [],
  );

  const connect = async () => {
    onKernelUpdate(tab.path, { state: 'connecting', error: undefined });
    try {
      const conn = await KernelConnection.connect(ctx, tab.kernel.kernelName);
      connRef.current = conn;
      onKernelUpdate(tab.path, {
        state: 'connected',
        sessionId: undefined,
        kernelId: conn.kernelId,
        executionState: 'idle',
        error: undefined,
      });
    } catch (e) {
      onKernelUpdate(tab.path, {
        state: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const disconnect = async () => {
    try {
      await connRef.current?.shutdown();
    } catch {
      /* ignore */
    }
    connRef.current = null;
    onKernelUpdate(tab.path, {
      state: 'disconnected',
      sessionId: undefined,
      kernelId: undefined,
      executionState: undefined,
      error: undefined,
    });
  };

  const runCell = async (cellId: string) => {
    const cell = tab.cells.find((c) => c.id === cellId);
    const conn = connRef.current;
    if (!cell || cell.cell_type !== 'code' || !conn) return;

    setRunningCellId(cellId);
    try {
      const result = await conn.execute(cell.source);
      onChangeCells(
        tab.path,
        tab.cells.map((c) =>
          c.id === cellId
            ? { ...c, execution_count: result.execution_count, outputs: result.outputs }
            : c,
        ),
      );
      onKernelUpdate(tab.path, { executionState: 'idle' });
    } catch (e) {
      onChangeCells(
        tab.path,
        tab.cells.map((c) =>
          c.id === cellId
            ? { ...c, outputs: [e instanceof Error ? e.message : String(e)] }
            : c,
        ),
      );
    } finally {
      setRunningCellId(null);
    }
  };

  const runAll = async () => {
    const conn = connRef.current;
    if (!conn || tab.kernel.state !== 'connected') return;

    let cells = tab.cells;
    for (const cell of cells) {
      if (cell.cell_type !== 'code') continue;
      const current = cells.find((c) => c.id === cell.id);
      if (!current) continue;

      setRunningCellId(cell.id);
      try {
        const result = await conn.execute(current.source);
        cells = cells.map((c) =>
          c.id === cell.id
            ? { ...c, execution_count: result.execution_count, outputs: result.outputs }
            : c,
        );
        onChangeCells(tab.path, cells);
      } catch (e) {
        cells = cells.map((c) =>
          c.id === cell.id
            ? { ...c, outputs: [e instanceof Error ? e.message : String(e)] }
            : c,
        );
        onChangeCells(tab.path, cells);
        break;
      } finally {
        setRunningCellId(null);
      }
    }
    onKernelUpdate(tab.path, { executionState: 'idle' });
  };

  const updateCell = (id: string, source: string) => {
    onChangeCells(
      tab.path,
      tab.cells.map((c) => (c.id === id ? { ...c, source } : c)),
    );
  };

  const addCell = (cell_type: 'code' | 'markdown') => {
    const id = `cell-${Date.now()}`;
    const cell: NotebookCell = { id, cell_type, source: '', execution_count: null, outputs: [] };
    onChangeCells(tab.path, [...tab.cells, cell]);
  };

  const deleteCell = (id: string) => {
    onChangeCells(
      tab.path,
      tab.cells.filter((c) => c.id !== id),
    );
  };

  const duplicateCell = (id: string) => {
    const src = tab.cells.find((c) => c.id === id);
    if (!src) return;
    const copy = { ...src, id: `cell-${Date.now()}` };
    const idx = tab.cells.findIndex((c) => c.id === id);
    const next = [...tab.cells];
    next.splice(idx + 1, 0, copy);
    onChangeCells(tab.path, next);
  };

  const kernelLabel = tab.kernel.kernelName === 'python3' ? 'Python' : tab.kernel.kernelName;
  const stateLabel =
    tab.kernel.state === 'connected'
      ? tab.kernel.executionState || 'idle'
      : tab.kernel.state === 'connecting'
        ? 'Starting…'
        : tab.kernel.state === 'error'
          ? 'Error'
          : 'Detached';

  return (
    <div className="notebook-editor">
      <div className="notebook-menubar">
        {MENU_ITEMS.map((m) => (
          <button key={m} type="button" className="nb-menu-item" disabled title="Not implemented">
            {m}
          </button>
        ))}
      </div>
      <div className="notebook-toolbar">
        <div className="notebook-toolbar-left">
          <span className="notebook-title">{tab.name}</span>
          {formatLastEdit(tab.modifyTime) && (
            <span className="notebook-meta">{formatLastEdit(tab.modifyTime)}</span>
          )}
        </div>
        <div className="notebook-toolbar-center">
          <label className="kernel-select-wrap">
            <select
              value={tab.kernel.kernelName}
              disabled={tab.kernel.state === 'connected' || tab.kernel.state === 'connecting'}
              onChange={(e) => onKernelUpdate(tab.path, { kernelName: e.target.value })}
            >
              {specs.map((s) => (
                <option key={s} value={s}>
                  {s === 'python3' ? 'Python' : s}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={tab.kernel.state !== 'connected' || !!runningCellId}
            title={tab.kernel.state === 'connected' ? 'Run all cells' : 'Connect kernel first'}
            onClick={() => void runAll()}
          >
            Run all
          </button>
        </div>
        <div className="notebook-toolbar-right">
          <span className="compute-select" title="Attach cluster">
            {tab.kernel.state === 'connected' ? kernelLabel : 'Detached'}
          </span>
          <span className={`kernel-pill state-${tab.kernel.state}`}>{stateLabel}</span>
          {tab.kernel.state === 'connected' ? (
            <button type="button" onClick={() => void disconnect()}>
              Disconnect
            </button>
          ) : (
            <button type="button" className="primary" onClick={() => void connect()}>
              Connect
            </button>
          )}
          <button type="button" disabled title="Schedule — not implemented">
            Schedule
          </button>
          <button type="button" disabled title="Share — needs ACL API">
            Share
          </button>
          <button type="button" onClick={onSave} disabled={!tab.dirty}>
            Save
          </button>
        </div>
      </div>
      {specsError && <div className="banner err notebook-banner">Gateway: {specsError}</div>}
      {tab.kernel.error && <div className="banner err notebook-banner">{tab.kernel.error}</div>}
      <div className="notebook-cells">
        {tab.cells.map((cell, idx) => (
          <div key={cell.id} className={`nb-cell nb-cell-${cell.cell_type}`}>
            <div className="nb-cell-gutter">
              {cell.cell_type === 'code' ? (
                <>
                  <span className="nb-prompt">[{cell.execution_count ?? ' '}]</span>
                  <button
                    type="button"
                    className="nb-run"
                    title={tab.kernel.state === 'connected' ? 'Run cell' : 'Connect kernel first'}
                    disabled={tab.kernel.state !== 'connected' || runningCellId === cell.id}
                    onClick={() => void runCell(cell.id)}
                  >
                    {runningCellId === cell.id ? '…' : '▶'}
                  </button>
                </>
              ) : (
                <span className="nb-md-icon">M↓</span>
              )}
            </div>
            <div className="nb-cell-body">
              <div className="nb-cell-actions">
                <span className="nb-cell-lang">{cell.cell_type === 'code' ? kernelLabel : 'Text'}</span>
                <button type="button" title="Delete cell" onClick={() => deleteCell(cell.id)}>
                  🗑
                </button>
                <button type="button" title="Copy cell" onClick={() => duplicateCell(cell.id)}>
                  ⧉
                </button>
              </div>
              {cell.cell_type === 'markdown' ? (
                <textarea
                  className="nb-markdown-edit"
                  value={cell.source}
                  onChange={(e) => updateCell(cell.id, e.target.value)}
                  placeholder="Markdown"
                />
              ) : (
                <textarea
                  className="nb-code"
                  value={cell.source}
                  onChange={(e) => updateCell(cell.id, e.target.value)}
                  spellCheck={false}
                  placeholder="# code"
                />
              )}
              {cell.outputs?.map((out, oi) => (
                <pre key={oi} className="nb-output">
                  {out}
                </pre>
              ))}
            </div>
            <div className="nb-cell-index">{idx + 1}</div>
          </div>
        ))}
      </div>
      <div className="notebook-footer">
        <button type="button" onClick={() => addCell('code')}>
          + Code
        </button>
        <button type="button" onClick={() => addCell('markdown')}>
          + Text
        </button>
        <span className="muted genie-hint">Genie Code — not implemented</span>
      </div>
    </div>
  );
}
