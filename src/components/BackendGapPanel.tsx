import type { FileEntry } from '../types';
import { BACKEND_GAPS } from '../data/backendGaps';

interface Props {
  apiLog: string[];
  selected: FileEntry | null;
}

export function BackendGapPanel({ apiLog, selected }: Props) {
  return (
    <section className="gap-panel">
      <h3>workspace-service 差距（由本 UI 驱动验证）</h3>
      <p className="muted">
        对照 Databricks{' '}
        <a href="https://docs.databricks.com/aws/en/workspace/workspace-browser" target="_blank" rel="noreferrer">
          Workspace browser
        </a>
        。差距项维护在 <code>src/data/backendGaps.ts</code>。
      </p>
      <table className="gap-table">
        <thead>
          <tr>
            <th>UI 能力</th>
            <th>后端</th>
            <th>改造建议</th>
          </tr>
        </thead>
        <tbody>
          {BACKEND_GAPS.map((g) => (
            <tr key={g.id}>
              <td>{g.ui}</td>
              <td>
                <span className={`tag tag-${g.status}`}>{g.status}</span>
              </td>
              <td>
                <div>{g.backendChange}</div>
                {g.api && <code className="api">{g.api}</code>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="gap-side">
        <div>
          <h4>最近 API 调用</h4>
          <ul className="api-log">
            {apiLog.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        {selected && (
          <div>
            <h4>选中项元数据</h4>
            <pre className="meta-json">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        )}
      </div>
    </section>
  );
}
