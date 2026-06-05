export type GapStatus = 'ok' | 'partial' | 'missing';

export interface BackendGap {
  id: string;
  ui: string;
  status: GapStatus;
  api?: string;
  backendChange: string;
}

/** Gaps discovered while implementing Databricks-like workspace-browser */
export const BACKEND_GAPS: BackendGap[] = [
  {
    id: 'shell',
    ui: '全局顶栏 + 应用侧栏（Workspace/Recents/Catalog…）',
    status: 'partial',
    backendChange: 'UI 已对标 DBX 壳；Recents/Catalog 等需各自后端服务，非 workspace-service 范围',
  },
  {
    id: 'ws-tree',
    ui: 'Workspace 内树：Home / Shared / Favorites / Trash',
    status: 'partial',
    backendChange: 'Home/Trash OK；Shared 需 ACL；Favorites 当前仅 localStorage，需 Favorite API',
  },
  {
    id: 'browse',
    ui: '面包屑 Workspace › Users › … + 表头筛选 Type/Owner',
    status: 'ok',
    api: 'ListFiles, GetFolderNodePath',
    backendChange: '已满足；Last modified 筛选缺独立 created_at 字段',
  },
  {
    id: 'crud',
    ui: 'Create Folder/File、Rename、Move、Copy、Delete',
    status: 'ok',
    api: 'CreateFolder, CreateFile, RenamePath, MovePath, CopyPath, DeletePath',
    backendChange: '已满足',
  },
  {
    id: 'trash',
    ui: 'Trash / Restore / Empty',
    status: 'ok',
    api: 'ListRecycleBin, RestorePath, EmptyRecycleBin',
    backendChange: '已满足（无 30 天 TTL 字段，产品层可补）',
  },
  {
    id: 'editor',
    ui: '文件 Tab 编辑 + Save',
    status: 'partial',
    api: 'ReadFile, WriteFile',
    backendChange: '文本 OK；缺 ETag/版本冲突检测；Notebook(.ipynb) 无结构化 API',
  },
  {
    id: 'import',
    ui: 'Import / 拖放上传',
    status: 'partial',
    api: 'CreateFile (base64)',
    backendChange: 'P0: >10MB 需 InitUpload/CompleteUpload + STS；CAPI 与 Read 限制应对齐 ~10MB',
  },
  {
    id: 'download',
    ui: 'Download',
    status: 'partial',
    api: 'DownloadFile',
    backendChange: '大文件应返回签名 URL 而非 inline octet-stream；与 ReadFile 限制一致',
  },
  {
    id: 'git',
    ui: 'Git folder 创建 + 状态',
    status: 'partial',
    api: 'CreateGitFolder, GetGitFolderStatus',
    backendChange: '有 API；缺 WebSocket/SSE 推送克隆进度；UI 需轮询 status',
  },
  {
    id: 'search',
    ui: '全局搜索',
    status: 'missing',
    backendChange: 'P1: SearchFiles(path_prefix, query) 或对接业务 t_file 索引',
  },
  {
    id: 'acl',
    ui: 'Share / 文件夹权限',
    status: 'missing',
    backendChange: 'P1: 权限模型 + ShareFolder API（DBX workspace-objects ACL）',
  },
  {
    id: 'notebook',
    ui: 'Create Notebook（.ipynb + node_type=notebook）',
    status: 'ok',
    api: 'CreateNotebook',
    backendChange: '已满足：写入 nbformat v4 模板并记录 file_node.node_type=notebook',
  },
  {
    id: 'types',
    ui: 'Query / Dashboard 等多对象类型 + ide_code_file 业务树',
    status: 'missing',
    backendChange: 'P1: 业务 t_file 树 + file_type；Query 等仍需 ide_code_file 集成',
  },
  {
    id: 'cors',
    ui: '生产环境前端直连',
    status: 'missing',
    backendChange: 'P0: CORS 或统一 BFF；本地靠 Vite proxy',
  },
  {
    id: 'batch',
    ui: '多选批量删除/移动',
    status: 'missing',
    backendChange: 'P2: BatchDelete/BatchMove 或事务包装',
  },
];
