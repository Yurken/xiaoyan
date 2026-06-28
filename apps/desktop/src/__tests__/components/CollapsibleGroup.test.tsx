import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../helpers/render";
import CollapsibleGroup from "../../components/CollapsibleGroup";

describe("CollapsibleGroup 组件", () => {
  it("应渲染标题", () => {
    render(
      <CollapsibleGroup title="测试分组">
        <div>子内容</div>
      </CollapsibleGroup>,
    );
    expect(screen.getByText("测试分组")).toBeInTheDocument();
  });

  it("应渲染子内容", () => {
    render(
      <CollapsibleGroup title="测试分组">
        <div>子内容</div>
      </CollapsibleGroup>,
    );
    expect(screen.getByText("子内容")).toBeInTheDocument();
  });

  it("应显示计数标签", () => {
    render(
      <CollapsibleGroup title="测试分组" countLabel="5 项">
        <div>子内容</div>
      </CollapsibleGroup>,
    );
    expect(screen.getByText("5 项")).toBeInTheDocument();
  });

  it("应显示副标题", () => {
    render(
      <CollapsibleGroup title="测试分组" subtitle="这是副标题">
        <div>子内容</div>
      </CollapsibleGroup>,
    );
    expect(screen.getByText("这是副标题")).toBeInTheDocument();
  });

  it("点击标题应折叠/展开", () => {
    render(
      <CollapsibleGroup title="测试分组" defaultOpen={true}>
        <div>子内容</div>
      </CollapsibleGroup>,
    );
    expect(screen.getByText("子内容")).toBeInTheDocument();

    fireEvent.click(screen.getByText("测试分组"));
    expect(screen.queryByText("子内容")).not.toBeInTheDocument();
  });

  it("初始折叠时不应显示子内容", () => {
    render(
      <CollapsibleGroup title="测试分组" defaultOpen={false}>
        <div>子内容</div>
      </CollapsibleGroup>,
    );
    expect(screen.queryByText("子内容")).not.toBeInTheDocument();
  });

  it("应渲染操作按钮", () => {
    const action = vi.fn();
    render(
      <CollapsibleGroup
        title="测试分组"
        actions={<button onClick={action}>操作</button>}
      >
        <div>子内容</div>
      </CollapsibleGroup>,
    );
    expect(screen.getByText("操作")).toBeInTheDocument();
    fireEvent.click(screen.getByText("操作"));
    expect(action).toHaveBeenCalled();
  });
});
