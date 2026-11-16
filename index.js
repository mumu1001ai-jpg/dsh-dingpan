/**
 * Host half of the Stock Watch bundle.
 *
 * The browser never talks to a market-data origin directly: this route validates
 * the requested A-share/ETF codes, fetches public Eastmoney quotes and daily
 * bars through the Host web capability, and returns a compact JSON payload with
 * indicators and scenario levels already computed.
 */

import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUOTE_FIELDS = [
  'f2', 'f3', 'f4', 'f5', 'f6', 'f8', 'f9', 'f10', 'f12', 'f13',
  'f14', 'f15', 'f16', 'f17', 'f18', 'f20', 'f21', 'f23', 'f86',
].join(',');

const SINGLE_QUOTE_FIELDS = [
  'f43', 'f44', 'f45', 'f46', 'f47', 'f48', 'f57', 'f58', 'f60',
  'f86', 'f107', 'f116', 'f117', 'f162', 'f167', 'f168', 'f169', 'f170', 'f171',
].join(',');

const KLINE_FIELDS = 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61';
const QUOTE_HOST = 'push2.eastmoney.com';
const HISTORY_HOST = 'push2his.eastmoney.com';
const TENCENT_QUOTE_HOST = 'qt.gtimg.cn';
const TENCENT_KLINE_HOST = 'web.ifzq.gtimg.cn';
const CNBC_HOST = 'quote.cnbc.com';
const CNBC_QUERY = '&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1';
const PROTOCOLS = ['https', 'http'];
/** Eastmoney's push2 CDN resets TLS handshakes for some clients, so http stays as a fallback. */
const protocolPreference = new Map();
const TRANSPORT_ROUNDS = 2;
const TRANSPORT_RETRY_MS = 150;
/**
 * Per-market quote source preference.
 *
 * The delayed `qt.gtimg.cn` snapshot is fine for mainland codes, but its Hong Kong
 * feed lags the tape by minutes. `web.ifzq.gtimg.cn` serves the live Hong Kong
 * snapshot (one code per request), with Eastmoney as the fallback there.
 */
const SOURCE_ORDER = {
  mainland: ['tencent', 'eastmoney'],
  HK: ['ifzq', 'eastmoney'],
  US: ['cnbc'],
  KR: ['eastmoney', 'tencent'],
  A50: ['eastmoney'],
};
const HISTORY_ORDER = ['tencent', 'eastmoney'];
/** Eastmoney market ids for US venues, used only for daily history. */
const US_MARKET_IDS = { NASDAQ: 105, NYSE: 106, AMEX: 107, ARCA: 107, 'NYSE ARCA': 107 };
const usVenues = new Map();

/** FTSE China A50 cash index (100.XIN9); futures 104.CN00Y kept as a fallback. */
const A50_SECIDS = ['100.XIN9', '104.CN00Y', '101.CN00Y'];
let a50Secid = A50_SECIDS[0];

/**
 * Eastmoney blips for seconds at a time. Remember the last good read per row so a
 * failed refresh dims nothing: the card keeps its number and is flagged stale.
 */
const lastSectorQuotes = new Map();
const lastWorldQuotes = new Map();
const MAX_CODES = 20;
const HISTORY_BARS = 120;
/** Chart periods: Tencent's param token, Eastmoney's klt, and how many bars to ask for. */
const KLINE_PERIODS = {
  day: { tencent: 'day', eastmoney: 101, bars: 300 },
  week: { tencent: 'week', eastmoney: 102, bars: 200 },
  month: { tencent: 'month', eastmoney: 103, bars: 120 },
};
const HISTORY_TTL_MS = 60_000;
const ROUTE_PATH = '/plugins/stock-watch/data';
const KLINE_PATH = '/plugins/stock-watch/kline.json';
const TICKER_DATA_PATH = '/plugins/stock-watch/ticker.json';
const TICKER_CONTROL_PATH = '/plugins/stock-watch/ticker';
const TICKER_SNAPSHOT_TTL_MS = 2_000;
const WORLD_PATH = '/plugins/stock-watch/world.json';
const WORLD_TTL_MS = 20_000;
const WORLD_FIELDS = 'f2,f3,f4,f12,f13,f14,f18';
const SECTOR_PATH = '/plugins/stock-watch/sectors.json';
const SECTOR_TTL_MS = 30_000;
const SECTOR_SEARCH_HOST = 'searchapi.eastmoney.com';
const SECTOR_SEARCH_TOKEN = 'D43BF722C8E33BDCCA1A1D5D2D4C1EE7';
const SECTOR_RESOLVE_TTL_MS = 6 * 60 * 60 * 1000;
const STORAGE_PATH = '/plugins/stock-watch/storage.json';const STORAGE_TTL_MS = 10 * 60 * 1000;
const STORAGE_HOST = 'www.chinaflashmarket.com';
const NAVER_HOST = 'fchart.stock.naver.com';

/**
 * CFM (ChinaFlashMarket) publishes free weekly spot quotes per SKU, with a
 * small inline history chart. It covers DRAM and NAND only — there is no free
 * public series for NOR Flash or MCU, so those carry published contract-price
 * guidance instead of a fake line.
 */
const STORAGE_SKUS = [
  { id: 'ddr5-16g', name: 'DDR5 16Gb', group: 'dram', path: '/price/ews/100266', unit: '美元/颗', frequency: 'week' },
  { id: 'ddr4-16g', name: 'DDR4 16Gb 3200', group: 'dram', path: '/price/ews/100222', unit: '美元/颗', frequency: 'week' },
  { id: 'ddr5-24g', name: 'DDR5 24Gb', group: 'dram', path: '/price/ews/100265', unit: '美元/颗', frequency: 'week' },
  { id: 'nand-1t', name: 'NAND 1Tb TLC', group: 'nand', path: '/price/in/100242', unit: '美元/颗', frequency: 'day' },
  { id: 'nand-512g', name: 'NAND 512Gb TLC', group: 'nand', path: '/price/in/100170', unit: '美元/颗', frequency: 'day' },
];

const STORAGE_REFERENCES = [
  {
    id: 'nor',
    name: 'NOR Flash',
    note: '无公开连续报价；以下为 TrendForce 集邦咨询公开口径',
    points: [
      { date: '2026-06-30', text: '2026 上半年合约价累计上涨 100–120%' },
      { date: '2026-09-14', text: '2H26 高容量（256Mb 及以上）预估再涨 90–110%' },
      { date: '2026-09-14', text: '128Mb 及以下 Q4 涨幅预估 10–20%，进入高位盘整' },
    ],
  },
  {
    id: 'mcu',
    name: 'MCU',
    note: '无公开连续报价；华虹宏力 2026-11-12 三季度业绩会口径',
    points: [
      { date: '2026-11-12', text: '2026 年产品平均提价约 10–15%（MCU、闪存、部分 PMIC 为主）' },
      { date: '2026-11-12', text: '预计 Q4 平均售价环比 Q3 小幅上涨，2027 年仍将上行' },
    ],
  },
];

/** Themes resolve to Eastmoney board codes by name, so a renamed board heals itself. */
const SECTOR_THEMES = [
  { id: 'ai', zh: 'AI算力', en: 'AI compute', queries: ['算力', '东数西算'] },
  { id: 'cpo', zh: 'CPO', en: 'CPO', queries: ['CPO'] },
  { id: 'semi', zh: '半导体', en: 'Semiconductors', queries: ['半导体'] },
  { id: 'storage', zh: '存储', en: 'Memory', queries: ['存储芯片', '存储'] },
  { id: 'cloud', zh: '云计算', en: 'Cloud', queries: ['云计算'] },
  { id: 'idc', zh: '数据中心', en: 'Data centers', queries: ['数据中心', 'IDC'] },
  { id: 'space', zh: '航天', en: 'Space', queries: ['商业航天', '航天'] },
  { id: 'bank', zh: '银行', en: 'Banks', queries: ['银行'] },
  { id: 'game', zh: '游戏', en: 'Gaming', queries: ['游戏'] },
  { id: 'adas', zh: '自动驾驶', en: 'Autonomous driving', queries: ['智能驾驶', '无人驾驶', '自动驾驶'] },
  { id: 'robot', zh: '机器人', en: 'Robotics', queries: ['机器人'] },
  { id: 'energy', zh: '新能源', en: 'New energy', queries: ['新能源'] },
  { id: 'solar', zh: '光伏', en: 'Solar', queries: ['光伏'] },
  { id: 'pharma', zh: '医药', en: 'Healthcare', queries: ['创新药', '医药'] },
  { id: 'gold', zh: '黄金', en: 'Gold', queries: ['黄金'] },
  { id: 'consumer', zh: '消费', en: 'Consumer', queries: ['消费', '白酒'] },
];

/** SPDR sector ETFs stand in for the GICS sectors; SOXX covers the chip complex. */
const US_SECTORS = [
  { secid: '105.SOXX', ticker: 'SOXX', zh: '费半 (SOXX)', en: 'Semis (SOXX)' },
  { secid: '105.MU', ticker: 'MU', zh: '存储 (MU)', en: 'Memory (MU)' },
  { secid: '107.XLK', ticker: 'XLK', zh: '科技', en: 'Technology' },
  { secid: '107.XLF', ticker: 'XLF', zh: '金融', en: 'Financials' },
  { secid: '107.XLV', ticker: 'XLV', zh: '医疗', en: 'Health care' },
  { secid: '107.XLI', ticker: 'XLI', zh: '工业', en: 'Industrials' },
  { secid: '107.XLY', ticker: 'XLY', zh: '可选消费', en: 'Cons. discretionary' },
  { secid: '107.XLP', ticker: 'XLP', zh: '日常消费', en: 'Cons. staples' },
  { secid: '107.XLE', ticker: 'XLE', zh: '能源', en: 'Energy' },
  { secid: '107.XLB', ticker: 'XLB', zh: '材料', en: 'Materials' },
  { secid: '107.XLU', ticker: 'XLU', zh: '公用事业', en: 'Utilities' },
  { secid: '107.XLRE', ticker: 'XLRE', zh: '房地产', en: 'Real estate' },
  { secid: '107.XLC', ticker: 'XLC', zh: '通信服务', en: 'Communication' },
];

/**
 * Global board: Asia-Pacific indices plus the US complex. The US index futures
 * (CME, secids on market 103) are what actually moves before the cash open, so
 * they sit above the cash indices.
 */
