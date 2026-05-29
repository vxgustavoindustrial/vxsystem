import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Legacy integrations retain visible typing warnings while new workflow code stays strict.
    files: [
      'src/app/agency/ai-agent/page.tsx',
      'src/app/client/social/page.tsx',
      'src/app/client/traffic/**/*.tsx',
      'src/components/modules/AgencyApprovalsTab.tsx',
      'src/modules/traffic/**/*.{ts,tsx}',
      'src/services/automation.service.ts',
      'src/services/supabase.ts',
      'src/types/traffic.types.ts',
      'supabase/functions/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
])
