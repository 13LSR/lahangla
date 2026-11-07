import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { getSiteStats, umamiShareUrl } from './umami'
import type { SiteStats as Stats } from './umami'

type StatsState = { status: 'loading' } | { status: 'ready'; stats: Stats } | { status: 'error' }

export default function SiteStats() {
  const [state, setState] = useState<StatsState>({ status: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    setState({ status: 'loading' })
    getSiteStats(controller.signal)
      .then((stats) => { if (active) setState({ status: 'ready', stats }) })
      .catch(() => { if (active) setState({ status: 'error' }) })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [retry])

  const formatCount = (value: number) => value.toLocaleString('zh-CN')

  return (
    <section className="site-stats" aria-labelledby="site-stats-heading">
      <h2 id="site-stats-heading" className="eyebrow">// 访问统计</h2>
      <dl className="site-stats-counts" aria-busy={state.status === 'loading'}>
        <div><dt>浏览量</dt><dd>{state.status === 'ready' ? formatCount(state.stats.pageviews) : '—'}</dd></div>
        <div><dt>访客数</dt><dd>{state.status === 'ready' ? formatCount(state.stats.visitors) : '—'}</dd></div>
      </dl>
      {state.status !== 'ready' && <div className="site-stats-status" role="status">
        <span>{state.status === 'loading' ? '正在加载访问统计…' : '统计暂时不可用'}</span>
        {state.status === 'error' && <button className="site-stats-retry" onClick={() => setRetry((value) => value + 1)}>重试</button>}
      </div>}
      <p className="site-stats-note">使用自建 Umami 统计网站访问，不采集上传图片、文件名或排名内容。</p>
      <a className="site-stats-link" href={umamiShareUrl} target="_blank" rel="noopener noreferrer">查看统计详情<ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only">（在新标签页打开）</span></a>
    </section>
  )
}
