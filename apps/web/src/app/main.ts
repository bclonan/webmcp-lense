import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import HomePage from '../pages/HomePage.vue'
import SessionPage from '../pages/SessionPage.vue'
import DemoPage from '../pages/DemoPage.vue'
import SettingsPage from '../pages/SettingsPage.vue'
import WebMcpPage from '../pages/WebMcpPage.vue'
import HackathonPage from '../pages/HackathonPage.vue'
import EvalsPage from '../pages/EvalsPage.vue'
import { LensService } from './LensService'
import { lensKey } from './context'
import './style.css'
import './panels.css'
import './docs.css'
import { updateMetadata } from '../content/metadata'
import '@fontsource-variable/dm-sans/wght.css'
import '@fontsource-variable/manrope/wght.css'
import { registerNativeTools } from '../webmcp/nativeAdapter'
const app = createApp(App)
app.use(createPinia())
const lens = new LensService()
const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path !== from.path && ['/webmcp', '/hackathon'].includes(to.path)) {
      if (to.hash)
        return {
          el: to.hash,
          top: document.querySelector('.site-header')!.getBoundingClientRect().height + 20,
        }
      return { left: 0, top: 0 }
    }
  },
  routes: [
    { path: '/', redirect: '/session' },
    { path: '/about', component: HomePage },
    { path: '/session', component: SessionPage },
    { path: '/setup', redirect: '/session?setup=desktop' },
    { path: '/demo', component: DemoPage },
    { path: '/tools', redirect: '/webmcp' },
    { path: '/webmcp', component: WebMcpPage },
    { path: '/hackathon', component: HackathonPage },
    { path: '/evals', component: EvalsPage },
    { path: '/settings', component: SettingsPage },
  ],
})
router.beforeEach(async (to, from) => {
  if (from.path === '/session' && to.path !== '/session' && lens.session.mode === 'live') {
    if (lens.runtime.busy) await lens.cancelGoal()
  }
})
router.afterEach((to) => {
  updateMetadata(to.path)
  if (to.path === '/session' && to.query.setup === 'desktop') lens.requestSetup()
})
app.provide(lensKey, lens)
app.use(router)
app.mount('#app')
void lens.init()
const cleanup = registerNativeTools(lens.tools)
const healthCheck = window.setInterval(() => void lens.checkConnection(), 15000)
window.addEventListener('pagehide', () => {
  clearInterval(healthCheck)
  lens.capture.stop()
  void lens.stop()
  void cleanup.then((dispose) => dispose())
})
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    clearInterval(healthCheck)
    lens.capture.stop()
    void lens.stop()
    void cleanup.then((dispose) => dispose())
  })
