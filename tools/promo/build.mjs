// Builds a static promo page from the running plugin's real payloads, so the
// README screenshots show genuine data. Run: node tools/promo/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const base = process.env.SW_BASE || 'http://127.0.0.1:59211';
const outDir = join(root, 'docs', 'promo');
mkdirSync(outDir, { recursive: true });

const clientSource = readFileSync(join(root, 'client.js'), 'utf8');
const cssStart = clientSource.indexOf('const CSS = `');
const cssEnd = clientSource.indexOf('\n    `;', cssStart);
const CSS = clientSource.slice(cssStart + 'const CSS = `'.length, cssEnd);

async function getJson(path) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
}

const [watch, kline, world, sectors, storage] = await Promise.all([
  getJson('/plugins/stock-watch/data?codes=SH600519,SH603986,HK00700,US.MU,US.SNDK,KR005930,KR000660,A50'),
  getJson('/plugins/stock-watch/kline.json?code=SH600519&period=day'),
  getJson('/plugins/stock-watch/world.json'),
  getJson('/plugins/stock-watch/sectors.json'),
  getJson('/plugins/stock-watch/storage.json'),
]);

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const money = (value, digits = 2) => (typeof value === 'number'
  ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  : '—');

const pct = (value) => (typeof value === 'number'
  ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
  : '—');

const tone = (value) => (typeof value !== 'number' ? '' : value > 0 ? 'is-up' : value < 0 ? 'is-down' : '');

function candleSvg(bars, width = 560, height = 210) {
  const data = (bars || []).slice(-60);
  if (data.length < 2) return '<div class="sw-inline-empty">no bars</div>';
  const left = 44;
  const right = 10;
  const top = 10;
  const bottom = 20;
  const volumeHeight = 34;
  const gap = 8;
  const priceBottom = height - bottom - volumeHeight - gap;
  const volumeBottom = height - bottom;
  const highs = data.map((bar) => bar.high);
  const lows = data.map((bar) => bar.low);
  const volumes = data.map((bar) => bar.volume ?? 0);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = max - min || 1;
  const yMax = max + span * 0.06;
  const yMin = min - span * 0.06;
  const plot = width - left - right;
  const x = (index) => left + (index / (data.length - 1)) * plot;
  const y = (value) => top + (1 - (value - yMin) / (yMax - yMin)) * (priceBottom - top);
  const barWidth = Math.max(1.4, (plot / data.length) * 0.62);
  const maxVolume = Math.max(...volumes) || 1;

  const parts = [];
  for (const ratio of [0, 0.5, 1]) {
    const value = yMin + (yMax - yMin) * ratio;
    const lineY = y(value);
    parts.push(`<line x1="${left}" x2="${width - right}" y1="${lineY}" y2="${lineY}" stroke="var(--dsw-alias-border-l1)" stroke-dasharray="3 4"/>`);
    parts.push(`<text x="${left - 6}" y="${lineY + 3}" text-anchor="end">${value.toFixed(2)}</text>`);
  }
  data.forEach((bar, index) => {
    const up = bar.close >= bar.open;
    const color = up ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-success-primary)';
    const bodyTop = y(Math.max(bar.open, bar.close));
    const bodyBottom = y(Math.min(bar.open, bar.close));
    parts.push(`<line x1="${x(index)}" x2="${x(index)}" y1="${y(bar.high)}" y2="${y(bar.low)}" stroke="${color}"/>`);
    parts.push(`<rect x="${(x(index) - barWidth / 2).toFixed(2)}" y="${bodyTop.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(1, bodyBottom - bodyTop).toFixed(2)}" fill="${color}" opacity="0.92"/>`);
    const volumeBar = (volumes[index] / maxVolume) * volumeHeight;
    parts.push(`<rect x="${(x(index) - barWidth / 2).toFixed(2)}" y="${(volumeBottom - volumeBar).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(1, volumeBar).toFixed(2)}" fill="${color}" opacity="0.42"/>`);
  });
  parts.push(`<text x="${left}" y="${height - 5}">${esc(data[0].date)}</text>`);
  parts.push(`<text x="${width - right}" y="${height - 5}" text-anchor="end">${esc(data[data.length - 1].date)}</text>`);

  const closes = data.map((bar) => bar.close);
  const average = (values, period) => values.map((_, index) => {
    if (index < period - 1) return null;
    let sum = 0;
    for (let offset = 0; offset < period; offset += 1) sum += values[index - offset];
    return sum / period;
  });
  const pathOf = (series, color) => {
    const path = series.map((value, index) => {
      if (value == null) return null;
      const command = index === 0 || series[index - 1] == null ? 'M' : 'L';
      return `${command}${x(index).toFixed(2)},${y(value).toFixed(2)}`;
    }).filter(Boolean).join(' ');
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.3"/>`;
  };
  parts.push(pathOf(average(closes, 5), 'var(--dsw-alias-state-warn-primary)'));
  parts.push(pathOf(average(closes, 20), 'var(--dsw-alias-brand-primary)'));
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%;height:${height}px;display:block">${parts.join('')}</svg>`;
}

