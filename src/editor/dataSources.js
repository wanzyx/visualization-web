const cloneDeep = (value) => JSON.parse(JSON.stringify(value))

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `source-${Date.now()}-${Math.random().toString(16).slice(2)}`

const randomBetween = (min, max) => min + Math.random() * (max - min)
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const round1 = (value) => Math.round(value * 10) / 10

export const requestMethodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
export const authModeOptions = [
  { value: 'none', label: '无鉴权' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'custom-header', label: '自定义请求头' }
]

function formatClock(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

function serializeTextValue(value, fallback = '') {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch (error) {
      console.warn(error)
    }
  }

  return fallback
}

export function createDataSourceRequestConfig(overrides = {}) {
  const method = String(overrides.method || 'GET').toUpperCase()
  const timeout = Number(overrides.timeout)
  const authMode = authModeOptions.some((option) => option.value === overrides.authMode)
    ? overrides.authMode
    : 'none'

  return {
    url: typeof overrides.url === 'string' ? overrides.url : '',
    method: requestMethodOptions.includes(method) ? method : 'GET',
    dataPath: typeof overrides.dataPath === 'string' ? overrides.dataPath : '',
    queryText: serializeTextValue(overrides.queryText ?? overrides.query, ''),
    headersText: serializeTextValue(overrides.headersText ?? overrides.headers, ''),
    bodyText: serializeTextValue(overrides.bodyText ?? overrides.body, ''),
    fieldMappingsText: serializeTextValue(
      overrides.fieldMappingsText ?? overrides.fieldMappings,
      ''
    ),
    authMode,
    authToken: typeof overrides.authToken === 'string' ? overrides.authToken : '',
    authHeaderName:
      typeof overrides.authHeaderName === 'string' && overrides.authHeaderName.trim()
        ? overrides.authHeaderName
        : 'Authorization',
    authUsername: typeof overrides.authUsername === 'string' ? overrides.authUsername : '',
    authPassword: typeof overrides.authPassword === 'string' ? overrides.authPassword : '',
    timeout: Number.isFinite(timeout) ? Math.max(500, timeout) : 10000,
    withCredentials: Boolean(overrides.withCredentials)
  }
}

