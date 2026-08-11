<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MaterialPanel from './components/MaterialPanel.vue'
import RuntimeShell from './components/RuntimeShell.vue'
import StageCanvas from './components/StageCanvas.vue'
import InspectorPanel from './components/InspectorPanel.vue'
import TopToolbar from './components/TopToolbar.vue'
import { materials, createWidget } from './editor/materials'
import { createDataSource, generateDataSourcePayload } from './editor/dataSources'
import {
  STORAGE_KEY,
  TEMPLATE_STORAGE_KEY,
  createDemoProject,
  createProjectPage,
  createTemplateFromSelection,
  createWidgetGroup,
  defaultPageMeta,
  duplicateProjectPage,
  duplicateWidgets,
  expandIdsWithGroups,
  getNextZIndex,
  getSelectionBounds,
  instantiateTemplate,
  loadTemplateLibrary,
  normalizeProjectSchema,
  removeWidgetGroup,
  sortWidgets
} from './editor/project'

const HISTORY_LIMIT = 80
const HISTORY_MERGE_WINDOW = 600
const PROJECT_SYNC_DELAY = 120
const TEMPLATE_LIMIT = 30
const LINKED_WIDGET_DURATION = 1800

const initialRoute = getInitialRouteState()
const appMode = ref(initialRoute.mode)
const previewMode = ref(false)
const dialogMode = ref(null)
const dialogText = ref('')
const templateDraftName = ref('')
const statusMessage = ref('已启用多页面、模板库、数据源和事件联动')

const project = ref(loadProject())
const templates = ref(loadTemplateLibrary())
const dataSourceRuntime = ref({})
const linkedWidgetIds = ref([])
const runtimePageId = ref(initialRoute.pageId || '')
const clipboardTemplate = ref(null)

const sourceRefreshTimers = new Map()
let linkedWidgetTimerId = 0
let projectSyncTimerId = 0
let lastProjectSnapshot = JSON.stringify(project.value)

const isRuntimeMode = computed(() => appMode.value === 'runtime')

const currentPageId = computed(() => {
  const fallbackPageId = project.value.activePageId || project.value.pages[0]?.id || ''
  const preferredPageId = isRuntimeMode.value ? runtimePageId.value : project.value.activePageId

  return project.value.pages.some((page) => page.id === preferredPageId) ? preferredPageId : fallbackPageId
})

const currentPage = computed(() => {
  const pages = project.value.pages ?? []
  return pages.find((page) => page.id === currentPageId.value) ?? pages[0] ?? null
})

const currentWidgets = computed(() => currentPage.value?.widgets ?? [])

const currentCanvas = computed(() => ({
  id: currentPage.value?.id ?? '',
  name: currentPage.value?.name ?? '',
  meta: currentPage.value?.meta ?? defaultPageMeta,
  widgets: currentWidgets.value,
  dataSources: project.value.dataSources ?? []
}))

const selectedIds = ref(currentWidgets.value[0]?.id ? [currentWidgets.value[0].id] : [])
const primarySelectedId = ref(currentWidgets.value[0]?.id ?? null)

const undoStack = ref([])
const redoStack = ref([])
const pendingHistoryLabel = ref(null)
const activeHistoryLabel = ref(null)
const currentHistoryLabel = ref('当前项目')
const isRestoringHistory = ref(false)
const lastHistoryCommitAt = ref(0)
const lastHistoryCommitLabel = ref('')

const selectedWidgets = computed(() => {
  const selection = new Set(selectedIds.value)
  return currentWidgets.value.filter((item) => selection.has(item.id))
})

const selectedWidget = computed(() => {
  if (selectedIds.value.length !== 1) {
    return null
  }

  return currentWidgets.value.find((item) => item.id === selectedIds.value[0]) ?? null
})

const selectedBounds = computed(() => getSelectionBounds(selectedWidgets.value))
const canOperate = computed(() => selectedIds.value.length > 0)
const canGroup = computed(() => selectedIds.value.length > 1)
const canUngroup = computed(() => selectedWidgets.value.some((item) => item.groupId))
const canUndo = computed(() => undoStack.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)
const canCopy = computed(() => selectedIds.value.length > 0)
const canPaste = computed(() => Boolean(clipboardTemplate.value?.widgets?.length))
const canSaveTemplate = computed(() => selectedIds.value.length > 0)
const canDeletePage = computed(() => project.value.pages.length > 1)
const hasDataSources = computed(() => project.value.dataSources.length > 0)

const sourceBindingCounts = computed(() => {
  const counts = Object.fromEntries(project.value.dataSources.map((source) => [source.id, 0]))

  project.value.pages.forEach((page) => {
    page.widgets.forEach((widget) => {
      const sourceId = widget.dataBinding?.sourceId

      if (sourceId) {
        counts[sourceId] = (counts[sourceId] ?? 0) + 1
      }
    })
  })

  return counts
})

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value))
}

function loadProject() {
  if (typeof localStorage === 'undefined') {
    return createDemoProject()
  }

  const localValue = localStorage.getItem(STORAGE_KEY)

  if (!localValue) {
    return createDemoProject()
  }

  try {
    return normalizeProjectSchema(JSON.parse(localValue))
  } catch (error) {
    console.warn(error)
    return createDemoProject()
  }
}

function getInitialRouteState() {
  if (typeof window === 'undefined') {
    return {
      mode: 'editor',
      pageId: ''
    }
  }

  const url = new URL(window.location.href)
  return {
    mode: url.searchParams.get('mode') === 'runtime' ? 'runtime' : 'editor',
    pageId: url.searchParams.get('page') || ''
  }
}

function syncRoute() {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)

  if (isRuntimeMode.value) {
    url.searchParams.set('mode', 'runtime')

    if (currentPageId.value) {
      url.searchParams.set('page', currentPageId.value)
    } else {
      url.searchParams.delete('page')
    }
  } else {
    url.searchParams.delete('mode')
    url.searchParams.delete('page')
  }

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function createHistoryEntry(snapshot, label) {
  return {
    snapshot,
    label,
    at: Date.now()
  }
}

