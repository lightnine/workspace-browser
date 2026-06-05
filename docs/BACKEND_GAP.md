# workspace-service 后端差距分析

> 由 `workspace-browser`（Databricks Workspace `/browse` 对标实现）驱动验证。  
> 参考：[Databricks Workspace browser](https://docs.databricks.com/aws/en/workspace/workspace-browser)、[Manage workspace objects](https://learn.microsoft.com/en-us/azure/databricks/workspace/workspace-objects)

## 目标

在本地用 **接近 Databricks 的 Workspace 文件浏览 UI** 走通真实后端，明确 **哪些能力已满足、哪些需要改 workspace-service**。

## Databricks Workspace 实测结构（leondli@tencent.com / databricks-test）

对照 live UI（`/browse`）记录，与早期简化版差异很大：

| 区域 | Databricks 实测 |
|------|-----------------|
| 全局顶栏 | Logo、⌘+P 全局搜索、workspace 切换、用户头像 |
| 应用侧栏 | New、Workspace、Recents、Catalog、Jobs、Compute、SQL、AI/ML… |
| Workspace 内树 | Home、Shared with me、Workspace、Favorites、Trash |
| 主区顶栏 | 面包屑 `Workspace › Users › {email}`、文件夹标题 + Favorite |
| 操作按钮 | Share、Create（分组菜单）、文件夹内 Search |
| 表头筛选 | Type、Owner、Last modified |
| 表列 | Checkbox、Favorite ☆、Name（含 Git branch badge）、Type、Owner、Created at、⋯ |
| 行 ⋯ 菜单 | Open in new tab、View details、Rename、Move、Clone、Import、Share、Favorite、Move to Trash |
| Create 菜单 | Folder/Git folder \| Notebook、File、Query、Dashboard… \| Pipeline、Alert… |
| 对象类型 | Notebook、Query、Git folder（branch + Git editor）、Folder、File |

## 本前端已实现（对标 DBX 2026-03 实测）

- **壳层**：深色顶栏 + 应用侧栏 + Workspace 双栏（内树 + 主区）
- **内树**：Home / Shared / Workspace / Favorites / Trash
- **主区**：面包屑、文件夹标题 + Favorite、Share（占位）、Create 分组菜单
- **筛选**：文件夹 Search、Type、Owner（Last modified 占位）
- **表格**：Checkbox、Favorite、Name（Git badge）、Type、Owner、Created at、Overflow 菜单
- **文件能力**：Folder / File / Git folder、Import 拖放、Rename/Move/Clone/Trash
- **Favorites**：localStorage（待 Favorite API）
- **差距面板**：可折叠，驱动 BACKEND_GAP 验证

## workspace-service 结论

### 已满足（无需改 API 即可支撑 DBX 浏览 MVP）

| 能力 | API |
|------|-----|
| 列目录 | `ListFiles` |
| 面包屑 | `GetFolderNodePath` |
| 建目录/文件 | `CreateFolder`, `CreateFile` |
| 读写信令 | `ReadFile`, `WriteFile` |
| 重命名/移动/复制 | `RenamePath`, `MovePath`, `CopyPath` |
| 软删与回收站 | `DeletePath(soft_delete)`, `ListRecycleBin`, `RestorePath`, `EmptyRecycleBin` |
| 路径冲突 | `ValidatePath` |
| Git 目录 | `CreateGitFolder`, `GetGitFolderStatus` |
| 下载 | `DownloadFile`（小文件） |

### 需要修改 / 新增（按优先级）

#### P0 — 不做会卡住生产化前端

1. **大文件上传/下载**
   - 现状：`CreateFile`/`ReadFile` base64 内联，infra 约 32MB 读上限；CAPI 约 10MB。
   - 改造：实现架构文档中的 `InitUpload` / `CompleteUpload` / `GetDownloadURL`（STS + COS），与 CAPI 对齐。
   - 前端表现：Import >10MB 直接报错（已在 UI 中验证）。

2. **CORS 或 BFF**
   - 现状：无 CORS 中间件；生产前端不能依赖 Vite proxy。
   - 改造：`internal/adapter/http/middleware/cors.go` 或可配置 `allowed_origins`，或由网关统一转发 Verb+Noun。

3. **Git 克隆进度**
   - 现状：异步克隆，仅 `GetGitFolderStatus` 轮询。
   - 改造：可选 SSE/WebSocket 推送 status；或文档约定轮询间隔 + 超时。

#### P1 — 对齐 Databricks 体验

4. **全局搜索** — `SearchFiles` 或查询业务 `t_file` 索引。

5. **业务文件树 / 多对象类型** — Notebook、Query 等不是 POSIX 文件；需 `t_file` + `file_type`，`ListFiles` 返回业务类型与 `file_id`。

6. **文件夹 ACL / Share** — 新表 + `SharePath` API。

7. **回收站 TTL** — `deleted_at` + 定时清理（DBX 30 天）。

8. **写冲突** — `WriteFile` 支持 `expected_mtime` 或 ETag。

#### P2 — 增强

9. **批量操作** — `BatchDelete` / `BatchMove`。

10. **侧栏树优化** — `ListFiles?tree_depth=2` 减少往返。

11. **`.ipynb` 结构化** — 专用 Notebook CRUD，而非纯文本 WriteFile。

## 本地运行

```bash
# 终端 1
cd workspace-service && go run ./cmd/server -config conf/workspace-service.yaml

# 终端 2
cd workspace-browser && npm run dev
```

打开 http://localhost:5173 ，用 UI 操作后查看页面底部 **差距面板** 与 **API 调用日志**。

## 建议改造顺序（workspace-service）

1. CORS（或确认只走网关）
2. 大文件 STS 上传/下载 API
3. `t_file` 业务树接入 `ListFiles` 响应
4. Search + ACL
5. 批量与 Notebook 专用接口
