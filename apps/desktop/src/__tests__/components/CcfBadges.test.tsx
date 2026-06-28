import { describe, it, expect } from "vitest";
import { render, screen } from "../helpers/render";
import {
  CcfRatingBadge,
  VenueTypeBadge,
  WosIndexBadge,
  JcrQuartileBadge,
  CasQuartileBadge,
  CasTopBadge,
  ccfRatingVariant,
  ccfTypeLabel,
} from "../../components/CcfBadges";

describe("CcfBadges 纯函数", () => {
  it("ccfRatingVariant 应映射等级到样式变体", () => {
    expect(ccfRatingVariant("A")).toBe("success");
    expect(ccfRatingVariant("B")).toBe("info");
    expect(ccfRatingVariant("C")).toBe("warning");
    expect(ccfRatingVariant("X")).toBe("default");
    expect(ccfRatingVariant(undefined)).toBe("default");
  });

  it("ccfTypeLabel 应映射来源类型到中文标签", () => {
    expect(ccfTypeLabel("journal")).toBe("期刊");
    expect(ccfTypeLabel("conference")).toBe("会议");
    expect(ccfTypeLabel("other")).toBe("");
    expect(ccfTypeLabel(undefined)).toBe("");
  });
});

describe("CcfBadges 组件", () => {
  it("应渲染 CCF 等级标签（带 CCF 前缀）", () => {
    render(<CcfRatingBadge rating="A" />);
    expect(screen.getByText("CCF A")).toBeInTheDocument();
  });

  it("应渲染不同 CCF 等级", () => {
    const { rerender } = render(<CcfRatingBadge rating="A" />);
    expect(screen.getByText("CCF A")).toBeInTheDocument();

    rerender(<CcfRatingBadge rating="B" />);
    expect(screen.getByText("CCF B")).toBeInTheDocument();

    rerender(<CcfRatingBadge rating="C" />);
    expect(screen.getByText("CCF C")).toBeInTheDocument();
  });

  it("应渲染会议类型标签", () => {
    render(<VenueTypeBadge type="conference" />);
    expect(screen.getByText("会议")).toBeInTheDocument();
  });

  it("应渲染期刊类型标签", () => {
    render(<VenueTypeBadge type="journal" />);
    expect(screen.getByText("期刊")).toBeInTheDocument();
  });

  it("应渲染 WoS 索引标签", () => {
    render(<WosIndexBadge index="SCI" />);
    expect(screen.getByText("SCI")).toBeInTheDocument();
  });

  it("应渲染 JCR 分区标签", () => {
    render(<JcrQuartileBadge quartile="Q1" />);
    expect(screen.getByText("JCR Q1")).toBeInTheDocument();
  });

  it("应渲染中科院分区标签", () => {
    render(<CasQuartileBadge quartile="1" />);
    expect(screen.getByText("中科院 1区")).toBeInTheDocument();
  });

  it("应渲染中科院 Top 标签", () => {
    render(<CasTopBadge top />);
    expect(screen.getByText("Top")).toBeInTheDocument();
  });

  it("无数据时不应渲染", () => {
    expect(render(<CcfRatingBadge rating="" />).container.firstChild).toBeNull();
    expect(render(<VenueTypeBadge type="" />).container.firstChild).toBeNull();
    expect(render(<WosIndexBadge index="" />).container.firstChild).toBeNull();
    expect(render(<JcrQuartileBadge quartile="" />).container.firstChild).toBeNull();
    expect(render(<CasQuartileBadge quartile="" />).container.firstChild).toBeNull();
    expect(render(<CasTopBadge top={false} />).container.firstChild).toBeNull();
  });
});
