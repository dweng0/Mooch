import { BrowserWindow } from 'electron'

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15_000
const MIN_DESCRIPTION_CHARS = 200

/** A job posting extracted from a URL. */
export interface JobPosting {
  title: string
  company: string
  location: string
  description: string
}

/** Page data collected by either the plain fetch or the hidden-window tier. */
interface PageData {
  title: string
  jsonLd: string[]
  text: string
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
}

function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
}

/**
 * Converts an HTML fragment to readable plain text, keeping paragraph and list structure.
 * @param html - The HTML (or entity-escaped HTML) to convert.
 * @returns Plain text.
 */
export function htmlToText(html: string): string {
  // JSON-LD descriptions are sometimes entity-escaped HTML; unescape first so tags are stripped.
  const source = /&lt;\w+/.test(html) ? decodeEntities(html) : html
  return decodeEntities(
    source
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|ul|ol|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function findJobPosting(node: unknown): Record<string, any> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item)
      if (found) return found
    }
    return null
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, any>
    const type = obj['@type']
    if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return obj
    return findJobPosting(obj['@graph'])
  }
  return null
}

function formatLocation(loc: any): string {
  const first = Array.isArray(loc) ? loc[0] : loc
  const addr = first?.address
  if (!addr) return ''
  if (typeof addr === 'string') return addr
  return [addr.addressLocality, addr.addressRegion, addr.addressCountry?.name ?? addr.addressCountry]
    .filter((part, i, parts) => part && part !== parts[i - 1])
    .join(', ')
}

/**
 * Builds a job posting from collected page data, preferring schema.org JobPosting JSON-LD.
 * @param page - Title, JSON-LD blocks and visible text from the page.
 * @returns The posting, or null if no usable description was found.
 */
export function parseJobPosting(page: PageData): JobPosting | null {
  for (const raw of page.jsonLd) {
    try {
      const job = findJobPosting(JSON.parse(raw))
      const description = job?.description ? htmlToText(String(job.description)) : ''
      if (job && description.length >= MIN_DESCRIPTION_CHARS) {
        const org = job.hiringOrganization
        return {
          title: String(job.title ?? page.title),
          company: String(typeof org === 'string' ? org : org?.name ?? ''),
          location: formatLocation(job.jobLocation),
          description,
        }
      }
    } catch {
      // malformed JSON-LD block; try the next one
    }
  }
  if (page.text.length >= MIN_DESCRIPTION_CHARS) {
    return { title: page.title, company: '', location: '', description: page.text }
  }
  return null
}

/**
 * Renders a posting as the text placed in the job description box.
 * @param job - The posting to format.
 * @returns Title/company/location header followed by the description.
 */
export function formatJobPosting(job: JobPosting): string {
  const header = job.company && !job.title.includes(job.company) ? `${job.title} @ ${job.company}` : job.title
  return [header, job.location, '', job.description].filter((l, i) => i === 2 || l).join('\n')
}

function extractFromHtml(html: string): PageData {
  const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(
    (m) => m[1]
  )
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()
  const body = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html
  return { title, jsonLd, text: htmlToText(body) }
}

async function scrapeWithFetch(url: string): Promise<PageData> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return extractFromHtml(await res.text())
}

async function scrapeWithHiddenWindow(url: string): Promise<PageData> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: 'job-scrape' },
  })
  try {
    win.webContents.setUserAgent(USER_AGENT)
    await Promise.race([
      win.loadURL(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('page load timed out')), FETCH_TIMEOUT_MS)),
    ])
    await new Promise((r) => setTimeout(r, 2000)) // let client-side rendering settle
    return await win.webContents.executeJavaScript(`({
      title: document.title,
      jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent),
      text: document.body.innerText
    })`)
  } finally {
    win.destroy()
  }
}

/**
 * Fetches a job posting URL: plain fetch first, then a hidden browser window for JS-rendered pages.
 * @param url - An http(s) link to a job posting.
 * @returns The extracted posting formatted as text for the job description box.
 */
export async function fetchJobPosting(url: string): Promise<string> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) links are supported')
  }

  const tiers = [scrapeWithFetch, scrapeWithHiddenWindow]
  let lastError = ''
  for (const scrape of tiers) {
    try {
      const posting = parseJobPosting(await scrape(parsed.href))
      if (posting) return formatJobPosting(posting)
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }
  throw new Error(`Couldn't read that link${lastError ? ` (${lastError})` : ''}. Paste the job description text instead.`)
}
