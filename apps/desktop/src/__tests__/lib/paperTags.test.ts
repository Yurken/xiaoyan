import { describe, it, expect } from "vitest";
import {
  DEFAULT_PAPER_TAG_VISIBILITY,
  DEFAULT_PAPER_TAG_VISIBILITY_VALUE,
  parsePaperTagVisibility,
  serializePaperTagVisibility,
  togglePaperTagVisibility,
} from "../../lib/paperTags";

describe("paperTags 可见性纯函数", () => {
  describe("parsePaperTagVisibility", () => {
    it("null/undefined 视为从未配置，回退到全部默认项", () => {
      expect(parsePaperTagVisibility(null)).toEqual(
        new Set(DEFAULT_PAPER_TAG_VISIBILITY),
      );
      expect(parsePaperTagVisibility(undefined)).toEqual(
        new Set(DEFAULT_PAPER_TAG_VISIBILITY),
      );
    });

    it("空字符串表示用户主动清空所有标签", () => {
      expect(parsePaperTagVisibility("")).toEqual(new Set());
    });

    it("仅保留合法 key 并忽略未知项与空白", () => {
      const result = parsePaperTagVisibility(" ccf_rating , bogus, wos_indexes ");
      expect(result).toEqual(new Set(["ccf_rating", "wos_indexes"]));
    });
  });

  describe("serializePaperTagVisibility", () => {
    it("按默认顺序序列化，去重", () => {
      const value = serializePaperTagVisibility([
        "wos_indexes",
        "ccf_rating",
        "ccf_rating",
      ]);
      expect(value).toBe("ccf_rating,wos_indexes");
    });

    it("默认全集序列化等于 DEFAULT_PAPER_TAG_VISIBILITY_VALUE", () => {
      expect(serializePaperTagVisibility(DEFAULT_PAPER_TAG_VISIBILITY)).toBe(
        DEFAULT_PAPER_TAG_VISIBILITY_VALUE,
      );
    });
  });

  describe("togglePaperTagVisibility", () => {
    it("已存在则移除", () => {
      const next = togglePaperTagVisibility(
        "ccf_rating,wos_indexes",
        "ccf_rating",
      );
      expect(next).toBe("wos_indexes");
    });

    it("不存在则按默认顺序加入", () => {
      const next = togglePaperTagVisibility("wos_indexes", "ccf_rating");
      expect(next).toBe("ccf_rating,wos_indexes");
    });

    it("toggle 往返应可逆", () => {
      const start = "ccf_rating,wos_indexes";
      const once = togglePaperTagVisibility(start, "jcr_quartile");
      const twice = togglePaperTagVisibility(once, "jcr_quartile");
      expect(parsePaperTagVisibility(twice)).toEqual(
        parsePaperTagVisibility(start),
      );
    });
  });
});
