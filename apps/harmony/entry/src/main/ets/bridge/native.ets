/**
 * 原生后端导入的唯一入口（隔离层）。
 *
 * 所有对 Rust NAPI .so 的依赖都收口在这里，上层只依赖本文件，
 * 便于：①统一类型；②未来切换实现/做降级；③缩小 .so 缺失时的爆炸半径。
 *
 * 运行前需先用 ohrs 构建 native/ 并把 libxiaoyanbridge.so 放到 entry/libs/<abi>/，
 * 构建步骤见 apps/harmony/README.md。
 */
export {
  sourceLookup,
  ccfLookup,
  ccfList,
  journalLookup,
  journalRankFilter,
  invoke as nativeInvoke,
} from 'libxiaoyanbridge.so';
