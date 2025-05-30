import checker from 'vite-plugin-checker';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    checker({
      typescript: true,
    }),
    nodePolyfills({
      // Options (if needed):
      // To add only specific polyfills, add them here.
      // If no option is passed, adds all polyfills.
      //include: ['path'], // You might want to be specific
      // To polyfill `node:` protocol imports.
      protocolImports: true,
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/node/index.ts'),
      name: 'VuepressPluginCalqula',
      fileName: (format) => `calqula.${format}.js`,
    },
    rollupOptions: {
      external: [
        'vue',
        '@vuepress/client',
        '@mdit/plugin-container',
        '@vueuse/core',
        '@vuepress/helper',
        '@vuepress/core',
        '@vuepress/client',
        '@vuepress/utils',
        '@vuepress/markdown',
      ],
      output: {
        globals: {
          vue: 'Vue',
          '@vuepress/client': 'VuePressClient',
        },
      },
    },
  },
});