const WORLD_GROUPS = [
  {
    id: 'asia',
    items: [
      { secid: '1.000001', name: '上证指数', nameEn: 'SSE Composite', exchange: 'CN' },
      { secid: '0.399001', name: '深证成指', nameEn: 'SZSE Component', exchange: 'CN' },
      { secid: '0.399006', name: '创业板指', nameEn: 'ChiNext', exchange: 'CN' },
      { secid: '100.HSI', name: '恒生指数', nameEn: 'Hang Seng', exchange: 'HK' },
      { secid: '124.HSTECH', name: '恒生科技', nameEn: 'Hang Seng Tech', exchange: 'HK' },
      { secid: '100.N225', name: '日经225', nameEn: 'Nikkei 225', exchange: 'JP' },
      { secid: '100.KS11', name: '韩国KOSPI', nameEn: 'KOSPI', exchange: 'KR' },
      { secid: '100.TWII', name: '台湾加权', nameEn: 'TAIEX', exchange: 'TW' },
      { secid: '100.AS51', name: '澳洲标普200', nameEn: 'ASX 200', exchange: 'AU' },
    ],
  },
  {
    id: 'us',
    items: [
      { secid: '103.ES00Y', name: '标普500期货', nameEn: 'S&P 500 futures', exchange: 'US', kind: 'futures' },
      { secid: '103.NQ00Y', name: '纳指期货', nameEn: 'Nasdaq futures', exchange: 'US', kind: 'futures' },
      { secid: '103.YM00Y', name: '道指期货', nameEn: 'Dow futures', exchange: 'US', kind: 'futures' },
      { secid: '100.DJIA', name: '道琼斯', nameEn: 'Dow Jones', exchange: 'US' },
      { secid: '100.NDX', name: '纳斯达克', nameEn: 'Nasdaq', exchange: 'US' },
      { secid: '100.SPX', name: '标普500', nameEn: 'S&P 500', exchange: 'US' },
    ],
  },
];

/** Tencent fallbacks for the subset it can serve when Eastmoney drops out. */
const WORLD_TENCENT_CODES = {
  '1.000001': 'sh000001',
  '0.399001': 'sz399001',
  '0.399006': 'sz399006',
  '100.HSI': 'r_hkHSI',
  '124.HSTECH': 'r_hkHSTECH',
  '100.DJIA': 'usDJI',
  '100.NDX': 'usIXIC',
  '100.SPX': 'usINX',
  '103.ES00Y': 'hf_ES',
};

const WORLD_ZONES = {
  CN: 'Asia/Shanghai',
  HK: 'Asia/Hong_Kong',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  TW: 'Asia/Taipei',
  AU: 'Australia/Sydney',
  US: 'America/New_York',
};

export const inject = ['webServer', 'web'];

export function apply(ctx) {
  const cache = new Map();
  const ticker = createTicker(ctx);

  ctx.effect(() => () => cache.clear(), 'stock-watch: release quote cache');
  ctx.effect(() => () => ticker.stop(), 'stock-watch: stop taskbar ticker');

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PATH,
      handler: (req, res) => handleData(ctx, cache, req, res),
    }),
    'stock-watch: data route',
  );

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: TICKER_DATA_PATH,
      handler: (req, res) => handleTickerData(ticker, req, res),
    }),
    'stock-watch: taskbar ticker feed',
  );

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: TICKER_CONTROL_PATH,
      handler: (req, res) => handleTickerControl(ticker, req, res),
    }),
    'stock-watch: taskbar ticker control',
  );

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: WORLD_PATH,
      handler: (req, res) => handleWorld(ctx, cache, req, res),
    }),
    'stock-watch: global board',
  );

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: SECTOR_PATH,
      handler: (req, res) => handleSectors(ctx, cache, req, res),
    }),
    'stock-watch: sector board',
  );

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: STORAGE_PATH,
      handler: (req, res) => handleStorage(ctx, cache, req, res),
    }),
    'stock-watch: storage prices',
  );

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: KLINE_PATH,
      handler: (req, res) => handleKline(ctx, cache, req, res),
    }),
    'stock-watch: kline periods',
  );
}

async function handleKline(ctx, cache, req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const url = new URL(req.url ?? KLINE_PATH, 'http://localhost');
  const period = url.searchParams.get('period') ?? 'day';
  if (!KLINE_PERIODS[period]) {
    sendJson(res, 400, { error: 'invalid_period', message: 'period must be day, week or month.' });
    return;
  }

  const entry = normalizeCode(url.searchParams.get('code') ?? '');
  if (!entry) {
    sendJson(res, 400, { error: 'invalid_code', message: 'Provide a valid watchlist code.' });
    return;
  }

  const order = ['US', 'KR', 'A50'].includes(entry.market) ? ['eastmoney'] : HISTORY_ORDER;
  let history = null;
  let lastError = null;
  for (const source of order) {
    try {
      history = await loadBars(ctx, cache, source, entry, period);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!history) {
    sendJson(res, 502, {
      error: errorCode(lastError),
      message: lastError instanceof Error ? lastError.message : 'The market data source is unavailable.',
    });
    return;
  }

  sendJson(res, 200, {
    code: entry.code,
    market: entry.market,
    secid: entry.secid,
    period,
    name: history.name,
    bars: history.bars.slice(-(KLINE_PERIODS[period]?.bars ?? 120)),
    fetchedAt: new Date().toISOString(),
  });
}

async function handleStorage(ctx, cache, req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  try {
    const url = new URL(req.url ?? STORAGE_PATH, 'http://localhost');
    const fresh = url.searchParams.get('fresh') === '1';
    const debug = url.searchParams.get('debug') === '1';
    sendJson(res, 200, await loadStorage(ctx, cache, fresh, debug));
  } catch (error) {
    sendJson(res, 502, {
      error: 'upstream_error',
      message: error instanceof Error ? error.message : 'The storage price source is unavailable.',
    });
  }
}

/**
 * CFM renders the price table server-side (`<td><i>date</i>…<span>close</span>`),
 * well before the fetch provider's 100 KB cap, while the inline chart JSON sits
 * near the end of the page and gets truncated. Read the table.
 */
function parseCfmPoints(html) {
  if (typeof html !== 'string') return [];

  const tableStart = html.indexOf('<table class="table-box"');
  if (tableStart === -1) return [];
  const tableEnd = html.indexOf('</table>', tableStart);
  const table = html.slice(tableStart, tableEnd === -1 ? undefined : tableEnd);

  const cells = table.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? [];
  const byDate = new Map();

  for (const cell of cells) {
    const date = /<i>\s*([^<]+?)\s*<\/i>/.exec(cell);
    const close = /<span>\s*([^<]+?)\s*<\/span>/.exec(cell);
    if (!date || !close) continue;

    const raw = date[1].trim();
    const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!parsed) continue;

    const value = Number(close[1].replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;

    byDate.set(raw, { date: raw, value });
  }

  return Array.from(byDate.values()).sort((left, right) => (left.date < right.date ? -1 : 1));
}

async function loadStorage(ctx, cache, fresh = false, debug = false) {
  const hit = cache.get('storage');
  if (!fresh && hit && hit.expiresAt > Date.now()) return hit.value;

  const series = [];
  for (const item of STORAGE_SKUS) {
    let points = [];
    let diagnostics = null;
    try {
      const html = await fetchText(ctx, STORAGE_HOST, item.path);
      points = parseCfmPoints(html);
      if (debug) {
        diagnostics = {
          path: item.path,
          bytes: typeof html === 'string' ? html.length : 0,
          hasSample: typeof html === 'string' && html.includes('sampleData'),
        };
      }
    } catch (error) {
      points = [];
      diagnostics = { path: item.path, error: error instanceof Error ? error.message : String(error) };
    }

    const latest = points.length > 0 ? points[points.length - 1] : null;
    const previous = points.length > 1 ? points[points.length - 2] : null;
    const changePct = latest && previous && previous.value !== 0
      ? ((latest.value - previous.value) / previous.value) * 100
      : null;

    series.push({
      id: item.id,
      name: item.name,
      group: item.group,
      unit: item.unit,
      frequency: item.frequency,
      points,
      latest: latest ? latest.value : null,
      latestDate: latest ? latest.date : null,
      changePct,
      unavailable: points.length === 0,
      ...(debug ? { diagnostics } : {}),
    });
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    source: 'CFM 闪存市场',
    sourceUrl: 'https://www.chinaflashmarket.com/price',
    series,
    references: STORAGE_REFERENCES,
  };

  cache.set('storage', { expiresAt: Date.now() + STORAGE_TTL_MS, value: payload });
  return payload;
}

async function handleSectors(ctx, cache, req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  try {
    const url = new URL(req.url ?? SECTOR_PATH, 'http://localhost');
    const fresh = url.searchParams.get('fresh') === '1';
    sendJson(res, 200, await loadSectors(ctx, cache, fresh));
  } catch (error) {
    sendJson(res, 502, {
      error: 'upstream_error',
      message: error instanceof Error ? error.message : 'The market data source is unavailable.',
    });
  }
}

const sectorBoardCache = new Map();

/** Resolve one theme keyword to an Eastmoney board code, cached for hours. */
async function resolveThemeBoard(ctx, theme) {
  const cached = sectorBoardCache.get(theme.id);
  if (cached && Date.now() - cached.at < SECTOR_RESOLVE_TTL_MS) return cached;

  for (const query of theme.queries) {
    try {
      const body = await fetchJson(
        ctx,
        SECTOR_SEARCH_HOST,
        `/api/suggest/get?input=${encodeURIComponent(query)}&type=14&count=10&token=${SECTOR_SEARCH_TOKEN}`,
      );
      const rows = body?.QuotationCodeTable?.Data ?? [];
      const boards = rows.filter((row) => row?.Classify === 'BK' && typeof row.QuoteID === 'string');
      if (boards.length === 0) continue;

      const exact = boards.find((row) => row.Name === query || row.Name === `${query}概念`);
      const contains = boards
        .filter((row) => typeof row.Name === 'string' && row.Name.includes(query))
        .sort((left, right) => left.Name.length - right.Name.length)[0];
      const pick = exact ?? contains ?? boards[0];
      const entry = {
        at: Date.now(),
        secid: String(pick.QuoteID),
        code: String(pick.Code ?? ''),
        name: String(pick.Name ?? query),
      };
      sectorBoardCache.set(theme.id, entry);
      return entry;
    } catch {
      // Try the next alias.
    }
  }

  return null;
}

let lastIndustry = [];

/** Major industry boards used when the ranking list (clist) is unavailable. */
const INDUSTRY_BOARD_NAMES = [
  '半导体', '银行', '证券', '保险', '白酒', '电力',
  '煤炭', '有色金属', '汽车整车', '家电行业', '房地产开发', '通信设备',
];

async function fallbackIndustryBoard(ctx) {
  const boards = await mapLimit(INDUSTRY_BOARD_NAMES, 3,
    (name) => resolveThemeBoard(ctx, { id: `ind:${name}`, queries: [name] }));
  const secids = boards.filter(Boolean).map((board) => board.secid);
  if (secids.length === 0) return [];

  const body = await fetchJson(
    ctx,
    QUOTE_HOST,
    `/api/qt/ulist.np/get?fltt=2&invt=2&secids=${encodeURIComponent(secids.join(','))}&fields=f3,f12,f14,f104,f105,f128`,
  );
  return (body?.data?.diff ?? [])
    .filter((row) => typeof row.f14 === 'string')
    .map((row) => ({
      id: String(row.f12 ?? row.f14),
      name: String(row.f14),
      nameEn: null,
      board: String(row.f14),
      pct: num(row.f3),
      leader: typeof row.f128 === 'string' ? row.f128 : null,
      up: num(row.f104),
      down: num(row.f105),
    }))
    .sort((left, right) => (right.pct ?? -999) - (left.pct ?? -999));
}

/** The industry ranking: the flakiest Eastmoney call, so it retries once. */
async function fetchIndustryBoard(ctx) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const body = await fetchJson(
        ctx,
        QUOTE_HOST,
        '/api/qt/clist/get?pn=1&pz=12&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f3,f12,f14,f104,f105,f128',
      );
      const rows = (body?.data?.diff ?? [])
        .filter((row) => typeof row.f14 === 'string')
        .map((row) => ({
          id: String(row.f12 ?? row.f14),
          name: String(row.f14),
          nameEn: null,
          board: String(row.f14),
          pct: num(row.f3),
          leader: typeof row.f128 === 'string' ? row.f128 : null,
          up: num(row.f104),
          down: num(row.f105),
        }));
      if (rows.length > 0) return rows;
    } catch {
      // Retry below.
    }
    await delay(250);
  }
  return [];
}