function queueHistoryLabel(label) {
  pendingHistoryLabel.value = label
}

function clearQueuedHistoryLabel() {
  pendingHistoryLabel.value = null
}

function startHistorySession(label) {
  activeHistoryLabel.value = label
}

function endHistorySession() {
  flushProjectSync()
  activeHistoryLabel.value = null
}

function cleanupInteractionReferences(options = {}) {
  const removedWidgetIds = new Set(options.widgetIds ?? [])
  const removedSourceIds = new Set(options.sourceIds ?? [])
  const removedPageIds = new Set(options.pageIds ?? [])

  if (!removedWidgetIds.size && !removedSourceIds.size && !removedPageIds.size) {
    return
  }

  project.value.pages.forEach((page) => {
    page.widgets.forEach((widget) => {
      if (!widget.interaction) {
        return
      }

      if (removedWidgetIds.size) {
        widget.interaction.targetWidgetIds = (widget.interaction.targetWidgetIds ?? []).filter(
          (id) => !removedWidgetIds.has(id)
        )
      }

      if (removedSourceIds.size) {
        widget.interaction.targetSourceIds = (widget.interaction.targetSourceIds ?? []).filter(
          (id) => !removedSourceIds.has(id)
        )
      }

      if (removedPageIds.size && removedPageIds.has(widget.interaction.targetPageId)) {
        widget.interaction.targetPageId = ''
      }
    })
  })
}

function flushProjectSync() {
  if (projectSyncTimerId) {
    window.clearTimeout(projectSyncTimerId)
    projectSyncTimerId = 0
  }

  const nextSnapshot = JSON.stringify(project.value)

  if (nextSnapshot === lastProjectSnapshot) {
    return
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, nextSnapshot)
  }

  if (!isRestoringHistory.value) {
    const previousSnapshot = lastProjectSnapshot
    const label = pendingHistoryLabel.value || activeHistoryLabel.value || '编辑画布'
    const now = Date.now()
    const shouldMerge =
      undoStack.value.length > 0 &&
      label === lastHistoryCommitLabel.value &&
      now - lastHistoryCommitAt.value < HISTORY_MERGE_WINDOW

    if (!shouldMerge) {
      pushUndoEntry(createHistoryEntry(previousSnapshot, currentHistoryLabel.value))
    }

    redoStack.value = []
    currentHistoryLabel.value = label
    lastHistoryCommitAt.value = now
    lastHistoryCommitLabel.value = label
    pendingHistoryLabel.value = null
  }

  lastProjectSnapshot = nextSnapshot
}

function scheduleProjectSync(delay = PROJECT_SYNC_DELAY) {
  if (projectSyncTimerId) {
    window.clearTimeout(projectSyncTimerId)
  }

  projectSyncTimerId = window.setTimeout(() => {
    flushProjectSync()
  }, delay)
}

function sanitizeSelection(ids, primaryId = null) {
  const availableIds = new Set(currentWidgets.value.map((item) => item.id))
  const uniqueIds = Array.from(new Set(ids.filter((id) => availableIds.has(id))))

  selectedIds.value = uniqueIds
  primarySelectedId.value = uniqueIds.includes(primaryId) ? primaryId : uniqueIds.at(-1) ?? null
}

function selectDefaultWidget(page = currentPage.value) {
  const firstId = page?.widgets[0]?.id ?? null
  sanitizeSelection(firstId ? [firstId] : [], firstId)
}

function selectAllWidgets() {
  if (!currentWidgets.value.length) {
    return
  }

  sanitizeSelection(
    currentWidgets.value.map((item) => item.id),
    currentWidgets.value.at(-1)?.id ?? null
  )
  statusMessage.value = `已选中当前页 ${currentWidgets.value.length} 个组件`
}

function updateSelection(payload) {
  sanitizeSelection(payload?.ids ?? [], payload?.primaryId ?? null)
}

function toggleSelectionByIds(idsToToggle, primaryId) {
  const selection = new Set(selectedIds.value)
  const fullySelected = idsToToggle.every((id) => selection.has(id))

  if (fullySelected) {
    idsToToggle.forEach((id) => selection.delete(id))
  } else {
    idsToToggle.forEach((id) => selection.add(id))
  }

  const ids = Array.from(selection)
  sanitizeSelection(ids, ids.includes(primaryId) ? primaryId : ids.at(-1) ?? null)
}

function getExpandedSelectedIds() {
  return expandIdsWithGroups(selectedIds.value, currentWidgets.value)
}

function getEditableSelectedWidgets(minCount = 1) {
  const editable = selectedWidgets.value.filter((item) => !item.locked && !item.hidden)
  return editable.length >= minCount ? editable : []
}

function syncDataSourceRuntime() {
  const previousRuntime = dataSourceRuntime.value
  const nextRuntime = {}

  project.value.dataSources.forEach((source) => {
    nextRuntime[source.id] = {
      payload: cloneDeep(source.payload),
      updatedAt: previousRuntime[source.id]?.updatedAt ?? null,
      refreshCount: previousRuntime[source.id]?.refreshCount ?? 0
    }
  })

  dataSourceRuntime.value = nextRuntime
}

function clearSourceRefreshTimers() {
  sourceRefreshTimers.forEach((timerId) => {
    window.clearInterval(timerId)
  })

  sourceRefreshTimers.clear()
}

function syncSourceRefreshTimers() {
  clearSourceRefreshTimers()

  if (!previewMode.value && !isRuntimeMode.value) {
    return
  }

  project.value.dataSources.forEach((source) => {
    if (source.refreshInterval <= 0) {
      return
    }

    const timerId = window.setInterval(() => {
      refreshDataSource(source.id, { silent: true })
    }, source.refreshInterval * 1000)

    sourceRefreshTimers.set(source.id, timerId)
  })
}

