<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MaterialPanel from './components/MaterialPanel.vue'
import StageCanvas from './components/StageCanvas.vue'
import InspectorPanel from './components/InspectorPanel.vue'
import TopToolbar from './components/TopToolbar.vue'
import { materials, createWidget } from './editor/materials'
import {
  STORAGE_KEY,
  TEMPLATE_STORAGE_KEY,
  createDemoProject,
  createTemplateFromSelection,
  createWidgetGroup,
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
const TEMPLATE_LIMIT = 30

const previewMode = ref(false)
const dialogMode = ref(null)
const dialogText = ref('')
const templateDraftName = ref('')
const statusMessage = ref('已启用自动保存、图层管理、模板库和历史记录')

const project = ref(loadProject())
const templates = ref(loadTemplateLibrary())
const selectedIds = ref(project.value.widgets[0]?.id ? [project.value.widgets[0].id] : [])
const primarySelectedId = ref(project.value.widgets[0]?.id ?? null)

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
  return project.value.widgets.filter((item) => selection.has(item.id))
})

const selectedWidget = computed(() => {
  if (selectedIds.value.length !== 1) {
    return null
  }

  return project.value.widgets.find((item) => item.id === selectedIds.value[0]) ?? null
})

const selectedBounds = computed(() => getSelectionBounds(selectedWidgets.value))
const canOperate = computed(() => selectedIds.value.length > 0)
const canGroup = computed(() => selectedIds.value.length > 1)
const canUngroup = computed(() => selectedWidgets.value.some((item) => item.groupId))
const canUndo = computed(() => undoStack.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)
const canSaveTemplate = computed(() => selectedIds.value.length > 0)

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
  activeHistoryLabel.value = null
}

function sanitizeSelection(ids, primaryId = null) {
  const availableIds = new Set(project.value.widgets.map((item) => item.id))
  const uniqueIds = Array.from(new Set(ids.filter((id) => availableIds.has(id))))

  selectedIds.value = uniqueIds
  primarySelectedId.value = uniqueIds.includes(primaryId) ? primaryId : uniqueIds.at(-1) ?? null
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
  return expandIdsWithGroups(selectedIds.value, project.value.widgets)
}

function addWidget(type, position = {}) {
  queueHistoryLabel('添加组件')

  const nextWidget = createWidget(type, {
    x: clamp(position.x ?? 180, 0, Math.max(project.value.meta.screenWidth - 160, 0)),
    y: clamp(position.y ?? 180, 0, Math.max(project.value.meta.screenHeight - 120, 0)),
    zIndex: getNextZIndex(project.value.widgets)
  })

  project.value.widgets.push(nextWidget)
  sortWidgets(project.value.widgets)
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
  const nextX = clamp(position.x ?? 180, 0, Math.max(project.value.meta.screenWidth - width, 0))
  const nextY = clamp(position.y ?? 180, 0, Math.max(project.value.meta.screenHeight - height, 0))

  queueHistoryLabel(template.widgets.length > 1 ? '添加组合模板' : '添加组件模板')
  const createdWidgets = instantiateTemplate(project.value, template, {
    x: nextX,
    y: nextY
  })

  if (!createdWidgets.length) {
    clearQueuedHistoryLabel()
    return
  }

  project.value.widgets.push(...createdWidgets)
  sortWidgets(project.value.widgets)
  sanitizeSelection(
    createdWidgets.map((item) => item.id),
    createdWidgets.at(-1)?.id ?? null
  )
  statusMessage.value = `已添加模板：${template.name}`
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
    project.value,
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
  const relatedIds = expandIdsWithGroups([payload.widgetId], project.value.widgets)

  if (payload.additive) {
    toggleSelectionByIds(relatedIds, payload.widgetId)
    return
  }

  sanitizeSelection(relatedIds, payload.widgetId)
}