const SINA_BOARD_HOSTS = { industry: 'vip.stock.finance.sina.com.cn', concept: 'money.finance.sina.com.cn' };
const SINA_BOARD_PATHS = { industry: '/q/view/newSinaHy.php', concept: '/q/view/newFLJK.php?param=class' };

/** Sina ships each board as `"key":"code,name,count,avg,change,pct,vol,amount,...,leader"`. */
function parseSinaBoards(text) {
  if (typeof text !== 'string') return [];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return [];

  const boards = [];
  for (const match of text.slice(start + 1, end).matchAll(/"([^"]+)"\s*:\s*"([^"]*)"/g)) {
    const parts = match[2].split(',');
    if (parts.length < 13) continue;
    const changePct = Number(parts[5]);
    boards.push({
      key: parts[0],
      name: parts[1],
      count: Number(parts[2]),
      changePct: Number.isFinite(changePct) ? changePct : null,
      leader: parts[12] || null,
    });
  }
  return boards;
}

async function loadSinaBoards(ctx, cache) {
  const hit = cache.get('sina-boards');
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const [industry, concept] = await Promise.allSettled([
    fetchText(ctx, SINA_BOARD_HOSTS.industry, SINA_BOARD_PATHS.industry),
    fetchText(ctx, SINA_BOARD_HOSTS.concept, SINA_BOARD_PATHS.concept),
  ]);

  const value = {
    industry: industry.status === 'fulfilled' ? parseSinaBoards(industry.value) : [],
    concept: concept.status === 'fulfilled' ? parseSinaBoards(concept.value) : [],
  };
  if (value.industry.length > 0 || value.concept.length > 0) {
    cache.set('sina-boards', { expiresAt: Date.now() + SECTOR_TTL_MS, value });
  }
  return value;
}

/** Sina's board names differ from Eastmoney's, so each theme lists its aliases. */
const THEME_SINA_NAMES = {
  ai: ['算力', '数据中心', '云计算'],
  cpo: ['CPO', '光通信', '5G概念'],
  semi: ['半导体', '电子器件', '电子信息'],
  storage: ['存储芯片', '电子器件'],
  cloud: ['云计算', '国产软件'],
  idc: ['数据中心', '云计算'],
  space: ['军工航天', '卫星导航', '大飞机'],
  bank: ['金融行业', '银行'],
  game: ['网络游戏', '游戏'],
  adas: ['无人驾驶', '智能汽车', '汽车电子'],
  robot: ['机器人概念', '智能机器'],
  energy: ['新能源', '锂电池'],
  solar: ['光伏概念', '风能'],
  pharma: ['创新药', '生物制药', '生物疫苗'],
  gold: ['黄金概念', '稀缺资源'],
  consumer: ['白酒概念', '商业百货', '食品行业'],
};

function matchSinaBoard(sina, theme) {
  const names = THEME_SINA_NAMES[theme.id] ?? [theme.zh];

  for (const list of [sina?.concept, sina?.industry]) {
    if (!Array.isArray(list) || list.length === 0) continue;
    for (const name of names) {
      const exact = list.find((board) => board.name === name && board.changePct != null);
      if (exact) return exact;
    }
  }
  for (const list of [sina?.concept, sina?.industry]) {
    if (!Array.isArray(list) || list.length === 0) continue;
    for (const name of names) {
      const fuzzy = list.find((board) => board.name.includes(name) && board.changePct != null);
      if (fuzzy) return fuzzy;
    }
  }
  return null;
}

async function loadSectors(ctx, cache, fresh = false) {
  const hit = cache.get('sectors');
  if (!fresh && hit && hit.expiresAt > Date.now()) return hit.value;

  let sina = { industry: [], concept: [] };
  try {
    sina = await loadSinaBoards(ctx, cache);
  } catch {
    // Sina unreachable: every theme falls back to Eastmoney below.
  }

  const themeItems = SECTOR_THEMES.map((theme) => {
    const match = matchSinaBoard(sina, theme);
    return {
      id: theme.id,
      name: theme.zh,
      nameEn: theme.en,
      board: match?.name ?? null,
      pct: match?.changePct ?? null,
      leader: match?.leader ?? null,
      up: null,
      down: null,
    };
  });

  // Only the themes Sina has no board for still need Eastmoney. When it is down
  // the row keeps a placeholder instead of blanking the whole section.
  const unmatched = SECTOR_THEMES.filter((theme) => {
    const item = themeItems.find((entry) => entry.id === theme.id);
    return item && item.pct == null;
  });

  if (unmatched.length > 0) {
    const resolved = await mapLimit(unmatched, 3, async (theme) => ({
      theme,
      board: await resolveThemeBoard(ctx, theme),
    }));

    const boardSecids = resolved
      .map((entry) => entry.board?.secid)
      .filter((secid) => typeof secid === 'string');

    const boardQuotes = new Map();
    if (boardSecids.length > 0) {
      try {
        const body = await fetchJson(
          ctx,
          QUOTE_HOST,
          `/api/qt/ulist.np/get?fltt=2&invt=2&secids=${encodeURIComponent(boardSecids.join(','))}&fields=f2,f3,f12,f14,f104,f105,f128`,
        );
        for (const row of body?.data?.diff ?? []) {
          boardQuotes.set(`90.${row.f12}`, {
            pct: num(row.f3),
            leader: typeof row.f128 === 'string' ? row.f128 : null,
            up: num(row.f104),
            down: num(row.f105),
          });
        }
      } catch {
        // Placeholders below.
      }
    }

    for (const { theme, board } of resolved) {
      const quote = board ? boardQuotes.get(board.secid) : null;
      const item = themeItems.find((entry) => entry.id === theme.id);
      if (!item || !quote) continue;
      item.board = board?.name ?? item.board;
      item.pct = quote.pct;
      item.leader = quote.leader;
      item.up = quote.up;
      item.down = quote.down;
    }
  }

  let industryItems = sina.industry.length > 0
    ? sina.industry
      .filter((row) => row.changePct != null)
      .sort((left, right) => right.changePct - left.changePct)
      .slice(0, 12)
      .map((row) => ({
        id: row.key,
        name: row.name,
        nameEn: null,
        board: row.name,
        pct: row.changePct,
        leader: row.leader,
        up: null,
        down: null,
      }))
    : [];
  try {
    if (industryItems.length === 0) industryItems = await fetchIndustryBoard(ctx);
  } catch {
    // Keep an empty industry section rather than failing the whole board.
  }
  if (industryItems.length === 0) {
    try {
      industryItems = await fallbackIndustryBoard(ctx);
    } catch {
      // Both paths are down; the section renders empty.
    }
  }
  if (industryItems.length === 0 && lastIndustry.length > 0) {
    // The ranking list is the flakiest call of the three; keep the previous read
    // rather than blanking the section on a single reset.
    industryItems = lastIndustry;
  } else if (industryItems.length > 0) {
    lastIndustry = industryItems;
  }

  let usItems = [];
  try {
    const body = await fetchJson(
      ctx,
      QUOTE_HOST,
      `/api/qt/ulist.np/get?fltt=2&invt=2&secids=${encodeURIComponent(US_SECTORS.map((item) => item.secid).join(','))}&fields=f2,f3,f12,f14`,
    );
    const byCode = new Map();
    for (const row of body?.data?.diff ?? []) {
      byCode.set(String(row.f12), { pct: num(row.f3), price: num(row.f2) });
    }
    usItems = US_SECTORS.map((item) => ({
      id: item.ticker,
      name: item.zh,
      nameEn: item.en,
      ticker: item.ticker,
      pct: byCode.get(item.ticker)?.pct ?? null,
      price: byCode.get(item.ticker)?.price ?? null,
    }));
  } catch {
    usItems = US_SECTORS.map((item) => ({
      id: item.ticker,
      name: item.zh,
      nameEn: item.en,
      ticker: item.ticker,
      pct: null,
      price: null,
    }));
  }

  // CNBC carries the same sector ETFs, so the US column survives an Eastmoney outage.
  if (usItems.every((item) => item.pct == null)) {
    try {
      const entries = US_SECTORS.map((item) => ({ code: item.ticker, market: 'US', secid: `107.${item.ticker}` }));
      const quotes = await loadQuotesFromCnbc(ctx, entries);
      usItems = usItems.map((item) => {
        const quote = quotes.get(`107.${item.ticker}`);
        return quote ? { ...item, pct: quote.changePct, price: quote.price } : item;
      });
    } catch {
      // Leave the placeholders.
    }
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    groups: [
      { id: 'themes', items: themeItems },
      { id: 'industry', items: industryItems },
      { id: 'us', items: usItems },
    ],
  };

  // Keep the last good read per row: an upstream reset should dim a value, not blank it.
  for (const group of payload.groups) {
    for (const item of group.items) {
      const key = `${group.id}:${item.id}`;
      const previous = lastSectorQuotes.get(key);
      if (item.pct == null && previous) {
        item.pct = previous.pct;
        item.price = item.price ?? previous.price;
        item.leader = item.leader ?? previous.leader;
        item.stale = true;
      } else if (item.pct != null || item.price != null) {
        lastSectorQuotes.set(key, { pct: item.pct, price: item.price, leader: item.leader });
      }
    }
  }

  // A partial read (missing industry rows) heals faster if it is not cached long.
  const ttl = industryItems.length > 0 ? SECTOR_TTL_MS : 5_000;
  cache.set('sectors', { expiresAt: Date.now() + ttl, value: payload });
  return payload;
}

