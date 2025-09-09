import type { PluginWithOptions } from 'markdown-it'

import type { MarkdownCalqulaPluginOptions } from './options.js'

export const graphViz: PluginWithOptions<MarkdownCalqulaPluginOptions> = (
  md,
  options = {}
) => {}
