import { getDirname, path } from '@vuepress/utils'
import type { Plugin } from '@vuepress/core'
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs'

const __dirname = getDirname(import.meta.url)

export const markdownCalqulaPlugin = (): Plugin => {
  return {
    name: 'vuepress-plugin-calqula',
    extendsMarkdown: (md, app) => {
      md.block.ruler.before(
        'fence',
        'graph-block',
        (state: StateBlock, startLine, endLine, silent) => {
          const bMark = state.bMarks[startLine]
          const tShift = state.tShift[startLine]
          const eMark = state.eMarks[startLine]
          if (
            bMark === undefined ||
            tShift === undefined ||
            eMark === undefined
          )
            return false
          const startPos = bMark + tShift
          const lineText = state.src.slice(startPos, eMark)
          if (!/^::: *graph *$/.test(lineText)) return false
          // find closing :::
          let nextLine = startLine + 1
          let content = ''
          while (nextLine < endLine) {
            const b = state.bMarks[nextLine]
            const t = state.tShift[nextLine]
            const e = state.eMarks[nextLine]
            if (b === undefined || t === undefined || e === undefined) break
            const text = state.src.slice(b + t, e)
            if (/^::: *$/.test(text)) break
            content += text + '\n'
            nextLine++
          }
          if (nextLine >= endLine) return false
          if (!silent) {
            const token = state.push('html_block', '', 0)
            token.content = `<GraphContainer :config='${content.trim()}' />\n`
          }
          state.line = nextLine + 1
          return true
        }
      )
    },
    clientConfigFile: path.resolve(__dirname, '../src/clientAppEnhance.ts')
  }
}

export default markdownCalqulaPlugin
