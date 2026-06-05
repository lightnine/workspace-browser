import type { OpenTab } from '../types';

interface Props {
  tabs: OpenTab[];
  activeTab: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onChange: (path: string, content: string) => void;
  onSave: (path: string) => void;
}

export function FileEditorTabs({ tabs, activeTab, onSelect, onClose, onChange, onSave }: Props) {
  if (tabs.length === 0) return null;
  const current = tabs.find((t) => t.path === activeTab) ?? tabs[0];

  return (
    <section className="editor-panel">
      <div className="tab-bar">
        {tabs.map((tab) => (
          <div
            key={tab.path}
            className={`tab ${tab.path === current.path ? 'active' : ''}`}
            role="tab"
          >
            <button type="button" className="tab-title" onClick={() => onSelect(tab.path)}>
              {tab.name}
              {tab.dirty ? ' •' : ''}
            </button>
            <button type="button" className="tab-close" onClick={() => onClose(tab.path)}>
              ×
            </button>
          </div>
        ))}
      </div>
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
    </section>
  );
}
