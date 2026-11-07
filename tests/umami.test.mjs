import assert from 'node:assert/strict'
import test from 'node:test'
import { getSiteStats } from '../src/umami.ts'

const websiteId = '914c24a6-c9ed-40b5-b2de-8e20330e4549'
const share = { websiteId, token: 'test-public-share-token' }

test('reads all-time totals using the public token without sending credentials', async (t) => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: String(url), options })
    return Response.json(requests.length === 1 ? share : { pageviews: 1234, visitors: 56 })
  })
  const signal = new AbortController().signal
  assert.deepEqual(await getSiteStats(signal), { pageviews: 1234, visitors: 56 })
  assert.equal(requests.length, 2)
  assert.ok(requests.every(({ options }) => options.credentials === 'omit' && options.signal === signal))
  const statsUrl = new URL(requests[1].url)
  assert.equal(statsUrl.pathname, `/api/websites/${websiteId}/stats`)
  assert.equal(statsUrl.searchParams.get('startAt'), '0')
  assert.equal(statsUrl.searchParams.get('timezone'), 'Asia/Shanghai')
  assert.equal(statsUrl.searchParams.has('path'), false)
  assert.equal(requests[1].options.headers['x-umami-share-token'], share.token)
})

test('accepts valid zero counts', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => Response.json(++calls === 1 ? share : { pageviews: 0, visitors: 0 }))
  assert.deepEqual(await getSiteStats(new AbortController().signal), { pageviews: 0, visitors: 0 })
})

test('refreshes an expired token once and uses the new token', async (t) => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options })
    if (requests.length === 1) return Response.json(share)
    if (requests.length === 2) return new Response(null, { status: 401 })
    if (requests.length === 3) return Response.json({ websiteId, token: 'refreshed-token' })
    return Response.json({ pageviews: 8, visitors: 3 })
  })
  assert.deepEqual(await getSiteStats(new AbortController().signal), { pageviews: 8, visitors: 3 })
  assert.equal(requests.length, 4)
  assert.equal(requests[3].options.headers['x-umami-share-token'], 'refreshed-token')
})

test('stops retrying after a second 401', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => ++calls % 2 ? Response.json(share) : new Response(null, { status: 401 }))
  await assert.rejects(getSiteStats(new AbortController().signal))
  assert.equal(calls, 4)
})

test('rejects a share link for a different website before requesting totals', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1
    return Response.json({ websiteId: 'different-website', token: share.token })
  })
  await assert.rejects(getSiteStats(new AbortController().signal))
  assert.equal(calls, 1)
})

test('rejects malformed counts instead of displaying zero', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => Response.json(++calls === 1 ? share : { pageviews: null, visitors: -1 }))
  await assert.rejects(getSiteStats(new AbortController().signal))
})

test('propagates request cancellation', async (t) => {
  const controller = new AbortController()
  controller.abort()
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    signal.throwIfAborted()
  })
  await assert.rejects(getSiteStats(controller.signal), { name: 'AbortError' })
})
