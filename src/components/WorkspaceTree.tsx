export type WorkspaceTreeView = 'home' | 'shared' | 'workspace' | 'favorites' | 'trash';

interface Props {
  active: WorkspaceTreeView;
  onSelect: (view: WorkspaceTreeView) => void;
}

const ITEMS: { id: WorkspaceTreeView; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'shared', label: 'Shared with me', icon: 'shared' },
  { id: 'workspace', label: 'Workspace', icon: 'workspace' },
  { id: 'favorites', label: 'Favorites', icon: 'favorite' },
  { id: 'trash', label: 'Trash', icon: 'trash' },
];

export function WorkspaceTree({ active, onSelect }: Props) {
  return (
    <nav className="dbx-ws-tree" aria-label="Workspace tree">
      <div className="dbx-ws-tree-title">Workspace</div>
      <ul>
        {ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`ws-tree-item ${active === item.id ? 'active' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <span className={`ws-icon ws-icon-${item.icon}`} />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