function refreshDataSource(sourceId, options = {}) {
  const source = project.value.dataSources.find((item) => item.id === sourceId)

  if (!source) {
    return false
  }

  const current = dataSourceRuntime.value[source.id] ?? {
    payload: cloneDeep(source.payload),
    updatedAt: null,
    refreshCount: 0
  }

  dataSourceRuntime.value = {
    ...dataSourceRuntime.value,
    [source.id]: {
      payload: generateDataSourcePayload(source),
      updatedAt: Date.now(),
      refreshCount: (current.refreshCount ?? 0) + 1
    }
  }

  if (!options.silent) {
    statusMessage.value = `已刷新数据源：${source.name}`
  }

  return true
}

function refreshAllDataSources(options = {}) {
  if (!project.value.dataSources.length) {
    if (!options.silent) {
      statusMessage.value = '当前没有可刷新的数据源'
    }
    return
  }

  project.value.dataSources.forEach((source) => {
    refreshDataSource(source.id, { silent: true })
  })

  if (!options.silent) {
    statusMessage.value = `已刷新 ${project.value.dataSources.length} 个数据源`
  }
}

async function copyRuntimeLink() {
  if (typeof window === 'undefined') {
    return
  }

  const pageId = currentPageId.value || project.value.activePageId || project.value.pages[0]?.id || ''
  const url = new URL(window.location.href)
  url.searchParams.set('mode', 'runtime')

  if (pageId) {
    url.searchParams.set('page', pageId)
  }

  try {
    await navigator.clipboard.writeText(url.toString())
    statusMessage.value = '运行地址已复制到剪贴板'
  } catch (error) {
    statusMessage.value = '运行地址复制失败，请手动复制浏览器地址'
    console.warn(error)
  }
}

function clearLinkedWidgetState() {
  linkedWidgetIds.value = []

  if (linkedWidgetTimerId) {
    window.clearTimeout(linkedWidgetTimerId)
    linkedWidgetTimerId = 0
  }
}

function flashLinkedWidgets(widgetIds) {
  const validIds = widgetIds.filter((id) => currentWidgets.value.some((widget) => widget.id === id))

  if (!validIds.length) {
    return
  }

  linkedWidgetIds.value = validIds

  if (linkedWidgetTimerId) {
    window.clearTimeout(linkedWidgetTimerId)
  }

  linkedWidgetTimerId = window.setTimeout(() => {
    linkedWidgetIds.value = []
    linkedWidgetTimerId = 0
  }, LINKED_WIDGET_DURATION)
}

function enterRuntimeMode() {
  closeDialog()
  previewMode.value = false
  clearLinkedWidgetState()
  runtimePageId.value = currentPageId.value || project.value.activePageId || project.value.pages[0]?.id || ''
  appMode.value = 'runtime'
  refreshAllDataSources({ silent: true })
  syncSourceRefreshTimers()
  statusMessage.value = '已进入运行页'
}

function exitRuntimeMode() {
  const pageId = currentPageId.value

  if (pageId) {
    project.value.activePageId = pageId
  }

  appMode.value = 'editor'
  clearLinkedWidgetState()
  selectDefaultWidget(project.value.pages.find((page) => page.id === pageId) ?? currentPage.value)
  syncSourceRefreshTimers()
  statusMessage.value = '已返回编辑器'
}

function createSource(type) {
  queueHistoryLabel('新增数据源')
  const source = createDataSource(type)
  project.value.dataSources.unshift(source)
  statusMessage.value = `已新增数据源：${source.name}`
}

function deleteSource(sourceId) {
  const source = project.value.dataSources.find((item) => item.id === sourceId)

  if (!source) {
    return
  }

  queueHistoryLabel('删除数据源')
  project.value.dataSources = project.value.dataSources.filter((item) => item.id !== sourceId)

  project.value.pages.forEach((page) => {
    page.widgets.forEach((widget) => {
      if (widget.dataBinding?.sourceId === sourceId) {
        widget.dataBinding.sourceId = ''
      }
    })
  })
  cleanupInteractionReferences({
    sourceIds: [sourceId]
  })

  const nextRuntime = { ...dataSourceRuntime.value }
  delete nextRuntime[sourceId]
  dataSourceRuntime.value = nextRuntime
  statusMessage.value = `已删除数据源：${source.name}`
}

function changeSourceType(payload) {
  const source = project.value.dataSources.find((item) => item.id === payload.sourceId)

  if (!source || source.type === payload.type) {
    return
  }

  const nextSource = createDataSource(payload.type, { name: source.name })

  queueHistoryLabel('切换数据源类型')
  source.type = nextSource.type
  source.generator = nextSource.generator
  source.payload = nextSource.payload

  project.value.pages.forEach((page) => {
    page.widgets.forEach((widget) => {
      if (widget.dataBinding?.sourceId === source.id && widget.type !== source.type) {
        widget.dataBinding.sourceId = ''
      }
    })
  })

  statusMessage.value = `已切换数据源类型：${source.name}`
}

function updateSourcePayload(payload) {
  const source = project.value.dataSources.find((item) => item.id === payload.sourceId)

  if (!source) {
    return
  }

  try {
    const parsed = JSON.parse(payload.value)

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Payload must be an object')
    }

    queueHistoryLabel('更新数据源数据')
    source.payload = {
      ...source.payload,
      ...parsed
    }
    statusMessage.value = `已更新数据源：${source.name}`
  } catch (error) {
    statusMessage.value = '数据源 JSON 解析失败，请检查格式'
    console.warn(error)
  }
}

function switchPage(pageId, options = {}) {
  const nextPage = project.value.pages.find((page) => page.id === pageId)

  if (!nextPage) {
    return
  }

  if (isRuntimeMode.value) {
    if (nextPage.id === runtimePageId.value) {
      return
    }

    runtimePageId.value = nextPage.id
    clearLinkedWidgetState()
    statusMessage.value = `已切换页面：${nextPage.name}`
    return
  }

  if (nextPage.id === project.value.activePageId) {
    return
  }

  project.value.activePageId = nextPage.id
  clearLinkedWidgetState()

  if (previewMode.value || options.previewNavigation) {
    sanitizeSelection([], null)
  } else {
    selectDefaultWidget(nextPage)
  }

  statusMessage.value = `已切换页面：${nextPage.name}`
}

