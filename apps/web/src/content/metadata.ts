import project from './project.json'
const titles: Record<string, string> = {
  '/webmcp': 'WebMCP tools, prompts and workflows | Lens',
  '/hackathon': 'Lens | Shared control with WebMCP',
  '/session': 'Lens | Screen to action',
  '/demo': 'Lens | Desktop demos',
  '/about': 'About Lens | Screen to action',
  '/evals': 'Lens | Runtime evaluations',
  '/settings': 'Lens | Settings and session history',
}
export function updateMetadata(path: string) {
  const title = titles[path] ?? 'Lens | Screen to action'
  document.title = title
  const url = new URL(path, project.liveUrl).href
  for (const key of ['og:title', 'twitter:title'])
    document
      .querySelector(`meta[property="${key}"], meta[name="${key}"]`)
      ?.setAttribute('content', title)
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', url)
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', url)
}
