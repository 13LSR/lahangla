const baseUrl = 'https://umami.331106.xyz'
const websiteId = '914c24a6-c9ed-40b5-b2de-8e20330e4549'
const shareId = 'oiCGkTjuA2Gfs2Jo'

export const umamiShareUrl = `${baseUrl}/share/${shareId}`

export type SiteStats = { pageviews: number; visitors: number }

// Only the public share API is used. No account credentials are needed in the browser.
export async function getSiteStats(signal: AbortSignal): Promise<SiteStats> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const shareResponse = await fetch(`${baseUrl}/api/share/${shareId}`, {
      credentials: 'omit', signal,
    })
    if (!shareResponse.ok) throw new Error('Unable to load Umami share')
    const share: unknown = await shareResponse.json()
    if (!isRecord(share) || share.websiteId !== websiteId || typeof share.token !== 'string' || !share.token) {
      throw new Error('Invalid Umami share')
    }

    const params = new URLSearchParams({
      startAt: '0', endAt: String(Date.now()), timezone: 'Asia/Shanghai',
    })
    const response = await fetch(`${baseUrl}/api/websites/${websiteId}/stats?${params}`, {
      headers: { 'x-umami-share-token': share.token }, credentials: 'omit', signal,
    })
    // A share token can expire between requests. Refresh it once before failing.
    if (response.status === 401 && attempt === 0) continue
    if (!response.ok) throw new Error('Unable to load Umami statistics')
    const stats: unknown = await response.json()
    if (!isRecord(stats) || !isCount(stats.pageviews) || !isCount(stats.visitors)) {
      throw new Error('Invalid Umami statistics')
    }
    return { pageviews: stats.pageviews, visitors: stats.visitors }
  }
  throw new Error('Unable to load Umami statistics')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