function createPage() {
  const nextIndex = project.value.pages.length + 1
  const page = createProjectPage(`页面 ${nextIndex}`, {
    meta: {
      ...cloneDeep(currentPage.value?.meta ?? defaultPageMeta),
      title: `新建页面 ${nextIndex}`
    }
  })

  queueHistoryLabel('新建页面')
  const currentIndex = project.value.pages.findIndex((item) => item.id === project.value.activePageId)
  project.value.pages.splice(currentIndex + 1, 0, page)
  project.value.activePageId = page.id
  selectDefaultWidget(page)
  statusMessage.value = `已新建页面：${page.name}`
}

function duplicatePage(pageId) {
  const sourcePage = project.value.pages.find((page) => page.id === pageId)

  if (!sourcePage) {
    return
  }

  queueHistoryLabel('复制页面')
  const nextPage = duplicateProjectPage(sourcePage)
  const index = project.value.pages.findIndex((page) => page.id === pageId)
  project.value.pages.splice(index + 1, 0, nextPage)
  project.value.activePageId = nextPage.id
  selectDefaultWidget(nextPage)
  statusMessage.value = `已复制页面：${nextPage.name}`
}

function deletePage(pageId) {
  if (project.value.pages.length <= 1) {
    return
  }

  const index = project.value.pages.findIndex((page) => page.id === pageId)

  if (index === -1) {
    return
  }

  queueHistoryLabel('删除页面')
  const [removedPage] = project.value.pages.splice(index, 1)
  cleanupInteractionReferences({
    widgetIds: removedPage.widgets.map((widget) => widget.id),
    pageIds: [removedPage.id]
  })

  if (removedPage.id === project.value.activePageId) {
    const fallbackPage = project.value.pages[index] ?? project.value.pages[index - 1] ?? project.value.pages[0]
    project.value.activePageId = fallbackPage.id

    if (previewMode.value) {
      sanitizeSelection([], null)
    } else {
      selectDefaultWidget(fallbackPage)
    }
  }

  statusMessage.value = `已删除页面：${removedPage.name}`
}

function addWidget(type, position = {}) {
  queueHistoryLabel('添加组件')

  const nextWidget = createWidget(type, {
    x: clamp(position.x ?? 180, 0, Math.max(currentCanvas.value.meta.screenWidth - 160, 0)),
    y: clamp(position.y ?? 180, 0, Math.max(currentCanvas.value.meta.screenHeight - 120, 0)),
    zIndex: getNextZIndex(currentWidgets.value)
  })

  currentWidgets.value.push(nextWidget)
  sortWidgets(currentWidgets.value)
  sanitizeSelection([nextWidget.id], nextWidget.id)
  statusMessage.value = `已添加组件：${nextWidget.name}`
}

function addTemplate(templateId, position = {}) {
  const template = templates.value.find((item) => item.id === templateId)

  if (!template) {
    return
  }

  const width = template.preview?.width ?? 180
  const height = template.preview?.height ?? 120
  const nextX = clamp(position.x ?? 180, 0, Math.max(currentCanvas.value.meta.screenWidth - width, 0))
  const nextY = clamp(position.y ?? 180, 0, Math.max(currentCanvas.value.meta.screenHeight - height, 0))

  queueHistoryLabel(template.widgets.length > 1 ? '添加组合模板' : '添加组件模板')
  const createdWidgets = instantiateTemplate(currentCanvas.value, template, {
    x: nextX,
    y: nextY
  })

  if (!createdWidgets.length) {
    clearQueuedHistoryLabel()
    return
  }

  currentWidgets.value.push(...createdWidgets)
  sortWidgets(currentWidgets.value)
  sanitizeSelection(
    createdWidgets.map((item) => item.id),
    createdWidgets.at(-1)?.id ?? null
  )
  statusMessage.value = `已添加模板：${template.name}`
}

function copySelected() {
  if (!canCopy.value) {
    return
  }

  const template = createTemplateFromSelection(
    currentCanvas.value,
    selectedIds.value,
    '剪贴板选区'
  )
  const bounds = getSelectionBounds(selectedWidgets.value)

  if (!template || !bounds) {
    return
  }

  clipboardTemplate.value = {
    ...template,
    origin: {
      x: bounds.x,
      y: bounds.y
    },
    pasteCount: 0
  }
  statusMessage.value = `已复制 ${selectedWidgets.value.length} 个组件`
}

function pasteClipboard() {
  const template = clipboardTemplate.value

  if (!template?.widgets?.length) {
    return
  }

  const width = template.preview?.width ?? 0
  const height = template.preview?.height ?? 0
  const pasteCount = (template.pasteCount ?? 0) + 1
  const baseX = template.origin?.x ?? 80
  const baseY = template.origin?.y ?? 80
  const offset = 28 * pasteCount
  const nextX = clamp(baseX + offset, 0, Math.max(currentCanvas.value.meta.screenWidth - width, 0))
  const nextY = clamp(baseY + offset, 0, Math.max(currentCanvas.value.meta.screenHeight - height, 0))

  queueHistoryLabel(template.widgets.length > 1 ? '粘贴组件组合' : '粘贴组件')
  const createdWidgets = instantiateTemplate(currentCanvas.value, template, {
    x: nextX,
    y: nextY
  })

  if (!createdWidgets.length) {
    clearQueuedHistoryLabel()
    return
  }

  currentWidgets.value.push(...createdWidgets)
  sortWidgets(currentWidgets.value)
  sanitizeSelection(
    createdWidgets.map((item) => item.id),
    createdWidgets.at(-1)?.id ?? null
  )
  clipboardTemplate.value = {
    ...template,
    pasteCount
  }
  statusMessage.value = `已粘贴 ${createdWidgets.length} 个组件到当前页`
}