const sourceSpecs = {
  text: {
    label: '文本',
    generators: [
      { value: 'static', label: '静态数据' },
      { value: 'headlineFlash', label: '标题轮播' },
      { value: 'remote', label: 'HTTP 接口' }
    ],
    createPayload: () => ({
      text: '城市运行智能指挥中心'
    })
  },
  stat: {
    label: '指标',
    generators: [
      { value: 'static', label: '静态数据' },
      { value: 'statPulse', label: '动态波动' },
      { value: 'remote', label: 'HTTP 接口' }
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
      { value: 'barPulse', label: '柱状浮动' },
      { value: 'remote', label: 'HTTP 接口' }
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
      { value: 'linePulse', label: '趋势变化' },
      { value: 'remote', label: 'HTTP 接口' }
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
      { value: 'gaugePulse', label: '百分比波动' },
      { value: 'remote', label: 'HTTP 接口' }
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
      { value: 'panelDigest', label: '摘要轮播' },
      { value: 'remote', label: 'HTTP 接口' }
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

export function getRemoteFieldMappingTemplate(type) {
  const templates = {
    text: {
      text: 'text'
    },
    stat: {
      title: 'title',
      value: 'value',
      unit: 'unit',
      trend: 'trend',
      trendLabel: 'trendLabel'
    },
    barChart: {
      title: 'title',
      categories: 'categories',
      values: 'values',
      color: 'color'
    },
    lineChart: {
      title: 'title',
      labels: 'labels',
      values: 'values',
      color: 'color',
      areaColor: 'areaColor'
    },
    gauge: {
      title: 'title',
      value: 'value',
      color: 'color'
    },
    panel: {
      title: 'title',
      subtitle: 'subtitle',
      content: 'content'
    }
  }

  return JSON.stringify(templates[type] ?? templates.text, null, 2)
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
    request: createDataSourceRequestConfig(overrides.request ?? {}),
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
    request: rawSource?.request,
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
  const baseText = String(basePayload.text || '城市运行智能指挥中心').split(' 路 ')[0]

  return {
    ...basePayload,
    text: `${baseText} 路 ${formatClock()}`
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

function buildBasePayload(source) {
  return {
    ...getDefaultDataSourcePayload(source.type),
    ...cloneDeep(source.payload ?? {})
  }
}

function buildTemplateContext(source, context = {}) {
  const now = new Date()
  const isoNow = context.isoNow ?? now.toISOString()

  return {
    timestamp: context.timestamp ?? now.getTime(),
    isoNow,
    today: context.today ?? isoNow.slice(0, 10),
    pageId: context.pageId ?? '',
    pageName: context.pageName ?? '',
    projectTitle: context.projectTitle ?? '',
    sourceId: context.sourceId ?? source.id ?? '',
    sourceName: context.sourceName ?? source.name ?? '',
    env: import.meta.env ?? {}
  }
}

function toPathSegments(path) {
  return String(path || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getValueByPath(target, path) {
  const segments = toPathSegments(path)

  if (!segments.length) {
    return target
  }

  return segments.reduce((current, key) => current?.[key], target)
}

function setValueByPath(target, path, value) {
  const segments = toPathSegments(path)

  if (!segments.length) {
    return
  }

  let current = target

  while (segments.length > 1) {
    const key = segments.shift()

    if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
      current[key] = {}
    }

    current = current[key]
  }

  current[segments[0]] = value
}

function formatTemplateValue(value) {
  if (value === undefined || value === null) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch (error) {
    console.warn(error)
    return String(value)
  }
}

function interpolateTemplateString(input, context) {
  return String(input || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expression) => {
    const value = getValueByPath(context, expression)
    return formatTemplateValue(value)
  })
}

function parseHeadersText(headersText) {
  if (!headersText?.trim()) {
    return {}
  }

  const parsed = JSON.parse(headersText)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('请求头必须是 JSON 对象')
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, value == null ? '' : String(value)])
  )
}

function parseQueryText(queryText) {
  if (!queryText?.trim()) {
    return {}
  }

  const parsed = JSON.parse(queryText)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('请求参数必须是 JSON 对象')
  }

  return parsed
}

function parseBodyValue(bodyText) {
  if (!bodyText?.trim()) {
    return undefined
  }

  try {
    return JSON.parse(bodyText)
  } catch (error) {
    return bodyText
  }
}

function appendQueryParams(urlValue, query) {
  const entries = Object.entries(query)

  if (!entries.length) {
    return urlValue
  }

  const base = globalThis.location?.origin ?? 'http://localhost'
  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(urlValue)
  const isRootRelative = urlValue.startsWith('/')
  const url = new URL(urlValue, base)

  entries.forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== '') {
          url.searchParams.append(key, String(item))
        }
      })
      return
    }

    url.searchParams.set(key, String(value))
  })

  if (hasProtocol) {
    return url.toString()
  }

  if (isRootRelative) {
    return `${url.pathname}${url.search}${url.hash}`
  }

  return `${url.pathname.replace(/^\//, '')}${url.search}${url.hash}`
}

function parseFieldMappingsText(fieldMappingsText) {
  if (!fieldMappingsText?.trim()) {
    return {}
  }

  const parsed = JSON.parse(fieldMappingsText)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('字段映射必须是 JSON 对象')
  }

  return parsed
}

function encodeBase64(value) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64')
  }

  if (typeof globalThis.btoa === 'function') {
    const bytes = new TextEncoder().encode(value)
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })
    return globalThis.btoa(binary)
  }

  throw new Error('当前环境不支持 Base64 编码')
}