function setWidgetHidden(widgetId, hidden) {
  const widget = project.value.widgets.find((item) => item.id === widgetId)

  if (!widget || widget.hidden === hidden) {
    return
  }

  queueHistoryLabel(hidden ? '隐藏图层' : '显示图层')
  widget.hidden = hidden
  statusMessage.value = hidden ? `已隐藏图层：${widget.name}` : `已显示图层：${widget.name}`
}

function toggleLayerHidden(widgetId) {
  const widget = project.value.widgets.find((item) => item.id === widgetId)

  if (!widget) {
    return
  }

  setWidgetHidden(widgetId, !widget.hidden)
}

function setWidgetLocked(widgetId, locked) {
  const widget = project.value.widgets.find((item) => item.id === widgetId)

  if (!widget || widget.locked === locked) {
    return
  }

  queueHistoryLabel(locked ? '锁定图层' : '解锁图层')
  widget.locked = locked
  statusMessage.value = locked ? `已锁定图层：${widget.name}` : `已解锁图层：${widget.name}`
}

function toggleLayerLocked(widgetId) {
  const widget = project.value.widgets.find((item) => item.id === widgetId)

  if (!widget) {
    return
  }

  setWidgetLocked(widgetId, !widget.locked)
}

function setSelectedHidden(hidden) {
  const ids = getExpandedSelectedIds()
  const targets = project.value.widgets.filter((item) => ids.includes(item.id) && item.hidden !== hidden)

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
  const targets = project.value.widgets.filter((item) => ids.includes(item.id) && item.locked !== locked)

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
  const ordered = [...project.value.widgets].sort((a, b) => b.zIndex - a.zIndex)
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

  sortWidgets(project.value.widgets)
  statusMessage.value = `已调整图层顺序：${dragged.name}`
}

function deleteSelected() {
  const expandedIds = getExpandedSelectedIds()

  if (!expandedIds.length) {
    return
  }

  queueHistoryLabel('删除组件')
  const deleteSet = new Set(expandedIds)

  project.value.widgets = project.value.widgets.filter((item) => !deleteSet.has(item.id))
  sanitizeSelection([], null)
  statusMessage.value = `已删除 ${expandedIds.length} 个组件`
}

function duplicateSelected() {
  if (!selectedIds.value.length) {
    return
  }

  queueHistoryLabel('复制组件')
  const duplicates = duplicateWidgets(project.value, selectedIds.value)

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
  const nextBase = getNextZIndex(project.value.widgets)

  orderedSelection.forEach((widget, index) => {
    widget.zIndex = nextBase + index
  })

  sortWidgets(project.value.widgets)
  statusMessage.value = '已上移所选图层'
}

function sendToBack() {
  if (!selectedWidgets.value.length) {
    return
  }

  queueHistoryLabel('下移图层')
  const orderedSelection = [...selectedWidgets.value].sort((a, b) => a.zIndex - b.zIndex)
  const minZIndex = Math.min(...project.value.widgets.map((item) => item.zIndex || 0))
  const start = minZIndex - orderedSelection.length

  orderedSelection.forEach((widget, index) => {
    widget.zIndex = start + index
  })

  sortWidgets(project.value.widgets)
  statusMessage.value = '已下移所选图层'
}

function groupSelected() {
  if (!canGroup.value) {
    return
  }

  queueHistoryLabel('编组组件')
  const groupId = createWidgetGroup(project.value, selectedIds.value)

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
  const count = removeWidgetGroup(project.value, selectedIds.value)

  if (!count) {
    clearQueuedHistoryLabel()
    return
  }

  statusMessage.value = '已取消组件编组'
}