function removeTemplate(templateId) {
  const template = templates.value.find((item) => item.id === templateId)

  if (!template) {
    return
  }

  templates.value = templates.value.filter((item) => item.id !== templateId)
  statusMessage.value = `已删除模板：${template.name}`
}

function buildDefaultTemplateName() {
  if (selectedWidgets.value.length === 1) {
    return `${selectedWidgets.value[0].name} 模板`
  }

  return `组合模板 ${selectedWidgets.value.length} 项`
}

function openTemplateDialog() {
  if (!canSaveTemplate.value) {
    return
  }

  templateDraftName.value = buildDefaultTemplateName()
  dialogMode.value = 'template'
}

function saveSelectionAsTemplate() {
  if (!canSaveTemplate.value) {
    return
  }

  const template = createTemplateFromSelection(
    currentCanvas.value,
    selectedIds.value,
    templateDraftName.value.trim() || buildDefaultTemplateName()
  )

  if (!template) {
    return
  }

  templates.value = [template, ...templates.value].slice(0, TEMPLATE_LIMIT)
  dialogMode.value = null
  templateDraftName.value = ''
  statusMessage.value = `已保存模板：${template.name}`
}

function handleLayerSelection(payload) {
  const relatedIds = expandIdsWithGroups([payload.widgetId], currentWidgets.value)

  if (payload.additive) {
    toggleSelectionByIds(relatedIds, payload.widgetId)
    return
  }

  sanitizeSelection(relatedIds, payload.widgetId)
}

function alignSelected(mode) {
  const targets = getEditableSelectedWidgets(2)
  const bounds = getSelectionBounds(targets)

  if (!bounds) {
    return
  }

  queueHistoryLabel('对齐组件')

  targets.forEach((widget) => {
    switch (mode) {
      case 'left':
        widget.x = bounds.x
        break
      case 'center-x':
        widget.x = bounds.x + (bounds.w - widget.w) / 2
        break
      case 'right':
        widget.x = bounds.x + bounds.w - widget.w
        break
      case 'top':
        widget.y = bounds.y
        break
      case 'center-y':
        widget.y = bounds.y + (bounds.h - widget.h) / 2
        break
      case 'bottom':
        widget.y = bounds.y + bounds.h - widget.h
        break
      default:
        break
    }
  })

  const actionLabelMap = {
    left: '左对齐',
    'center-x': '水平居中',
    right: '右对齐',
    top: '顶部对齐',
    'center-y': '垂直居中',
    bottom: '底部对齐'
  }

  statusMessage.value = `已${actionLabelMap[mode] ?? '对齐'} ${targets.length} 个组件`
}

function distributeSelected(axis) {
  const targets = [...getEditableSelectedWidgets(3)]

  if (!targets.length) {
    return
  }

  const bounds = getSelectionBounds(targets)

  if (!bounds) {
    return
  }

  const horizontal = axis === 'horizontal'
  targets.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y))

  const totalSize = targets.reduce((sum, widget) => sum + (horizontal ? widget.w : widget.h), 0)
  const availableSize = horizontal ? bounds.w : bounds.h
  const gap = (availableSize - totalSize) / (targets.length - 1)
  let cursor = horizontal ? bounds.x : bounds.y

  queueHistoryLabel(horizontal ? '横向分布组件' : '纵向分布组件')

  targets.forEach((widget) => {
    if (horizontal) {
      widget.x = cursor
      cursor += widget.w + gap
      return
    }

    widget.y = cursor
    cursor += widget.h + gap
  })

  statusMessage.value = horizontal
    ? `已横向分布 ${targets.length} 个组件`
    : `已纵向分布 ${targets.length} 个组件`
}

function setWidgetHidden(widgetId, hidden) {
  const widget = currentWidgets.value.find((item) => item.id === widgetId)

  if (!widget || widget.hidden === hidden) {
    return
  }

  queueHistoryLabel(hidden ? '隐藏图层' : '显示图层')
  widget.hidden = hidden
  statusMessage.value = hidden ? `已隐藏图层：${widget.name}` : `已显示图层：${widget.name}`
}

function toggleLayerHidden(widgetId) {
  const widget = currentWidgets.value.find((item) => item.id === widgetId)

  if (!widget) {
    return
  }

  setWidgetHidden(widgetId, !widget.hidden)
}

function setWidgetLocked(widgetId, locked) {
  const widget = currentWidgets.value.find((item) => item.id === widgetId)

  if (!widget || widget.locked === locked) {
    return
  }

  queueHistoryLabel(locked ? '锁定图层' : '解锁图层')
  widget.locked = locked
  statusMessage.value = locked ? `已锁定图层：${widget.name}` : `已解锁图层：${widget.name}`
}

function toggleLayerLocked(widgetId) {
  const widget = currentWidgets.value.find((item) => item.id === widgetId)

  if (!widget) {
    return
  }

  setWidgetLocked(widgetId, !widget.locked)
}

function setSelectedHidden(hidden) {
  const ids = getExpandedSelectedIds()
  const targets = currentWidgets.value.filter((item) => ids.includes(item.id) && item.hidden !== hidden)

  if (!targets.length) {
    return
  }

  queueHistoryLabel(hidden ? '批量隐藏组件' : '批量显示组件')
  targets.forEach((widget) => {
    widget.hidden = hidden
  })
  statusMessage.value = hidden ? `已隐藏 ${targets.length} 个组件` : `已显示 ${targets.length} 个组件`
}

function setSelectedLocked(locked) {
  const ids = getExpandedSelectedIds()
  const targets = currentWidgets.value.filter((item) => ids.includes(item.id) && item.locked !== locked)

  if (!targets.length) {
    return
  }

  queueHistoryLabel(locked ? '批量锁定组件' : '批量解锁组件')
  targets.forEach((widget) => {
    widget.locked = locked
  })
  statusMessage.value = locked ? `已锁定 ${targets.length} 个组件` : `已解锁 ${targets.length} 个组件`
}