function applyAuthHeaders(headers, request) {
  switch (request.authMode) {
    case 'bearer':
      if (request.authToken.trim()) {
        headers.Authorization = `Bearer ${request.authToken.trim()}`
      }
      break
    case 'basic':
      if (request.authUsername || request.authPassword) {
        headers.Authorization = `Basic ${encodeBase64(
          `${request.authUsername}:${request.authPassword}`
        )}`
      }
      break
    case 'custom-header':
      if (request.authHeaderName.trim() && request.authToken.trim()) {
        headers[request.authHeaderName.trim()] = request.authToken.trim()
      }
      break
    default:
      break
  }
}

function toPreviewValue(value) {
  if (typeof value === 'string') {
    return value.length > 1800 ? `${value.slice(0, 1800)}...` : value
  }

  if (value === undefined) {
    return ''
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    console.warn(error)
    return String(value)
  }
}

function maskSensitiveHeaderValue(headerName, value, request) {
  const normalizedName = String(headerName).toLowerCase()
  const customHeaderName = String(request.authHeaderName || '').toLowerCase()
  const shouldMask =
    normalizedName === 'authorization' ||
    normalizedName === 'cookie' ||
    normalizedName === customHeaderName ||
    normalizedName.includes('token') ||
    normalizedName.includes('secret') ||
    normalizedName.includes('key')

  if (!shouldMask) {
    return value
  }

  if (typeof value !== 'string') {
    return '***'
  }

  return value.length > 8 ? `${value.slice(0, 4)}***${value.slice(-2)}` : '***'
}

function buildRequestPreview(url, method, headers, body, request) {
  return {
    url,
    method,
    headers: Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key, maskSensitiveHeaderValue(key, value, request)])
    ),
    body: toPreviewValue(body ?? '')
  }
}

function resolveMappedFieldValue(responseData, mapping) {
  if (typeof mapping === 'string') {
    return getValueByPath(responseData, mapping)
  }

  if (mapping && typeof mapping === 'object' && !Array.isArray(mapping)) {
    let nextValue

    if (typeof mapping.path === 'string' && mapping.path.trim()) {
      nextValue = getValueByPath(responseData, mapping.path)
    } else if ('value' in mapping) {
      nextValue = cloneDeep(mapping.value)
    }

    if (nextValue === undefined && 'default' in mapping) {
      nextValue = cloneDeep(mapping.default)
    }

    return nextValue
  }

  return cloneDeep(mapping)
}

function applyFieldMappings(basePayload, responseData, fieldMappings) {
  const entries = Object.entries(fieldMappings)

  if (!entries.length) {
    return null
  }

  const nextPayload = cloneDeep(basePayload)
  let appliedCount = 0

  entries.forEach(([payloadPath, mapping]) => {
    const value = resolveMappedFieldValue(responseData, mapping)

    if (value === undefined) {
      return
    }

    setValueByPath(nextPayload, payloadPath, cloneDeep(value))
    appliedCount += 1
  })

  return appliedCount > 0 ? nextPayload : cloneDeep(basePayload)
}

function normalizeRemotePayload(type, extracted, basePayload) {
  if (extracted === undefined || extracted === null) {
    return cloneDeep(basePayload)
  }

  if (typeof extracted === 'object' && !Array.isArray(extracted)) {
    return {
      ...basePayload,
      ...cloneDeep(extracted)
    }
  }

  if (Array.isArray(extracted)) {
    switch (type) {
      case 'barChart':
      case 'lineChart':
        return {
          ...basePayload,
          values: cloneDeep(extracted)
        }
      case 'text':
        return {
          ...basePayload,
          text: extracted.join(' / ')
        }
      case 'panel':
        return {
          ...basePayload,
          content: extracted.join('\n')
        }
      default:
        return cloneDeep(basePayload)
    }
  }

  switch (type) {
    case 'text':
      return {
        ...basePayload,
        text: String(extracted)
      }
    case 'panel':
      return {
        ...basePayload,
        content: String(extracted)
      }
    case 'stat':
    case 'gauge': {
      const nextValue = Number(extracted)

      return Number.isFinite(nextValue)
        ? {
            ...basePayload,
            value: nextValue
          }
        : cloneDeep(basePayload)
    }
    default:
      return cloneDeep(basePayload)
  }
}

