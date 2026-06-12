import { NotebookEditor } from './NotebookEditor';
import type { OpenTab, WorkspaceContext } from '../types';
import type { NotebookCell } from '../utils/notebook';
import type { NotebookKernelState } from '../types';

interface Props {
  ctx: WorkspaceContext;
  tabs: OpenTab[];
  activeTab: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onChange: (path: string, content: string) => void;
  onNotebookCells: (path: string, cells: NotebookCell[]) => void;
  onNotebookKernel: (path: string, patch: Partial<NotebookKernelState>) => void;
  onSave: (path: string) => void;
  fullHeight?: boolean;
}

export function FileEditorTabs({
  ctx,
  tabs,
  activeTab,
  onSelect,
  onClose,
  onChange,
  onNotebookCells,
  onNotebookKernel,
  onSave,
  fullHeight = false,
}: Props) {
  if (tabs.length === 0) return null;
  const current = tabs.find((t) => t.path === activeTab) ?? tabs[0];

  return (
    <section
      className={`editor-panel ${current.kind === 'notebook' ? 'editor-panel-notebook' : ''} ${fullHeight ? 'editor-panel-full' : ''}`}
    >
      <div className="tab-bar">
        {tabs.map((tab) => (
          <div key={tab.path} className={`tab ${tab.path === current.path ? 'active' : ''}`} role="tab">
            <button type="button" className="tab-title" onClick={() => onSelect(tab.path)}>
              {tab.kind === 'notebook' ? '📓 ' : ''}
              {tab.name}
              {tab.dirty ? ' •' : ''}
            </button>
            <button type="button" className="tab-close" onClick={() => onClose(tab.path)}>
              ×
            </button>
          </div>
        ))}
      </div>
      {current.kind === 'notebook' ? (
        current.loading ? (
          <p className="muted editor-loading">Loading notebook…</p>
        ) : (
          <NotebookEditor
            ctx={ctx}
            tab={current}
            onChangeCells={onNotebookCells}
            onKernelUpdate={onNotebookKernel}
            onSave={() => onSave(current.path)}
          />
        )
      ) : (
        <>
          <div className="editor-toolbar">
            <button type="button" onClick={() => onSave(current.path)} disabled={current.loading || !current.dirty}>
              Save
            </button>
            <span className="muted">{current.path}</span>
          </div>
          {current.loading ? (
            <p className="muted editor-loading">Loading…</p>
          ) : (
            <textarea
              className="editor"
              value={current.content}
              onChange={(e) => onChange(current.path, e.target.value)}
              spellCheck={false}
            />
          )}
        </>
      )}
    </section>
  );
}