function reorderLayers(payload) {
  const ordered = [...currentWidgets.value].sort((a, b) => b.zIndex - a.zIndex)
  const draggedIndex = ordered.findIndex((item) => item.id === payload.draggedId)

  if (draggedIndex === -1) {
    return
  }

  const [dragged] = ordered.splice(draggedIndex, 1)
  let targetIndex = ordered.findIndex((item) => item.id === payload.targetId)

  if (targetIndex === -1) {
    return
  }

  if (payload.placement === 'after') {
    targetIndex += 1
  }

  ordered.splice(targetIndex, 0, dragged)
  queueHistoryLabel('调整图层顺序')

  const total = ordered.length
  ordered.forEach((widget, index) => {
    widget.zIndex = total - index
  })

  sortWidgets(currentWidgets.value)
  statusMessage.value = `已调整图层顺序：${dragged.name}`
}

function deleteSelected() {
  const expandedIds = getExpandedSelectedIds()

  if (!expandedIds.length) {
    return
  }

  queueHistoryLabel('删除组件')
  const deleteSet = new Set(expandedIds)
  currentPage.value.widgets = currentPage.value.widgets.filter((item) => !deleteSet.has(item.id))
  cleanupInteractionReferences({
    widgetIds: expandedIds
  })
  sanitizeSelection([], null)
  statusMessage.value = `已删除 ${expandedIds.length} 个组件`
}

function duplicateSelected() {
  if (!selectedIds.value.length) {
    return
  }

  queueHistoryLabel('复制组件')
  const duplicates = duplicateWidgets(currentCanvas.value, selectedIds.value)

  if (!duplicates.length) {
    clearQueuedHistoryLabel()
    return
  }

  sanitizeSelection(
    duplicates.map((item) => item.id),
    duplicates.at(-1)?.id ?? null
  )
  statusMessage.value = `已复制 ${duplicates.length} 个组件`
}

function bringToFront() {
  if (!selectedWidgets.value.length) {
    return
  }

  queueHistoryLabel('上移图层')
  const orderedSelection = [...selectedWidgets.value].sort((a, b) => a.zIndex - b.zIndex)
  const nextBase = getNextZIndex(currentWidgets.value)

  orderedSelection.forEach((widget, index) => {
    widget.zIndex = nextBase + index
  })

  sortWidgets(currentWidgets.value)
  statusMessage.value = '已上移所选图层'
}

function sendToBack() {
  if (!selectedWidgets.value.length) {
    return
  }

  queueHistoryLabel('下移图层')
  const orderedSelection = [...selectedWidgets.value].sort((a, b) => a.zIndex - b.zIndex)
  const minZIndex = Math.min(...currentWidgets.value.map((item) => item.zIndex || 0))
  const start = minZIndex - orderedSelection.length

  orderedSelection.forEach((widget, index) => {
    widget.zIndex = start + index
  })

  sortWidgets(currentWidgets.value)
  statusMessage.value = '已下移所选图层'
}

function groupSelected() {
  if (!canGroup.value) {
    return
  }

  queueHistoryLabel('编组组件')
  const groupId = createWidgetGroup(currentCanvas.value, selectedIds.value)

  if (!groupId) {
    clearQueuedHistoryLabel()
    return
  }

  statusMessage.value = `已编组 ${selectedIds.value.length} 个组件`
}

function ungroupSelected() {
  if (!canUngroup.value) {
    return
  }

  queueHistoryLabel('取消编组')
  const count = removeWidgetGroup(currentCanvas.value, selectedIds.value)

  if (!count) {
    clearQueuedHistoryLabel()
    return
  }

  statusMessage.value = '已取消组件编组'
}

function resetProject() {
  queueHistoryLabel('恢复示例项目')
  project.value = createDemoProject()
  appMode.value = 'editor'
  previewMode.value = false
  runtimePageId.value = ''
  clipboardTemplate.value = null
  clearLinkedWidgetState()
  selectDefaultWidget(currentPage.value)
  statusMessage.value = '已恢复示例项目'
}

function openExportDialog() {
  dialogMode.value = 'export'
  dialogText.value = JSON.stringify(project.value, null, 2)
}

function openImportDialog() {
  dialogMode.value = 'import'
  dialogText.value = ''
}

async function copyExport() {
  try {
    await navigator.clipboard.writeText(dialogText.value)
    statusMessage.value = 'JSON 已复制到剪贴板'
  } catch (error) {
    statusMessage.value = '复制失败，请手动复制 JSON'
    console.warn(error)
  }
}

function applyImport() {
  try {
    const nextProject = normalizeProjectSchema(JSON.parse(dialogText.value))
    queueHistoryLabel('导入项目')
    project.value = nextProject
    dialogMode.value = null
    appMode.value = 'editor'
    previewMode.value = false
    runtimePageId.value = ''
    clipboardTemplate.value = null
    clearLinkedWidgetState()
    selectDefaultWidget(currentPage.value)
    statusMessage.value = '项目 JSON 已导入'
  } catch (error) {
    statusMessage.value = '导入失败，请检查 JSON 结构'
    console.warn(error)
  }
}

function closeDialog() {
  dialogMode.value = null
  dialogText.value = ''
  templateDraftName.value = ''
}

function createProjectSnapshot() {
  return lastProjectSnapshot
}

function pushUndoEntry(entry) {
  undoStack.value.push(entry)

  if (undoStack.value.length > HISTORY_LIMIT) {
    undoStack.value.shift()
  }
}

async function restoreHistoryEntry(entry) {
  isRestoringHistory.value = true
  project.value = normalizeProjectSchema(JSON.parse(entry.snapshot))
  clearLinkedWidgetState()
  await nextTick()
  flushProjectSync()

  if (previewMode.value) {
    sanitizeSelection([], null)
  } else {
    sanitizeSelection(selectedIds.value, primarySelectedId.value)

    if (!selectedIds.value.length) {
      selectDefaultWidget(currentPage.value)
    }
  }

  currentHistoryLabel.value = entry.label
  pendingHistoryLabel.value = null
  activeHistoryLabel.value = null
  lastHistoryCommitAt.value = 0
  lastHistoryCommitLabel.value = ''
  isRestoringHistory.value = false
}

