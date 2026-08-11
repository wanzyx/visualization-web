import { cloneWidget, createWidget } from './materials'

export const STORAGE_KEY = 'visualization-web-project-v1'
export const TEMPLATE_STORAGE_KEY = 'visualization-web-templates-v1'

const cloneDeep = (value) => JSON.parse(JSON.stringify(value))

const createGroupId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `group-${Date.now()}-${Math.random().toString(16).slice(2)}`

const createTemplateId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `template-${Date.now()}-${Math.random().toString(16).slice(2)}`

export const defaultMeta = {
  title: 'Vue3 大屏低代码平台',
  screenWidth: 1920,
  screenHeight: 1080,
  background:
    'radial-gradient(circle at top, rgba(44, 126, 255, 0.32), transparent 36%), linear-gradient(135deg, #071225 0%, #08162c 45%, #03070d 100%)',
  gridColor: 'rgba(72, 210, 255, 0.12)',
  showGrid: true
}

export function createDemoProject() {
  return {
    meta: cloneDeep(defaultMeta),
    widgets: [
      createWidget('text', {
        x: 88,
        y: 48,
        w: 620,
        h: 86,
        zIndex: 1,
        props: {
          text: '城市运行智能指挥中心',
          fontSize: 46
        }
      }),
      createWidget('panel', {
        x: 72,
        y: 154,
        w: 540,
        h: 320,
        zIndex: 2,
        props: {
          title: '左侧概览',
          subtitle: '承载业务摘要、分析结论和筛选说明',
          content: '通过拖拽或点击左侧物料，可以快速组合文本、图表和指标卡，属性面板支持直接调整样式、尺寸和数据。'
        }
      }),
      createWidget('stat', {
        x: 648,
        y: 154,
        zIndex: 3,
        props: {
          title: '活跃设备',
          value: 28640,
          unit: '台',
          trend: 8.2
        }
      }),
      createWidget('stat', {
        x: 1020,
        y: 154,
        zIndex: 4,
        props: {
          title: '今日告警',
          value: 312,
          unit: '次',
          trend: -5.8,
          color: '#ffd66b',
          accent: '#ff8a72'
        }
      }),
      createWidget('gauge', {
        x: 1418,
        y: 144,
        zIndex: 5
      }),
      createWidget('barChart', {
        x: 648,
        y: 386,
        zIndex: 6
      }),
      createWidget('lineChart', {
        x: 1200,
        y: 386,
        zIndex: 7
      })
    ]
  }
}

export function normalizeProjectSchema(rawProject) {
  if (!rawProject || typeof rawProject !== 'object') {
    throw new Error('项目 JSON 不合法')
  }

  const widgets = Array.isArray(rawProject.widgets)
    ? rawProject.widgets.map((widget, index) => normalizeWidget(widget, index))
    : []

  return {
    meta: {
      ...cloneDeep(defaultMeta),
      ...(rawProject.meta ?? {})
    },
    widgets
  }
}

function normalizeWidget(widget, index) {
  const normalized = createWidget(widget?.type || 'panel', cloneDeep(widget ?? {}))

  return {
    ...normalized,
    id: widget?.id || normalized.id,
    name: widget?.name || normalized.name,
    groupId: widget?.groupId || null,
    locked: Boolean(widget?.locked),
    hidden: Boolean(widget?.hidden),
    x: Number(widget?.x ?? normalized.x),
    y: Number(widget?.y ?? normalized.y),
    w: Math.max(100, Number(widget?.w ?? normalized.w)),
    h: Math.max(60, Number(widget?.h ?? normalized.h)),
    zIndex: Number.isFinite(Number(widget?.zIndex)) ? Number(widget.zIndex) : index + 1
  }
}

export function getNextZIndex(widgets) {
  return widgets.length ? Math.max(...widgets.map((item) => item.zIndex || 0)) + 1 : 1
}

export function sortWidgets(widgets) {
  widgets.sort((a, b) => a.zIndex - b.zIndex)
}

export function getSelectionBounds(widgets) {
  if (!widgets.length) {
    return null
  }

  const left = Math.min(...widgets.map((item) => item.x))
  const top = Math.min(...widgets.map((item) => item.y))
  const right = Math.max(...widgets.map((item) => item.x + item.w))
  const bottom = Math.max(...widgets.map((item) => item.y + item.h))

  return {
    x: left,
    y: top,
    w: right - left,
    h: bottom - top
  }
}

export function expandIdsWithGroups(ids, widgets) {
  const selection = new Set(ids.filter(Boolean))
  const activeGroups = new Set()

  widgets.forEach((widget) => {
    if (selection.has(widget.id) && widget.groupId) {
      activeGroups.add(widget.groupId)
    }
  })

  if (!activeGroups.size) {
    return Array.from(selection)
  }

  widgets.forEach((widget) => {
    if (widget.groupId && activeGroups.has(widget.groupId)) {
      selection.add(widget.id)
    }
  })

  return Array.from(selection)
}