async function handleWorld(ctx, cache, req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  try {
    const url = new URL(req.url ?? WORLD_PATH, 'http://localhost');
    const fresh = url.searchParams.get('fresh') === '1';
    sendJson(res, 200, await loadWorld(ctx, cache, fresh));
  } catch (error) {
    sendJson(res, 502, {
      error: 'upstream_error',
      message: error instanceof Error ? error.message : 'The market data source is unavailable.',
    });
  }
}

/** Every row of one Eastmoney market list (`fs=m:100`, `m:103`, `m:90+t:3`, ...). */
async function loadMarketRows(ctx, fs, pz = 200, fields = 'f2,f3,f4,f12,f13,f14') {
  const body = await fetchJson(
    ctx,
    QUOTE_HOST,
    // `fs` keeps its raw `+`/`:` separators: Eastmoney rejects the encoded form.
    `/api/qt/clist/get?pn=1&pz=${pz}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${fs}&fields=${fields}`,
  );
  const rows = body?.data?.diff;
  const map = new Map();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row || row.f12 == null || row.f13 == null) continue;
    map.set(`${row.f13}.${row.f12}`, row);
  }
  return map;
}

async function loadWorld(ctx, cache, fresh = false) {  const hit = cache.get('world');
  if (!fresh && hit && hit.expiresAt > Date.now()) return hit.value;

  const wanted = WORLD_GROUPS.flatMap((group) => group.items);
  const secids = wanted.map((item) => item.secid).join(',');
  const quotes = new Map();

  try {
    const body = await fetchJson(
      ctx,
      QUOTE_HOST,
      `/api/qt/ulist.np/get?fltt=2&invt=2&secids=${encodeURIComponent(secids)}&fields=${WORLD_FIELDS}`,
    );
    for (const row of body?.data?.diff ?? []) {
      const secid = `${row.f13}.${row.f12}`;
      quotes.set(secid, {
        price: num(row.f2),
        change: num(row.f4),
        changePct: num(row.f3),
        name: typeof row.f14 === 'string' ? row.f14 : null,
      });
    }
  } catch {
    // Fall through to the Tencent subset below.
  }

  // Eastmoney answers lazily under load: fill whatever it skipped from Tencent
  // rather than only when it returned nothing at all.
  let missing = WORLD_GROUPS
    .flatMap((group) => group.items)
    .filter((item) => !quotes.has(item.secid) && WORLD_TENCENT_CODES[item.secid]);

  if (missing.length > 0) {
    try {
      const symbols = missing.map((item) => WORLD_TENCENT_CODES[item.secid]);
      const text = await fetchText(ctx, TENCENT_QUOTE_HOST, `/q=${symbols.join(',')}`);
      for (const item of missing) {
        const quote = readTencentWorldQuote(text, WORLD_TENCENT_CODES[item.secid]);
        if (quote) quotes.set(item.secid, quote);
      }
    } catch {
      // Nothing readable: the board still renders with placeholders.
    }
  }

  // The batch list endpoint skips global indices and CME futures, but the market
  // list endpoint returns them; use it for whatever is still blank.
  missing = WORLD_GROUPS
    .flatMap((group) => group.items)
    .filter((item) => !quotes.has(item.secid));

  const markets = [...new Set(missing.map((item) => item.secid.split('.')[0]))];
  for (const market of markets) {
    try {
      const rows = await loadMarketRows(ctx, `m:${market}`);
      for (const item of missing.filter((entry) => entry.secid.startsWith(`${market}.`))) {
        const row = rows.get(item.secid);
        if (!row) continue;
        const price = num(row.f2);
        if (price == null) continue;
        quotes.set(item.secid, {
          price,
          change: num(row.f4),
          changePct: num(row.f3),
          name: typeof row.f14 === 'string' ? row.f14 : null,
        });
      }
    } catch {
      // Keep the placeholder for this market.
    }
  }

  const now = new Date();
  const payload = {
    fetchedAt: now.toISOString(),
    session: describeWorldSession(),
    groups: WORLD_GROUPS.map((group) => ({
      id: group.id,
      items: group.items.map((item) => {
        const quote = quotes.get(item.secid) ?? null;
        const previous = lastWorldQuotes.get(item.secid) ?? null;
        if (quote) {
          lastWorldQuotes.set(item.secid, {
            price: quote.price,
            change: quote.change,
            changePct: quote.changePct,
          });
        }
        return {
          secid: item.secid,
          name: item.name,
          nameEn: item.nameEn,
          kind: item.kind ?? 'index',
          price: quote?.price ?? previous?.price ?? null,
          change: quote?.change ?? previous?.change ?? null,
          changePct: quote?.changePct ?? previous?.changePct ?? null,
          stale: !quote && previous ? true : undefined,
          session: sessionFor(item.exchange, item.kind === 'futures', now),
        };
      }),
    })),
  };

  cache.set('world', { expiresAt: Date.now() + WORLD_TTL_MS, value: payload });
  return payload;
}

/** Parse one Tencent quote line (either a US/HK index or an `hf_` future). */
function readTencentWorldQuote(text, symbol) {
  if (typeof text !== 'string') return null;

  if (symbol.startsWith('hf_')) {
    const match = new RegExp(`v_${symbol}="([^"]*)"`).exec(text);
    if (!match) return null;
    const parts = match[1].split(',');
    if (parts.length < 8) return null;
    const price = num(parts[0]);
    const changePct = num(parts[1]);
    const prevClose = num(parts[7]);
    if (price == null) return null;
    return {
      price,
      change: prevClose != null ? price - prevClose : null,
      changePct,
      name: parts[13] ?? null,
    };
  }

  const match = new RegExp(`v_${symbol}="([^"]*)"`).exec(text);
  if (!match) return null;
  const fields = match[1].split('~');
  if (fields.length < 33) return null;
  return {
    price: num(fields[3]),
    change: num(fields[31]),
    changePct: num(fields[32]),
    name: fields[1] ?? null,
  };
}

function zoneClock(zone, date) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const read = (type) => (parts.find((part) => part.type === type)?.value ?? '');
    return {
      weekday: read('weekday'),
      minutes: (Number(read('hour')) % 24) * 60 + Number(read('minute')),
    };
  } catch {
    return null;
  }
}

function inSpan(minutes, start, end) {
  return minutes >= start && minutes < end;
}

/**
 * Exchange session for one market, in that market's own clock. The client turns
 * these states into labels, so the board stays bilingual.
 */
function sessionFor(exchange, futures, now) {
  if (futures) {
    // CME equity futures run nearly around the clock; the useful labels are the
    // US cash windows they lead into.
    const clock = zoneClock('America/New_York', now);
    if (!clock) return 'closed';
    if (clock.weekday === 'Sat') return 'closed';
    if (clock.weekday === 'Sun' && clock.minutes < 18 * 60) return 'closed';
    if (inSpan(clock.minutes, 4 * 60, 9 * 60 + 30)) return 'pre';
    if (inSpan(clock.minutes, 9 * 60 + 30, 16 * 60)) return 'open';
    if (inSpan(clock.minutes, 16 * 60, 20 * 60)) return 'after';
    return 'night';
  }

  const zone = WORLD_ZONES[exchange];
  const clock = zone ? zoneClock(zone, now) : null;
  if (!clock) return 'closed';
  if (clock.weekday === 'Sat' || clock.weekday === 'Sun') return 'closed';

  const minutes = clock.minutes;
  switch (exchange) {
    case 'CN':
      if (inSpan(minutes, 9 * 60 + 15, 9 * 60 + 30)) return 'pre';
      if (inSpan(minutes, 9 * 60 + 30, 11 * 60 + 30) || inSpan(minutes, 13 * 60, 15 * 60)) return 'open';
      if (inSpan(minutes, 11 * 60 + 30, 13 * 60)) return 'lunch';
      return 'closed';
    case 'HK':
      if (inSpan(minutes, 9 * 60, 9 * 60 + 30)) return 'pre';
      if (inSpan(minutes, 9 * 60 + 30, 12 * 60) || inSpan(minutes, 13 * 60, 16 * 60)) return 'open';
      if (inSpan(minutes, 12 * 60, 13 * 60)) return 'lunch';
      return 'closed';
    case 'JP':
      if (inSpan(minutes, 8 * 60, 9 * 60)) return 'pre';
      if (inSpan(minutes, 9 * 60, 11 * 60 + 30) || inSpan(minutes, 12 * 60 + 30, 15 * 60)) return 'open';
      if (inSpan(minutes, 11 * 60 + 30, 12 * 60 + 30)) return 'lunch';
      return 'closed';
    case 'KR':
      if (inSpan(minutes, 8 * 60, 9 * 60)) return 'pre';
      if (inSpan(minutes, 9 * 60, 15 * 60 + 30)) return 'open';
      return 'closed';
    case 'TW':
      if (inSpan(minutes, 8 * 60 + 30, 9 * 60)) return 'pre';
      if (inSpan(minutes, 9 * 60, 13 * 60 + 30)) return 'open';
      return 'closed';
    case 'AU':
      if (inSpan(minutes, 9 * 60 + 30, 10 * 60)) return 'pre';
      if (inSpan(minutes, 10 * 60, 16 * 60)) return 'open';
      return 'closed';
    case 'US':
      // Cash indices only trade 09:30-16:00 ET; the pre/post labels belong to the
      // futures rows, whose price actually moves outside that window.
      if (inSpan(minutes, 9 * 60 + 30, 16 * 60)) return 'open';
      return 'closed';
    default:
      return 'closed';
  }
}

/** Which regions are trading right now, for the board header. */
function describeWorldSession() {
  const now = new Date();
  const states = {
    CN: sessionFor('CN', false, now),
    HK: sessionFor('HK', false, now),
    JP: sessionFor('JP', false, now),
    KR: sessionFor('KR', false, now),
    US: sessionFor('US', false, now),
    USFutures: sessionFor('US', true, now),
  };
  return states;
}

async function handleData(ctx, cache, req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  let parsed;
  try {
    const url = new URL(req.url ?? ROUTE_PATH, 'http://localhost');
    parsed = parseCodes(url.searchParams.get('codes') ?? '');
  } catch (error) {
    sendJson(res, 400, {
      error: error && typeof error === 'object' && 'code' in error ? error.code : 'invalid_code',
      message: error instanceof Error ? error.message : 'Invalid request.',
    });
    return;
  }

  if (parsed.codes.length === 0) {
    sendJson(res, 400, {
      error: 'invalid_code',
      invalid: parsed.invalid,
      message: 'Provide at least one six-digit A-share or ETF code.',
    });
    return;
  }

  try {
    const payload = await collect(ctx, cache, parsed.codes);
    payload.invalid = parsed.invalid;
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 502, {
      error: 'upstream_error',
      message: error instanceof Error ? error.message : 'The market data source is unavailable.',
    });
  }
}

// ----------------------------------------------------------- taskbar ticker

/**
 * The taskbar pill is a small Python/Win32 process (`ticker.py`): it draws a
 * layered, click-through window inside the taskbar strip and polls
 * `TICKER_DATA_PATH`. This half owns that process and answers with the first
 * watchlist code, so the pill never touches the market APIs itself.
 */
