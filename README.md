# workspace-browser

**Databricks Workspace `/browse` 对标实现**，用于驱动 `workspace-service` 文件/目录能力联调，并输出后端改造清单。

不是简单 smoke UI：包含侧栏树、主列表、Create 菜单、Import/拖放、编辑器 Tab、Trash、拖拽移动、Git folder 创建等。

## 启动

```bash
# 1. 后端
cd ../workspace-service
go run ./cmd/server -config conf/workspace-service.yaml

# 2. 前端
npm install && npm run dev
```

http://localhost:5173

右下角 **Context** 可改 `owner_uin` / `uin` / `app_id` / `workspace_id`。

## 后端是否满足要求？

见 **`docs/BACKEND_GAP.md`** 与页面底部 **差距面板**（随操作更新 API 日志）。

### 一句话结论

- **DBX 式「文件工作区」MVP（浏览/CRUD/回收站/简单编辑）**：后端 **基本满足**。
- **生产级对齐 Databricks**：需补 **大文件 STS**、**CORS/BFF**、**全局搜索**、**t_file 业务树**、**ACL** 等（见 BACKEND_GAP P0/P1）。

## 结构

```
src/pages/BrowsePage.tsx      # 主界面
src/hooks/useWorkspaceBrowser.ts
src/components/               # 表、树、编辑器、差距面板
src/data/backendGaps.ts       # 差距数据（与 BACKEND_GAP.md 同步）
docs/BACKEND_GAP.md           # 给 workspace-service 的改造建议
```