function resetProject() {
  queueHistoryLabel('恢复示例项目')
  project.value = createDemoProject()
  previewMode.value = false
  sanitizeSelection(
    project.value.widgets[0]?.id ? [project.value.widgets[0].id] : [],
    project.value.widgets[0]?.id ?? null
  )
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
    sanitizeSelection(
      project.value.widgets[0]?.id ? [project.value.widgets[0].id] : [],
      project.value.widgets[0]?.id ?? null
    )
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
  return JSON.stringify(project.value)
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
  await nextTick()
  sanitizeSelection(selectedIds.value, primarySelectedId.value)
  currentHistoryLabel.value = entry.label
  pendingHistoryLabel.value = null
  activeHistoryLabel.value = null
  lastHistoryCommitAt.value = 0
  lastHistoryCommitLabel.value = ''
  isRestoringHistory.value = false
}

async function undoProject() {
  const entry = undoStack.value.pop()

  if (!entry) {
    return
  }

  redoStack.value.push(createHistoryEntry(createProjectSnapshot(), currentHistoryLabel.value))
  await restoreHistoryEntry(entry)
  statusMessage.value = '已撤销上一步操作'
}

async function redoProject() {
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
  const maxDeltaX = project.value.meta.screenWidth - (movableBounds.x + movableBounds.w)
  const minDeltaY = -movableBounds.y
  const maxDeltaY = project.value.meta.screenHeight - (movableBounds.y + movableBounds.h)
  const nextDeltaX = clamp(deltaX, minDeltaX, maxDeltaX)
  const nextDeltaY = clamp(deltaY, minDeltaY, maxDeltaY)

  movableWidgets.forEach((widget) => {
    widget.x += nextDeltaX
    widget.y += nextDeltaY
  })
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

  if (event.key === 'Escape') {
    sanitizeSelection([], null)
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    duplicateSelected()
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

watch(
  () => JSON.stringify(project.value),
  (nextSnapshot, previousSnapshot) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, nextSnapshot)
    }

    if (isRestoringHistory.value) {
      return
    }

    if (typeof previousSnapshot !== 'string' || nextSnapshot === previousSnapshot) {
      return
    }

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

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--preview': previewMode }">
    <TopToolbar
      :preview-mode="previewMode"
      :can-operate="canOperate"
      :selection-count="selectedIds.length"
      :can-group="canGroup"
      :can-ungroup="canUngroup"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :can-save-template="canSaveTemplate"
      @toggle-preview="previewMode = !previewMode"
      @reset-project="resetProject"
      @export-project="openExportDialog"
      @import-project="openImportDialog"
      @duplicate-selected="duplicateSelected"
      @delete-selected="deleteSelected"
      @bring-to-front="bringToFront"
      @send-to-back="sendToBack"
      @group-selected="groupSelected"
      @ungroup-selected="ungroupSelected"
      @save-selection-template="openTemplateDialog"
      @undo="undoProject"
      @redo="redoProject"
    />

    <section class="workspace">
      <MaterialPanel
        v-if="!previewMode"
        :materials="materials"
        :templates="templates"
        @add-widget="addWidget"
        @add-template="addTemplate"
        @remove-template="removeTemplate"
      />

      <StageCanvas
        :project="project"
        :selected-ids="selectedIds"
        :primary-selected-id="primarySelectedId"
        :preview-mode="previewMode"
        @selection-change="updateSelection"
        @add-widget="addWidget"
        @add-template="addTemplate"
        @history-session-start="startHistorySession"
        @history-session-end="endHistorySession"
      />

      <InspectorPanel
        v-if="!previewMode"
        :project="project"
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
        @select-layer="handleLayerSelection"
        @toggle-layer-hidden="toggleLayerHidden"
        @toggle-layer-locked="toggleLayerLocked"
        @reorder-layer="reorderLayers"
        @set-selected-hidden="setSelectedHidden"
        @set-selected-locked="setSelectedLocked"
        @undo="undoProject"
        @redo="redoProject"
      />
    </section>

    <footer class="status-bar">
      <span>{{ statusMessage }}</span>
      <span>Ctrl/Cmd + Z 撤销，Ctrl/Cmd + Shift + Z 重做，Ctrl/Cmd + G 编组</span>
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
            <strong>{{ selectedWidgets.length }} 个</strong>
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
