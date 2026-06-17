# entry/libs

预编译的 Rust NAPI 原生库放在这里，按 ABI 分目录：

```
entry/libs/
├── arm64-v8a/libxiaoyanbridge.so      # 真机（鸿蒙电脑 / 平板，arm64）
└── x86_64/libxiaoyanbridge.so         # 模拟器（如适用）
```

由 `apps/harmony/native/` 通过 `ohrs build` 构建后拷入，详见 `apps/harmony/README.md`。
`.so` 文件本身不入库（见 `.gitignore`）。
