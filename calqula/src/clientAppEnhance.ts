import { defineClientConfig } from '@vuepress/client'
import GraphContainer from './client/components/GraphContainer.vue'
import { useColorMode } from '@vueuse/core'
import { defineComponent, h } from 'vue'

export default defineClientConfig({
  enhance({ app }) {
    app.component(
      'GraphContainer',
      defineComponent({
        props: GraphContainer.props as Record<string, any>,
        setup(props: any, { attrs }: { attrs: any }) {
          const colorMode = useColorMode()
          const mode = colorMode.value
          return () =>
            h(GraphContainer, {
              ...attrs,
              theme: mode,
              config: props.config
            })
        }
      })
    )
  }
})
