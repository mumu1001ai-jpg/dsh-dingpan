window.__ModuleLoader__.load({
  id: '@local/dsh-stock-watch',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useMemo, useState } = React;

    const NS = 'stock-watch';
    const STORAGE_KEY = 'dsh.stock-watch.watchlist.v1';
    const TICKER_KEY = 'dsh.stock-watch.taskbar.v1';
    const SEED_KEY = 'dsh.stock-watch.seeded.v3';
    const SEED_CODES = ['US.MU', 'KR005930', 'KR000660', 'US.SNDK', 'A50'];
    const DEFAULT_CODES = ['SH600519', 'SZ000001', 'SZ300750'];
    const MAX_CODES = 20;
    const REFRESH_MS = 30_000;
    const REQUEST_TIMEOUT_MS = 30_000;

    const ZH = {
      nav: '盯盘',
      tabWatch: '自选',
      tabWorld: '全球市场',
      worldTitle: '全球市场',
      worldMeta: '更新于 {time}',
      worldNoteAsia: '按当地交易时段',
      worldNoteUs: '期货为 CME 当月连续，现金指数为最近收盘',
      sessionOpen: '交易中',
      sessionClosed: '已收盘',
      sessionLunch: '午休',
      sessionPre: '盘前',
      sessionAfter: '盘后',
      sessionNight: '夜盘',
      worldFailed: '全球行情加载失败，稍后重试。',
      tabSectors: '板块',
      secThemes: '热点题材',
      secIndustry: '行业涨幅榜',
      secUs: '美股板块',
      secThemesNote: '按概念板块，领涨股为板块内最强',
      secIndustryNote: '东财行业板块涨幅前 12',
      secUsNote: 'SPDR 行业 ETF 对应 11 个 GICS 板块',
      secLeader: '领涨',
      sectorsFailed: '板块行情加载失败，稍后重试。',
      tabStorage: '存储价格',
      storageSeries: '品种',
      storagePeriod: '周期',
      storageDay: '日',
      storageWeek: '周',
      storageMonth: '月',
      storageWeekly: '周频，每周二 11:00 更新',
      storageDaily: '日频',
      storageNoData: '该品种暂无可绘制的历史数据。',
      storageFailed: '存储报价加载失败，稍后重试。',
      storageRefTitle: '无公开连续报价的品种',
      storageRefTag: '参考口径',
      title: '盯盘',
      subtitle: '自选行情、趋势结构与后续涨跌情景',
      addPlaceholder: '输入代码，如 600519、00700',
      add: '添加',
      addHint: '支持 A 股 / ETF（SH / SZ / BJ 前缀）、港股（HK 前缀，如 700）、韩股（KS 前缀，如 KS005930 三星）、美股（直接写代码，如 MU）；逗号分隔可一次添加多个。',
      addEmpty: '请输入至少一个股票代码。',
      addDuplicate: '这些代码已在自选中。',
      addError: '未识别：{codes}。请输入 6 位 A 股 / ETF、5 位港股、KS+6 位韩股或美股代码。',
      addLimit: '自选最多 20 只。',
      refresh: '刷新',
      updating: '更新中',
      taskbar: '任务栏',
      taskbarTitle: '在任务栏右侧显示自选行情；点两端箭头切换上一只 / 下一只，按住可拖动',
      taskbarFailed: '任务栏挂件启动失败：未找到可用的 Python 运行时。',
      updated: '更新于 {time}',
      autoRefresh: '每 30 秒自动刷新',
      marketOpen: '交易中',
      marketLunch: '午间休市',
      marketClosed: '已收盘',
      marketPre: '盘前',
      marketAfter: '盘后',
      preMarket: '盘前',
      afterHours: '盘后',
      marketWeekend: '周末休市',
      watchlist: '自选股',
      watchCount: '共 {n} 只',
      emptyTitle: '还没有自选股',
      emptyBody: '输入股票代码，开始跟踪走势与涨跌分析。',
      emptyExamples: '试试：600519 · 000001 · 00700',
      loading: '正在获取行情…',
      loadingShort: '加载中…',
      errorTitle: '行情加载失败',
      errorBody: '请检查网络或数据源后重试。',
      timeout: '请求超时',
      retry: '重试',
      remove: '移除 {name}',
      noData: '暂无行情',
      quoteError: '该股票行情获取失败：{reason}',
      notFound: '未找到该代码的行情',
      historyUnavailable: '历史 K 线暂不可用，仅显示实时报价。',
      quoteUnavailable: '实时报价暂不可用，当前基于最近收盘数据。',
      insufficientHistory: '历史数据不足，暂无法生成趋势研判。',
      dataUnavailable: '行情源暂时不可用，请稍后重试（{reason}）。',
      stale: '本次刷新失败，当前显示上次成功获取的数据。',
      detailEmptyTitle: '选择一只自选股',
      detailEmptyBody: '从列表中选择股票，查看实时行情、走势图与量化研判。',
      chartTitle: '价格走势',
      klineDay: '日线',
      klineWeek: '周线',
      klineMonth: '月线',
      klineOlder: '往前翻（更早）',
      klineNewer: '往后翻（更新）',
      klineZoomIn: '放大（K 线更少、更宽）',
      klineZoomOut: '缩小（K 线更多）',
      chartUp: '涨',
      chartDown: '跌',
      chartClose: '收盘',
      chartMA5: 'MA5',
      chartMA20: 'MA20',
      chartSupport: '支撑',
      chartResistance: '压力',
      chartNoData: '暂无足够历史数据绘制走势图。',
      chartFailed: '该周期的历史数据暂时取不到（数据源波动），稍后重试。',
      open: '今开',
      high: '最高',
      low: '最低',
      prevClose: '昨收',
      volume: '成交量',
      amount: '成交额',
      turnover: '换手',
      volumeRatio: '量比',
      pe: '市盈率',
      pb: '市净率',
      marketCap: '总市值',
      floatCap: '流通市值',
      lots: '手',
      shares: '股',
      quoteTime: '行情时间',
      day20: '20日',
      day60: '60日',
      trend: '趋势',
      score: '量化评分',
      scoreUnit: '分',
      biasBullish: '偏多',
      biasNeutral: '中性',
      biasBearish: '偏空',
      biasMeterLow: '偏空',
      biasMeterHigh: '偏多',
      analysisTitle: '走势与后续研判',
      signalsTitle: '关键信号',
      support: '支撑位',
      resistance: '压力位',
      scenarioTitle: '后续涨跌情景',
      scenarioUp: '上行观察：若放量站稳 {resistance}，上方空间有望打开。',
      scenarioDown: '下行观察：若跌破 {support}，短线趋势可能转弱。',
      scenarioBreakout: '已突破近 20 日压力 {resistance}，关注能否站稳；下一压力参考 {next}。',
      scenarioBreakdown: '已跌破近 20 日支撑 {support}，关注能否收回；下一支撑参考 {next}。',
      noLevel: '暂无',
      riskNote: '以上为基于历史价格与成交量的量化统计，不构成投资建议。市场有风险，决策需谨慎。',
      redUpGreenDown: '红涨绿跌',
      trendBull: '多头排列',
      trendBear: '空头排列',
      trendRange: '区间震荡',
      trendRebound: '反弹修复',
      trendPullback: '回调走弱',
      summaryBull: '均线呈多头排列，价格运行在中期均线上方，趋势结构偏强。',
      summaryBear: '均线呈空头排列，价格位于中期均线下方，趋势结构偏弱。',
      summaryRange: '均线交织，价格缺乏明确方向，短线以区间震荡看待。',
      summaryRebound: '价格回到中期均线上方，但短期均线尚未完全转强，属于反弹修复。',
      summaryPullback: '价格跌破中期均线，短期均线仍偏强，属于上涨后的回调。',
      sigMaBull: '均线多头',
      sigMaBear: '均线空头',
      sigMacdBull: 'MACD 红柱',
      sigMacdBear: 'MACD 绿柱',
      sigRsiHot: 'RSI 偏热',
      sigRsiOversold: 'RSI 超卖',
      sigVolumeExpand: '放量',
      sigVolumeDry: '缩量',
      sigBreakout: '突破 20 日压力',
      sigBreakdown: '跌破 20 日支撑',
      sigNearResistance: '逼近压力',
      sigNearSupport: '逼近支撑',
      metricRsi: 'RSI(14)',
      metricMacd: 'MACD 柱',
      metricVol: '20日年化波动',
      metricAtr: 'ATR(14)',
      metricRet20: '20日涨跌',
      metricRet60: '60日涨跌',
      metricVolRatio: '量比',
      metricBars: '样本',
      barsUnit: '根',
      price: '现价',
      change: '涨跌',
      lastBar: '最新交易日 {date}',
      dataSource: '数据源：腾讯 / 东方财富公开行情（港股为实时快照）',
      disclaimerShort: '量化统计，仅供参考',
    };

    const EN = {
      nav: 'Stock Watch',
      tabWatch: 'Watchlist',
      tabWorld: 'Global markets',
      worldTitle: 'Global markets',
      worldMeta: 'Updated {time}',
      worldNoteAsia: 'Local trading hours',
      worldNoteUs: 'Futures are front-month CME; cash indices show the latest close',
      sessionOpen: 'Open',
      sessionClosed: 'Closed',
      sessionLunch: 'Lunch break',
      sessionPre: 'Pre-market',
      sessionAfter: 'After hours',
      sessionNight: 'Overnight',
      worldFailed: 'Could not load the global board. Try again shortly.',
      tabSectors: 'Sectors',
      secThemes: 'Hot themes',
      secIndustry: 'Industry leaders',
      secUs: 'US sectors',
      secThemesNote: 'Concept boards; leader is the strongest constituent',
      secIndustryNote: 'Top 12 Eastmoney industry boards by change',
      secUsNote: 'SPDR sector ETFs standing in for the 11 GICS sectors',
      secLeader: 'Leader',
      sectorsFailed: 'Could not load the sector board. Try again shortly.',
      tabStorage: 'Storage prices',
      storageSeries: 'Product',
      storagePeriod: 'Period',
      storageDay: 'Day',
      storageWeek: 'Week',
      storageMonth: 'Month',
      storageWeekly: 'Weekly, every Tuesday 11:00',
      storageDaily: 'Daily',
      storageNoData: 'No drawable history for this product yet.',
      storageFailed: 'Could not load storage prices. Try again shortly.',
      storageRefTitle: 'No public continuous quote',
      storageRefTag: 'Reference',
      title: 'Stock Watch',
      subtitle: 'Watchlist quotes, trend structure, and scenarios for what comes next',
      addPlaceholder: 'Enter a code, e.g. 600519 or 00700',
      add: 'Add',
      addHint: 'A-share / ETF (SH, SZ, BJ), Hong Kong (HK, e.g. 700), Korean (KS, e.g. KS005930) or a US ticker (e.g. MU). Add several at once with commas.',
      addEmpty: 'Enter at least one stock code.',
      addDuplicate: 'Those codes are already on the watchlist.',
      addError: 'Not recognized: {codes}. Enter an A-share / ETF code, a HK code, KS+6 digits, or a US ticker.',
      addLimit: 'The watchlist holds at most 20 stocks.',
      refresh: 'Refresh',
      updating: 'Updating',
      taskbar: 'Taskbar',
      taskbarTitle: 'Show the watchlist in the taskbar; click the arrows to step through stocks, drag to move',
      taskbarFailed: 'Could not start the taskbar pill: no usable Python runtime found.',
      updated: 'Updated {time}',
      autoRefresh: 'Refreshes every 30 seconds',
      marketOpen: 'Market open',
      marketLunch: 'Lunch break',
      marketClosed: 'Market closed',
      marketPre: 'Pre-market',
      marketAfter: 'After hours',
      preMarket: 'Pre-market',
      afterHours: 'After hours',
      marketWeekend: 'Weekend',
      watchlist: 'Watchlist',
      watchCount: '{n} stocks',
      emptyTitle: 'No stocks yet',
      emptyBody: 'Add a stock code to start tracking its trend and scenarios.',
      emptyExamples: 'Try: 600519 · 000001 · 00700',
      loading: 'Loading quotes…',
      loadingShort: 'Loading…',
      errorTitle: 'Could not load quotes',
      errorBody: 'Check the network or data source and try again.',
      timeout: 'Request timed out',
      retry: 'Retry',
      remove: 'Remove {name}',
      noData: 'No quote',
      quoteError: 'Could not load this stock: {reason}',
      notFound: 'No quote was found for this code',
      historyUnavailable: 'Daily history is unavailable; showing the live quote only.',
      quoteUnavailable: 'The live quote is unavailable; showing the latest daily close.',
      insufficientHistory: 'Not enough history to build a trend read.',
      dataUnavailable: 'The market data source is unavailable right now ({reason}). Try again shortly.',
      stale: 'This refresh failed. Showing the last successful data.',
      detailEmptyTitle: 'Select a stock',
      detailEmptyBody: 'Choose a stock from the list to see its quote, chart, and quantitative read.',
      chartTitle: 'Price trend',
      klineDay: 'Daily',
      klineWeek: 'Weekly',
      klineMonth: 'Monthly',
      klineOlder: 'Older bars',
      klineNewer: 'Newer bars',
      klineZoomIn: 'Zoom in (fewer, wider candles)',
      klineZoomOut: 'Zoom out (more candles)',
      chartUp: 'Up',
      chartDown: 'Down',
      chartClose: 'Close',
      chartMA5: 'MA5',
      chartMA20: 'MA20',
      chartSupport: 'Support',
      chartResistance: 'Resistance',
      chartNoData: 'Not enough history to draw a chart.',
      chartFailed: 'History for this period is unavailable right now; try again shortly.',
      open: 'Open',
      high: 'High',
      low: 'Low',
      prevClose: 'Prev close',
      volume: 'Volume',
      amount: 'Turnover value',
      turnover: 'Turnover',
      volumeRatio: 'Volume ratio',
      pe: 'P/E',
      pb: 'P/B',
      marketCap: 'Market cap',
      floatCap: 'Float cap',
      lots: 'lots',
      shares: 'shares',
      quoteTime: 'Quote time',
      day20: '20D',
      day60: '60D',
      trend: 'Trend',
      score: 'Quant score',
      scoreUnit: 'pts',
      biasBullish: 'Bullish',
      biasNeutral: 'Neutral',
      biasBearish: 'Bearish',
      biasMeterLow: 'Bearish',
      biasMeterHigh: 'Bullish',
      analysisTitle: 'Trend and outlook',
      signalsTitle: 'Key signals',
      support: 'Support',
      resistance: 'Resistance',
      scenarioTitle: 'Scenarios ahead',
      scenarioUp: 'Upside watch: if price holds above {resistance} on volume, the upper range may open.',
      scenarioDown: 'Downside watch: a break below {support} could weaken the short-term trend.',
      scenarioBreakout: 'Price has cleared the 20-day resistance at {resistance}; watch whether it holds. Next resistance: {next}.',
      scenarioBreakdown: 'Price has broken the 20-day support at {support}; watch whether it reclaims it. Next support: {next}.',
      noLevel: 'n/a',
      riskNote: 'These are quantitative statistics from past price and volume, not investment advice. Markets carry risk.',
      redUpGreenDown: 'Red = up · green = down',
      trendBull: 'Bullish stack',
      trendBear: 'Bearish stack',
      trendRange: 'Range-bound',
      trendRebound: 'Rebound',
      trendPullback: 'Pullback',
      summaryBull: 'Moving averages are stacked upward and price sits above the medium-term average; the trend structure is strong.',
      summaryBear: 'Moving averages are stacked downward and price sits below the medium-term average; the trend structure is weak.',
      summaryRange: 'Moving averages are intertwined and price lacks direction; treat the short term as range-bound.',
      summaryRebound: 'Price has reclaimed the medium-term average while short averages are still turning up; this is a rebound repair.',
      summaryPullback: 'Price has slipped below the medium-term average while short averages remain firm; this looks like a pullback after a rise.',
      sigMaBull: 'Bullish MAs',
      sigMaBear: 'Bearish MAs',
      sigMacdBull: 'MACD positive',
      sigMacdBear: 'MACD negative',
      sigRsiHot: 'RSI hot',
      sigRsiOversold: 'RSI oversold',
      sigVolumeExpand: 'Volume expansion',
      sigVolumeDry: 'Volume dry-up',
      sigBreakout: '20D breakout',
      sigBreakdown: '20D breakdown',
      sigNearResistance: 'Near resistance',
      sigNearSupport: 'Near support',
      metricRsi: 'RSI(14)',
      metricMacd: 'MACD hist',
      metricVol: '20D annualized vol',
      metricAtr: 'ATR(14)',
      metricRet20: '20D return',
      metricRet60: '60D return',
      metricVolRatio: 'Volume ratio',
      metricBars: 'Sample',
      barsUnit: 'bars',
      price: 'Last',
      change: 'Change',
      lastBar: 'Last session {date}',
      dataSource: 'Source: public Tencent / Eastmoney quotes (live Hong Kong snapshot)',
      disclaimerShort: 'Quantitative statistics only',
    };

    const CSS = `
      .sw-root {
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: var(--dsw-alias-bg-base);
        color: var(--dsw-alias-label-primary);
        font-family: inherit;
      }
      .sw-root *, .sw-root *::before, .sw-root *::after { box-sizing: border-box; }
      .sw-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        padding: 20px 24px 16px;
        border-bottom: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-base);
      }
      .sw-heading { min-width: 0; }
      .sw-eyebrow {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 11px;
        line-height: 1;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--dsw-alias-label-secondary);
      }
      .sw-eyebrow-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: var(--dsw-alias-brand-primary);
      }
      .sw-title {
        margin: 8px 0 0;
        font-size: 22px;
        line-height: 1.2;
        font-weight: 650;
        letter-spacing: -.02em;
      }
      .sw-subtitle {
        margin: 5px 0 0;
        font-size: 12px;
        line-height: 1.5;
        color: var(--dsw-alias-label-secondary);
      }
      .sw-header-side {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .sw-status {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 30px;
        padding: 0 10px;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 999px;
        font-size: 11px;
        color: var(--dsw-alias-label-secondary);
        white-space: nowrap;
        background: var(--dsw-alias-bg-layer-1);
      }
      .sw-status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); }
      .sw-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        padding: 0 24px;
        border-bottom: 1px solid var(--dsw-alias-border-l1);
      }
      .sw-tab {
        appearance: none;
        border: 0;
        background: transparent;
        padding: 9px 12px 10px;
        font: inherit;
        font-size: 13px;
        color: var(--dsw-alias-label-secondary);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: color .15s ease, border-color .15s ease;
      }
      .sw-tab:hover { color: var(--dsw-alias-label-primary); }
      .sw-tab:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
      .sw-tab.is-active {
        color: var(--dsw-alias-brand-primary);
        border-bottom-color: var(--dsw-alias-brand-primary);
        font-weight: 600;
      }
      .sw-world {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 16px 24px 24px;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .sw-world-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .sw-world-title { margin: 0; font-size: 14px; color: var(--dsw-alias-label-primary); }
      .sw-world-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 11.5px;
        color: var(--dsw-alias-label-secondary);
      }
      .sw-world-section { display: flex; flex-direction: column; gap: 10px; }
      .sw-world-section-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      .sw-world-section-title {
        margin: 0;
        font-size: 12px;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--dsw-alias-label-secondary);
      }
      .sw-world-section-note { font-size: 11px; color: var(--dsw-alias-label-secondary); opacity: .75; }
      .sw-world-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: 10px;
      }
      .sw-world-card {
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 12px;
        padding: 10px 12px 11px;
        background: var(--dsw-alias-bg-layer-1);
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      .sw-world-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .sw-world-name {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--dsw-alias-label-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sw-world-price {
        font-size: 19px;
        font-weight: 650;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
      }
      .sw-world-chg {
        font-size: 11.5px;
        font-variant-numeric: tabular-nums;
      }
      .sw-sector-sub {
        font-size: 11px;
        color: var(--dsw-alias-label-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sw-ext {
        font-size: 11px;
        color: var(--dsw-alias-label-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .sw-storage {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 16px 24px 24px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .sw-chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .sw-chips-label {
        font-size: 11px;
        color: var(--dsw-alias-label-secondary);
        letter-spacing: .06em;
        text-transform: uppercase;
        margin-right: 2px;
      }
      .sw-chip {
        border: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-secondary);
        border-radius: 999px;
        padding: 5px 11px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        transition: color .15s ease, border-color .15s ease, background .15s ease;
      }
      .sw-chip:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
      .sw-chip.is-active {
        border-color: var(--dsw-alias-brand-primary);
        color: var(--dsw-alias-brand-primary);
        background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
        font-weight: 600;
      }
      .sw-chip:disabled { opacity: .5; cursor: default; }
      .sw-storage-card {
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 12px;
        background: var(--dsw-alias-bg-layer-1);
        padding: 12px 14px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .sw-storage-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }
      .sw-storage-name { font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary); }
      .sw-storage-value { font-size: 24px; font-weight: 650; font-variant-numeric: tabular-nums; }
      .sw-storage-sub { font-size: 11.5px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .sw-storage-chart { width: 100%; height: 220px; display: block; }
      .sw-chart-label { font-size: 10px; fill: var(--dsw-alias-label-secondary); }
      .sw-ref-card {
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 12px;
        background: var(--dsw-alias-bg-layer-1);
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .sw-ref-note { font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
      .sw-ref-point { font-size: 12px; display: flex; gap: 10px; }
      .sw-ref-date { color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; flex: none; }
      .sw-session {
        flex: none;
        font-size: 10px;
        line-height: 1;
        padding: 3px 6px;
        border-radius: 999px;
        border: 1px solid var(--dsw-alias-border-l1);
        color: var(--dsw-alias-label-secondary);
        white-space: nowrap;
      }
      .sw-session.is-open {
        color: var(--dsw-alias-state-success-primary);
        border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 45%, transparent);
        background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent);
      }
      .sw-session.is-warm {
        color: var(--dsw-alias-state-warn-primary);
        border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, transparent);
        background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);
      }
      .sw-status.is-open .sw-status-dot { background: var(--dsw-alias-state-success-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, transparent); }
      .sw-status.is-pre .sw-status-dot { background: var(--dsw-alias-state-warn-primary); }
      .sw-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 30px;
        padding: 0 12px;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 8px;
        background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        transition: background .15s ease, border-color .15s ease;
      }
      .sw-btn:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l2); }
      .sw-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
      .sw-btn:disabled { cursor: default; opacity: .62; }
      .sw-btn-primary {
        border-color: var(--dsw-alias-brand-primary);
        color: var(--dsw-alias-brand-primary);
      }
      .sw-btn.is-on {
        border-color: var(--dsw-alias-brand-primary);
        color: var(--dsw-alias-brand-primary);
        background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
      }
      .sw-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--dsw-alias-state-idle-primary);
      }
      .sw-btn.is-on .sw-dot { background: currentColor; }
      .sw-btn-icon { padding: 0; width: 30px; }
      .sw-spin { animation: sw-spin 1s linear infinite; }
      @keyframes sw-spin { to { transform: rotate(360deg); } }
      .sw-body {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: 300px minmax(0, 1fr);
        gap: 16px;
        padding: 16px 24px 22px;
        overflow: hidden;
      }
      .sw-list-panel {
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .sw-panel-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        padding: 1px 1px 0;
      }
      .sw-panel-head h2 {
        margin: 0;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: .06em;
        text-transform: uppercase;
        color: var(--dsw-alias-label-secondary);
      }
      .sw-count { font-size: 11px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .sw-add {
        display: flex;
        gap: 6px;
        padding: 6px;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 10px;
        background: var(--dsw-alias-bg-layer-1);
      }
      .sw-add:focus-within { border-color: var(--dsw-alias-brand-primary); }
      .sw-input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--dsw-alias-label-primary);
        font: inherit;
        font-size: 12px;
        padding: 4px 6px;
      }
      .sw-input::placeholder { color: var(--dsw-alias-label-secondary); opacity: .8; }
      .sw-add-btn {
        border: 0;
        border-radius: 7px;
        background: var(--dsw-alias-brand-primary);
        color: var(--dsw-alias-bg-base);
        font: inherit;
        font-size: 11px;
        font-weight: 650;
        padding: 0 11px;
        min-height: 28px;
        cursor: pointer;
      }
      .sw-add-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
      .sw-form-error {
        font-size: 11px;
        line-height: 1.5;
        color: var(--dsw-alias-state-error-primary);
        padding: 0 2px;
      }
      .sw-hint { margin: 0; padding: 0 2px; font-size: 10.5px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
      .sw-list {
        min-height: 0;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 1px 3px 1px 1px;
        scrollbar-width: thin;
      }
      .sw-card {
        position: relative;
        flex: 0 0 auto;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 12px;
        background: var(--dsw-alias-bg-layer-1);
        transition: border-color .15s ease, background .15s ease;
      }
      .sw-card:hover { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); }
      .sw-card.is-active { border-color: var(--dsw-alias-brand-primary); box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary); }
      .sw-card-main {
        display: block;
        width: 100%;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        padding: 11px 12px 10px;
        border-radius: 11px;
        cursor: pointer;
      }
      .sw-card-main:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
      .sw-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-right: 16px; }
      .sw-card-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sw-card-sub { margin-top: 2px; font-size: 10px; color: var(--dsw-alias-label-secondary); letter-spacing: .02em; font-variant-numeric: tabular-nums; }
      .sw-price-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: 9px; }
      .sw-card-price { font-size: 17px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
      .sw-card-meta { font-size: 10px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sw-chg { font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .sw-spark { display: block; width: 100%; height: 30px; margin-top: 8px; overflow: visible; }
      .sw-spark-empty { height: 30px; margin-top: 8px; border-radius: 4px; background: linear-gradient(90deg, var(--dsw-alias-bg-layer-2), var(--dsw-alias-bg-layer-1), var(--dsw-alias-bg-layer-2)); background-size: 200% 100%; animation: sw-shimmer 1.5s infinite linear; }
      @keyframes sw-shimmer { to { background-position: -200% 0; } }
      .sw-del {
        position: absolute;
        top: 7px;
        right: 7px;
        width: 22px;
        height: 22px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        font: inherit;
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
        opacity: 0;
        transition: opacity .12s ease, background .12s ease;
      }
      .sw-card:hover .sw-del, .sw-card:focus-within .sw-del { opacity: 1; }
      .sw-del:hover { background: var(--dsw-alias-bg-base); color: var(--dsw-alias-state-error-primary); }
      .sw-del:focus-visible { opacity: 1; outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
      .sw-empty-list {
        border: 1px dashed var(--dsw-alias-border-l1);
        border-radius: 12px;
        padding: 22px 14px;
        text-align: center;
        color: var(--dsw-alias-label-secondary);
      }
      .sw-empty-list strong { display: block; color: var(--dsw-alias-label-primary); font-size: 13px; margin-bottom: 5px; }
      .sw-empty-list p { margin: 0; font-size: 11px; line-height: 1.55; }
      .sw-empty-list small { display: block; margin-top: 8px; font-size: 10px; opacity: .8; }
      .sw-skeleton-list { display: flex; flex-direction: column; gap: 8px; }
      .sw-skeleton {
        height: 96px;
        border-radius: 12px;
        border: 1px solid var(--dsw-alias-border-l1);
        background: linear-gradient(90deg, var(--dsw-alias-bg-layer-1), var(--dsw-alias-bg-layer-2), var(--dsw-alias-bg-layer-1));
        background-size: 200% 100%;
        animation: sw-shimmer 1.5s infinite linear;
      }
      .sw-detail {
        min-width: 0;
        min-height: 0;
        overflow: auto;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 16px;
        background: var(--dsw-alias-bg-layer-1);
        padding: 20px;
        scrollbar-width: thin;
      }
      .sw-detail-empty {
        min-height: 320px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-align: center;
        color: var(--dsw-alias-label-secondary);
        padding: 30px;
      }
      .sw-detail-empty strong { color: var(--dsw-alias-label-primary); font-size: 15px; }
      .sw-detail-empty p { margin: 0; font-size: 12px; line-height: 1.6; max-width: 340px; }
      .sw-detail-empty-art { margin-bottom: 4px; opacity: .55; }
      .sw-detail-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        flex-wrap: wrap;
      }
      .sw-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .sw-detail-title { margin: 0; font-size: 20px; line-height: 1.2; font-weight: 650; letter-spacing: -.02em; }
      .sw-code-chip {
        display: inline-flex;
        align-items: center;
        min-height: 20px;
        padding: 0 7px;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 5px;
        font-size: 10px;
        color: var(--dsw-alias-label-secondary);
        letter-spacing: .04em;
        font-variant-numeric: tabular-nums;
      }
      .sw-price-line { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
      .sw-big-price { font-size: 34px; line-height: 1; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -.03em; }
      .sw-big-change { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
      .sw-asof { font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
      .sw-last-bar { margin-top: 6px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
      .sw-side-stats { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .sw-side-stat {
        min-width: 82px;
        padding: 9px 11px;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 9px;
        background: var(--dsw-alias-bg-layer-2);
      }
      .sw-side-stat span { display: block; font-size: 9.5px; letter-spacing: .05em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .sw-side-stat strong { display: block; margin-top: 4px; font-size: 14px; font-weight: 650; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .sw-stats {
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
        gap: 1px;
        margin-top: 18px;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 10px;
        overflow: hidden;
        background: var(--dsw-alias-border-l1);
      }
      .sw-stat { background: var(--dsw-alias-bg-layer-1); padding: 9px 10px; min-width: 0; }
      .sw-stat span { display: block; font-size: 9.5px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sw-stat strong { display: block; margin-top: 4px; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sw-meta-line {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 16px;
        margin-top: 9px;
        font-size: 10.5px;
        color: var(--dsw-alias-label-secondary);
        font-variant-numeric: tabular-nums;
      }
      .sw-notice {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 12px;
        padding: 8px 10px;
        border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 35%, var(--dsw-alias-border-l1));
        border-radius: 8px;
        background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 7%, transparent);
        font-size: 11px;
        line-height: 1.5;
        color: var(--dsw-alias-label-secondary);
      }
      .sw-notice button {
        margin-left: auto;
        flex: 0 0 auto;
        border: 0;
        background: transparent;
        color: var(--dsw-alias-brand-primary);
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }
      .sw-chart-card {
        margin-top: 16px;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 12px;
        background: var(--dsw-alias-bg-base);
        padding: 12px 12px 8px;
      }
      .sw-chart-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 0 2px 6px; }
      .sw-chart-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        padding: 0 2px 6px;
      }
      .sw-chart-nav { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
      .sw-chart-range {
        font-size: 10.5px;
        color: var(--dsw-alias-label-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sw-chip-icon { padding: 4px 9px; min-width: 28px; line-height: 1; font-size: 13px; }
      .sw-chart-title { font-size: 11.5px; font-weight: 600; color: var(--dsw-alias-label-secondary); }
      .sw-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 10px; color: var(--dsw-alias-label-secondary); }
      .sw-legend span { display: inline-flex; align-items: center; gap: 5px; }
      .sw-legend i { width: 12px; height: 2px; border-radius: 1px; display: inline-block; }
      .sw-chart { display: block; width: 100%; height: auto; overflow: visible; }
      .sw-chart text { font-family: inherit; font-size: 9px; fill: var(--dsw-alias-label-secondary); }
      .sw-grid-two {
        display: grid;
        grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
        gap: 12px;
        margin-top: 12px;
      }
      .sw-box {
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 12px;
        background: var(--dsw-alias-bg-base);
        padding: 14px;
        min-width: 0;
      }
      .sw-box-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
      .sw-box-title { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
      .sw-trend-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 7px;
        border-radius: 5px;
        font-size: 10px;
        font-weight: 600;
        border: 1px solid var(--dsw-alias-border-l1);
        color: var(--dsw-alias-label-secondary);
        white-space: nowrap;
      }
      .sw-trend-chip.is-up { color: var(--dsw-alias-state-error-primary); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, var(--dsw-alias-border-l1)); background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 7%, transparent); }
      .sw-trend-chip.is-down { color: var(--dsw-alias-state-success-primary); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 30%, var(--dsw-alias-border-l1)); background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 7%, transparent); }
      .sw-summary { margin: 0; font-size: 12.5px; line-height: 1.7; color: var(--dsw-alias-label-primary); }
      .sw-score-row { display: flex; align-items: flex-end; gap: 10px; margin-top: 14px; }
      .sw-score { font-size: 36px; line-height: .95; font-weight: 650; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
      .sw-score small { font-size: 11px; font-weight: 500; color: var(--dsw-alias-label-secondary); margin-left: 3px; letter-spacing: 0; }
      .sw-bias { font-size: 11px; font-weight: 600; margin-bottom: 3px; }
      .sw-meter { position: relative; height: 6px; margin-top: 12px; border-radius: 3px; background: linear-gradient(90deg, var(--dsw-alias-state-success-primary), var(--dsw-alias-state-idle-primary) 50%, var(--dsw-alias-state-error-primary)); opacity: .85; }
      .sw-meter::after { content: ''; position: absolute; top: -4px; left: 50%; width: 1px; height: 14px; background: var(--dsw-alias-bg-base); opacity: .7; }
      .sw-meter-marker { position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 50%; background: var(--dsw-alias-bg-base); border: 2px solid var(--dsw-alias-label-primary); transform: translate(-50%, -50%); box-shadow: 0 0 0 2px var(--dsw-alias-bg-base); }
      .sw-meter-labels { display: flex; justify-content: space-between; margin-top: 5px; font-size: 9.5px; color: var(--dsw-alias-label-secondary); }
      .sw-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--dsw-alias-border-l1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; overflow: hidden; margin-top: 2px; }
      .sw-metric { background: var(--dsw-alias-bg-base); padding: 8px 9px; min-width: 0; }
      .sw-metric span { display: block; font-size: 9.5px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sw-metric strong { display: block; margin-top: 3px; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .sw-signals { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
      .sw-signal { display: inline-flex; align-items: center; gap: 5px; padding: 3px 7px; border-radius: 5px; border: 1px solid var(--dsw-alias-border-l1); font-size: 10px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-1); }
      .sw-signal::before { content: ''; width: 4px; height: 4px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); }
      .sw-signal.is-up::before { background: var(--dsw-alias-state-error-primary); }
      .sw-signal.is-down::before { background: var(--dsw-alias-state-success-primary); }
      .sw-scenario { margin-top: 12px; }
      .sw-level-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
      .sw-level { border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 9px 10px; background: var(--dsw-alias-bg-base); }
      .sw-level span { display: block; font-size: 9.5px; color: var(--dsw-alias-label-secondary); }
      .sw-level strong { display: block; margin-top: 3px; font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; }
      .sw-level.is-support strong { color: var(--dsw-alias-state-success-primary); }
      .sw-level.is-resistance strong { color: var(--dsw-alias-state-error-primary); }
      .sw-scenario p { margin: 0; font-size: 11.5px; line-height: 1.65; color: var(--dsw-alias-label-secondary); }
      .sw-scenario p + p { margin-top: 6px; }
      .sw-risk {
        margin: 14px 0 0;
        padding-top: 11px;
        border-top: 1px solid var(--dsw-alias-border-l1);
        font-size: 10px;
        line-height: 1.6;
        color: var(--dsw-alias-label-secondary);
      }
      .sw-source { margin: 8px 0 0; font-size: 9.5px; color: var(--dsw-alias-label-secondary); opacity: .8; }
      .sw-up { color: var(--dsw-alias-state-error-primary); }
      .sw-down { color: var(--dsw-alias-state-success-primary); }
      .sw-flat { color: var(--dsw-alias-label-secondary); }
      .sw-error-card {
        margin: 16px 0;
        border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, var(--dsw-alias-border-l1));
        border-radius: 10px;
        background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 6%, transparent);
        padding: 16px;
        text-align: center;
      }
      .sw-error-card strong { display: block; font-size: 13px; }
      .sw-error-card p { margin: 6px 0 12px; font-size: 11px; line-height: 1.55; color: var(--dsw-alias-label-secondary); }
      .sw-inline-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 260px;
        text-align: center;
        color: var(--dsw-alias-label-secondary);
      }
      .sw-inline-empty strong { color: var(--dsw-alias-label-primary); font-size: 14px; }
      .sw-inline-empty p { margin: 0; font-size: 11.5px; line-height: 1.55; }
      @media (max-width: 1120px) {
        .sw-body { grid-template-columns: 260px minmax(0, 1fr); padding: 14px 18px 18px; }
        .sw-header { padding: 16px 18px 13px; }
        .sw-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      }
      @media (max-width: 940px) {
        .sw-root { overflow: auto; height: auto; min-height: 100%; }
        .sw-body { grid-template-columns: minmax(0, 1fr); overflow: visible; }
        .sw-list { overflow: visible; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
        .sw-detail { overflow: visible; }
        .sw-header { flex-direction: column; gap: 12px; }
        .sw-header-side { justify-content: flex-start; }
        .sw-side-stats { justify-content: flex-start; }
      }
      @media (max-width: 640px) {
        .sw-header { padding: 14px 14px 12px; }
        .sw-body { padding: 12px 14px 16px; gap: 14px; }
        .sw-title { font-size: 20px; }
        .sw-detail { padding: 15px; }
        .sw-big-price { font-size: 30px; }
        .sw-grid-two { grid-template-columns: minmax(0, 1fr); }
        .sw-level-row { grid-template-columns: minmax(0, 1fr); }
        .sw-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .sw-side-stats { width: 100%; }
        .sw-side-stat { flex: 1; min-width: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .sw-spin { animation: none; }
        .sw-skeleton, .sw-spark-empty { animation: none; }
        .sw-card, .sw-del { transition: none; }
      }
    `;

    function fill(template, values) {
      return String(template).replace(/\{(\w+)\}/g, (match, key) => (
        values && Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
      ));
    }

    function normalizeCode(raw) {
      let value = String(raw == null ? '' : raw).trim().toUpperCase().replace(/\s+/g, '');
      if (!value) return null;
      let match;
      if ((match = /^(SH|SZ|BJ)(\d{6})$/.exec(value))) return `${match[1]}${match[2]}`;
      if ((match = /^(\d{6})[.](SH|SZ|BJ)$/.exec(value))) return `${match[2]}${match[1]}`;
      if ((match = /^HK(\d{1,5})$/.exec(value))) return `HK${match[1].padStart(5, '0')}`;
      if ((match = /^(\d{1,5})[.]HK$/.exec(value))) return `HK${match[1].padStart(5, '0')}`;
      if ((match = /^(KS|KR)(\d{6})$/.exec(value))) return `KR${match[2]}`;
      if ((match = /^(\d{6})[.](KS|KR)$/.exec(value))) return `KR${match[1]}`;
      if ((match = /^(A50|CN00Y|FTSEA50|A50QH)$/.exec(value))) return 'A50';
      if ((match = /^US[.:]([A-Z][A-Z0-9]{0,5})$/.exec(value))) return `US.${match[1]}`;
      if ((match = /^([A-Z][A-Z0-9]{0,5})[.]US$/.exec(value))) return `US.${match[1]}`;
      if ((match = /^([A-Z][A-Z0-9]{0,5})$/.exec(value))) return `US.${match[1]}`;
      if (/^\d{6}$/.test(value)) return `${inferMarket(value)}${value}`;
      // Shorter numeric codes can only be Hong Kong here: mainland codes are six digits.
      if (/^\d{1,5}$/.test(value)) return `HK${value.padStart(5, '0')}`;
      return null;
    }

    function inferMarket(digits) {
      // 920xxx is a Beijing code even though it starts with 9, so test Beijing first.
      if (/^(4|8|92)/.test(digits)) return 'BJ';
      if (/^[569]/.test(digits)) return 'SH';
      return 'SZ';
    }

    function codeOf(key) {
      const text = String(key);
      if (text === 'A50') return 'A50';
      return text.startsWith('US.') ? text.slice(3) : text.slice(2);
    }

    function marketOf(key) {
      const text = String(key);
      if (text === 'A50') return 'A50';
      if (text.startsWith('US.')) return 'US';
      return text.slice(0, 2);
    }

    function loadWatchlist() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw == null) return withSeeded(DEFAULT_CODES.slice());
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return withSeeded(DEFAULT_CODES.slice());
        const unique = [];
        const seen = new Set();
        for (const value of parsed) {
          const code = normalizeCode(value);
          if (code && !seen.has(code)) {
            seen.add(code);
            unique.push(code);
          }
        }
        return withSeeded(unique).slice(0, MAX_CODES);
      } catch {
        return withSeeded(DEFAULT_CODES.slice());
      }
    }

    /**
     * One-time seed: the memory-chip names the user asked for (Micron, Samsung,
     * SK Hynix) are appended once, so their existing watchlist survives.
     */
    function withSeeded(codes) {
      try {
        if (window.localStorage.getItem(SEED_KEY) === '1') return codes;
        window.localStorage.setItem(SEED_KEY, '1');
      } catch {
        return codes;
      }
      const result = codes.slice();
      for (const code of SEED_CODES) {
        if (!result.includes(code) && result.length < MAX_CODES) result.push(code);
      }
      return result;
    }

    function saveWatchlist(codes) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
      } catch {
        // A full or disabled localStorage must not break the watchlist.
      }
    }

    function loadTickerEnabled() {
      try {
        const raw = window.localStorage.getItem(TICKER_KEY);
        // First run: the request was a taskbar readout, so start it on.
        return raw == null ? true : raw === '1';
      } catch {
        return true;
      }
    }

    function saveTickerEnabled(value) {
      try {
        window.localStorage.setItem(TICKER_KEY, value ? '1' : '0');
      } catch {
        // Losing the preference only means the pill starts hidden next time.
      }
    }

    function isChinese() {
      const lang = document.documentElement.getAttribute('lang') || navigator.language || 'en';
      return String(lang).toLowerCase().startsWith('zh');
    }

    function fmtPrice(value, market) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      // Hong Kong quotes carry three decimals, Korean quotes are whole won.
      if (market === 'KR') return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
      return market === 'HK'
        ? value.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtPct(value, digits = 2, withSign = true) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      const sign = withSign && value > 0 ? '+' : '';
      return `${sign}${value.toFixed(digits)}%`;
    }

    function fmtSigned(value, digits = 2) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      const sign = value > 0 ? '+' : '';
      return `${sign}${value.toFixed(digits)}`;
    }

    function fmtInt(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      return Math.round(value).toLocaleString();
    }

    function compactNumber(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      if (isChinese()) {
        const abs = Math.abs(value);
        if (abs >= 100_000_000) return `${trimZero(value / 100_000_000)}亿`;
        if (abs >= 10_000) return `${trimZero(value / 10_000)}万`;
        return Math.round(value).toLocaleString();
      }
      return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 }).format(value);
    }

    function trimZero(value) {
      return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    }

    function fmtMoney(value, market) {
      const compact = compactNumber(value);
      if (compact === '—') return compact;
      return market === 'HK' ? `HK$${compact}` : `¥${compact}`;
    }

    function fmtQuoteTime(value) {
      if (!value) return null;
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return null;
      const clock = date.toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });
      const sameDay = date.toDateString() === new Date().toDateString();
      return sameDay ? clock : `${date.toLocaleDateString()} ${clock}`;
    }

    function toneClass(value) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return 'sw-flat';
      return value > 0 ? 'sw-up' : 'sw-down';
    }

    function scoreClass(score) {
      if (typeof score !== 'number' || !Number.isFinite(score)) return 'sw-flat';
      if (score >= 60) return 'sw-up';
      if (score <= 40) return 'sw-down';
      return 'sw-flat';
    }

    function trendLabel(t, trend) {
      if (trend === 'bull') return t('trendBull');
      if (trend === 'bear') return t('trendBear');
      if (trend === 'rebound') return t('trendRebound');
      if (trend === 'pullback') return t('trendPullback');
      return t('trendRange');
    }

    function trendTone(trend) {
      if (trend === 'bull' || trend === 'rebound') return 'is-up';
      if (trend === 'bear' || trend === 'pullback') return 'is-down';
      return '';
    }

    function summaryKey(trend) {
      if (trend === 'bull') return 'summaryBull';
      if (trend === 'bear') return 'summaryBear';
      if (trend === 'rebound') return 'summaryRebound';
      if (trend === 'pullback') return 'summaryPullback';
      return 'summaryRange';
    }

    function signalMeta(code) {
      const map = {
        ma_bull: ['sigMaBull', 'is-up'],
        ma_bear: ['sigMaBear', 'is-down'],
        macd_bull: ['sigMacdBull', 'is-up'],
        macd_bear: ['sigMacdBear', 'is-down'],
        rsi_hot: ['sigRsiHot', 'is-up'],
        rsi_oversold: ['sigRsiOversold', 'is-down'],
        volume_expand: ['sigVolumeExpand', 'is-up'],
        volume_dry: ['sigVolumeDry', 'is-down'],
        breakout: ['sigBreakout', 'is-up'],
        breakdown: ['sigBreakdown', 'is-down'],
        near_resistance: ['sigNearResistance', 'is-up'],
        near_support: ['sigNearSupport', 'is-down'],
      };
      return map[code] || null;
    }

    function marketStatus(t, codes) {
      const list = Array.isArray(codes) ? codes : [];
      const allOf = (prefix) => list.length > 0 && list.every((code) => String(code).startsWith(prefix));
      const hongKong = allOf('HK');
      const us = allOf('US');
      const korea = allOf('KR');
      const zone = us ? 'America/New_York' : (korea ? 'Asia/Seoul' : 'Asia/Shanghai');

      let parts;
      try {
        parts = new Intl.DateTimeFormat('en-US', {
          timeZone: zone,
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).formatToParts(new Date());
      } catch {
        return { label: t('marketClosed'), tone: 'is-closed' };
      }
      const get = (type) => {
        const part = parts.find((item) => item.type === type);
        return part ? part.value : '';
      };
      const weekday = get('weekday');
      if (weekday === 'Sat' || weekday === 'Sun') {
        return { label: t('marketWeekend'), tone: 'is-closed' };
      }
      const hour = Number(get('hour')) % 24;
      const minute = Number(get('minute'));
      const total = (hour * 60) + minute;

      if (us) {
        if (total >= 4 * 60 && total < (9 * 60) + 30) return { label: t('marketPre'), tone: 'is-pre' };
        if (total >= (9 * 60) + 30 && total < 16 * 60) return { label: t('marketOpen'), tone: 'is-open' };
        if (total >= 16 * 60 && total < 20 * 60) return { label: t('marketAfter'), tone: 'is-pre' };
        return { label: t('marketClosed'), tone: 'is-closed' };
      }

      if (korea) {
        if (total >= (9 * 60) && total < (15 * 60) + 30) return { label: t('marketOpen'), tone: 'is-open' };
        return { label: t('marketClosed'), tone: 'is-closed' };
      }

      // A50 is the FTSE China A50 cash index now, so it keeps A-share hours.
      const open = (9 * 60) + 30;
      // Hong Kong trades 09:30-12:00 and 13:00-16:00; the mainland breaks at 11:30 and closes at 15:00.
      const lunch = hongKong ? 12 * 60 : (11 * 60) + 30;
      const afternoon = 13 * 60;
      const close = hongKong ? 16 * 60 : 15 * 60;
      if (total >= open && total < lunch) return { label: t('marketOpen'), tone: 'is-open' };
      if (total >= lunch && total < afternoon) return { label: t('marketLunch'), tone: 'is-closed' };
      if (total >= afternoon && total < close) return { label: t('marketOpen'), tone: 'is-open' };
      if (total >= close) return { label: t('marketClosed'), tone: 'is-closed' };
      if (total >= 9 * 60) return { label: t('marketPre'), tone: 'is-pre' };
      return { label: t('marketClosed'), tone: 'is-closed' };
    }

    function useMarketData(codeKey, refreshToken) {
      const [state, setState] = useState(() => ({ loading: Boolean(codeKey), data: null, error: null }));

      useEffect(() => {
        if (!codeKey) {
          setState({ loading: false, data: null, error: null });
          return undefined;
        }

        let alive = true;
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        setState((previous) => ({ ...previous, loading: true, error: null }));

        const url = `/plugins/stock-watch/data?codes=${encodeURIComponent(codeKey)}`;
        fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
          .then(async (response) => {
            let body = null;
            try {
              body = await response.json();
            } catch {
              body = null;
            }
            if (!response.ok) {
              const code = body && body.error ? body.error : `HTTP ${response.status}`;
              throw new Error(code);
            }
            return body;
          })
          .then((body) => {
            if (!alive) return;
            setState({ loading: false, data: body, error: null });
          })
          .catch((error) => {
            if (!alive) return;
            const message = error && error.name === 'AbortError'
              ? 'timeout'
              : (error && error.message ? error.message : 'network_error');
            setState((previous) => ({ ...previous, loading: false, error: message }));
          })
          .finally(() => window.clearTimeout(timer));

        return () => {
          alive = false;
          window.clearTimeout(timer);
          controller.abort();
        };
      }, [codeKey, refreshToken]);

      return state;
    }

    function useAutoRefresh(onTick) {
      useEffect(() => {
        const tick = () => {
          if (document.visibilityState === 'visible') onTick();
        };
        const timer = window.setInterval(tick, REFRESH_MS);
        const onVisibility = () => {
          if (document.visibilityState === 'visible') onTick();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
          window.clearInterval(timer);
          document.removeEventListener('visibilitychange', onVisibility);
        };
      }, [onTick]);
    }

    function sessionLabel(t, state) {
      const map = {
        open: 'sessionOpen',
        closed: 'sessionClosed',
        lunch: 'sessionLunch',
        pre: 'sessionPre',
        after: 'sessionAfter',
        night: 'sessionNight',
      };
      return map[state] ? t(map[state]) : t('sessionClosed');
    }

    function sessionTone(state) {
      if (state === 'open') return 'is-open';
      if (state === 'pre' || state === 'after' || state === 'night' || state === 'lunch') return 'is-warm';
      return '';
    }

    function WorldBoard({ t }) {
      const { data, failed, loading, reload } = useFeed('/plugins/stock-watch/world.json', 30_000);

      const groups = Array.isArray(data?.groups) ? data.groups : [];
      const zh = isChinese();
      const sessions = data?.session ?? {};
      const asiaStates = ['CN', 'HK', 'JP', 'KR'].map((key) => sessions[key]);
      const asiaState = asiaStates.includes('open')
        ? 'open'
        : (asiaStates.includes('lunch') ? 'lunch' : 'closed');
      const usState = sessions.USFutures ?? sessions.US ?? 'closed';
      const updated = data?.fetchedAt
        ? new Date(data.fetchedAt).toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
          })
        : null;

      return h('div', { className: 'sw-world' },
        h('div', { className: 'sw-world-head' },
          h('div', { className: 'sw-world-meta' },
            h('strong', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, t('worldTitle')),
            updated ? h('span', null, '·') : null,
            updated ? h('span', null, fill(t('worldMeta'), { time: updated })) : null,
            h('span', { className: `sw-session ${sessionTone(asiaState)}` },
              `${zh ? '亚太' : 'APAC'} · ${sessionLabel(t, asiaState)}`),
            h('span', { className: `sw-session ${sessionTone(usState)}` },
              `${zh ? '美股' : 'US'} · ${sessionLabel(t, usState)}`),
          ),
          h('button', {
            type: 'button',
            className: 'sw-btn',
            onClick: reload,
            disabled: loading,
          },
            h(RefreshIcon, { spinning: loading }),
            loading ? t('updating') : t('refresh'),
          ),
        ),
        failed ? h('div', { className: 'sw-notice' }, h('span', null, t('worldFailed'))) : null,
        groups.map((group) => h('section', { key: group.id, className: 'sw-world-section' },
          h('div', { className: 'sw-world-section-head' },
            h('h3', { className: 'sw-world-section-title' },
              group.id === 'us' ? (zh ? '美股' : 'United States') : (zh ? '亚太' : 'Asia-Pacific')),
            h('span', { className: 'sw-world-section-note' },
              group.id === 'us' ? t('worldNoteUs') : t('worldNoteAsia')),
          ),
          h('div', { className: 'sw-world-grid' },
            group.items.map((item) => h('div', { key: item.secid, className: 'sw-world-card' },
              h('div', { className: 'sw-world-top' },
                h('span', { className: 'sw-world-name', title: item.name }, zh ? item.name : (item.nameEn || item.name)),
                h('span', { className: `sw-session ${sessionTone(item.session)}` }, sessionLabel(t, item.session)),
              ),
              h('div', { className: `sw-world-price ${toneClass(item.changePct)}` }, fmtPrice(item.price)),
              h('div', { className: `sw-world-chg ${toneClass(item.changePct)}` },
                item.changePct == null ? '—' : `${fmtSigned(item.change)}  ${fmtPct(item.changePct)}`,
              ),
            )),
          ),
        )),
        groups.length === 0 && loading
          ? h('div', { className: 'sw-skeleton-list' },
              h('div', { className: 'sw-skeleton' }),
              h('div', { className: 'sw-skeleton' }),
              h('div', { className: 'sw-skeleton' }),
            )
          : null,
      );
    }

    function useFeed(path, intervalMs) {
      const [state, setState] = useState({ data: null, loading: true, failed: false });

      const apply = (body) => setState({ data: body, loading: false, failed: false });
      const fail = () => setState((previous) => ({ ...previous, loading: false, failed: true }));

      useEffect(() => {
        let alive = true;
        const controller = new AbortController();
        const load = () => {
          fetch(path, { signal: controller.signal, headers: { Accept: 'application/json' } })
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
            .then((body) => {
              if (alive) apply(body);
            })
            .catch((error) => {
              if (!alive || (error && error.name === 'AbortError')) return;
              fail();
            });
        };
        load();
        const timer = window.setInterval(load, intervalMs);
        return () => {
          alive = false;
          window.clearInterval(timer);
          controller.abort();
        };
      }, [path, intervalMs]);

      // A manual refresh must bypass the Host's short cache, otherwise pressing
      // it inside the cache window returns identical numbers and looks broken.
      const reload = () => {
        setState((previous) => ({ ...previous, loading: true, failed: false }));
        const url = `${path}${path.includes('?') ? '&' : '?'}fresh=1`;
        fetch(url, { headers: { Accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
          .then((body) => apply(body))
          .catch(() => fail());
      };

      return { ...state, reload };
    }

    function SectorBoard({ t }) {
      const { data, loading, failed, reload } = useFeed('/plugins/stock-watch/sectors.json', 30_000);
      const zh = isChinese();
      const groups = Array.isArray(data?.groups) ? data.groups : [];
      const updated = data?.fetchedAt
        ? new Date(data.fetchedAt).toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
          })
        : null;

      const titles = { themes: t('secThemes'), industry: t('secIndustry'), us: t('secUs') };
      const notes = { themes: t('secThemesNote'), industry: t('secIndustryNote'), us: t('secUsNote') };

      return h('div', { className: 'sw-world' },
        h('div', { className: 'sw-world-head' },
          h('div', { className: 'sw-world-meta' },
            h('strong', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, t('tabSectors')),
            updated ? h('span', null, '·') : null,
            updated ? h('span', null, fill(t('worldMeta'), { time: updated })) : null,
          ),
          h('button', { type: 'button', className: 'sw-btn', onClick: reload, disabled: loading },
            h(RefreshIcon, { spinning: loading }),
            loading ? t('updating') : t('refresh'),
          ),
        ),
        failed ? h('div', { className: 'sw-notice' }, h('span', null, t('sectorsFailed'))) : null,
        groups.map((group) => h('section', { key: group.id, className: 'sw-world-section' },
          h('div', { className: 'sw-world-section-head' },
            h('h3', { className: 'sw-world-section-title' }, titles[group.id] ?? group.id),
            h('span', { className: 'sw-world-section-note' }, notes[group.id] ?? ''),
          ),
          h('div', { className: 'sw-world-grid' },
            group.items.map((item) => h('div', { key: item.id, className: 'sw-world-card' },
              h('div', { className: 'sw-world-top' },
                h('span', { className: 'sw-world-name', title: item.board || item.ticker || item.name },
                  zh ? item.name : (item.nameEn || item.name)),
                item.ticker
                  ? h('span', { className: 'sw-session' }, item.ticker)
                  : null,
              ),
              h('div', { className: `sw-world-price ${toneClass(item.pct)}` }, fmtPct(item.pct)),
              item.leader
                ? h('div', { className: 'sw-sector-sub' }, `${t('secLeader')} ${item.leader}`)
                : null,
              (item.up != null || item.down != null)
                ? h('div', { className: 'sw-sector-sub' }, `${item.up ?? 0} ↑   ${item.down ?? 0} ↓`)
                : null,
            )),
          ),
        )),
        groups.length === 0 && loading
          ? h('div', { className: 'sw-skeleton-list' },
              h('div', { className: 'sw-skeleton' }),
              h('div', { className: 'sw-skeleton' }),
              h('div', { className: 'sw-skeleton' }),
            )
          : null,
      );
    }

    function aggregatePoints(points, period) {
      const list = Array.isArray(points) ? points : [];
      if (period === 'day' || list.length === 0) return list;

      const bucketOf = (date) => {
        if (period === 'month') return date.slice(0, 7);
        const day = new Date(`${date}T00:00:00Z`);
        const shift = (day.getUTCDay() + 6) % 7;
        day.setUTCDate(day.getUTCDate() - shift);
        return day.toISOString().slice(0, 10);
      };

      const last = new Map();
      for (const point of list) last.set(bucketOf(point.date), point);
      return Array.from(last.values()).sort((left, right) => (left.date < right.date ? -1 : 1));
    }

    function StorageChart({ points, t }) {
      const data = Array.isArray(points) ? points : [];
      if (data.length < 2) {
        return h('div', { className: 'sw-inline-empty', style: { minHeight: 180 } },
          h('p', null, t('storageNoData')));
      }

      const width = 720;
      const height = 220;
      const padL = 12;
      const padR = 12;
      const padT = 16;
      const padB = 26;
      const values = data.map((point) => point.value);
      const max = Math.max(...values);
      const min = Math.min(...values);
      const span = max - min || Math.max(0.01, Math.abs(max) * 0.02);
      const low = min - span * 0.12;
      const high = max + span * 0.12;

      const x = (index) => padL + (index / (data.length - 1)) * (width - padL - padR);
      const y = (value) => padT + (1 - (value - low) / (high - low)) * (height - padT - padB);
      const line = data
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`)
        .join(' ');
      const area = `${line} L${x(data.length - 1).toFixed(1)},${height - padB} L${padL},${height - padB} Z`;

      return h('svg', { className: 'sw-storage-chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none' },
        h('path', { d: area, fill: 'var(--dsw-alias-brand-primary)', opacity: 0.1 }),
        h('path', {
          d: line,
          fill: 'none',
          stroke: 'var(--dsw-alias-brand-primary)',
          strokeWidth: 2,
          strokeLinejoin: 'round',
          vectorEffect: 'non-scaling-stroke',
        }),
        h('text', { x: padL, y: padT + 4, className: 'sw-chart-label' }, max.toFixed(2)),
        h('text', { x: padL, y: height - padB - 6, className: 'sw-chart-label' }, min.toFixed(2)),
        h('text', { x: padL, y: height - 8, className: 'sw-chart-label' }, data[0].date),
        h('text', { x: width - padR, y: height - 8, textAnchor: 'end', className: 'sw-chart-label' }, data[data.length - 1].date),
      );
    }

    function StorageBoard({ t }) {
      const { data, loading, failed, reload } = useFeed('/plugins/stock-watch/storage.json', 60_000);
      const [seriesId, setSeriesId] = useState('');
      const [period, setPeriod] = useState('day');

      const seriesList = Array.isArray(data?.series) ? data.series : [];
      const active = seriesList.find((item) => item.id === seriesId) || seriesList[0] || null;
      const points = active ? aggregatePoints(active.points, period) : [];
      const updated = data?.fetchedAt
        ? new Date(data.fetchedAt).toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
          })
        : null;
      const referenceCards = Array.isArray(data?.references) ? data.references : [];

      const periods = [
        ['day', t('storageDay')],
        ['week', t('storageWeek')],
        ['month', t('storageMonth')],
      ];

      return h('div', { className: 'sw-storage' },
        h('div', { className: 'sw-world-head' },
          h('div', { className: 'sw-world-meta' },
            h('strong', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, t('tabStorage')),
            updated ? h('span', null, '·') : null,
            updated ? h('span', null, fill(t('worldMeta'), { time: updated })) : null,
            data?.source ? h('span', { className: 'sw-session' }, data.source) : null,
          ),
          h('button', { type: 'button', className: 'sw-btn', onClick: reload, disabled: loading },
            h(RefreshIcon, { spinning: loading }),
            loading ? t('updating') : t('refresh'),
          ),
        ),
        failed ? h('div', { className: 'sw-notice' }, h('span', null, t('storageFailed'))) : null,
        h('div', { className: 'sw-chips' },
          h('span', { className: 'sw-chips-label' }, t('storageSeries')),
          seriesList.map((item) => h('button', {
            key: item.id,
            type: 'button',
            className: `sw-chip${active && active.id === item.id ? ' is-active' : ''}`,
            onClick: () => setSeriesId(item.id),
          }, `${item.name}${item.latest != null ? ` ${item.latest}` : ''}`)),
        ),
        h('div', { className: 'sw-chips' },
          h('span', { className: 'sw-chips-label' }, t('storagePeriod')),
          periods.map(([value, label]) => h('button', {
            key: value,
            type: 'button',
            className: `sw-chip${period === value ? ' is-active' : ''}`,
            onClick: () => setPeriod(value),
          }, label)),
        ),
        h('div', { className: 'sw-storage-card' },
          active
            ? h('div', { className: 'sw-storage-head' },
                h('div', null,
                  h('div', { className: 'sw-storage-name' }, active.name),
                  h('div', { className: 'sw-storage-sub' },
                    `${active.unit} · ${active.frequency === 'week' ? t('storageWeekly') : t('storageDaily')}`),
                ),
                h('div', { style: { textAlign: 'right' } },
                  h('div', { className: `sw-storage-value ${toneClass(active.changePct)}` },
                    active.latest != null ? String(active.latest) : '—'),
                  h('div', { className: `sw-storage-sub ${toneClass(active.changePct)}` },
                    `${fmtPct(active.changePct)} · ${active.latestDate || ''}`),
                ),
              )
            : null,
          h(StorageChart, { points, t }),
        ),
        referenceCards.length > 0
          ? h('div', { className: 'sw-world-section' },
              h('div', { className: 'sw-world-section-head' },
                h('h3', { className: 'sw-world-section-title' }, t('storageRefTitle')),
              ),
              h('div', { className: 'sw-world-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' } },
                referenceCards.map((card) => h('div', { key: card.id, className: 'sw-ref-card' },
                  h('div', { className: 'sw-world-top' },
                    h('span', { className: 'sw-world-name' }, card.name),
                    h('span', { className: 'sw-session' }, t('storageRefTag')),
                  ),
                  h('div', { className: 'sw-ref-note' }, card.note),
                  (card.points || []).map((point, index) => h('div', { key: `${card.id}-${index}`, className: 'sw-ref-point' },
                    h('span', { className: 'sw-ref-date' }, point.date),
                    h('span', null, point.text),
                  )),
                )),
              ),
            )
          : null,
      );
    }

    function StockWatchPage({ t }) {
      const [codes, setCodes] = useState(loadWatchlist);
      const [selected, setSelected] = useState(() => loadWatchlist()[0] || '');
      const [draft, setDraft] = useState('');
      const [formError, setFormError] = useState('');
      const [refreshToken, setRefreshToken] = useState(0);
      const [tickerOn, setTickerOn] = useState(loadTickerEnabled);
      const [view, setView] = useState('watch');

      useEffect(() => {
        saveWatchlist(codes);
      }, [codes]);

      useEffect(() => {
        saveTickerEnabled(tickerOn);
        const controller = new AbortController();
        fetch('/plugins/stock-watch/ticker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: tickerOn ? 'on' : 'off', codes }),
          signal: controller.signal,
        })
          .then((response) => response.json())
          .then((body) => {
            if (!tickerOn || !body || !body.error) return;
            // The host could not start the pill (usually a missing Python): say so
            // instead of leaving the button lit with nothing on the taskbar.
            setTickerOn(false);
            setFormError(t('taskbarFailed'));
          })
          .catch(() => {
            // The pill is a nicety; a failed toggle must not disturb the panel.
          });
        return () => controller.abort();
      }, [codes, tickerOn]);

      useEffect(() => {
        if (!codes.includes(selected)) setSelected(codes[0] || '');
      }, [codes, selected]);

      const codeKey = codes.join(',');
      const market = useMarketData(codeKey, refreshToken);

      const refresh = useMemo(() => () => setRefreshToken((value) => value + 1), []);
      const toggleTicker = useMemo(() => () => setTickerOn((value) => !value), []);
      useAutoRefresh(refresh);

      const items = Array.isArray(market.data?.items) ? market.data.items : [];
      const byKey = useMemo(() => {
        const map = new Map();
        for (const item of items) map.set(item.key || `${item.market}${item.code}`, item);
        return map;
      }, [items]);

      const selectedItem = byKey.get(selected) || null;
      const status = marketStatus(t, codes);
      const updatedTime = market.data?.fetchedAt
        ? new Date(market.data.fetchedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
        : null;

      function addCodes(event) {
        event.preventDefault();
        const tokens = draft.split(/[,，;；\s]+/).map((token) => token.trim()).filter(Boolean);
        if (tokens.length === 0) {
          setFormError(t('addEmpty'));
          return;
        }

        const valid = [];
        const invalid = [];
        const seen = new Set(codes);
        for (const token of tokens) {
          const code = normalizeCode(token);
          if (!code) {
            invalid.push(token);
          } else if (!seen.has(code)) {
            seen.add(code);
            valid.push(code);
          }
        }

        if (codes.length + valid.length > MAX_CODES) {
          setFormError(t('addLimit'));
          return;
        }

        if (valid.length > 0) {
          setCodes((previous) => [...previous, ...valid]);
          setSelected(valid[0]);
          setDraft('');
        }

        if (invalid.length > 0) {
          setFormError(fill(t('addError'), { codes: invalid.join(', ') }));
        } else if (valid.length === 0) {
          setFormError(t('addDuplicate'));
        } else {
          setFormError('');
        }
      }

      function removeCode(code) {
        setCodes((previous) => previous.filter((value) => value !== code));
      }

      return h('div', { className: 'sw-root' },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        h('header', { className: 'sw-header' },
          h('div', { className: 'sw-heading' },
            h('div', { className: 'sw-eyebrow' },
              h('span', { className: 'sw-eyebrow-dot' }),
              t('nav'),
              h('span', { style: { opacity: 0.55 } }, '·'),
              h('span', { style: { letterSpacing: 0, textTransform: 'none' } }, t('redUpGreenDown')),
            ),
            h('h1', { className: 'sw-title' }, t('title')),
            h('p', { className: 'sw-subtitle' }, t('subtitle')),
          ),
          h('div', { className: 'sw-header-side' },
            view === 'watch'
              ? h('div', { className: `sw-status ${status.tone}`, title: t('autoRefresh') },
                  h('span', { className: 'sw-status-dot' }),
                  h('span', null, status.label),
                  updatedTime ? h('span', { style: { opacity: 0.6 } }, '·') : null,
                  updatedTime ? h('span', null, fill(t('updated'), { time: updatedTime })) : null,
                )
              : null,
            h('button', {
              type: 'button',
              className: `sw-btn${tickerOn ? ' is-on' : ''}`,
              onClick: toggleTicker,
              title: t('taskbarTitle'),
              'aria-pressed': tickerOn ? 'true' : 'false',
            },
              h('span', { className: 'sw-dot' }),
              t('taskbar'),
            ),
            view === 'watch'
              ? h('button', {
                  type: 'button',
                  className: 'sw-btn',
                  onClick: refresh,
                  disabled: market.loading,
                  'aria-busy': market.loading ? 'true' : 'false',
                },
                  h(RefreshIcon, { spinning: market.loading }),
                  market.loading ? t('updating') : t('refresh'),
                )
              : null,
          ),
        ),
        h('nav', { className: 'sw-tabs' },
          h('button', {
            type: 'button',
            className: `sw-tab${view === 'watch' ? ' is-active' : ''}`,
            onClick: () => setView('watch'),
            'aria-current': view === 'watch' ? 'page' : undefined,
          }, t('tabWatch')),
          h('button', {
            type: 'button',
            className: `sw-tab${view === 'world' ? ' is-active' : ''}`,
            onClick: () => setView('world'),
            'aria-current': view === 'world' ? 'page' : undefined,
          }, t('tabWorld')),
          h('button', {
            type: 'button',
            className: `sw-tab${view === 'sectors' ? ' is-active' : ''}`,
            onClick: () => setView('sectors'),
            'aria-current': view === 'sectors' ? 'page' : undefined,
          }, t('tabSectors')),
          h('button', {
            type: 'button',
            className: `sw-tab${view === 'storage' ? ' is-active' : ''}`,
            onClick: () => setView('storage'),
            'aria-current': view === 'storage' ? 'page' : undefined,
          }, t('tabStorage')),
        ),
        view === 'world'
          ? h(WorldBoard, { t })
          : view === 'sectors'
            ? h(SectorBoard, { t })
            : view === 'storage'
              ? h(StorageBoard, { t })
              : h('div', { className: 'sw-body' },
          h('aside', { className: 'sw-list-panel' },
            h('div', { className: 'sw-panel-head' },
              h('h2', null, t('watchlist')),
              h('span', { className: 'sw-count' }, fill(t('watchCount'), { n: codes.length })),
            ),
            h('form', { className: 'sw-add', onSubmit: addCodes },
              h('input', {
                className: 'sw-input',
                value: draft,
                onChange: (event) => {
                  setDraft(event.target.value);
                  if (formError) setFormError('');
                },
                placeholder: t('addPlaceholder'),
                'aria-label': t('addPlaceholder'),
                autoComplete: 'off',
                spellCheck: false,
              }),
              h('button', { type: 'submit', className: 'sw-add-btn' }, t('add')),
            ),
            formError ? h('div', { className: 'sw-form-error', role: 'alert' }, formError) : null,
            h('p', { className: 'sw-hint' }, t('addHint')),
            market.loading && items.length === 0 && codes.length > 0
              ? h('div', { className: 'sw-skeleton-list' },
                  codes.slice(0, 4).map((code) => h('div', { key: code, className: 'sw-skeleton' })),
                )
              : codes.length === 0
                ? h('div', { className: 'sw-empty-list' },
                    h('strong', null, t('emptyTitle')),
                    h('p', null, t('emptyBody')),
                    h('small', null, t('emptyExamples')),
                  )
                : h('div', { className: 'sw-list' },
                    codes.map((code) => h(StockCard, {
                      key: code,
                      code: codeOf(code),
                      market: marketOf(code),
                      entry: byKey.get(code) || null,
                      active: code === selected,
                      onSelect: () => setSelected(code),
                      onRemove: () => removeCode(code),
                      t,
                    })),
                  ),
          ),
          h('section', { className: 'sw-detail' },
            market.error && market.data
              ? h('div', { className: 'sw-notice' },
                  h('span', null, t('stale')),
                  h('button', { type: 'button', onClick: refresh }, t('retry')),
                )
              : null,
            codes.length === 0
              ? h(EmptyDetail, { t })
              : !selectedItem
                ? (market.loading
                    ? h('div', { className: 'sw-inline-empty' },
                        h(Spinner, { size: 20 }),
                        h('strong', null, t('loading')),
                      )
                    : market.error
                      ? h(ErrorCard, { t, onRetry: refresh })
                      : h(EmptyDetail, { t }))
                : h(StockDetail, { entry: selectedItem, t }),
          ),
        ),
      );
    }

    function StockCard({ code, market, entry, active, onSelect, onRemove, t }) {
      const quote = entry && entry.quote ? entry.quote : null;
      const name = entry && entry.name ? entry.name : t('loadingShort');
      const price = quote && Number.isFinite(quote.price) ? quote.price : null;
      const changePct = quote && Number.isFinite(quote.changePct) ? quote.changePct : null;
      const turnover = quote && Number.isFinite(quote.turnover) ? quote.turnover : null;
      const volume = quote && Number.isFinite(quote.volume) ? quote.volume : null;
      const bars = entry && Array.isArray(entry.bars) ? entry.bars : [];
      const marketLabel = entry?.market || market || '';
      const pe = quote && Number.isFinite(quote.pe) ? quote.pe : null;
      const metaParts = [];
      if (turnover != null) metaParts.push(`${t('turnover')} ${fmtPct(turnover, 2, false)}`);
      else if (volume != null) metaParts.push(`${t('volume')} ${compactNumber(volume)}`);
      if (pe != null) metaParts.push(`${t('pe')} ${pe.toFixed(2)}`);
      const meta = metaParts.length > 0 ? metaParts.join(' · ') : t('noData');
      const extended = quote && quote.extended ? quote.extended : null;

      return h('div', { className: `sw-card${active ? ' is-active' : ''}` },
        h('button', {
          type: 'button',
          className: 'sw-card-main',
          onClick: onSelect,
          'aria-pressed': active ? 'true' : 'false',
          title: `${name} ${marketLabel}${code}`,
        },
          h('div', { className: 'sw-card-top' },
            h('span', { className: 'sw-card-name' }, name),
            h('span', { className: `sw-chg ${toneClass(changePct)}` }, fmtPct(changePct)),
          ),
          h('div', { className: 'sw-card-sub' }, `${marketLabel} ${code}`),
          h('div', { className: 'sw-price-row' },
            h('span', { className: `sw-card-price ${toneClass(changePct)}` }, fmtPrice(price, marketLabel)),
            h('span', { className: 'sw-card-meta' }, meta),
          ),
          extended
            ? h('div', { className: 'sw-ext' },
                `${extended.session === 'pre' ? t('preMarket') : t('afterHours')} `,
                h('span', { className: toneClass(extended.changePct) }, `${fmtPrice(extended.price, marketLabel)}  ${fmtPct(extended.changePct)}`),
              )
            : null,
          h(Sparkline, { bars, up: changePct == null ? true : changePct >= 0 }),
        ),
        h('button', {
          type: 'button',
          className: 'sw-del',
          onClick: (event) => {
            event.stopPropagation();
            onRemove();
          },
          title: fill(t('remove'), { name }),
          'aria-label': fill(t('remove'), { name }),
        }, '×'),
      );
    }

    function Sparkline({ bars, up }) {
      if (!Array.isArray(bars) || bars.length < 2) {
        return h('div', { className: 'sw-spark-empty' });
      }
      const values = bars.slice(-30).map((bar) => bar.close).filter((value) => Number.isFinite(value));
      if (values.length < 2) return h('div', { className: 'sw-spark-empty' });

      const width = 240;
      const height = 32;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const span = max - min || 1;
      const points = values.map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - 2 - ((value - min) / span) * (height - 4);
        return [x, y];
      });
      const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
      const area = `${line} L${width},${height} L0,${height} Z`;
      const color = up ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-success-primary)';

      return h('svg', {
        className: 'sw-spark',
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: 'none',
        'aria-hidden': true,
      },
        h('path', { d: area, fill: color, opacity: 0.08 }),
        h('path', { d: line, fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' }),
      );
    }

    function StockDetail({ entry, t }) {
      const quote = entry.quote || null;
      const analysis = entry.analysis || null;
      const bars = Array.isArray(entry.bars) ? entry.bars : [];
      const [period, setPeriod] = useState('day');
      const [periodBars, setPeriodBars] = useState(null);
      const [periodLoading, setPeriodLoading] = useState(false);
      const [periodFailed, setPeriodFailed] = useState(false);
      const [viewCount, setViewCount] = useState(60);
      const [offset, setOffset] = useState(0);
      const entryKey = entry.key || `${entry.market}${entry.code}`;

      useEffect(() => {
        let alive = true;
        const controller = new AbortController();
        setPeriodLoading(true);
        setPeriodBars(null);
        setPeriodFailed(false);
        setOffset(0);
        fetch(`/plugins/stock-watch/kline.json?code=${encodeURIComponent(entryKey)}&period=${period}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
          .then((body) => {
            if (!alive) return;
            setPeriodBars(Array.isArray(body.bars) ? body.bars : []);
            setPeriodLoading(false);
          })
          .catch((error) => {
            if (!alive || (error && error.name === 'AbortError')) return;
            setPeriodBars([]);
            setPeriodFailed(true);
            setPeriodLoading(false);
          });
        return () => {
          alive = false;
          controller.abort();
        };
      }, [period, entryKey]);

      const allBars = Array.isArray(periodBars) && periodBars.length > 0
        ? periodBars
        : (period === 'day' ? bars : []);
      const total = allBars.length;
      const visibleCount = Math.min(Math.max(15, viewCount), total || 60);
      const safeOffset = Math.min(offset, Math.max(0, total - visibleCount));
      const endIndex = Math.max(0, total - 1 - safeOffset);
      const startIndex = Math.max(0, endIndex - visibleCount + 1);
      const chartBars = allBars.slice(startIndex, endIndex + 1);
      const canOlder = startIndex > 0;
      const canNewer = endIndex < total - 1;
      const pageStep = Math.max(1, Math.round(visibleCount * 0.8));
      const rangeText = chartBars.length > 0
        ? `${chartBars[0].date} ~ ${chartBars[chartBars.length - 1].date} · ${chartBars.length}${t('barsUnit')}`
        : '';

      const shiftOlder = () => setOffset(Math.min(Math.max(0, total - visibleCount), safeOffset + pageStep));
      const shiftNewer = () => setOffset(Math.max(0, safeOffset - pageStep));
      const zoomIn = () => setViewCount(Math.max(15, Math.round(visibleCount / 1.5)));
      const zoomOut = () => setViewCount(Math.min(Math.max(60, total || 300), Math.round(visibleCount * 1.5)));
      const lastBar = bars.length > 0 ? bars[bars.length - 1] : null;
      const price = quote && Number.isFinite(quote.price)
        ? quote.price
        : (analysis && Number.isFinite(analysis.price) ? analysis.price : (lastBar ? lastBar.close : null));
      const changePct = quote && Number.isFinite(quote.changePct)
        ? quote.changePct
        : (lastBar && Number.isFinite(lastBar.changePct) ? lastBar.changePct : null);
      const change = quote && Number.isFinite(quote.change)
        ? quote.change
        : (lastBar && Number.isFinite(lastBar.change) ? lastBar.change : null);
      const date = analysis?.lastDate || (lastBar ? lastBar.date : null);

      const stats = [
        ['open', quote?.open ?? lastBar?.open, false],
        ['high', quote?.high ?? lastBar?.high, true],
        ['low', quote?.low ?? lastBar?.low, true],
        ['prevClose', quote?.prevClose, false],
        ['volume', quote?.volume ?? lastBar?.volume, false],
        ['amount', quote?.amount ?? lastBar?.amount, false],
        ['turnover', quote?.turnover ?? lastBar?.turnover, true],
        ['volumeRatio', quote?.volumeRatio ?? analysis?.volumeRatio, false],
      ];

      const warning = entry.warning === 'history_unavailable'
        ? t('historyUnavailable')
        : entry.warning === 'quote_unavailable'
          ? t('quoteUnavailable')
          : entry.warning === 'insufficient_history'
            ? t('insufficientHistory')
            : entry.warning === 'not_found'
              ? t('notFound')
              : entry.warning
                ? fill(t('dataUnavailable'), { reason: entry.warningCode || entry.warning })
                : null;

      return h('div', null,
        h('div', { className: 'sw-detail-head' },
          h('div', { style: { minWidth: 0 } },
            h('div', { className: 'sw-name-row' },
              h('h2', { className: 'sw-detail-title' }, entry.name || entry.code),
              h('span', { className: 'sw-code-chip' },
                entry.market === entry.code ? entry.code : `${entry.market || ''} ${entry.code}`),
              analysis ? h('span', { className: `sw-trend-chip ${trendTone(analysis.trend)}` }, trendLabel(t, analysis.trend)) : null,
            ),
            h('div', { className: 'sw-price-line' },
              h('span', { className: `sw-big-price ${toneClass(changePct)}` }, fmtPrice(price, entry.market)),
              h('span', { className: `sw-big-change ${toneClass(changePct)}` },
                `${fmtSigned(change)}  ${fmtPct(changePct)}`,
              ),
              date ? h('span', { className: 'sw-asof' }, fill(t('lastBar'), { date })) : null,
            ),
          ),
          h('div', { className: 'sw-side-stats' },
            h(SideStat, { label: t('day20'), value: fmtPct(analysis?.return20), tone: toneClass(analysis?.return20) }),
            h(SideStat, { label: t('day60'), value: fmtPct(analysis?.return60), tone: toneClass(analysis?.return60) }),
            h(SideStat, { label: t('score'), value: analysis ? `${analysis.score}` : '—', tone: scoreClass(analysis?.score) }),
          ),
        ),
        h('div', { className: 'sw-stats' },
          stats.map(([key, value]) => h(StatCell, {
            key,
            label: t(key),
            value: statValue(key, value, t, entry.market),
            tone: (key === 'high' || key === 'low' || key === 'turnover' || key === 'volumeRatio') && typeof value === 'number'
              ? toneClass(value)
              : '',
          })),
        ),
        h('div', { className: 'sw-meta-line' },
          quote && Number.isFinite(quote.pe) ? h('span', null, `${t('pe')} ${quote.pe.toFixed(2)}`) : null,
          quote && Number.isFinite(quote.pb) ? h('span', null, `${t('pb')} ${quote.pb.toFixed(2)}`) : null,
          quote && Number.isFinite(quote.marketCap) ? h('span', null, `${t('marketCap')} ${fmtMoney(quote.marketCap, entry.market)}`) : null,
          quote && Number.isFinite(quote.floatCap) ? h('span', null, `${t('floatCap')} ${fmtMoney(quote.floatCap, entry.market)}`) : null,
          quote && fmtQuoteTime(quote.quoteTime) ? h('span', null, `${t('quoteTime')} ${fmtQuoteTime(quote.quoteTime)}`) : null,
          quote && quote.extended
            ? h('span', { className: toneClass(quote.extended.changePct) },
                `${quote.extended.session === 'pre' ? t('preMarket') : t('afterHours')} `,
                `${fmtPrice(quote.extended.price, entry.market)} ${fmtPct(quote.extended.changePct)}`)
            : null,
        ),
        warning ? h('div', { className: 'sw-notice' }, h('span', null, warning)) : null,
        h('div', { className: 'sw-chart-card' },
          h('div', { className: 'sw-chart-head' },
            h('span', { className: 'sw-chart-title' }, t('chartTitle')),
            h('div', { className: 'sw-legend' },
              h('span', null, h('i', { style: { background: 'var(--dsw-alias-state-error-primary)' } }), t('chartUp')),
              h('span', null, h('i', { style: { background: 'var(--dsw-alias-state-success-primary)' } }), t('chartDown')),
              h('span', null, h('i', { style: { background: 'var(--dsw-alias-state-warn-primary)' } }), t('chartMA5')),
              h('span', null, h('i', { style: { background: 'var(--dsw-alias-brand-primary)' } }), t('chartMA20')),
            ),
            h('div', { className: 'sw-chips' },
              [['day', t('klineDay')], ['week', t('klineWeek')], ['month', t('klineMonth')]].map(([value, label]) =>
                h('button', {
                  key: value,
                  type: 'button',
                  className: `sw-chip${period === value ? ' is-active' : ''}`,
                  onClick: () => setPeriod(value),
                }, label)),
            ),
          ),
          h('div', { className: 'sw-chart-toolbar' },
            h('div', { className: 'sw-chart-nav' },
              h('button', {
                type: 'button',
                className: 'sw-chip sw-chip-icon',
                onClick: shiftOlder,
                disabled: !canOlder,
                title: t('klineOlder'),
                'aria-label': t('klineOlder'),
              }, '‹'),
              h('button', {
                type: 'button',
                className: 'sw-chip sw-chip-icon',
                onClick: shiftNewer,
                disabled: !canNewer,
                title: t('klineNewer'),
                'aria-label': t('klineNewer'),
              }, '›'),
              h('span', { className: 'sw-chart-range' }, rangeText),
            ),
            h('div', { className: 'sw-chart-nav' },
              h('button', {
                type: 'button',
                className: 'sw-chip sw-chip-icon',
                onClick: zoomOut,
                disabled: visibleCount >= (total || 60),
                title: t('klineZoomOut'),
                'aria-label': t('klineZoomOut'),
              }, '−'),
              h('button', {
                type: 'button',
                className: 'sw-chip sw-chip-icon',
                onClick: zoomIn,
                disabled: visibleCount <= 15,
                title: t('klineZoomIn'),
                'aria-label': t('klineZoomIn'),
              }, '+'),
            ),
          ),
          periodFailed
            ? h('div', { className: 'sw-notice' }, h('span', null, t('chartFailed')))
            : h(CandleChart, { bars: chartBars, period, loading: periodLoading, t }),
        ),
        analysis
          ? h(AnalysisPanels, { analysis, t })
          : h('div', { className: 'sw-inline-empty' },
              h('strong', null, t('insufficientHistory')),
              h('p', null, t('chartNoData')),
            ),
        h('p', { className: 'sw-risk' }, t('riskNote')),
        h('p', { className: 'sw-source' }, t('dataSource')),
      );
    }

    function SideStat({ label, value, tone }) {
      return h('div', { className: 'sw-side-stat' },
        h('span', null, label),
        h('strong', { className: tone || 'sw-flat' }, value),
      );
    }

    function StatCell({ label, value, tone }) {
      return h('div', { className: 'sw-stat' },
        h('span', null, label),
        h('strong', { className: tone || '', title: value }, value),
      );
    }

    function statValue(key, value, t, market) {
      if (value == null || (typeof value === 'number' && !Number.isFinite(value))) return '—';
      if (key === 'volume') {
        // Hong Kong volume is reported in shares, mainland volume in lots of 100.
        return market === 'HK'
          ? `${compactNumber(value)} ${t('shares')}`
          : `${fmtInt(value)} ${t('lots')}`;
      }
      if (key === 'amount') return fmtMoney(value, market);
      if (key === 'turnover') return fmtPct(value, 2, false);
      if (key === 'volumeRatio') return typeof value === 'number' ? value.toFixed(2) : '—';
      return fmtPrice(value, market);
    }

    function CandleChart({ bars, period, loading, t }) {
      const data = Array.isArray(bars) ? bars.slice(-240) : [];
      if (data.length < 2) {
        return h('div', { className: 'sw-inline-empty', style: { minHeight: 150 } },
          h('p', null, loading ? t('loading') : t('chartNoData')));
      }

      const width = 760;
      const height = 300;
      const left = 52;
      const right = 16;
      const top = 12;
      const bottom = 22;
      const volumeHeight = 46;
      const gap = 12;
      const priceBottom = height - bottom - volumeHeight - gap;
      const volumeBottom = height - bottom;

      const closes = data.map((bar) => bar.close);
      const highs = data.map((bar) => bar.high);
      const lows = data.map((bar) => bar.low);
      const volumes = data.map((bar) => bar.volume ?? 0);
      const maxPrice = Math.max(...highs);
      const minPrice = Math.min(...lows);
      const span = maxPrice - minPrice || 1;
      const pad = span * 0.06;
      const yMax = maxPrice + pad;
      const yMin = minPrice - pad;
      const plotWidth = width - left - right;

      const x = (index) => left + ((index / (data.length - 1)) * plotWidth);
      const y = (value) => top + (1 - ((value - yMin) / (yMax - yMin))) * (priceBottom - top);
      const maxVolume = Math.max(...volumes) || 1;
      const barWidth = Math.max(1.5, (plotWidth / data.length) * 0.62);

      const ma5 = movingAverage(closes, 5);
      const ma20 = movingAverage(closes, 20);
      const lineFor = (series) => series
        .map((value, index) => {
          if (value == null) return null;
          const command = index === 0 || series[index - 1] == null ? 'M' : 'L';
          return `${command}${x(index).toFixed(2)},${y(value).toFixed(2)}`;
        })
        .filter(Boolean)
        .join(' ');

      const upColor = 'var(--dsw-alias-state-error-primary)';
      const downColor = 'var(--dsw-alias-state-success-primary)';
      const ma5Color = 'var(--dsw-alias-state-warn-primary)';
      const ma20Color = 'var(--dsw-alias-brand-primary)';
      const ticks = [0, Math.floor((data.length - 1) / 2), data.length - 1];

      return h('svg', {
        className: 'sw-price-chart',
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: 'none',
        role: 'img',
      },
        [0, 0.5, 1].map((ratio) => {
          const value = yMin + ((yMax - yMin) * ratio);
          const lineY = y(value);
          return h('g', { key: `grid-${ratio}` },
            h('line', {
              x1: left,
              x2: width - right,
              y1: lineY,
              y2: lineY,
              stroke: 'var(--dsw-alias-border-l1)',
              strokeWidth: 1,
              strokeDasharray: '3 4',
            }),
            h('text', {
              x: left - 6,
              y: lineY + 3,
              textAnchor: 'end',
              style: { fill: 'var(--dsw-alias-label-secondary)', fontSize: 10 },
            }, value.toFixed(2)),
          );
        }),
        data.map((bar, index) => {
          const isUp = bar.close >= bar.open;
          const color = isUp ? upColor : downColor;
          const bodyTop = y(Math.max(bar.open, bar.close));
          const bodyBottom = y(Math.min(bar.open, bar.close));
          return h('g', { key: `c-${bar.date}-${index}` },
            h('line', {
              x1: x(index),
              x2: x(index),
              y1: y(bar.high),
              y2: y(bar.low),
              stroke: color,
              strokeWidth: 1,
            }),
            h('rect', {
              x: x(index) - (barWidth / 2),
              y: bodyTop,
              width: barWidth,
              height: Math.max(1, bodyBottom - bodyTop),
              fill: color,
              opacity: 0.92,
            }),
          );
        }),
        h('path', { d: lineFor(ma5), fill: 'none', stroke: ma5Color, strokeWidth: 1.2, opacity: 0.95 }),
        h('path', { d: lineFor(ma20), fill: 'none', stroke: ma20Color, strokeWidth: 1.2, opacity: 0.95 }),
        data.map((bar, index) => {
          const barHeight = (volumes[index] / maxVolume) * volumeHeight;
          return h('rect', {
            key: `v-${bar.date}-${index}`,
            x: x(index) - (barWidth / 2),
            y: volumeBottom - barHeight,
            width: barWidth,
            height: Math.max(1, barHeight),
            fill: bar.close >= bar.open ? upColor : downColor,
            opacity: 0.42,
          });
        }),
        ticks.map((index) => h('text', {
          key: `x-${index}`,
          x: x(index),
          y: height - 5,
          textAnchor: index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle',
          style: { fill: 'var(--dsw-alias-label-secondary)', fontSize: 10 },
        }, data[index].date.slice(0, 10))),
      );
    }

    function movingAverage(values, period) {
      return values.map((_, index) => {
        if (index < period - 1) return null;
        let sum = 0;
        for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
          if (!Number.isFinite(values[cursor])) return null;
          sum += values[cursor];
        }
        return sum / period;
      });
    }

    function seriesPath(values, x, y) {
      let path = '';
      let open = false;
      values.forEach((value, index) => {
        if (!Number.isFinite(value)) {
          open = false;
          return;
        }
        path += `${open ? 'L' : 'M'}${x(index).toFixed(2)},${y(value).toFixed(2)}`;
        open = true;
      });
      return path;
    }

    function uniqueIndexes(values) {
      return [...new Set(values)].filter((value) => value >= 0).sort((left, right) => left - right);
    }

    function AnalysisPanels({ analysis, t }) {
      const signals = Array.isArray(analysis.signals) ? analysis.signals : [];
      const support = analysis.levels?.support1;
      const resistance = analysis.levels?.resistance1;
      const support2 = analysis.levels?.support2;
      const resistance2 = analysis.levels?.resistance2;
      const flags = analysis.flags || {};

      const scenarios = [];
      if (flags.breakout20) {
        scenarios.push(fill(t('scenarioBreakout'), {
          resistance: fmtPrice(resistance),
          next: Number.isFinite(resistance2) ? fmtPrice(resistance2) : t('noLevel'),
        }));
      } else {
        scenarios.push(fill(t('scenarioUp'), { resistance: fmtPrice(resistance) }));
      }
      if (flags.breakdown20) {
        scenarios.push(fill(t('scenarioBreakdown'), {
          support: fmtPrice(support),
          next: Number.isFinite(support2) ? fmtPrice(support2) : t('noLevel'),
        }));
      } else {
        scenarios.push(fill(t('scenarioDown'), { support: fmtPrice(support) }));
      }

      return h(React.Fragment, null,
        h('div', { className: 'sw-grid-two' },
          h('div', { className: 'sw-box' },
            h('div', { className: 'sw-box-head' },
              h('h3', { className: 'sw-box-title' }, t('analysisTitle')),
              h('span', { className: `sw-trend-chip ${trendTone(analysis.trend)}` }, trendLabel(t, analysis.trend)),
            ),
            h('p', { className: 'sw-summary' }, t(summaryKey(analysis.trend))),
            h('div', { className: 'sw-score-row' },
              h('span', { className: `sw-score ${scoreClass(analysis.score)}` }, String(analysis.score), h('small', null, t('scoreUnit'))),
              h('span', { className: `sw-bias ${scoreClass(analysis.score)}` }, scoreBias(t, analysis.bias)),
            ),
            h('div', { className: 'sw-meter' },
              h('span', { className: 'sw-meter-marker', style: { left: `${Math.max(0, Math.min(100, analysis.score))}%` } }),
            ),
            h('div', { className: 'sw-meter-labels' },
              h('span', null, t('biasMeterLow')),
              h('span', null, t('biasMeterHigh')),
            ),
            h('div', { className: 'sw-metrics' },
              h(Metric, { label: t('metricRsi'), value: numberOrDash(analysis.rsi14, 2), tone: rsiTone(analysis.rsi14) }),
              h(Metric, { label: t('metricMacd'), value: numberOrDash(analysis.macd?.hist, 4), tone: toneClass(analysis.macd?.hist) }),
              h(Metric, { label: t('metricVol'), value: pctOrDash(analysis.volatility20), tone: '' }),
              h(Metric, { label: t('metricAtr'), value: numberOrDash(analysis.atr14, 2), tone: '' }),
              h(Metric, { label: t('metricRet20'), value: pctOrDash(analysis.return20), tone: toneClass(analysis.return20) }),
              h(Metric, { label: t('metricRet60'), value: pctOrDash(analysis.return60), tone: toneClass(analysis.return60) }),
              h(Metric, { label: t('metricVolRatio'), value: numberOrDash(analysis.volumeRatio, 2), tone: '' }),
              h(Metric, { label: t('metricBars'), value: `${analysis.bars} ${t('barsUnit')}`, tone: '' }),
            ),
          ),
          h('div', { className: 'sw-box' },
            h('div', { className: 'sw-box-head' },
              h('h3', { className: 'sw-box-title' }, t('signalsTitle')),
            ),
            h('div', { className: 'sw-signals' },
              signals.length > 0
                ? signals.slice(0, 8).map((code) => {
                    const meta = signalMeta(code);
                    if (!meta) return null;
                    return h('span', { key: code, className: `sw-signal ${meta[1]}` }, t(meta[0]));
                  })
                : h('span', { className: 'sw-signal' }, t('trendRange')),
            ),
            h('div', { className: 'sw-scenario' },
              h('div', { className: 'sw-level-row' },
                h('div', { className: 'sw-level is-support' },
                  h('span', null, t('support')),
                  h('strong', null, fmtPrice(support)),
                ),
                h('div', { className: 'sw-level is-resistance' },
                  h('span', null, t('resistance')),
                  h('strong', null, fmtPrice(resistance)),
                ),
              ),
              h('h3', { className: 'sw-box-title', style: { marginBottom: 7 } }, t('scenarioTitle')),
              scenarios.map((text, index) => h('p', { key: `scenario-${index}` }, text)),
            ),
          ),
        ),
      );
    }

    function Metric({ label, value, tone }) {
      return h('div', { className: 'sw-metric' },
        h('span', null, label),
        h('strong', { className: tone || '' }, value),
      );
    }

    function scoreBias(t, bias) {
      if (bias === 'bullish') return t('biasBullish');
      if (bias === 'bearish') return t('biasBearish');
      return t('biasNeutral');
    }

    function rsiTone(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '';
      if (value >= 70) return 'sw-up';
      if (value <= 30) return 'sw-down';
      return '';
    }

    function numberOrDash(value, digits) {
      return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
    }

    function pctOrDash(value) {
      return typeof value === 'number' && Number.isFinite(value) ? fmtPct(value) : '—';
    }

    function EmptyDetail({ t }) {
      return h('div', { className: 'sw-detail-empty' },
        h('div', { className: 'sw-detail-empty-art' }, h(EmptyArt)),
        h('strong', null, t('detailEmptyTitle')),
        h('p', null, t('detailEmptyBody')),
      );
    }

    function ErrorCard({ t, onRetry }) {
      return h('div', { className: 'sw-error-card' },
        h('strong', null, t('errorTitle')),
        h('p', null, t('errorBody')),
        h('button', { type: 'button', className: 'sw-btn sw-btn-primary', onClick: onRetry }, t('retry')),
      );
    }

    function Spinner({ size = 14 }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        className: 'sw-spin',
        'aria-hidden': true,
      },
        h('circle', { cx: 12, cy: 12, r: 9, stroke: 'currentColor', strokeWidth: 2, opacity: 0.22 }),
        h('path', { d: 'M21 12a9 9 0 0 0-9-9', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
      );
    }

    function RefreshIcon({ spinning }) {
      return h('svg', {
        width: 14,
        height: 14,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className: spinning ? 'sw-spin' : null,
        'aria-hidden': true,
      },
        h('path', { d: 'M20 11a8 8 0 1 0-2.3 6.3' }),
        h('path', { d: 'M20 4v7h-7' }),
      );
    }

    function EmptyArt() {
      return h('svg', {
        width: 54,
        height: 54,
        viewBox: '0 0 64 64',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      },
        h('rect', { x: 7, y: 8, width: 50, height: 42, rx: 8, opacity: 0.45 }),
        h('path', { d: 'M15 40l9-10 7 6 8-12 10 10', opacity: 0.8 }),
        h('path', { d: 'M15 50h34', opacity: 0.3 }),
      );
    }

    function SidebarIcon({ size = 20, active = false }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        style: { display: 'block', color: active ? 'var(--dsw-alias-brand-primary)' : 'currentColor' },
        'aria-hidden': true,
        focusable: false,
      },
        h('path', { d: 'M3 17.5 8.2 12l3.4 3.2L21 6.5' }),
        h('path', { d: 'M15.5 6.5H21v5.5' }),
        h('path', { d: 'M3 21h18', opacity: 0.35 }),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const zh = ctx.locale.register(NS, 'zh', ZH);
          const en = ctx.locale.register(NS, 'en', EN);
          return () => {
            zh();
            en();
          };
        }, 'stock-watch: locale dictionaries');

        const t = ctx.locale.bind(NS);

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'stock-watch',
          order: 20,
          label: () => t('nav'),
        }, SidebarIcon));

        const Page = () => h(StockWatchPage, { t });

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'stock-watch',
        }, Page));
      },
    };
  },
});
