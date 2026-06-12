import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tsParser from '@typescript-eslint/parser'
import tsEslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parser: tsParser,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      '@typescript-eslint': tsEslint.plugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // ── TypeScript 推荐规则 ──
      // 禁止使用 any 类型（允许 unknown）
      '@typescript-eslint/no-explicit-any': 'warn',
      // 禁止未使用的变量（以下划线开头可忽略）
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // 禁止非空断言
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // 禁止空函数（回调占位除外）
      '@typescript-eslint/no-empty-function': ['warn', {
        allow: ['arrowFunctions'],
      }],
      // 要求函数返回类型一致（不强制显式标注）
      '@typescript-eslint/consistent-type-imports': ['warn', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
    },
  },
])