function createTicker(ctx) {
  const state = { codes: [], index: 0, enabled: false, child: null, cache: null, error: null };

  function stopChild() {
    const child = state.child;
    if (!child) return;
    state.child = null;
    try {
      child.kill();
    } catch {
      // The process may already be gone; nothing left to release.
    }
  }

  function startChild() {
    if (state.child) return;

    const python = resolvePython();
    const script = fileURLToPath(new URL('./ticker.py', import.meta.url));
    if (!python || !existsSync(script)) {
      state.error = python ? 'ticker_missing' : 'python_not_found';
      return;
    }

    let origin;
    try {
      origin = ctx.webServer.getOrigin();
    } catch {
      state.error = 'no_origin';
      return;
    }

    let child;
    try {
      child = spawn(python, [script, '--base', origin, '--interval', '3'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch {
      state.error = 'spawn_failed';
      return;
    }

    state.error = null;
    state.child = child;
    child.on('error', () => {
      if (state.child === child) {
        state.child = null;
        state.error = 'spawn_failed';
      }
    });
    child.on('exit', () => {
      if (state.child === child) state.child = null;
    });
  }

  async function snapshot() {
    if (!state.enabled) return { enabled: false, running: Boolean(state.child) };

    const entries = parseCodes(Array.isArray(state.codes) ? state.codes.join(',') : '').codes;
    if (entries.length === 0) {
      return { enabled: true, running: Boolean(state.child), code: null, message: 'no-code' };
    }

    if (state.index < 0 || state.index >= entries.length) state.index = 0;
    const entry = entries[state.index];

    const now = Date.now();
    if (state.cache && state.cache.secid === entry.secid && now - state.cache.at < TICKER_SNAPSHOT_TTL_MS) {
      return state.cache.value;
    }

    const { quotes, sources } = await loadQuotes(ctx, [entry]);
    const quote = quotes.get(entry.secid) ?? null;
    const value = {
      enabled: true,
      running: Boolean(state.child),
      code: entry.code,
      market: entry.market,
      secid: entry.secid,
      name: quote?.name ?? entry.code,
      price: quote?.price ?? null,
      change: quote?.change ?? null,
      changePct: quote?.changePct ?? null,
      quoteTime: quote?.quoteTime ?? null,
      extended: quote?.extended ?? null,
      source: sources[marketGroup(entry.market)] ?? null,
      index: state.index,
      count: entries.length,
      fetchedAt: new Date().toISOString(),
    };
    state.cache = { at: now, secid: entry.secid, value };
    return value;
  }

  return {
    state,
    setCodes(codes) {
      state.codes = codes;
      if (state.index >= codes.length) state.index = 0;
      state.cache = null;
    },
    enable(codes) {
      state.codes = codes;
      if (state.index >= codes.length) state.index = 0;
      state.enabled = true;
      state.cache = null;
      startChild();
    },
    step(delta) {
      const entries = parseCodes(Array.isArray(state.codes) ? state.codes.join(',') : '').codes;
      if (entries.length < 2) return;
      const size = entries.length;
      state.index = ((state.index + delta) % size + size) % size;
      state.cache = null;
    },
    disable() {
      state.enabled = false;
      state.cache = null;
      stopChild();
    },
    snapshot,
    stop() {
      state.enabled = false;
      stopChild();
    },
  };
}

async function handleTickerData(ticker, req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  try {
    sendJson(res, 200, await ticker.snapshot());
  } catch (error) {
    sendJson(res, 502, {
      error: 'upstream_error',
      message: error instanceof Error ? error.message : 'The market data source is unavailable.',
    });
  }
}

async function handleTickerControl(ticker, req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'bad_request' });
    return;
  }

  const codes = normalizeCodeList(body?.codes);
  if (body?.action === 'on') ticker.enable(codes);
  else if (body?.action === 'off') ticker.disable();
  else if (body?.action === 'codes') ticker.setCodes(codes);
  else if (body?.action === 'step') ticker.step(Number(body?.delta) >= 0 ? 1 : -1);
  else {
    sendJson(res, 400, { error: 'unknown_action' });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    enabled: ticker.state.enabled,
    running: Boolean(ticker.state.child),
    codes,
    index: ticker.state.index,
    error: ticker.state.error ?? null,
  });
}

function normalizeCodeList(raw) {
  if (!Array.isArray(raw)) return [];
  const codes = [];
  const seen = new Set();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const entry = normalizeCode(value);
    if (!entry || seen.has(entry.secid)) continue;
    seen.add(entry.secid);
    codes.push(codeKey(entry.market, entry.code));
  }
  return codes.slice(0, MAX_CODES);
}

