const cloneDeep = (value) => JSON.parse(JSON.stringify(value))

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `source-${Date.now()}-${Math.random().toString(16).slice(2)}`

const randomBetween = (min, max) => min + Math.random() * (max - min)
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const round1 = (value) => Math.round(value * 10) / 10

function formatClock(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

const sourceSpecs = {
  text: {
    label: '文本',
    generators: [
      { value: 'static', label: '静态数据' },
      { value: 'headlineFlash', label: '标题轮播' }
    ],
    createPayload: () => ({
      text: '城市运行智能指挥中心'
    })
  },
  stat: {
    label: '指标',
    generators: [
      { value: 'static', label: '静态数据' },
      { value: 'statPulse', label: '动态波动' }
    ],
    createPayload: () => ({
      title: '活跃设备',
      value: 28640,
      unit: '台',
      trend: 8.2,
      trendLabel: '较昨日',
      color: '#44e6ff',
      accent: '#84ffbf'
    })
  },
  barChart: {
    label: '柱状图',
    generators: [
      { value: 'static', label: '静态数据' },
      { value: 'barPulse', label: '柱状浮动' }
    ],
    createPayload: () => ({
      title: '渠道流量',
      categories: ['App', '小程序', '官网', '门店', '其他'],
      values: [92, 76, 54, 39, 22],
      color: '#46eeff'
    })
  },
  lineChart: {
    label: '折线图',
    generators: [
      { value: 'static', label: '静态数据' },
      { value: 'linePulse', label: '趋势变化' }
    ],
    createPayload: () => ({
      title: '近七日告警趋势',
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      values: [14, 28, 19, 33, 48, 30, 22],
      color: '#7bfecb',
      areaColor: 'rgba(123, 254, 203, 0.18)'
    })
  },
  gauge: {
    label: '仪表盘',
    generators: [
      { value: 'static', label: '静态数据' },
      { value: 'gaugePulse', label: '百分比波动' }
    ],
    createPayload: () => ({
      title: '设备在线率',
      value: 86,
      color: '#5affbd',
      trackColor: 'rgba(255, 255, 255, 0.12)'
    })
  },
  panel: {
    label: '面板',
    generators: [
      { value: 'static', label: '静态数据' },
      { value: 'panelDigest', label: '摘要轮播' }
    ],
    createPayload: () => ({
      title: '业务分区',
      subtitle: '支持作为信息容器使用',
      content: '你可以把这类面板当作版心区块，搭配图表和指标卡片组成完整大屏。'
    })
  }
}

const sourceTypeKeys = Object.keys(sourceSpecs)

export const dataSourceTypeOptions = sourceTypeKeys.map((value) => ({
  value,
  label: sourceSpecs[value].label
}))

export function getDataSourceSpec(type) {
  return sourceSpecs[type] ?? sourceSpecs.text
}

export function getGeneratorOptions(type) {
  return getDataSourceSpec(type).generators
}

export function getDefaultDataSourcePayload(type) {
  return cloneDeep(getDataSourceSpec(type).createPayload())
}

export function createDataSource(type, overrides = {}) {
  const safeType = sourceSpecs[type] ? type : 'text'
  const generatorOptions = getGeneratorOptions(safeType)
  const fallbackGenerator = generatorOptions[0]?.value ?? 'static'
  const generator = generatorOptions.some((item) => item.value === overrides.generator)
    ? overrides.generator
    : fallbackGenerator

  return {
    id: overrides.id ?? createId(),
    name: overrides.name ?? `${getDataSourceSpec(safeType).label}数据源`,
    type: safeType,
    generator,
    refreshInterval: Number.isFinite(Number(overrides.refreshInterval))
      ? Math.max(0, Number(overrides.refreshInterval))
      : 0,
    payload: {
      ...getDefaultDataSourcePayload(safeType),
      ...cloneDeep(overrides.payload ?? {})
    }
  }
}

export function normalizeDataSource(rawSource, index = 0) {
  const type = sourceSpecs[rawSource?.type] ? rawSource.type : 'text'

  return createDataSource(type, {
    id: rawSource?.id || `source-${index + 1}`,
    name: rawSource?.name || `${getDataSourceSpec(type).label}数据源 ${index + 1}`,
    generator: rawSource?.generator,
    refreshInterval: rawSource?.refreshInterval,
    payload:
      rawSource?.payload && typeof rawSource.payload === 'object' && !Array.isArray(rawSource.payload)
        ? rawSource.payload
        : {}
  })
}

function createStatPayload(basePayload) {
  const baseValue = Number(basePayload.value ?? 0)
  const nextValue = Math.max(0, Math.round(baseValue + randomBetween(-900, 1200)))

  return {
    ...basePayload,
    value: nextValue,
    trend: round1(randomBetween(-9.8, 13.2))
  }
}

function createBarPayload(basePayload) {
  const categories = Array.isArray(basePayload.categories) ? basePayload.categories.filter(Boolean) : []
  const values = Array.isArray(basePayload.values) ? basePayload.values : []

  return {
    ...basePayload,
    values: categories.map((_, index) => {
      const current = Number(values[index] ?? 0)
      const seed = current || 20
      return Math.max(0, Math.round(seed + randomBetween(-12, 14)))
    })
  }
}

function createLinePayload(basePayload) {
  const labels = Array.isArray(basePayload.labels) ? basePayload.labels.filter(Boolean) : []
  const values = Array.isArray(basePayload.values) ? basePayload.values : []

  return {
    ...basePayload,
    values: labels.map((_, index) => {
      const current = Number(values[index] ?? 0)
      const seed = current || 16 + index * 3
      return Math.max(0, Math.round(seed + randomBetween(-10, 11)))
    })
  }
}

function createGaugePayload(basePayload) {
  return {
    ...basePayload,
    value: Math.round(clamp(Number(basePayload.value ?? 0) + randomBetween(-8, 9), 0, 100))
  }
}

function createTextPayload(basePayload) {
  const baseText = String(basePayload.text || '城市运行智能指挥中心').split(' · ')[0]

  return {
    ...basePayload,
    text: `${baseText} · ${formatClock()}`
  }
}

function createPanelPayload(basePayload) {
  const notes = [
    '今日高优先级事件保持可控，建议关注告警波动区间。',
    '当前数据已自动刷新，建议对重点区域进行二次钻取。',
    '本时段趋势整体平稳，可继续结合图表进行联动分析。'
  ]

  return {
    ...basePayload,
    subtitle: `最近同步 ${formatClock()}`,
    content: notes[Math.floor(Math.random() * notes.length)]
  }
}

export function generateDataSourcePayload(source) {
  const basePayload = {
    ...getDefaultDataSourcePayload(source.type),
    ...cloneDeep(source.payload ?? {})
  }

  switch (source.generator) {
    case 'statPulse':
      return createStatPayload(basePayload)
    case 'barPulse':
      return createBarPayload(basePayload)
    case 'linePulse':
      return createLinePayload(basePayload)
    case 'gaugePulse':
      return createGaugePayload(basePayload)
    case 'headlineFlash':
      return createTextPayload(basePayload)
    case 'panelDigest':
      return createPanelPayload(basePayload)
    case 'static':
    default:
      return basePayload
  }
}
