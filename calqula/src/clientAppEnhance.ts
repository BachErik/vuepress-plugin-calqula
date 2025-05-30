import { defineClientConfig } from '@vuepress/client';
import GraphContainer from './client/components/GraphContainer.vue';

export default defineClientConfig({
  enhance({ app }) {
    app.component('GraphContainer', GraphContainer);
  },
});