async function undoProject() {
  flushProjectSync()
  const entry = undoStack.value.pop()

  if (!entry) {
    return
  }

  redoStack.value.push(createHistoryEntry(createProjectSnapshot(), currentHistoryLabel.value))
  await restoreHistoryEntry(entry)
  statusMessage.value = '已撤销上一步操作'
}

async function redoProject() {
  flushProjectSync()
  const entry = redoStack.value.pop()

  if (!entry) {
    return
  }

  pushUndoEntry(createHistoryEntry(createProjectSnapshot(), currentHistoryLabel.value))
  await restoreHistoryEntry(entry)
  statusMessage.value = '已重做上一步操作'
}

function moveSelectionBy(deltaX, deltaY) {
  const movableWidgets = selectedWidgets.value.filter((item) => !item.locked && !item.hidden)
  const movableBounds = getSelectionBounds(movableWidgets)

  if (!movableWidgets.length || !movableBounds) {
    return
  }

  queueHistoryLabel('移动组件')
  const minDeltaX = -movableBounds.x
  const maxDeltaX = currentCanvas.value.meta.screenWidth - (movableBounds.x + movableBounds.w)
  const minDeltaY = -movableBounds.y
  const maxDeltaY = currentCanvas.value.meta.screenHeight - (movableBounds.y + movableBounds.h)
  const nextDeltaX = clamp(deltaX, minDeltaX, maxDeltaX)
  const nextDeltaY = clamp(deltaY, minDeltaY, maxDeltaY)

  movableWidgets.forEach((widget) => {
    widget.x += nextDeltaX
    widget.y += nextDeltaY
  })
}

function handleWidgetAction(widgetId) {
  if (!previewMode.value && !isRuntimeMode.value) {
    return
  }

  const widget = currentWidgets.value.find((item) => item.id === widgetId)

  if (!widget) {
    return
  }

  const interaction = widget.interaction ?? { clickAction: 'none' }

  switch (interaction.clickAction) {
    case 'highlight-widgets': {
      const targetIds = interaction.targetWidgetIds ?? []
      flashLinkedWidgets(targetIds)

      if (targetIds.length) {
        statusMessage.value = `已联动高亮 ${targetIds.length} 个组件`
      }
      break
    }
    case 'refresh-sources': {
      const fallbackSourceId = widget.dataBinding?.sourceId
      const targetSourceIds = interaction.targetSourceIds?.length
        ? interaction.targetSourceIds
        : fallbackSourceId
          ? [fallbackSourceId]
          : []

      let refreshCount = 0
      targetSourceIds.forEach((sourceId) => {
        if (refreshDataSource(sourceId, { silent: true })) {
          refreshCount += 1
        }
      })

      if (refreshCount > 0) {
        statusMessage.value = `已联动刷新 ${refreshCount} 个数据源`
      }
      break
    }
    case 'switch-page':
      if (interaction.targetPageId) {
        switchPage(interaction.targetPageId, { previewNavigation: true })
      }
      break
    default:
      break
  }
}

function handleKeydown(event) {
  if (dialogMode.value) {
    if (event.key === 'Escape') {
      closeDialog()
    }
    return
  }

  const target = event.target

  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  ) {
    return
  }

  if (isRuntimeMode.value) {
    if (event.key === 'Escape') {
      exitRuntimeMode()
    }
    return
  }

  if (previewMode.value) {
    if (event.key === 'Escape') {
      previewMode.value = false
    }
    return
  }

  if (event.key === 'Escape') {
    sanitizeSelection([], null)
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    duplicateSelected()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
    event.preventDefault()
    copySelected()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
    event.preventDefault()
    pasteClipboard()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    selectAllWidgets()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()

    if (event.shiftKey) {
      void redoProject()
    } else {
      void undoProject()
    }
    return
  }

  if (event.ctrlKey && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    void redoProject()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
    event.preventDefault()

    if (event.shiftKey) {
      ungroupSelected()
    } else {
      groupSelected()
    }
    return
  }

  if (!selectedWidgets.value.length) {
    return
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    deleteSelected()
    return
  }

  const step = event.shiftKey ? 10 : 1

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    moveSelectionBy(-step, 0)
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    moveSelectionBy(step, 0)
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveSelectionBy(0, -step)
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveSelectionBy(0, step)
  }
}

watch(currentPageId, (pageId) => {
  if (isRuntimeMode.value && pageId && runtimePageId.value !== pageId) {
    runtimePageId.value = pageId
  }
})

watch([appMode, currentPageId], () => {
  syncRoute()
})

watch(
  project,
  () => {
    scheduleProjectSync(activeHistoryLabel.value ? 32 : PROJECT_SYNC_DELAY)
  },
  { deep: true }
)

watch(
  () => JSON.stringify(project.value.dataSources),
  () => {
    syncDataSourceRuntime()
    syncSourceRefreshTimers()
  },
  { immediate: true }
)

watch(
  () => JSON.stringify(templates.value),
  (nextSnapshot) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, nextSnapshot)
    }
  },
  { immediate: true }
)

watch(previewMode, (enabled) => {
  if (isRuntimeMode.value) {
    return
  }

  clearLinkedWidgetState()
  syncSourceRefreshTimers()

  if (enabled) {
    sanitizeSelection([], null)
    refreshAllDataSources({ silent: true })
    statusMessage.value = '已进入预览模式'
  } else {
    selectDefaultWidget(currentPage.value)
    statusMessage.value = '已退出预览模式'
  }
})