function lineSvg(points, width = 520, height = 120) {
  const data = (points || []).slice(-40);
  if (data.length < 2) return '<div class="sw-inline-empty">no data</div>';
  const values = data.map((point) => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const x = (index) => 8 + (index / (data.length - 1)) * (width - 16);
  const y = (value) => 10 + (1 - (value - min + span * 0.12) / (span * 1.24)) * (height - 30);
  const line = data.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${height - 14} L8,${height - 14} Z`;
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%;height:${height}px;display:block">
    <path d="${area}" fill="var(--dsw-alias-brand-primary)" opacity="0.1"/>
    <path d="${line}" fill="none" stroke="var(--dsw-alias-brand-primary)" stroke-width="2"/>
  </svg>`;
}

const items = watch.items || [];
const detail = items.find((item) => item.key === 'SH600519') || items[0];

const listCards = items.map((item, index) => {
  const quote = item.quote || {};
  const active = index === 0;
  return `<div class="sw-card${active ? ' is-active' : ''}">
    <div class="sw-card-top"><span class="sw-card-name">${esc(item.name)}</span><span class="sw-card-code">${esc(item.code)}</span></div>
    <div class="sw-card-price ${tone(quote.changePct)}">${money(quote.price)}<span class="sw-card-pct">${pct(quote.changePct)}</span></div>
    <div class="sw-card-meta">${esc(item.market)} · ${quote.pe ? `PE ${quote.pe}` : 'PE —'}</div>
  </div>`;
}).join('');

const worldCards = (world.groups || []).flatMap((group) => group.items.map((item) => `<div class="sw-world-card">
  <div class="sw-world-top"><span class="sw-world-name">${esc(item.name)}</span><span class="sw-session">${esc(item.session?.label ?? '')}</span></div>
  <div class="sw-world-price ${tone(item.changePct)}">${money(item.price)}</div>
  <div class="sw-world-pct ${tone(item.changePct)}">${pct(item.changePct)}</div>
</div>`)).join('');

const themeCards = (sectors.groups.find((group) => group.id === 'themes')?.items || []).map((item) => `<div class="sw-world-card">
  <div class="sw-world-top"><span class="sw-world-name">${esc(item.name)}</span><span class="sw-session">${esc(item.board || '—')}</span></div>
  <div class="sw-world-price ${tone(item.pct)}">${pct(item.pct)}</div>
  <div class="sw-world-pct">领涨 ${esc(item.leader || '—')}</div>
</div>`).join('');

const industryRows = (sectors.groups.find((group) => group.id === 'industry')?.items || []).map((item) => `<div class="sw-row">
  <span class="sw-row-name">${esc(item.name)}</span>
  <span class="sw-row-pct ${tone(item.pct)}">${pct(item.pct)}</span>
</div>`).join('');

const usRows = (sectors.groups.find((group) => group.id === 'us')?.items || []).map((item) => `<div class="sw-row">
  <span class="sw-row-name">${esc(item.name)}</span>
  <span class="sw-row-pct ${tone(item.pct)}">${pct(item.pct)}</span>
</div>`).join('');

const storageSeries = (storage.series || []);
const storageCards = storageSeries.map((series) => `<div class="sw-storage-card">
  <div class="sw-storage-head">
    <div><div class="sw-storage-name">${esc(series.name)}</div><div class="sw-storage-sub">${esc(series.unit)} · ${series.frequency === 'week' ? '周频' : '日频'}</div></div>
    <div style="text-align:right"><div class="sw-storage-value ${tone(series.changePct)}">${series.latest ?? '—'}</div><div class="sw-storage-sub">${pct(series.changePct)}</div></div>
  </div>
  ${lineSvg(series.points)}
</div>`).join('');

const referenceCards = (storage.references || []).map((card) => `<div class="sw-ref-card">
  <div class="sw-world-top"><span class="sw-world-name">${esc(card.name)}</span><span class="sw-session">参考口径</span></div>
  <div class="sw-ref-note">${esc(card.note)}</div>
  ${(card.points || []).map((point) => `<div class="sw-ref-point"><span class="sw-ref-date">${esc(point.date)}</span><span>${esc(point.text)}</span></div>`).join('')}
</div>`).join('');

const PAGE_HEIGHTS = { watch: 740, world: 540, sectors: 800, storage: 1000 };

const page = (title, body) => {
  const height = PAGE_HEIGHTS[title] ?? 760;
  return `<section class="shot" id="${title}" style="height:${height + 56}px">
  <div class="sw-root" style="height:${height}px">
    <div class="sw-tabs">
      <button class="sw-tab${title === 'watch' ? ' is-active' : ''}">自选</button>
      <button class="sw-tab${title === 'world' ? ' is-active' : ''}">全球市场</button>
      <button class="sw-tab${title === 'sectors' ? ' is-active' : ''}">板块</button>
      <button class="sw-tab${title === 'storage' ? ' is-active' : ''}">存储价格</button>
    </div>
    ${body}
  </div>
</section>`;
};

const watchPage = page('watch', `<div class="sw-body">
  <aside class="sw-list-panel">
    <div class="sw-panel-head"><h2>自选</h2><span class="sw-count">${items.length} 只</span></div>
    <div class="sw-list">${listCards}</div>
  </aside>
  <div class="sw-detail">
    <div class="sw-detail-head">
      <div><div class="sw-name-row"><h1 class="sw-detail-title">${esc(detail?.name || '')}</h1>
      <span class="sw-code-chip">${esc(detail?.market || '')} ${esc(detail?.code || '')}</span></div>
      <div class="sw-detail-sub">${esc(detail?.quote?.quoteTime || '')}</div></div>
      <div class="sw-detail-price ${tone(detail?.quote?.changePct)}">${money(detail?.quote?.price)}<span class="sw-detail-pct">${pct(detail?.quote?.changePct)}</span></div>
    </div>
    <div class="sw-chart-card">
      <div class="sw-chart-head"><span class="sw-chart-title">价格走势</span>
        <div class="sw-legend"><span><i style="background:var(--dsw-alias-state-error-primary)"></i>涨</span><span><i style="background:var(--dsw-alias-state-success-primary)"></i>跌</span><span><i style="background:var(--dsw-alias-state-warn-primary)"></i>MA5</span><span><i style="background:var(--dsw-alias-brand-primary)"></i>MA20</span></div>
        <div class="sw-chips"><button class="sw-chip is-active">日线</button><button class="sw-chip">周线</button><button class="sw-chip">月线</button></div>
      </div>
      <div class="sw-chart-toolbar">
        <div class="sw-chart-nav"><button class="sw-chip sw-chip-icon">‹</button><button class="sw-chip sw-chip-icon">›</button>
        <span class="sw-chart-range">${esc(kline.bars?.[0]?.date || '')} ~ ${esc(kline.bars?.[kline.bars.length - 1]?.date || '')} · 60根</span></div>
        <div class="sw-chart-nav"><button class="sw-chip sw-chip-icon">−</button><button class="sw-chip sw-chip-icon">+</button></div>
      </div>
      ${candleSvg(kline.bars)}
    </div>
  </div>
</div>`);

const worldPage = page('world', `<div class="sw-world">
  <div class="sw-world-head"><div class="sw-world-meta"><strong>全球市场</strong><span>· ${esc(world.session?.label ?? '')}</span></div></div>
  <div class="sw-world-grid">${worldCards}</div>
</div>`);

const sectorsPage = page('sectors', `<div class="sw-world">
  <div class="sw-world-head"><div class="sw-world-meta"><strong>板块</strong></div></div>
  <div class="sw-world-section">
    <div class="sw-world-section-head"><h3 class="sw-world-section-title">热点题材</h3><span class="sw-world-section-note">新浪概念板块口径</span></div>
    <div class="sw-world-grid">${themeCards}</div>
  </div>
  <div class="sw-world-section">
    <div class="sw-world-section-head"><h3 class="sw-world-section-title">行业涨幅榜</h3><span class="sw-world-section-note">新浪行业分类</span></div>
    <div class="sw-world-grid"><div class="sw-world-card sw-rows">${industryRows}</div><div class="sw-world-card sw-rows">${usRows}</div></div>
  </div>
</div>`);

const storagePage = page('storage', `<div class="sw-storage">
  <div class="sw-world-head"><div class="sw-world-meta"><strong>存储价格</strong><span class="sw-session">${esc(storage.source || 'CFM')}</span></div></div>
  <div class="sw-chips"><span class="sw-chips-label">品种</span>${storageSeries.map((series) => `<button class="sw-chip${series.id === storageSeries[0].id ? ' is-active' : ''}">${esc(series.name)} ${series.latest ?? ''}</button>`).join('')}</div>
  <div class="sw-chips"><span class="sw-chips-label">周期</span><button class="sw-chip is-active">日</button><button class="sw-chip">周</button><button class="sw-chip">月</button></div>
  <div class="sw-storage-grid">${storageCards}</div>
  <div class="sw-ref-grid">${referenceCards}</div>
</div>`);

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>
<title>dsh-stock-watch promo</title>
<style>
  :root {
    --dsw-alias-bg-base: #0f1115;
    --dsw-alias-bg-layer-1: #161a21;
    --dsw-alias-label-primary: #e8ecf3;
    --dsw-alias-label-secondary: #99a3b3;
    --dsw-alias-border-l1: #262d38;
    --dsw-alias-border-l2: #333c49;
    --dsw-alias-brand-primary: #4c8dff;
    --dsw-alias-state-error-primary: #f6465d;
    --dsw-alias-state-success-primary: #2ebd85;
    --dsw-alias-state-warn-primary: #f0b90b;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b0d11; font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif; color: var(--dsw-alias-label-primary); }
  .shot { width: 1280px; padding: 26px 28px 30px; }
  .sw-root { height: 760px; background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1); border-radius: 14px; overflow: hidden; }
  .sw-rows { display: flex; flex-direction: column; gap: 6px; }
  .sw-row { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; }
  .sw-row-name { color: var(--dsw-alias-label-primary); }
  .sw-row-pct { font-variant-numeric: tabular-nums; }
  .sw-storage-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .sw-ref-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .is-up { color: var(--dsw-alias-state-error-primary) !important; }
  .is-down { color: var(--dsw-alias-state-success-primary) !important; }
  .sw-card-price span, .sw-detail-price span { margin-left: 8px; font-size: 0.62em; font-weight: 600; }
  .sw-session:empty { display: none; }
  .sw-world-card { min-height: 96px; display: flex; flex-direction: column; gap: 6px; justify-content: center; }
  .sw-card { min-height: 74px; display: flex; flex-direction: column; gap: 4px; justify-content: center; }
  text { font-size: 9px; fill: var(--dsw-alias-label-secondary); }
  ${CSS}
</style></head><body>${watchPage}${worldPage}${sectorsPage}${storagePage}</body></html>`;

writeFileSync(join(outDir, 'preview.html'), html, 'utf8');
console.log('wrote', join(outDir, 'preview.html'));
