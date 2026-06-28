# 自动化测试指南

## 测试架构

本项目采用两层测试策略：

### 1. 组件测试 (Vitest + React Testing Library)

**位置**: `apps/desktop/src/__tests__/`

**运行方式**:
```bash
cd apps/desktop
pnpm test           # 运行所有测试
pnpm test:watch     # 监听模式
pnpm test:coverage  # 生成覆盖率报告
```

**测试范围**:
- 页面渲染和状态展示
- 用户交互（点击、输入、切换）
- 路由导航
- 组件生命周期

### 2. E2E 测试 (Playwright)

**位置**: `apps/desktop/e2e/`

**运行方式**:
```bash
cd apps/desktop
pnpm test:e2e       # 运行 E2E 测试
pnpm test:e2e:ui    # 打开 Playwright UI
```

**测试范围**:
- 完整用户流程
- 页面导航
- 功能交互

## 测试文件结构

```
apps/desktop/
├── vitest.config.ts              # Vitest 配置
├── playwright.config.ts          # Playwright 配置
├── src/__tests__/
│   ├── setup.ts                  # 测试环境设置和 Mock
│   ├── mocks/
│   │   └── tauri.ts              # Tauri API Mock 工具
│   ├── helpers/
│   │   ├── render.tsx            # 测试渲染工具
│   │   └── router.tsx            # 路由测试工具
│   ├── components/
│   │   ├── CcfBadges.test.tsx    # CCF 标签组件测试
│   │   └── CollapsibleGroup.test.tsx
│   ├── hooks/
│   │   ├── useClickOutside.test.ts
│   │   └── usePersistentStringState.test.ts
│   └── pages/
│       ├── App.test.tsx          # 路由和导航测试
│       ├── Home.test.tsx         # 首页测试
│       ├── Tools.test.tsx        # 工具页测试
│       ├── Experiment.test.tsx   # 实验记录测试
│       ├── Papers.test.tsx       # 论文库测试
│       ├── Copilot.test.tsx      # 对话页测试
│       ├── Knowledge.test.tsx    # 知识库测试
│       ├── Submission.test.tsx   # 投稿管理测试
│       ├── Writing.test.tsx      # 写作页测试
│       ├── Survey.test.tsx       # 综述页测试
│       └── Planner.test.tsx      # 规划页测试
└── e2e/
    ├── helpers/
    │   └── mock-tauri.ts         # E2E Tauri Mock
    ├── navigation.spec.ts        # 导航测试
    ├── pages.spec.ts             # 页面渲染测试
    └── features.spec.ts          # 功能交互测试
```

## Mock 策略

### Tauri API Mock

所有 Tauri API 调用都被 Mock：
- `@tauri-apps/api/core` - invoke 函数
- `@tauri-apps/api/event` - 事件监听
- `@tauri-apps/plugin-*` - 各插件

### 组件 Mock

对于复杂的子组件，使用简化 Mock：
- 只渲染必要的 UI 元素
- 通过 data-testid 标识
- 保留父组件的测试逻辑

## 编写新测试

### 1. 创建页面测试

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../helpers/render";
import YourPage from "../../pages/YourPage";

// Mock 依赖
vi.mock("../../features/your-feature/Component", () => ({
  default: () => <div data-testid="mock-component">Mock</div>,
}));

describe("YourPage 页面", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("应渲染页面标题", () => {
    renderWithRouter(<YourPage />);
    expect(screen.getByText("标题")).toBeInTheDocument();
  });
});
```

### 2. 创建组件测试

```typescript
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "../helpers/render";
import YourComponent from "../../components/YourComponent";

describe("YourComponent 组件", () => {
  it("应渲染内容", () => {
    render(<YourComponent prop="value" />);
    expect(screen.getByText("内容")).toBeInTheDocument();
  });

  it("应响应交互", () => {
    const onClick = vi.fn();
    render(<YourComponent onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });
});
```

## 最佳实践

1. **测试用户可见行为**，不测试实现细节
2. **使用 data-testid** 标识需要查询的元素
3. **Mock 外部依赖**，但保留组件间的真实交互
4. **每个测试独立**，不依赖其他测试的状态
5. **使用 waitFor** 处理异步操作

## 故障排查

### 测试超时
- 检查是否有未 Mock 的异步操作
- 增加 `test.timeout` 配置

### 找不到元素
- 检查 Mock 是否正确
- 使用 `screen.debug()` 查看 DOM

### 类型错误
- 运行 `pnpm type-check` 检查类型
- 确保 Mock 的类型与实际组件一致