onMounted(() => {
  if (isRuntimeMode.value) {
    runtimePageId.value = currentPageId.value
    refreshAllDataSources({ silent: true })
    syncSourceRefreshTimers()
  }

  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  flushProjectSync()
  window.removeEventListener('keydown', handleKeydown)
  clearSourceRefreshTimers()
  clearLinkedWidgetState()
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--preview': previewMode }">
    <TopToolbar
      v-if="!isRuntimeMode"
      :preview-mode="previewMode"
      :pages="project.pages"
      :active-page-id="project.activePageId"
      :can-operate="canOperate"
      :selection-count="selectedIds.length"
      :can-group="canGroup"
      :can-ungroup="canUngroup"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :can-copy="canCopy"
      :can-paste="canPaste"
      :can-save-template="canSaveTemplate"
      :has-data-sources="hasDataSources"
      :runtime-mode="isRuntimeMode"
      @toggle-preview="previewMode = !previewMode"
      @open-runtime="enterRuntimeMode"
      @copy-runtime-link="copyRuntimeLink"
      @select-page="switchPage"
      @reset-project="resetProject"
      @export-project="openExportDialog"
      @import-project="openImportDialog"
      @duplicate-selected="duplicateSelected"
      @copy-selected="copySelected"
      @paste-selected="pasteClipboard"
      @delete-selected="deleteSelected"
      @bring-to-front="bringToFront"
      @send-to-back="sendToBack"
      @group-selected="groupSelected"
      @ungroup-selected="ungroupSelected"
      @save-selection-template="openTemplateDialog"
      @refresh-data-sources="refreshAllDataSources"
      @undo="undoProject"
      @redo="redoProject"
    />

    <RuntimeShell
      v-if="isRuntimeMode"
      :project="currentCanvas"
      :page="currentPage"
      :pages="project.pages"
      :active-page-id="currentPageId"
      :linked-widget-ids="linkedWidgetIds"
      :data-source-runtime="dataSourceRuntime"
      @select-page="switchPage"
      @exit-runtime="exitRuntimeMode"
      @copy-runtime-link="copyRuntimeLink"
      @trigger-widget-action="handleWidgetAction"
    />

    <section v-else class="workspace">
      <MaterialPanel
        v-if="!previewMode"
        :pages="project.pages"
        :active-page-id="project.activePageId"
        :can-delete-page="canDeletePage"
        :materials="materials"
        :templates="templates"
        @select-page="switchPage"
        @create-page="createPage"
        @duplicate-page="duplicatePage"
        @delete-page="deletePage"
        @add-widget="addWidget"
        @add-template="addTemplate"
        @remove-template="removeTemplate"
      />

      <StageCanvas
        :project="currentCanvas"
        :selected-ids="selectedIds"
        :primary-selected-id="primarySelectedId"
        :preview-mode="previewMode"
        :linked-widget-ids="linkedWidgetIds"
        :data-source-runtime="dataSourceRuntime"
        @selection-change="updateSelection"
        @add-widget="addWidget"
        @add-template="addTemplate"
        @history-session-start="startHistorySession"
        @history-session-end="endHistorySession"
        @trigger-widget-action="handleWidgetAction"
      />

      <InspectorPanel
        v-if="!previewMode"
        :page="currentPage"
        :project="currentCanvas"
        :pages="project.pages"
        :current-page-id="project.activePageId"
        :selected-widget="selectedWidget"
        :selected-widgets="selectedWidgets"
        :selected-bounds="selectedBounds"
        :selected-ids="selectedIds"
        :primary-selected-id="primarySelectedId"
        :current-history-label="currentHistoryLabel"
        :undo-entries="undoStack"
        :redo-entries="redoStack"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :data-source-runtime="dataSourceRuntime"
        :source-binding-counts="sourceBindingCounts"
        @select-layer="handleLayerSelection"
        @toggle-layer-hidden="toggleLayerHidden"
        @toggle-layer-locked="toggleLayerLocked"
        @reorder-layer="reorderLayers"
        @set-selected-hidden="setSelectedHidden"
        @set-selected-locked="setSelectedLocked"
        @align-selected="alignSelected"
        @distribute-selected="distributeSelected"
        @create-source="createSource"
        @delete-source="deleteSource"
        @refresh-source="refreshDataSource"
        @refresh-all-sources="refreshAllDataSources"
        @change-source-type="changeSourceType"
        @update-source-payload="updateSourcePayload"
        @undo="undoProject"
        @redo="redoProject"
      />
    </section>

    <footer v-if="!isRuntimeMode" class="status-bar">
      <span>{{ statusMessage }}</span>
      <span>当前页面：{{ currentPage?.name || '未命名页面' }}，预览模式下可点击组件触发联动。</span>
    </footer>

    <div v-if="dialogMode" class="dialog-mask" @click.self="closeDialog">
      <div class="dialog-card">
        <template v-if="dialogMode === 'template'">
          <div class="dialog-card__header">
            <div>
              <p>模板保存</p>
              <h3>将当前选区保存为可复用模板</h3>
            </div>
            <button class="ghost" @click="closeDialog">关闭</button>
          </div>

          <label class="dialog-card__field">
            <span>模板名称</span>
            <input v-model="templateDraftName" type="text" placeholder="请输入模板名称" />
          </label>

          <div class="dialog-card__summary">
            <span>已选组件</span>
            <strong>{{ selectedWidgets.length }} 项</strong>
          </div>

          <div class="inspector-tag-list">
            <span v-for="widget in selectedWidgets" :key="widget.id" class="inspector-tag">
              {{ widget.name }}
            </span>
          </div>

          <div class="dialog-card__actions">
            <button class="primary" @click="saveSelectionAsTemplate">保存模板</button>
          </div>
        </template>

        <template v-else>
          <div class="dialog-card__header">
            <div>
              <p>{{ dialogMode === 'export' ? '项目导出' : '项目导入' }}</p>
              <h3>{{ dialogMode === 'export' ? '复制当前项目 JSON' : '粘贴项目 JSON 并导入' }}</h3>
            </div>
            <button class="ghost" @click="closeDialog">关闭</button>
          </div>

          <textarea
            v-model="dialogText"
            class="dialog-card__textarea"
            :readonly="dialogMode === 'export'"
            spellcheck="false"
          />

          <div class="dialog-card__actions">
            <button v-if="dialogMode === 'export'" class="primary" @click="copyExport">复制 JSON</button>
            <button v-else class="primary" @click="applyImport">确认导入</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
