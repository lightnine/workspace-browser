import { useState } from 'react';
import type { FileEntry } from '../types';
import { entryIcon, entryTypeLabel, formatCreated } from '../utils/format';

export type RowAction =
  | 'open'
  | 'rename'
  | 'move'
  | 'copy'
  | 'delete'
  | 'download'
  | 'restore'
  | 'permanent-delete'
  | 'favorite';

interface Props {
  files: FileEntry[];
  view: 'workspace' | 'trash';
  selectedPaths: Set<string>;
  favorites: Set<string>;
  onSelectRow: (entry: FileEntry, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onOpen: (entry: FileEntry) => void;
  onAction: (action: RowAction, entry: FileEntry) => void;
  onDropMove?: (srcPath: string, destFolder: string) => void;
}

export function FileTable({
  files,
  view,
  selectedPaths,
  favorites,
  onSelectRow,
  onSelectAll,
  onOpen,
  onAction,
  onDropMove,
}: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const allSelected = files.length > 0 && files.every((f) => selectedPaths.has(f.path));

  return (
    <table className="dbx-table">
      <thead>
        <tr>
          <th className="col-check">
            <input
              type="checkbox"
              aria-label="Select all"
              checked={allSelected}
              onChange={(e) => onSelectAll(e.target.checked)}
            />
          </th>
          <th className="col-fav" aria-label="Favorite" />
          <th className="col-name">Name</th>
          <th className="col-type">Type</th>
          <th className="col-owner">Owner</th>
          <th className="col-created">Created at</th>
          <th className="col-actions" aria-label="actions" />
        </tr>
      </thead>
      <tbody>
        {files.length === 0 && (
          <tr>
            <td colSpan={7} className="empty-cell">
              This folder is empty
            </td>
          </tr>
        )}
        {files.map((entry) => {
          const icon = entryIcon(entry);
          const isFav = favorites.has(entry.path);
          const isGit = entry.is_git_folder || entry.node_type === 'git_folder';
          return (
            <tr
              key={entry.path}
              className={selectedPaths.has(entry.path) ? 'selected' : ''}
              draggable={view === 'workspace'}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', entry.path);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (entry.is_dir) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const src = e.dataTransfer.getData('text/plain');
                if (src && entry.is_dir && onDropMove) onDropMove(src, entry.path);
              }}
              onDoubleClick={() => onOpen(entry)}
            >
              <td className="col-check">
                <input
                  type="checkbox"
                  aria-label={`Select row for ${entry.name}`}
                  checked={selectedPaths.has(entry.path)}
                  onChange={(e) => onSelectRow(entry, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              <td className="col-fav">
                <button
                  type="button"
                  className={`fav-btn ${isFav ? 'on' : ''}`}
                  aria-label="Favorite"
                  title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction('favorite', entry);
                  }}
                >
                  {isFav ? '★' : '☆'}
                </button>
              </td>
              <td className="col-name">
                <span className={`row-icon icon-${icon}`} />
                <button
                  type="button"
                  className="linkish name-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(entry);
                  }}
                >
                  {entry.name}
                </button>
                {isGit && (
                  <span className="git-branch-badge" title="Git branch">
                    main
                  </span>
                )}
                {isGit && (
                  <button type="button" className="git-editor-link" title="Open in Git folder editor">
                    Git editor
                  </button>
                )}
              </td>
              <td className="col-type">{entryTypeLabel(entry)}</td>
              <td className="col-owner">{entry.owner_uin || entry.creator_uin || '—'}</td>
              <td className="col-created">{formatCreated(entry.modify_time)}</td>
              <td className="col-actions kebab-cell">
                <button
                  type="button"
                  className="overflow-btn"
                  aria-label="Overflow actions"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenu(openMenu === entry.path ? null : entry.path);
                  }}
                >
                  ⋯
                </button>
                {openMenu === entry.path && (
                  <>
                    <button
                      type="button"
                      className="menu-backdrop"
                      aria-label="Close menu"
                      onClick={() => setOpenMenu(null)}
                    />
                    <menu className="overflow-menu">
                      <button type="button" onClick={() => { onAction('open', entry); setOpenMenu(null); }}>
                        Open in new browser tab
                      </button>
                      <button type="button" disabled title="后端缺失">
                        View details
                      </button>
                      <button type="button" disabled title="后端缺失">
                        Copy URL/path
                      </button>
                      <hr />
                      {view === 'workspace' && (
                        <>
                          <button type="button" onClick={() => { onAction('rename', entry); setOpenMenu(null); }}>
                            Rename
                          </button>
                          <button type="button" onClick={() => { onAction('move', entry); setOpenMenu(null); }}>
                            Move
                          </button>
                          <button type="button" onClick={() => { onAction('copy', entry); setOpenMenu(null); }}>
                            Clone
                          </button>
                          <hr />
                          {!entry.is_dir && (
                            <button type="button" onClick={() => { onAction('download', entry); setOpenMenu(null); }}>
                              Download as
                            </button>
                          )}
                          <hr />
                          <button type="button" disabled title="后端缺失 ACL API">
                            Share (Permissions)
                          </button>
                          <button type="button" onClick={() => { onAction('favorite', entry); setOpenMenu(null); }}>
                            {isFav ? 'Remove from favorites' : 'Add to favorites'}
                          </button>
                          <hr />
                          <button
                            type="button"
                            className="danger"
                            onClick={() => { onAction('delete', entry); setOpenMenu(null); }}
                          >
                            Move this {entry.is_dir ? 'folder' : 'file'} to Trash
                          </button>
                        </>
                      )}
                      {view === 'trash' && (
                        <>
                          <button type="button" onClick={() => { onAction('restore', entry); setOpenMenu(null); }}>
                            Restore
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => { onAction('permanent-delete', entry); setOpenMenu(null); }}
                          >
                            Delete permanently
                          </button>
                        </>
                      )}
                    </menu>
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
