interface Props {
  onCreate: (kind: 'folder' | 'file' | 'git' | 'notebook' | 'query') => void;
}

export function CreateMenu({ onCreate }: Props) {
  return (
    <div className="create-split">
      <button type="button" className="primary create-trigger">
        Create ▾
      </button>
      <div className="create-menu" role="menu">
        <div className="create-section">
          <button type="button" onClick={() => onCreate('folder')}>
            Folder
          </button>
          <button type="button" onClick={() => onCreate('git')}>
            Git folder
          </button>
        </div>
        <div className="create-divider" />
        <div className="create-section">
          <button type="button" onClick={() => onCreate('notebook')}>
            Notebook
          </button>
          <button type="button" onClick={() => onCreate('file')}>
            File
          </button>
          <button type="button" className="disabled-gap" onClick={() => onCreate('query')}>
            Query
            <span className="gap-hint">需 t_file</span>
          </button>
        </div>
      </div>
    </div>
  );
}
