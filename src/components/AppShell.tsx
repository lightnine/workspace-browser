import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  userLabel: string;
  workspaceLabel: string;
  onGlobalSearch?: (q: string) => void;
}

const APP_NAV = [
  { id: 'workspace', label: 'Workspace', active: true },
  { id: 'recents', label: 'Recents', disabled: true },
  { id: 'catalog', label: 'Catalog', disabled: true },
  { id: 'jobs', label: 'Jobs & Pipelines', disabled: true },
  { id: 'compute', label: 'Compute', disabled: true },
];

export function AppShell({ children, userLabel, workspaceLabel, onGlobalSearch }: Props) {
  return (
    <div className="dbx-app">
      <header className="dbx-global-nav">
        <button type="button" className="nav-icon-btn" aria-label="Toggle navigation">
          ☰
        </button>
        <a className="dbx-logo-link" href="/">
          <span className="dbx-logo" />
          <span className="dbx-logo-text">Databricks</span>
        </a>
        <div className="dbx-global-search">
          <input
            type="search"
            placeholder="Search data, notebooks, recents, and more..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') onGlobalSearch?.((e.target as HTMLInputElement).value);
            }}
          />
          <span className="kbd">⌘ + P</span>
        </div>
        <div className="dbx-global-actions">
          <button type="button" className="ws-switcher">
            {workspaceLabel}
          </button>
          <button type="button" className="user-avatar" title={userLabel}>
            {userLabel.charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      <div className="dbx-frame">
        <nav className="dbx-app-nav" aria-label="Side Navigation">
          <button type="button" className="app-nav-new">
            + New
          </button>
          {APP_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`app-nav-item ${item.active ? 'active' : ''}`}
              disabled={item.disabled}
              title={item.disabled ? '未实现（对标 DBX）' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="dbx-page">{children}</div>
      </div>
    </div>
  );
}