async function fetchRemoteDataSourcePayload(source, basePayload, context = {}) {
  const request = createDataSourceRequestConfig(source.request ?? {})
  const templateContext = buildTemplateContext(source, context)
  const resolvedRequest = {
    ...request,
    url: appendQueryParams(
      interpolateTemplateString(request.url, templateContext),
      parseQueryText(interpolateTemplateString(request.queryText, templateContext))
    ),
    headersText: interpolateTemplateString(request.headersText, templateContext),
    bodyText: interpolateTemplateString(request.bodyText, templateContext),
    authToken: interpolateTemplateString(request.authToken, templateContext),
    authHeaderName: interpolateTemplateString(request.authHeaderName, templateContext),
    authUsername: interpolateTemplateString(request.authUsername, templateContext),
    authPassword: interpolateTemplateString(request.authPassword, templateContext)
  }

  if (!resolvedRequest.url.trim()) {
    throw new Error('请先配置接口地址')
  }

  const headers = parseHeadersText(resolvedRequest.headersText)
  applyAuthHeaders(headers, resolvedRequest)
  const bodyValue = parseBodyValue(resolvedRequest.bodyText)
  const method = resolvedRequest.method.toUpperCase()
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  let timerId = 0

  if (controller && resolvedRequest.timeout > 0) {
    timerId = globalThis.setTimeout(() => controller.abort(), resolvedRequest.timeout)
  }

  try {
    const shouldSendBody = !['GET', 'HEAD'].includes(method)
    const requestInit = {
      method,
      headers,
      credentials: resolvedRequest.withCredentials ? 'include' : 'same-origin',
      signal: controller?.signal
    }

    if (shouldSendBody && bodyValue !== undefined) {
      if (
        typeof bodyValue === 'object' &&
        bodyValue !== null &&
        !Array.isArray(bodyValue) &&
        !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
      ) {
        headers['Content-Type'] = 'application/json'
      }

      requestInit.body = typeof bodyValue === 'string' ? bodyValue : JSON.stringify(bodyValue)
    }

    const response = await fetch(resolvedRequest.url, requestInit)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim())
    }

    const contentType = response.headers.get('content-type') || ''
    const responseData = contentType.includes('application/json')
      ? await response.json()
      : await response.text()
    const extracted = resolvedRequest.dataPath
      ? getValueByPath(responseData, resolvedRequest.dataPath)
      : responseData
    const fieldMappings = parseFieldMappingsText(resolvedRequest.fieldMappingsText)
    const mappedPayload = applyFieldMappings(basePayload, extracted, fieldMappings)
    const meta = {
      requestPreview: buildRequestPreview(
        resolvedRequest.url,
        method,
        headers,
        requestInit.body ?? '',
        resolvedRequest
      ),
      responseStatus: response.status,
      responseStatusText: response.statusText || '',
      responsePreview: toPreviewValue(responseData),
      extractedPreview: toPreviewValue(extracted),
      mappedFieldCount: Object.keys(fieldMappings).length
    }

    if (mappedPayload) {
      return {
        payload: mappedPayload,
        meta
      }
    }

    return {
      payload: normalizeRemotePayload(source.type, extracted, basePayload),
      meta
    }
  } finally {
    if (timerId) {
      globalThis.clearTimeout(timerId)
    }
  }
}

export function generateDataSourcePayload(source) {
  const basePayload = buildBasePayload(source)

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
    case 'remote':
    case 'static':
    default:
      return basePayload
  }
}

export async function resolveDataSourceRuntime(source, context = {}) {
  const basePayload = buildBasePayload(source)

  if (source.generator === 'remote') {
    return fetchRemoteDataSourcePayload(source, basePayload, context)
  }

  return {
    payload: generateDataSourcePayload(source),
    meta: {
      requestPreview: null,
      responseStatus: null,
      responseStatusText: '',
      responsePreview: '',
      extractedPreview: '',
      mappedFieldCount: 0
    }
  }
}

export async function resolveDataSourcePayload(source, context = {}) {
  const result = await resolveDataSourceRuntime(source, context)
  return result.payload
}
