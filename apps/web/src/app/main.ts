import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import HomePage from '../pages/HomePage.vue'
import SessionPage from '../pages/SessionPage.vue'
import DemoPage from '../pages/DemoPage.vue'
import SettingsPage from '../pages/SettingsPage.vue'
import ToolsPage from '../pages/ToolsPage.vue'
import EvalsPage from '../pages/EvalsPage.vue'
import { LensService } from './LensService'
import { lensKey } from './context'
import './style.css'
import './panels.css'
import '@fontsource-variable/dm-sans/wght.css'
import '@fontsource-variable/manrope/wght.css'
import { registerNativeTools } from '../webmcp/nativeAdapter'
const app = createApp(App)
app.use(createPinia())
const lens = new LensService()
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/session', component: SessionPage },
    { path: '/demo', component: DemoPage },
    { path: '/tools', component: ToolsPage },
    { path: '/evals', component: EvalsPage },
    { path: '/settings', component: SettingsPage },
  ],
})
router.beforeEach((to, from) => {
  if (from.path === '/session' && to.path !== '/session' && lens.session.mode === 'live') {
    lens.capture.stop()
    void lens.stop()
  }
})
app.provide(lensKey, lens)
app.use(router)
app.mount('#app')
void lens.init()
const cleanup = registerNativeTools(lens.tools)
window.addEventListener('pagehide', () => {
  lens.capture.stop()
  void lens.stop()
  void cleanup.then((dispose) => dispose())
})
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    lens.capture.stop()
    void lens.stop()
    void cleanup.then((dispose) => dispose())
  })