export function duplicateWidgets(project, selectedIds) {
  const expandedIds = expandIdsWithGroups(selectedIds, project.widgets)
  const selectedSet = new Set(expandedIds)
  const sources = project.widgets
    .filter((item) => selectedSet.has(item.id))
    .sort((a, b) => a.zIndex - b.zIndex)

  if (!sources.length) {
    return []
  }

  const nextZIndex = getNextZIndex(project.widgets)
  const groupMap = new Map()
  const duplicates = sources.map((widget, index) => {
    let nextGroupId = null

    if (widget.groupId) {
      if (!groupMap.has(widget.groupId)) {
        groupMap.set(widget.groupId, createGroupId())
      }
      nextGroupId = groupMap.get(widget.groupId)
    }

    return cloneWidget(widget, {
      x: widget.x + 28,
      y: widget.y + 28,
      zIndex: nextZIndex + index,
      groupId: nextGroupId
    })
  })

  project.widgets.push(...duplicates)
  sortWidgets(project.widgets)
  return duplicates
}

export function createWidgetGroup(project, selectedIds) {
  const expandedIds = expandIdsWithGroups(selectedIds, project.widgets)

  if (expandedIds.length < 2) {
    return null
  }

  const groupId = createGroupId()
  const selectedSet = new Set(expandedIds)

  project.widgets.forEach((widget) => {
    if (selectedSet.has(widget.id)) {
      widget.groupId = groupId
    }
  })

  return groupId
}

export function removeWidgetGroup(project, selectedIds) {
  const expandedIds = expandIdsWithGroups(selectedIds, project.widgets)
  const selectedSet = new Set(expandedIds)

  project.widgets.forEach((widget) => {
    if (selectedSet.has(widget.id)) {
      widget.groupId = null
    }
  })

  return expandedIds.length
}

function buildTemplatePreview(widgets) {
  const bounds = getSelectionBounds(widgets) ?? { w: 0, h: 0 }

  return {
    width: bounds.w,
    height: bounds.h,
    count: widgets.length
  }
}

function normalizeTemplate(rawTemplate, index) {
  if (!rawTemplate || typeof rawTemplate !== 'object') {
    return null
  }

  const widgets = Array.isArray(rawTemplate.widgets)
    ? rawTemplate.widgets.map((widget, widgetIndex) => normalizeWidget(widget, widgetIndex))
    : []

  if (!widgets.length) {
    return null
  }

  const bounds = getSelectionBounds(widgets) ?? { x: 0, y: 0 }
  const normalizedWidgets = widgets.map((widget, widgetIndex) => ({
    ...widget,
    x: widget.x - bounds.x,
    y: widget.y - bounds.y,
    zIndex: widgetIndex + 1
  }))

  return {
    id: rawTemplate.id || `template-${index + 1}`,
    name:
      rawTemplate.name ||
      (normalizedWidgets.length === 1
        ? `${normalizedWidgets[0].name} 模板`
        : `组合模板 ${normalizedWidgets.length} 项`),
    createdAt: Number.isFinite(Number(rawTemplate.createdAt))
      ? Number(rawTemplate.createdAt)
      : Date.now(),
    widgets: normalizedWidgets,
    preview: buildTemplatePreview(normalizedWidgets)
  }
}

export function loadTemplateLibrary() {
  if (typeof localStorage === 'undefined') {
    return []
  }

  const rawValue = localStorage.getItem(TEMPLATE_STORAGE_KEY)

  if (!rawValue) {
    return []
  }

  try {
    const templates = JSON.parse(rawValue)

    if (!Array.isArray(templates)) {
      return []
    }

    return templates.map(normalizeTemplate).filter(Boolean)
  } catch (error) {
    console.warn(error)
    return []
  }
}

export function createTemplateFromSelection(project, selectedIds, name = '') {
  const expandedIds = expandIdsWithGroups(selectedIds, project.widgets)
  const selectedSet = new Set(expandedIds)
  const sourceWidgets = project.widgets
    .filter((item) => selectedSet.has(item.id))
    .sort((a, b) => a.zIndex - b.zIndex)

  if (!sourceWidgets.length) {
    return null
  }

  const bounds = getSelectionBounds(sourceWidgets)

  if (!bounds) {
    return null
  }

  const widgets = sourceWidgets.map((widget, index) => ({
    ...cloneDeep(widget),
    x: widget.x - bounds.x,
    y: widget.y - bounds.y,
    zIndex: index + 1
  }))

  return {
    id: createTemplateId(),
    name: name.trim() || (widgets.length === 1 ? `${widgets[0].name} 模板` : `组合模板 ${widgets.length} 项`),
    createdAt: Date.now(),
    widgets,
    preview: buildTemplatePreview(widgets)
  }
}

export function instantiateTemplate(project, template, position = {}) {
  if (!template?.widgets?.length) {
    return []
  }

  const nextZIndex = getNextZIndex(project.widgets)
  const groupMap = new Map()
  const widgets = [...template.widgets].sort((a, b) => a.zIndex - b.zIndex)

  return widgets.map((widget, index) => {
    let nextGroupId = null

    if (widget.groupId) {
      if (!groupMap.has(widget.groupId)) {
        groupMap.set(widget.groupId, createGroupId())
      }
      nextGroupId = groupMap.get(widget.groupId)
    }

    return cloneWidget(widget, {
      x: (position.x ?? 80) + widget.x,
      y: (position.y ?? 80) + widget.y,
      zIndex: nextZIndex + index,
      groupId: nextGroupId,
      hidden: false,
      locked: false
    })
  })
}
