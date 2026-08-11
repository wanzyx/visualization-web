<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MaterialPanel from './components/MaterialPanel.vue'
import StageCanvas from './components/StageCanvas.vue'
import InspectorPanel from './components/InspectorPanel.vue'
import TopToolbar from './components/TopToolbar.vue'
import { materials, createWidget } from './editor/materials'
import {
  STORAGE_KEY,
  createDemoProject,
  createWidgetGroup,
  duplicateWidgets,
  expandIdsWithGroups,
  getNextZIndex,
  getSelectionBounds,
  normalizeProjectSchema,
  removeWidgetGroup,
  sortWidgets
} from './editor/project'

const previewMode = ref(false)
const dialogMode = ref(null)
const dialogText = ref('')
const statusMessage = ref('已启用自动保存、吸附对齐和多选编组')

const project = ref(loadProject())
const selectedIds = ref(project.value.widgets[0]?.id ? [project.value.widgets[0].id] : [])
const primarySelectedId = ref(project.value.widgets[0]?.id ?? null)

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

function loadProject() {
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

function sanitizeSelection(ids, primaryId = null) {
  const availableIds = new Set(project.value.widgets.map((item) => item.id))
  const uniqueIds = Array.from(new Set(ids.filter((id) => availableIds.has(id))))

  selectedIds.value = uniqueIds
  primarySelectedId.value = uniqueIds.includes(primaryId) ? primaryId : uniqueIds.at(-1) ?? null
}

function updateSelection(payload) {
  sanitizeSelection(payload?.ids ?? [], payload?.primaryId ?? null)
}

function addWidget(type, position = {}) {
  const nextWidget = createWidget(type, {
    x: clamp(position.x ?? 180, 0, project.value.meta.screenWidth - 160),
    y: clamp(position.y ?? 180, 0, project.value.meta.screenHeight - 120),
    zIndex: getNextZIndex(project.value.widgets)
  })

  project.value.widgets.push(nextWidget)
  sanitizeSelection([nextWidget.id], nextWidget.id)
  statusMessage.value = `已添加 ${nextWidget.name}`
}

function deleteSelected() {
  if (!selectedIds.value.length) {
    return
  }

  const expandedIds = expandIdsWithGroups(selectedIds.value, project.value.widgets)
  const deleteSet = new Set(expandedIds)

  project.value.widgets = project.value.widgets.filter((item) => !deleteSet.has(item.id))
  sanitizeSelection([], null)
  statusMessage.value = `已删除 ${expandedIds.length} 个组件`
}

function duplicateSelected() {
  const duplicates = duplicateWidgets(project.value, selectedIds.value)

  if (!duplicates.length) {
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
  const groupId = createWidgetGroup(project.value, selectedIds.value)

  if (!groupId) {
    return
  }

  statusMessage.value = `已编组 ${selectedIds.value.length} 个组件`
}

function ungroupSelected() {
  const count = removeWidgetGroup(project.value, selectedIds.value)

  if (!count) {
    return
  }

  statusMessage.value = '已取消编组'
}

function resetProject() {
  project.value = createDemoProject()
  previewMode.value = false
  sanitizeSelection(project.value.widgets[0]?.id ? [project.value.widgets[0].id] : [], project.value.widgets[0]?.id ?? null)
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
    statusMessage.value = '复制失败，请手动复制'
    console.warn(error)
  }
}

function applyImport() {
  try {
    project.value = normalizeProjectSchema(JSON.parse(dialogText.value))
    dialogMode.value = null
    sanitizeSelection(project.value.widgets[0]?.id ? [project.value.widgets[0].id] : [], project.value.widgets[0]?.id ?? null)
    statusMessage.value = '项目 JSON 已导入'
  } catch (error) {
    statusMessage.value = '导入失败，请检查 JSON 结构'
    console.warn(error)
  }
}

function closeDialog() {
  dialogMode.value = null
}

function moveSelectionBy(deltaX, deltaY) {
  if (!selectedWidgets.value.length || !selectedBounds.value) {
    return
  }

  const minDeltaX = -selectedBounds.value.x
  const maxDeltaX = project.value.meta.screenWidth - (selectedBounds.value.x + selectedBounds.value.w)
  const minDeltaY = -selectedBounds.value.y
  const maxDeltaY = project.value.meta.screenHeight - (selectedBounds.value.y + selectedBounds.value.h)
  const nextDeltaX = clamp(deltaX, minDeltaX, maxDeltaX)
  const nextDeltaY = clamp(deltaY, minDeltaY, maxDeltaY)

  selectedWidgets.value.forEach((widget) => {
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
  project,
  (value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  },
  { deep: true }
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
    />

    <section class="workspace">
      <MaterialPanel v-if="!previewMode" :materials="materials" @add-widget="addWidget" />

      <StageCanvas
        :project="project"
        :selected-ids="selectedIds"
        :primary-selected-id="primarySelectedId"
        :preview-mode="previewMode"
        @selection-change="updateSelection"
        @add-widget="addWidget"
      />

      <InspectorPanel
        v-if="!previewMode"
        :project="project"
        :selected-widget="selectedWidget"
        :selected-widgets="selectedWidgets"
        :selected-bounds="selectedBounds"
      />
    </section>

    <footer class="status-bar">
      <span>{{ statusMessage }}</span>
      <span>Ctrl/Cmd 点选追加，拖动画布空白可框选，Ctrl/Cmd + G 编组，Shift + Ctrl/Cmd + G 取消编组</span>
    </footer>

    <div v-if="dialogMode" class="dialog-mask" @click.self="closeDialog">
      <div class="dialog-card">
        <div class="dialog-card__header">
          <div>
            <p>{{ dialogMode === 'export' ? '项目导出' : '项目导入' }}</p>
            <h3>{{ dialogMode === 'export' ? '复制当前页面 JSON' : '粘贴页面 JSON 并导入' }}</h3>
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
      </div>
    </div>
  </div>
</template>