function readJsonBody(req, limit = 8_192) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(codedError('body_too_large', 'Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

/** Prefer the Python runtime DSH manages; fall back to whatever PATH resolves. */
function resolvePython() {
  const candidates = [];
  if (process.env.DSH_PYTHON) candidates.push(process.env.DSH_PYTHON);

  const home = process.env.DSH_HOME
    || (process.env.USERPROFILE ? join(process.env.USERPROFILE, '.dsh') : null);
  if (home) {
    const runtimes = join(home, 'dsh-runtimes');
    try {
      for (const name of readdirSync(runtimes)) {
        const pythonDir = join(runtimes, name, 'dependencies', 'python');
        candidates.push(join(pythonDir, 'pythonw.exe'));
        candidates.push(join(pythonDir, 'python.exe'));
      }
    } catch {
      // No managed runtimes on this machine; the PATH fallback below still applies.
    }
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return 'pythonw.exe';
}

async function collect(ctx, cache, codes) {
  const batch = await loadQuotes(ctx, codes);
  const items = await mapLimit(codes, 5, async (entry) => {
    const quote = batch.quotes.get(entry.secid) ?? null;
    const quoteSource = batch.sources[marketGroup(entry.market)] ?? null;
    let history = null;
    let historyError = null;
    let historySource = null;

    const order = ['US', 'KR', 'A50'].includes(entry.market) ? ['eastmoney'] : HISTORY_ORDER;
    for (const source of order) {
      try {
        history = await loadBars(ctx, cache, source, entry);
        historySource = source;
        break;
      } catch (error) {
        historyError = errorCode(error);
      }
    }

    const bars = history?.bars ?? [];

    if (!quote && bars.length === 0) {
      return {
        key: codeKey(entry.market, entry.code),
        code: entry.code,
        secid: entry.secid,
        market: entry.market,
        name: entry.code,
        quote: null,
        bars: [],
        analysis: null,
        // `not_found` means the code itself is unknown, not that the feed is down.
        warning: historyError && historyError !== 'not_found' ? 'data_unavailable' : 'not_found',
        warningCode: historyError ?? errorCode(batch.error),
        warningDetail: batch.error instanceof Error ? batch.error.message : null,
      };
    }

    // A US symbol comes back as "MU" or "SanDisk Corporation"; prefer the Chinese
    // name the history feed carries when it has one.
    const historyName = typeof history?.name === 'string' ? history.name : null;
    const rawName = quote?.name || historyName || entry.code;
    const name = historyName && /[^\x00-\x7F]/.test(historyName) ? historyName : rawName;
    const analysis = bars.length >= 20 ? analyze(quote, bars) : null;
    let warning = null;
    if (historyError && !history) warning = 'history_unavailable';
    else if (!analysis) warning = 'insufficient_history';
    else if (!quote) warning = 'quote_unavailable';

    return {
      key: codeKey(entry.market, entry.code),
      code: entry.code,
      secid: entry.secid,
      market: entry.market,
      name,
      quote,
      bars: bars.slice(-90),
      analysis,
      warning,
      warningCode: historyError ?? null,
      source: quoteSource ?? historySource,
      historySource,
    };
  });

  return {
    fetchedAt: new Date().toISOString(),
    source: describeSources(batch.sources),
    sources: batch.sources,
    items,
  };
}

function marketGroup(market) {
  if (market === 'HK') return 'HK';
  if (market === 'US') return 'US';
  if (market === 'KR') return 'KR';
  if (market === 'A50') return 'A50';
  return 'mainland';
}

function sourceOrder(group, preferred) {
  const base = SOURCE_ORDER[group] ?? SOURCE_ORDER.mainland;
  const first = preferred && base.includes(preferred) ? preferred : base[0];
  return [first, ...base.filter((source) => source !== first)];
}

function describeSources(sources) {
  const parts = Object.entries(sources).map(([group, source]) => `${group}:${source}`);
  return parts.length > 0 ? parts.join(',') : 'unavailable';
}

async function loadQuotes(ctx, codes) {
  const groups = new Map();
  for (const entry of codes) {
    const group = marketGroup(entry.market);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(entry);
  }

  const quotes = new Map();
  const sources = {};
  let lastError = null;

  for (const [group, entries] of groups) {
    for (const source of sourceOrder(group)) {
      const missing = entries.filter((entry) => !quotes.has(entry.secid));
      if (missing.length === 0) break;

      try {
        const map = await loadQuotesWith(source, ctx, missing);
        if (map.size === 0) continue;
        for (const [key, value] of map) quotes.set(key, value);
        sources[group] = sources[group] ? `${sources[group]}+${source}` : source;
      } catch (error) {
        lastError = error;
      }
    }
  }

  return { quotes, sources, error: lastError };
}

function loadQuotesWith(source, ctx, entries) {
  if (entries[0]?.market === 'A50') return loadQuotesA50(ctx, entries);
  if (source === 'ifzq') return loadQuotesFromIfzq(ctx, entries);
  if (source === 'eastmoney') return loadQuotesFromEastmoney(ctx, entries);
  if (source === 'cnbc') return loadQuotesFromCnbc(ctx, entries);
  return loadQuotesFromTencent(ctx, entries);
}

/**
 * FTSE China A50: cash index 100.XIN9, with SGX futures 104.CN00Y as fallback.
 * Both carry alphanumeric codes that `quoteFromList` rejects, so build the quote
 * here. Eastmoney answers the batch quote and the market list on different
 * schedules, so try both before giving up.
 */
async function loadQuotesA50(ctx, entries) {
  const map = new Map();
  const entry = entries[0];
  if (!entry) return map;

  const candidates = [
    { secid: '100.XIN9', fs: 'm:100', fallbackName: '富时中国A50' },
    { secid: '104.CN00Y', fs: 'm:104', fallbackName: 'A50期指当月连续' },
  ];
  let lastError = null;

  for (const candidate of candidates) {
    for (const mode of ['batch', 'list']) {
      try {
        let row = null;
        if (mode === 'batch') {
          const body = await fetchJson(
            ctx,
            QUOTE_HOST,
            `/api/qt/ulist.np/get?fltt=2&invt=2&secids=${encodeURIComponent(candidate.secid)}&fields=f2,f3,f4,f12,f13,f14`,
          );
          row = (body?.data?.diff ?? [])[0] ?? null;
        } else {
          const rows = await loadMarketRows(ctx, candidate.fs, 300);
          row = rows.get(candidate.secid) ?? null;
        }

        const price = num(row?.f2);
        if (price == null) continue;

        a50Secid = candidate.secid;
        map.set(entry.secid, {
          secid: candidate.secid,
          code: candidate.secid.split('.')[1],
          name: typeof row.f14 === 'string' && row.f14 ? row.f14 : candidate.fallbackName,
          price,
          change: num(row.f4),
          changePct: num(row.f3),
          open: null,
          high: null,
          low: null,
          volume: null,
          amount: null,
          turnover: null,
          pe: null,
          prevClose: null,
          quoteTime: null,
          extended: null,
        });
        return map;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError ?? codedError('not_found', 'The A50 quote is unavailable.');
}

/** "+4.53%" -> 4.53, tolerating plain numbers and dashes. */
function percentValue(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const parsed = Number(raw.replace(/[%\s+,]/g, '').replace(/^\+/, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function looseNumber(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const parsed = Number(raw.replace(/[,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * US quotes from CNBC: the only free source here that carries the
 * pre-market / after-hours print (`ExtendedMktQuote`) alongside the close.
 */
async function loadQuotesFromCnbc(ctx, codes) {
  const map = new Map();
  const symbols = codes.map((entry) => entry.code);
  const path = `/quote-html-webservice/restQuote/symbolType/symbol?symbols=${encodeURIComponent(symbols.join('|'))}${CNBC_QUERY}`;
  const body = await fetchJson(ctx, CNBC_HOST, path);
  const rows = body?.FormattedQuoteResult?.FormattedQuote ?? [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const symbol = typeof row?.symbol === 'string' ? row.symbol : null;
    if (!symbol) continue;

    const entry = codes.find((item) => item.code === symbol);
    if (!entry) continue;

    if (typeof row.exchange === 'string') usVenues.set(symbol, row.exchange.toUpperCase());

    const price = looseNumber(row.last);
    const extendedRaw = row.ExtendedMktQuote;
    let extended = null;
    if (extendedRaw && typeof extendedRaw === 'object') {
      const extPrice = looseNumber(extendedRaw.last);
      const type = String(extendedRaw.type ?? '').toUpperCase();
      if (extPrice != null) {
        extended = {
          session: type.includes('PRE') ? 'pre' : 'post',
          price: extPrice,
          change: looseNumber(extendedRaw.change),
          changePct: percentValue(extendedRaw.change_pct),
          time: typeof extendedRaw.last_timedate === 'string' ? extendedRaw.last_timedate : null,
        };
      }
    }

    map.set(entry.secid, {
      secid: entry.secid,
      code: symbol,
      name: (typeof row.onAirName === 'string' && row.onAirName)
        || (typeof row.name === 'string' && row.name)
        || symbol,
      price,
      prevClose: looseNumber(row.previous_day_closing),
      open: null,
      high: null,
      low: null,
      volume: looseNumber(row.volume),
      amount: null,
      change: looseNumber(row.change),
      changePct: percentValue(row.change_pct),
      turnover: null,
      pe: looseNumber(row.pe),
      pb: null,
      volumeRatio: null,
      marketCap: null,
      floatCap: null,
      quoteTime: typeof row.last_time === 'string' ? `${row.last_time}T16:00:00-05:00` : null,
      extended,
    });
  }

  return map;
}

/**
 * Live Hong Kong snapshot from Tencent's app feed. `qt.gtimg.cn` answers the same
 * shape for Hong Kong codes but lags the tape by minutes; this endpoint does not.
 * It accepts one code per request, so codes are fetched in a small parallel batch.
 */
async function loadQuotesFromIfzq(ctx, codes) {
  const map = new Map();

  await mapLimit(codes, 4, async (entry) => {
    const symbol = tencentSymbol(entry);
    try {
      const body = await fetchJson(
        ctx,
        TENCENT_KLINE_HOST,
        `/appstock/app/minute/query?code=${encodeURIComponent(symbol)}`,
      );
      const fields = body?.data?.[symbol]?.qt?.[symbol];
      if (!Array.isArray(fields) || fields.length < 50) return;
      const quote = quoteFromTencentFields(entry.market, entry.code, fields);
      if (quote.price != null) map.set(quote.secid, quote);
    } catch {
      // One unresponsive code must not drop the rest of the watchlist.
    }
  });

  return map;
}

async function loadQuotesFromEastmoney(ctx, codes) {
  const map = new Map();

  try {
    const secids = codes.map((entry) => entry.secid).join(',');
    const body = await fetchJson(
      ctx,
      QUOTE_HOST,
      `/api/qt/ulist.np/get?fltt=2&invt=2&secids=${encodeURIComponent(secids)}&fields=${QUOTE_FIELDS}`,
    );
    const rows = body?.data?.diff;
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const quote = quoteFromList(row);
        if (quote) map.set(quote.secid, quote);
      }
    }
  } catch {
    // A batch failure must not erase the whole page: retry one by one below.
  }

  const missing = codes.filter((entry) => !map.has(entry.secid));
  if (missing.length > 0) {
    const settled = await Promise.allSettled(missing.map((entry) => loadSingleQuote(ctx, entry)));
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) {
        map.set(result.value.secid, result.value);
      }
    }
  }

  return map;
}

async function loadSingleQuote(ctx, entry) {
  const body = await fetchJson(
    ctx,
    QUOTE_HOST,
    `/api/qt/stock/get?secid=${encodeURIComponent(entry.secid)}&fltt=2&invt=2&fields=${SINGLE_QUOTE_FIELDS}`,
  );
  const row = body?.data;
  if (!row) return null;
  return quoteFromSingle(row);
}

async function loadQuotesFromTencent(ctx, codes) {
  const map = new Map();
  const symbols = codes.map((entry) => tencentSymbol(entry)).join(',');
  const text = await fetchText(ctx, TENCENT_QUOTE_HOST, `/q=${symbols}`);

  for (const line of text.split(';')) {
    const match = /v_([a-z]{2})(\d{5,6})="([^"]*)"/.exec(line.trim());
    if (!match) continue;

    const market = match[1].toUpperCase();
    const code = match[2];
    const fields = match[3].split('~');
    if (fields.length < 50) continue;

    const quote = quoteFromTencentFields(market, code, fields);
    if (quote.price != null) map.set(quote.secid, quote);
  }

  return map;
}

function quoteFromTencentFields(market, code, fields) {
  const hongKong = market === 'HK';

  // The Korean feed keeps the price columns but packs a different tail, so the
  // fundamental columns stay empty instead of being read from the wrong slots.
  if (market === 'KR') {
    return {
      secid: secidFor(market, code),
      code,
      name: fields[1] || code,
      price: num(fields[3]),
      prevClose: num(fields[4]),
      open: num(fields[5]),
      volume: num(fields[6]),
      change: num(fields[31]),
      changePct: num(fields[32]),
      high: num(fields[33]),
      low: num(fields[34]),
      amount: null,
      turnover: null,
      pe: null,
      amplitude: null,
      floatCap: null,
      marketCap: null,
      pb: null,
      volumeRatio: null,
      quoteTime: parseTencentTime(fields[30], 9),
    };
  }

  return {
    secid: secidFor(market, code),
    code,
    name: fields[1] || code,
    price: num(fields[3]),
    prevClose: num(fields[4]),
    open: num(fields[5]),
    volume: num(fields[6]),
    change: num(fields[31]),
    changePct: num(fields[32]),
    high: num(fields[33]),
    low: num(fields[34]),
    // A-share turnover value arrives in 10k CNY; the Hong Kong feed reports HKD.
    amount: hongKong ? num(fields[37]) : scale(num(fields[37]), 10_000),
    turnover: hongKong ? null : num(fields[38]),
    pe: num(fields[39]),
    amplitude: num(fields[43]),
    floatCap: scale(num(fields[44]), 100_000_000),
    marketCap: scale(num(fields[45]), 100_000_000),
    // Past this point the Hong Kong layout carries different columns (company name,
    // 52-week range), so PB and volume ratio are only read for mainland codes.
    pb: hongKong ? null : num(fields[46]),
    volumeRatio: hongKong ? null : num(fields[49]),
    quoteTime: parseTencentTime(fields[30]),
  };
}

/** Tencent stamps the snapshot either as `20261029091257`, `2026/10/29 09:12:57` or `2026-10-29 09:12:57`. */
function parseTencentTime(raw, offsetHours = 8) {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(text)
    ?? /^(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(text);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+${String(offsetHours).padStart(2, '0')}:00`;
}

/** Eastmoney stamps `f86` as epoch seconds of the last tick. */
function parseEastmoneyTime(value) {
  const epoch = num(value);
  if (!epoch || epoch <= 0) return null;
  return new Date(epoch * 1000).toISOString();
}

function secidFor(market, code) {
  if (market === 'HK') return `116.${code}`;
  if (market === 'KR') return `177.${code}`;
  if (market === 'A50') return a50Secid;
  if (market === 'US') {
    return `${US_MARKET_IDS[usVenues.get(code)] ?? 105}.${code}`;
  }
  return `${market === 'SH' ? 1 : 0}.${code}`;
}

/** The watchlist key: `SH600519`, `HK00700`, `KR005930`, and `US.MU` (a dot keeps the
 * ticker from swallowing the market prefix when it is parsed back). */
function codeKey(market, code) {
  if (market === 'A50') return 'A50';
  return market === 'US' ? `US.${code}` : `${market}${code}`;
}

/** Eastmoney market ids: 1 = Shanghai, 116 = Hong Kong, 0 = Shenzhen/Beijing, 177 = Korea. */
function eastmoneySecid(marketId, code) {
  if (marketId === 1) return `1.${code}`;
  if (marketId === 116) return `116.${code}`;
  if (marketId === 0) return `0.${code}`;
  return `${marketId}.${code}`;
}

function tencentSymbol(entry) {
  return `${entry.market.toLowerCase()}${entry.code}`;
}

async function loadBars(ctx, cache, source, entry, period = 'day') {
  if (entry.market === 'US') {
    // Daily history comes from Eastmoney under the venue's market id; the quote
    // itself already arrived from CNBC.
    const venue = usVenues.get(entry.code);
    const secid = `${US_MARKET_IDS[venue] ?? 105}.${entry.code}`;
    return loadKlineFromEastmoney(ctx, cache, { ...entry, secid }, period);
  }
  if (entry.market === 'KR') {
    try {
      return await loadKlineFromEastmoney(ctx, cache, entry, period);
    } catch (error) {
      return loadKlineFromNaver(ctx, cache, entry, period);
    }
  }
  return source === 'tencent'
    ? loadKlineFromTencent(ctx, cache, entry, period)
    : loadKlineFromEastmoney(ctx, cache, entry, period);
}

/** Naver's public chart feed for Korean listings, used when Eastmoney is down. */
async function loadKlineFromNaver(ctx, cache, entry, period = 'day') {
  const key = `naver:${entry.secid}:${period}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    const text = await fetchText(
      ctx,
      NAVER_HOST,
      `/sise.nhn?symbol=${encodeURIComponent(entry.code)}&timeframe=day&count=240&requestType=0`,
    );

    // Each row is date|open|high|low|close|volume.
    const daily = [];
    for (const match of text.matchAll(/data="([^"]+)"/g)) {
      const parts = match[1].split('|');
      if (parts.length < 6) continue;
      const raw = parts[0];
      if (!/^\d{8}$/.test(raw)) continue;
      const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      const open = naverNumber(parts[1]);
      const high = naverNumber(parts[2]);
      const low = naverNumber(parts[3]);
      const close = naverNumber(parts[4]);
      if (close == null || high == null || low == null) continue;
      daily.push({ date, open, high, low, close, volume: naverNumber(parts[5]) });
    }

    if (daily.length === 0) {
      throw codedError('not_found', 'Naver returned no usable bars for this code.');
    }

    const bars = period === 'day' ? daily : aggregateBars(daily, period);
    if (period === 'day') {
      let previous = null;
      for (const bar of bars) {
        bar.change = previous != null ? bar.close - previous : null;
        bar.changePct = previous != null && previous !== 0 ? (bar.change / previous) * 100 : null;
        bar.amount = null;
        bar.amplitude = null;
        bar.turnover = null;
        previous = bar.close;
      }
    }

    const value = { code: entry.code, market: 'KR', name: entry.code, bars };
    cache.set(key, { expiresAt: now + HISTORY_TTL_MS, value });
    return value;
  } catch (error) {
    if (hit?.value) return hit.value;
    cache.delete(key);
    throw error;
  }
}

function naverNumber(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const parsed = Number(raw.replace(/[,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Roll daily bars up into weeks (Monday-anchored) or calendar months. */
function aggregateBars(bars, period) {
  const bucketOf = (date) => {
    if (period === 'month') return date.slice(0, 7);
    const day = new Date(`${date}T00:00:00Z`);
    const shift = (day.getUTCDay() + 6) % 7;
    day.setUTCDate(day.getUTCDate() - shift);
    return day.toISOString().slice(0, 10);
  };

  const buckets = [];
  let current = null;
  for (const bar of bars) {
    const bucket = bucketOf(bar.date);
    if (!current || current.bucket !== bucket) {
      current = {
        bucket,
        date: bar.date,
        open: bar.open,
        close: bar.close,
        high: bar.high,
        low: bar.low,
        volume: bar.volume ?? 0,
      };
      buckets.push(current);
      continue;
    }
    current.date = bar.date;
    current.close = bar.close;
    current.high = Math.max(current.high ?? bar.high, bar.high);
    current.low = Math.min(current.low ?? bar.low, bar.low);
    current.volume = (current.volume ?? 0) + (bar.volume ?? 0);
  }

  let previous = null;
  return buckets.map((bucket) => {
    const change = previous != null ? bucket.close - previous : null;
    const changePct = previous != null && previous !== 0 ? (change / previous) * 100 : null;
    previous = bucket.close;
    return {
      date: bucket.date,
      open: bucket.open,
      close: bucket.close,
      high: bucket.high,
      low: bucket.low,
      volume: bucket.volume,
      amount: null,
      amplitude: null,
      changePct,
      change,
      turnover: null,
    };
  });
}

async function loadKlineFromTencent(ctx, cache, entry, period = 'day') {
  const config = KLINE_PERIODS[period] ?? KLINE_PERIODS.day;
  const key = `tencent:${entry.secid}:${period}:${config.bars}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const symbol = tencentSymbol(entry);
  // Hong Kong daily bars live on a separate endpoint from the mainland feed.
  const endpoint = entry.market === 'HK' ? 'hkfqkline' : 'fqkline';
  const path = `/appstock/app/${endpoint}/get?param=${encodeURIComponent(symbol)},${config.tencent},,,${config.bars},qfq`;

  try {
    const body = await fetchJson(ctx, TENCENT_KLINE_HOST, path);
    const node = body?.data?.[symbol];
    const rows = node?.[`qfq${config.tencent}`] ?? node?.[config.tencent] ?? node?.qfqday ?? node?.day;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw codedError('not_found', 'No bars were returned for this code.');
    }

    const bars = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 6) continue;
      const close = num(row[2]);
      const high = num(row[3]);
      const low = num(row[4]);
      if (close == null || high == null || low == null) continue;
      const previous = bars.length > 0 ? bars[bars.length - 1].close : null;
      const change = previous != null ? close - previous : null;
      bars.push({
        date: String(row[0]),
        open: num(row[1]),
        close,
        high,
        low,
        volume: num(row[5]),
        amount: null,
        amplitude: previous != null && previous !== 0 ? ((high - low) / previous) * 100 : null,
        changePct: previous != null && previous !== 0 ? (change / previous) * 100 : null,
        change,
        turnover: null,
      });
    }

    if (bars.length === 0) {
      throw codedError('not_found', 'No usable daily bars were returned for this code.');
    }

    const value = {
      code: entry.code,
      market: entry.market,
      name: node?.qt?.[symbol]?.[1] || entry.code,
      bars,
    };
    cache.set(key, { expiresAt: now + HISTORY_TTL_MS, value });
    return value;
  } catch (error) {
    // A transient upstream failure should not blank a chart we already have.
    if (hit?.value) return hit.value;
    cache.delete(key);
    throw error;
  }
}

async function loadKlineFromEastmoney(ctx, cache, entry, period = 'day') {
  const config = KLINE_PERIODS[period] ?? KLINE_PERIODS.day;
  const key = `eastmoney:${entry.secid}:${period}:${config.bars}`;  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const path = `/api/qt/stock/kline/get?secid=${encodeURIComponent(entry.secid)}&klt=${config.eastmoney}&fqt=1&lmt=${config.bars}&end=20500101&fields1=f1,f2,f3,f4,f5,f6&fields2=${KLINE_FIELDS}`;

  try {
    const body = await fetchJson(ctx, HISTORY_HOST, path);
    const data = body?.data;
    if (!data || !Array.isArray(data.klines) || data.klines.length === 0) {
      throw codedError('not_found', 'No bars were returned for this code.');
    }

    const bars = [];
    for (const line of data.klines) {
      if (typeof line !== 'string') continue;
      const parts = line.split(',');
      if (parts.length < 11) continue;
      const bar = {
        date: parts[0],
        open: num(parts[1]),
        close: num(parts[2]),
        high: num(parts[3]),
        low: num(parts[4]),
        volume: num(parts[5]),
        amount: num(parts[6]),
        amplitude: num(parts[7]),
        changePct: num(parts[8]),
        change: num(parts[9]),
        turnover: num(parts[10]),
      };
      if (bar.close != null && bar.high != null && bar.low != null) bars.push(bar);
    }

    if (bars.length === 0) {
      throw codedError('not_found', 'No usable daily bars were returned for this code.');
    }

    const value = {
      code: String(data.code ?? entry.code),
      market: Number(data.market),
      name: typeof data.name === 'string' ? data.name : entry.code,
      bars,
    };
    cache.set(key, { expiresAt: now + HISTORY_TTL_MS, value });
    return value;
  } catch (error) {
    // A transient upstream failure should not blank a chart we already have.
    if (hit?.value) return hit.value;
    cache.delete(key);
    throw error;
  }
}

function quoteFromList(row) {
  if (!row) return null;
  const code = String(row.f12 ?? '');
  if (!/^\d{5,6}$/.test(code)) return null;
  const market = Number(row.f13);
  const secid = eastmoneySecid(market, code);
  const hongKong = market === 116;
  return {
    secid,
    code,
    name: String(row.f14 ?? code),
    price: num(row.f2),
    changePct: num(row.f3),
    change: num(row.f4),
    volume: num(row.f5),
    amount: num(row.f6),
    // Eastmoney reports 0 for the Hong Kong turnover column instead of a real rate.
    turnover: hongKong ? null : num(row.f8),
    pe: num(row.f9),
    volumeRatio: num(row.f10),
    high: num(row.f15),
    low: num(row.f16),
    open: num(row.f17),
    prevClose: num(row.f18),
    marketCap: num(row.f20),
    floatCap: num(row.f21),
    pb: num(row.f23),
    quoteTime: parseEastmoneyTime(row.f86),
  };
}

function quoteFromSingle(row) {
  const code = String(row.f57 ?? '');
  if (!/^\d{5,6}$/.test(code)) return null;
  const market = Number(row.f107);
  const secid = eastmoneySecid(market, code);
  const hongKong = market === 116;
  return {
    secid,
    code,
    name: String(row.f58 ?? code),
    price: num(row.f43),
    changePct: num(row.f170),
    change: num(row.f169),
    volume: num(row.f47),
    amount: num(row.f48),
    turnover: hongKong ? null : num(row.f168),
    pe: num(row.f162),
    volumeRatio: null,
    high: num(row.f44),
    low: num(row.f45),
    open: num(row.f46),
    prevClose: num(row.f60),
    marketCap: num(row.f116),
    floatCap: num(row.f117),
    pb: num(row.f167),
    amplitude: num(row.f171),
    quoteTime: parseEastmoneyTime(row.f86),
  };
}

async function fetchJson(ctx, host, path) {
  const content = await fetchText(ctx, host, path);
  try {
    return JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch {
    throw codedError('upstream_error', 'Market data source returned malformed JSON.');
  }
}

async function fetchText(ctx, host, path) {
  let lastError = null;

  for (let round = 0; round <= TRANSPORT_ROUNDS; round += 1) {
    for (const protocol of protocolOrder(host)) {
      try {
        const content = await requestText(ctx, `${protocol}://${host}${path}`);
        if (protocolPreference.get(host) !== protocol) protocolPreference.set(host, protocol);

        return content;
      } catch (error) {
        lastError = error;
        // Only a transport failure is worth another attempt; a real HTTP status or
        // malformed body would fail the same way again.
        if (!isTransportFailure(error)) throw error;
      }
    }
    // The CDN drops idle keep-alive sockets, so the first request after a pause can
    // die on a stale connection. A fresh socket on the next round usually succeeds.
    if (round < TRANSPORT_ROUNDS) await delay(TRANSPORT_RETRY_MS);
  }

  throw lastError ?? codedError('upstream_error', 'The market data source is unavailable.');
}

function protocolOrder(host) {
  const preferred = protocolPreference.get(host) ?? PROTOCOLS[0];
  return [preferred, ...PROTOCOLS.filter((protocol) => protocol !== preferred)];
}

function isTransportFailure(error) {
  const code = errorCode(error);
  return code !== 'upstream_error' && code !== 'not_found';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestText(ctx, url) {
  const result = await ctx.web.fetch({ url });
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw codedError('upstream_error', `Market data source returned HTTP ${result.statusCode}.`);
  }
  const content = result.body?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw codedError('upstream_error', 'Market data source returned an empty body.');
  }
  return content;
}

function parseCodes(raw) {
  const tokens = raw.split(/[,，；\s]+/).map((token) => token.trim()).filter(Boolean);
  const codes = [];
  const invalid = [];
  const seen = new Set();

  for (const token of tokens) {
    const entry = normalizeCode(token);
    if (!entry) {
      invalid.push(token);
      continue;
    }
    if (!seen.has(entry.secid)) {
      seen.add(entry.secid);
      codes.push(entry);
    }
  }

  if (codes.length > MAX_CODES) {
    throw codedError('too_many_codes', `At most ${MAX_CODES} codes can be watched at once.`);
  }

  return { codes, invalid };
}

function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!value) return null;

  let digits;
  let market;
  let match;

  if ((match = /^(SH|SZ|BJ)(\d{6})$/.exec(value))) {
    market = match[1];
    digits = match[2];
  } else if ((match = /^(\d{6})[.](SH|SZ|BJ)$/.exec(value))) {
    digits = match[1];
    market = match[2];
  } else if ((match = /^HK(\d{1,5})$/.exec(value))) {
    market = 'HK';
    digits = match[1].padStart(5, '0');
  } else if ((match = /^(\d{1,5})[.]HK$/.exec(value))) {
    market = 'HK';
    digits = match[1].padStart(5, '0');
  } else if ((match = /^(KS|KR)(\d{6})$/.exec(value))) {
    market = 'KR';
    digits = match[2];
  } else if ((match = /^(\d{6})[.](KS|KR)$/.exec(value))) {
    market = 'KR';
    digits = match[1];
  } else if ((match = /^(A50|CN00Y|FTSEA50|A50QH)$/.exec(value))) {
    market = 'A50';
    digits = 'A50';
  } else if ((match = /^US[.:]([A-Z][A-Z0-9]{0,5})$/.exec(value))) {
    market = 'US';
    digits = match[1];
  } else if ((match = /^([A-Z][A-Z0-9]{0,5})[.]US$/.exec(value))) {
    market = 'US';
    digits = match[1];
  } else if ((match = /^([A-Z][A-Z0-9]{0,5})$/.exec(value))) {
    // A bare ticker can only be a US symbol: every other market keys off digits.
    market = 'US';
    digits = match[1];
  } else if ((match = /^(\d{6})$/.exec(value))) {
    digits = match[1];
    market = inferMarket(digits);
  } else if ((match = /^(\d{1,5})$/.exec(value))) {
    // Shorter numeric codes can only be Hong Kong here: mainland codes are six digits.
    market = 'HK';
    digits = value.padStart(5, '0');
  } else {
    return null;
  }

  return {
    code: digits,
    market,
    secid: secidFor(market, digits),
  };
}

function inferMarket(digits) {
  // 920xxx is a Beijing code even though it starts with 9, so test Beijing first.
  if (/^(4|8|92)/.test(digits)) return 'BJ';
  if (/^[569]/.test(digits)) return 'SH';
  return 'SZ';
}

function analyze(quote, bars) {
  const closes = bars.map((bar) => bar.close);
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const volumes = bars.map((bar) => bar.volume ?? 0);
  const length = closes.length;
  const last = bars[length - 1];
  const price = finite(quote?.price) ? quote.price : closes[length - 1];

  const ma5 = avgLast(closes, 5);
  const ma10 = avgLast(closes, 10);
  const ma20 = avgLast(closes, 20);
  const ma60 = length >= 60 ? avgLast(closes, 60) : null;

  const rsi = rsi14(closes);
  const macd = macdAt(closes);
  const atr = atr14(bars);
  const volatility20 = annualizedVolatility(closes, 20);

  const return5 = returnOver(closes, price, 5);
  const return20 = returnOver(closes, price, 20);
  const return60 = returnOver(closes, price, 60);

  const avgVolume20 = avgLast(volumes, 20);
  const volumeRatio = finite(quote?.volumeRatio)
    ? quote.volumeRatio
    : (avgVolume20 && avgVolume20 > 0 ? (volumes[length - 1] ?? 0) / avgVolume20 : null);

  const prior20 = bars.slice(0, -1).slice(-20);
  const prior60 = bars.slice(0, -1).slice(-60);
  const support1 = prior20.length >= 5 ? Math.min(...prior20.map((bar) => bar.low)) : null;
  const resistance1 = prior20.length >= 5 ? Math.max(...prior20.map((bar) => bar.high)) : null;
  const support2Raw = prior60.length >= 10 ? Math.min(...prior60.map((bar) => bar.low)) : null;
  const resistance2Raw = prior60.length >= 10 ? Math.max(...prior60.map((bar) => bar.high)) : null;
  const support2 = support2Raw != null && support2Raw < price ? support2Raw : null;
  const resistance2 = resistance2Raw != null && resistance2Raw > price ? resistance2Raw : null;

  const breakout20 = support1 != null && resistance1 != null && price > resistance1;
  const breakdown20 = support1 != null && resistance1 != null && price < support1;
  const nearResistance = resistance1 != null && !breakout20 && price >= resistance1 * 0.985;
  const nearSupport = support1 != null && !breakdown20 && price <= support1 * 1.015;

  let trend = 'range';
  if (ma5 != null && ma10 != null && ma20 != null) {
    if (ma5 > ma10 && ma10 > ma20 && price > ma20) trend = 'bull';
    else if (ma5 < ma10 && ma10 < ma20 && price < ma20) trend = 'bear';
    else if (price > ma20 && ma5 < ma10) trend = 'rebound';
    else if (price < ma20 && ma5 > ma10) trend = 'pullback';
  }

  const signals = [];
  if (ma5 != null && ma10 != null && ma20 != null) {
    if (ma5 > ma10 && ma10 > ma20) signals.push('ma_bull');
    else if (ma5 < ma10 && ma10 < ma20) signals.push('ma_bear');
  }
  if (macd) signals.push(macd.hist >= 0 ? 'macd_bull' : 'macd_bear');
  if (rsi != null) {
    if (rsi >= 70) signals.push('rsi_hot');
    else if (rsi <= 30) signals.push('rsi_oversold');
  }
  if (volumeRatio != null) {
    if (volumeRatio >= 1.4) signals.push('volume_expand');
    else if (volumeRatio <= 0.7) signals.push('volume_dry');
  }
  if (breakout20) signals.push('breakout');
  else if (breakdown20) signals.push('breakdown');
  else if (nearResistance) signals.push('near_resistance');
  else if (nearSupport) signals.push('near_support');

  let score = 50;
  if (ma5 != null) score += price > ma5 ? 4 : -4;
  if (ma5 != null && ma10 != null) score += ma5 > ma10 ? 5 : -5;
  if (ma10 != null && ma20 != null) score += ma10 > ma20 ? 6 : -6;
  if (ma20 != null && ma60 != null) score += ma20 > ma60 ? 6 : -6;
  if (macd) score += macd.hist >= 0 ? 8 : -8;
  if (rsi != null) {
    if (rsi >= 45 && rsi <= 65) score += 4;
    else if (rsi > 75) score -= 8;
    else if (rsi < 25) score += 3;
    else if (rsi < 40) score -= 3;
  }
  if (return20 != null) score += return20 > 0 ? 5 : -5;
  if (volumeRatio != null && return5 != null) {
    if (volumeRatio > 1.25 && return5 > 0) score += 4;
    else if (volumeRatio > 1.25 && return5 < 0) score -= 4;
  }
  if (breakout20) score += 5;
  else if (breakdown20) score -= 6;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const bias = score >= 60 ? 'bullish' : score <= 40 ? 'bearish' : 'neutral';

  return {
    price: round(price, 3),
    lastDate: last.date,
    bars: length,
    ma5: round(ma5, 3),
    ma10: round(ma10, 3),
    ma20: round(ma20, 3),
    ma60: round(ma60, 3),
    rsi14: round(rsi, 2),
    macd: macd ? {
      dif: round(macd.dif, 4),
      dea: round(macd.dea, 4),
      hist: round(macd.hist, 4),
    } : null,
    atr14: round(atr, 3),
    volatility20: round(volatility20, 2),
    return5: round(return5, 2),
    return20: round(return20, 2),
    return60: round(return60, 2),
    volumeRatio: round(volumeRatio, 2),
    trend,
    score,
    bias,
    signals,
    levels: {
      // Three decimals keeps Hong Kong penny prices meaningful and leaves mainland levels untouched.
      support1: round(support1, 3),
      support2: round(support2, 3),
      resistance1: round(resistance1, 3),
      resistance2: round(resistance2, 3),
    },
    flags: {
      breakout20,
      breakdown20,
      nearSupport,
      nearResistance,
    },
  };
}

function avgLast(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  let sum = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isFinite(value)) return null;
    sum += value;
  }
  return sum / period;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function returnOver(closes, price, period) {
  if (closes.length <= period) return null;
  const base = closes[closes.length - 1 - period];
  if (!finite(base) || base === 0 || !finite(price)) return null;
  return ((price / base) - 1) * 100;
}

function rsi14(closes, period = 14) {
  if (closes.length <= period) return null;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = closes[index] - closes[index - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let index = period + 1; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function ema(values, period) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const multiplier = 2 / (period + 1);
  const result = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    result.push((values[index] * multiplier) + (result[index - 1] * (1 - multiplier)));
  }
  return result;
}

function macdAt(closes) {
  if (closes.length < 35) return null;
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const dif = closes.map((_, index) => ema12[index] - ema26[index]);
  const dea = ema(dif, 9);
  const last = closes.length - 1;
  return {
    dif: dif[last],
    dea: dea[last],
    hist: (dif[last] - dea[last]) * 2,
  };
}

function atr14(bars, period = 14) {
  if (bars.length <= period) return null;
  let sum = 0;
  let count = 0;
  for (let index = bars.length - period; index < bars.length; index += 1) {
    const high = bars[index].high;
    const low = bars[index].low;
    const previousClose = bars[index - 1].close;
    if (!finite(high) || !finite(low) || !finite(previousClose)) continue;
    sum += Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
    count += 1;
  }
  return count === period ? sum / period : null;
}

function annualizedVolatility(closes, period = 20) {
  if (closes.length <= period) return null;
  const returns = [];
  for (let index = closes.length - period; index < closes.length; index += 1) {
    const previous = closes[index - 1];
    if (!finite(previous) || previous <= 0) return null;
    returns.push(Math.log(closes[index] / previous));
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function num(value) {
  if (value == null || value === '' || value === '-') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function scale(value, factor) {
  if (!finite(value)) return null;
  return value * factor;
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value, digits) {
  if (!finite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function errorCode(error) {
  return error && typeof error === 'object' && typeof error.code === 'string'
    ? error.code
    : 'upstream_error';
}

function sendJson(res, status, payload) {
  if (res.writableEnded) return;
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}
