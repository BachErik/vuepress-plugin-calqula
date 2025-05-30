import { getDirname, path } from '@vuepress/utils';
import type { Plugin } from '@vuepress/core';
import type { MarkdownEnv } from '@vuepress/markdown';
import type { MarkdownItContainerOptions } from '@mdit/plugin-container';
import { container } from '@mdit/plugin-container';
import { cleanMarkdownEnv } from './cleanMarkdownEnv.js';

const __dirname = import.meta.dirname || getDirname(import.meta.url);

export const markdownCalqulaPlugin = (): Plugin => {
  return {
    name: 'vuepress-plugin-calqula',
    extendsMarkdown: (md, app) => {
      md.use<MarkdownItContainerOptions>(container, {
        name: 'graph',
        openRender: () => "<GraphContainer config='",
        closeRender: () => "' />",
      });
    },
    clientConfigFile: path.resolve(__dirname, '../clientAppEnhance.ts'),
  };
};

export default markdownCalqulaPlugin;
