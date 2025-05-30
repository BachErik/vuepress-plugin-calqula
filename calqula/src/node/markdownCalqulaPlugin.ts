import { getDirname, path } from '@vuepress/utils';
import type { Plugin } from '@vuepress/core';
import type { MarkdownEnv } from '@vuepress/markdown';
import type { MarkdownItContainerOptions } from '@mdit/plugin-container';
import { container } from '@mdit/plugin-container';
import { cleanMarkdownEnv } from './cleanMarkdownEnv.js';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';

const __dirname = import.meta.dirname || getDirname(import.meta.url);

export const markdownCalqulaPlugin = (): Plugin => {
  return {
    name: 'vuepress-plugin-calqula',
    extendsMarkdown: (md, app) => {
      md.block.ruler.before(
        'fence',
        'graph-block',
        (state: StateBlock, startLine, endLine, silent) => {
          const startPos = state.bMarks[startLine] + state.tShift[startLine];
          const lineText = state.src.slice(startPos, state.eMarks[startLine]);
          if (!/^::: *graph *$/.test(lineText)) return false;
          // find closing :::
          let nextLine = startLine + 1;
          let content = '';
          while (nextLine < endLine) {
            const text = state.src.slice(
              state.bMarks[nextLine] + state.tShift[nextLine],
              state.eMarks[nextLine],
            );
            if (/^::: *$/.test(text)) break;
            content += text + '\n';
            nextLine++;
          }
          if (nextLine >= endLine) return false;
          if (!silent) {
            const token = state.push('html_block', '', 0);
            token.content = `<GraphContainer :config='${content.trim()}' />\n`;
          }
          state.line = nextLine + 1;
          return true;
        },
      );
    },
    clientConfigFile: path.resolve(__dirname, '../src/clientAppEnhance.ts'),
  };
};

export default markdownCalqulaPlugin;
