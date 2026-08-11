<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import StageWidget from './StageWidget.vue'
import { expandIdsWithGroups, getSelectionBounds } from '../editor/project'

const SNAP_THRESHOLD = 8

const props = defineProps({
  project: {
    type: Object,
    required: true
  },
  selectedIds: {
    type: Array,
    default: () => []
  },
  primarySelectedId: {
    type: String,
    default: null
  },
  previewMode: {
    type: Boolean,
    default: false
  },
  showMeta: {
    type: Boolean,
    default: true
  },
  runtimeMode: {
    type: Boolean,
    default: false
  },
  linkedWidgetIds: {
    type: Array,
    default: () => []
  },
  dataSourceRuntime: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([
  'selection-change',
  'add-widget',
  'add-template',
  'history-session-start',
  'history-session-end',
  'trigger-widget-action'
])

const containerRef = ref(null)
const stageRef = ref(null)
const scale = ref(1)
const guideLines = ref({
  vertical: null,
  horizontal: null
})
const marqueeRect = ref(null)

let resizeObserver = null
let interactionState = null
let marqueeState = null

const orderedWidgets = computed(() =>
  [...props.project.widgets]
    .filter((item) => !item.hidden)
    .sort((a, b) => a.zIndex - b.zIndex)
)

const linkedIdSet = computed(() => new Set(props.linkedWidgetIds))
const selectedIdSet = computed(() => new Set(props.selectedIds))
const currentPrimaryId = computed(() => props.primarySelectedId || props.selectedIds.at(-1) || null)
const selectedBounds = computed(() =>
  getSelectionBounds(orderedWidgets.value.filter((item) => selectedIdSet.value.has(item.id)))
)

const scaledShellStyle = computed(() => ({
  width: `${props.project.meta.screenWidth * scale.value}px`,
  height: `${props.project.meta.screenHeight * scale.value}px`
}))

const stageStyle = computed(() => ({
  width: `${props.project.meta.screenWidth}px`,
  height: `${props.project.meta.screenHeight}px`,
  transform: `scale(${scale.value})`,
  transformOrigin: 'top left',
  background: props.project.meta.background
}))

const gridStyle = computed(() => ({
  '--grid-color': props.project.meta.gridColor
}))

const selectionBoundsStyle = computed(() => {
  if (!selectedBounds.value) {
    return null
  }

  return {
    left: `${selectedBounds.value.x}px`,
    top: `${selectedBounds.value.y}px`,
    width: `${selectedBounds.value.w}px`,
    height: `${selectedBounds.value.h}px`
  }
})

const marqueeStyle = computed(() => {
  if (!marqueeRect.value) {
    return null
  }

  return {
    left: `${marqueeRect.value.x}px`,
    top: `${marqueeRect.value.y}px`,
    width: `${marqueeRect.value.w}px`,
    height: `${marqueeRect.value.h}px`
  }
})

function updateScale() {
  if (!containerRef.value) {
    return
  }

  const bounds = containerRef.value.getBoundingClientRect()
  const horizontal = (bounds.width - 40) / props.project.meta.screenWidth
  const vertical = (bounds.height - 40) / props.project.meta.screenHeight
  scale.value = Math.max(0.25, Math.min(horizontal, vertical, 1))
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function toStagePoint(event) {
  if (!stageRef.value) {
    return {
      x: 0,
      y: 0
    }
  }

  const stageBounds = stageRef.value.getBoundingClientRect()

  return {
    x: clamp((event.clientX - stageBounds.left) / scale.value, 0, props.project.meta.screenWidth),
    y: clamp((event.clientY - stageBounds.top) / scale.value, 0, props.project.meta.screenHeight)
  }
}

function parseDropSource(dataTransfer) {
  const rawSource = dataTransfer.getData('application/widget-source')

  if (rawSource) {
    try {
      return JSON.parse(rawSource)
    } catch (error) {
      console.warn(error)
    }
  }

  const type = dataTransfer.getData('application/widget-type')
  return type ? { kind: 'material', type } : null
}

function findWidget(widgetId) {
  return props.project.widgets.find((item) => item.id === widgetId) ?? null
}

function isSelected(widgetId) {
  return selectedIdSet.value.has(widgetId)
}

function isPrimary(widgetId) {
  return currentPrimaryId.value === widgetId
}

function isLinkedActive(widgetId) {
  return linkedIdSet.value.has(widgetId)
}

function emitSelection(ids, primaryId = null) {
  const expandedIds = expandIdsWithGroups(ids, props.project.widgets)
  const validIds = Array.from(new Set(expandedIds)).filter((id) => findWidget(id))
  const nextPrimaryId = validIds.includes(primaryId) ? primaryId : validIds.at(-1) ?? null

  emit('selection-change', {
    ids: validIds,
    primaryId: nextPrimaryId
  })
}

function getWidgetBounds(widget) {
  return {
    left: widget.x,
    centerX: widget.x + widget.w / 2,
    right: widget.x + widget.w,
    top: widget.y,
    centerY: widget.y + widget.h / 2,
    bottom: widget.y + widget.h
  }
}

function resolveToggleSelection(idsToToggle, primaryId) {
  const selection = new Set(props.selectedIds)
  const fullySelected = idsToToggle.every((id) => selection.has(id))

  if (fullySelected) {
    idsToToggle.forEach((id) => selection.delete(id))
  } else {
    idsToToggle.forEach((id) => selection.add(id))
  }

  const ids = Array.from(selection)

  return {
    ids,
    primaryId: ids.includes(primaryId) ? primaryId : ids.at(-1) ?? null
  }
}

function resolveSelectionForInteraction(widgetId, event) {
  const relatedIds = expandIdsWithGroups([widgetId], props.project.widgets)
  const additive = event.ctrlKey || event.metaKey

  if (additive) {
    return resolveToggleSelection(relatedIds, widgetId)
  }

  if (props.selectedIds.includes(widgetId)) {
    return {
      ids: [...props.selectedIds],
      primaryId: currentPrimaryId.value ?? widgetId
    }
  }

  return {
    ids: relatedIds,
    primaryId: widgetId
  }
}

function handleWidgetSelect(payload) {
  const selection = resolveSelectionForInteraction(payload.widgetId, payload.event)
  emitSelection(selection.ids, selection.primaryId)
}

function handleWidgetAction(payload) {
  emit('trigger-widget-action', payload.widgetId)
}

function beginInteraction(payload, mode) {
  if (props.previewMode || payload.event.button !== 0) {
    return
  }

  const widget = findWidget(payload.widgetId)

  if (!widget) {
    return
  }

  const selection =
    mode === 'move'
      ? resolveSelectionForInteraction(payload.widgetId, payload.event)
      : {
          ids: [payload.widgetId],
          primaryId: payload.widgetId
        }

  const activeIds = mode === 'move' ? selection.ids : [payload.widgetId]
  const activeWidgets = props.project.widgets.filter(
    (item) => activeIds.includes(item.id) && !item.locked && !item.hidden
  )
  const referenceBounds = getSelectionBounds(activeWidgets)

  if (!referenceBounds) {
    emitSelection(selection.ids, selection.primaryId)
    return
  }

  emit('history-session-start', mode === 'move' ? '移动组件' : '缩放组件')
  emitSelection(selection.ids, selection.primaryId)

  interactionState = {
    mode,
    activeIds,
    activeWidgetId: payload.widgetId,
    startX: payload.event.clientX,
    startY: payload.event.clientY,
    referenceBounds,
    origins: activeWidgets.map((item) => ({
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h
    }))
  }

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopInteraction)
}

function buildSnapTargets(ignoreIds) {
  const ignored = new Set(ignoreIds)
  const xTargets = [0, props.project.meta.screenWidth / 2, props.project.meta.screenWidth].map((value) => ({
    value
  }))
  const yTargets = [0, props.project.meta.screenHeight / 2, props.project.meta.screenHeight].map(
    (value) => ({
      value
    })
  )

  props.project.widgets.forEach((widget) => {
    if (ignored.has(widget.id) || widget.hidden) {
      return
    }

    const bounds = getWidgetBounds(widget)
    xTargets.push({ value: bounds.left }, { value: bounds.centerX }, { value: bounds.right })
    yTargets.push({ value: bounds.top }, { value: bounds.centerY }, { value: bounds.bottom })
  })

  return {
    xTargets,
    yTargets
  }
}

function findNearestSnap(candidates, targets) {
  let best = null

  candidates.forEach((candidate) => {
    targets.forEach((target) => {
      const distance = Math.abs(candidate.value - target.value)

      if (distance > SNAP_THRESHOLD) {
        return
      }

      if (!best || distance < best.distance) {
        best = {
          distance,
          guide: target.value,
          result: target.value - candidate.offset
        }
      }
    })
  })

  return best
}

function findNearestValueSnap(value, targets) {
  let best = null

  targets.forEach((target) => {
    const distance = Math.abs(value - target.value)

    if (distance > SNAP_THRESHOLD) {
      return
    }

    if (!best || distance < best.distance) {
      best = {
        distance,
        guide: target.value,
        result: target.value
      }
    }
  })

  return best
}

function applyMoveSnap(nextLeft, nextTop, bounds, activeIds) {
  const { xTargets, yTargets } = buildSnapTargets(activeIds)
  const snapX = findNearestSnap(
    [
      { value: nextLeft, offset: 0 },
      { value: nextLeft + bounds.w / 2, offset: bounds.w / 2 },
      { value: nextLeft + bounds.w, offset: bounds.w }
    ],
    xTargets
  )
  const snapY = findNearestSnap(
    [
      { value: nextTop, offset: 0 },
      { value: nextTop + bounds.h / 2, offset: bounds.h / 2 },
      { value: nextTop + bounds.h, offset: bounds.h }
    ],
    yTargets
  )

  guideLines.value = {
    vertical: snapX?.guide ?? null,
    horizontal: snapY?.guide ?? null
  }

  return {
    left: clamp(snapX ? snapX.result : nextLeft, 0, props.project.meta.screenWidth - bounds.w),
    top: clamp(snapY ? snapY.result : nextTop, 0, props.project.meta.screenHeight - bounds.h)
  }
}

function applyResizeSnap(nextRight, nextBottom, widgetId) {
  const { xTargets, yTargets } = buildSnapTargets([widgetId])
  const snapX = findNearestValueSnap(nextRight, xTargets)
  const snapY = findNearestValueSnap(nextBottom, yTargets)

  guideLines.value = {
    vertical: snapX?.guide ?? null,
    horizontal: snapY?.guide ?? null
  }

  return {
    right: snapX ? snapX.result : nextRight,
    bottom: snapY ? snapY.result : nextBottom
  }
}

function handlePointerMove(event) {
  if (!interactionState) {
    return
  }

  const deltaX = (event.clientX - interactionState.startX) / scale.value
  const deltaY = (event.clientY - interactionState.startY) / scale.value

  if (interactionState.mode === 'move') {
    const maxLeft = props.project.meta.screenWidth - interactionState.referenceBounds.w
    const maxTop = props.project.meta.screenHeight - interactionState.referenceBounds.h
    const nextLeft = clamp(interactionState.referenceBounds.x + deltaX, 0, maxLeft)
    const nextTop = clamp(interactionState.referenceBounds.y + deltaY, 0, maxTop)
    const snapped = applyMoveSnap(
      nextLeft,
      nextTop,
      interactionState.referenceBounds,
      interactionState.activeIds
    )

    const moveX = snapped.left - interactionState.referenceBounds.x
    const moveY = snapped.top - interactionState.referenceBounds.y

    interactionState.origins.forEach((origin) => {
      const widget = findWidget(origin.id)

      if (!widget) {
        return
      }

      widget.x = origin.x + moveX
      widget.y = origin.y + moveY
    })
  }

  if (interactionState.mode === 'resize') {
    const origin = interactionState.origins[0]
    const widget = findWidget(interactionState.activeWidgetId)

    if (!origin || !widget) {
      return
    }

    const nextRight = clamp(
      origin.x + origin.w + deltaX,
      origin.x + 120,
      props.project.meta.screenWidth
    )
    const nextBottom = clamp(
      origin.y + origin.h + deltaY,
      origin.y + 80,
      props.project.meta.screenHeight
    )
    const snapped = applyResizeSnap(nextRight, nextBottom, widget.id)

    widget.w = clamp(snapped.right - origin.x, 120, props.project.meta.screenWidth - origin.x)
    widget.h = clamp(snapped.bottom - origin.y, 80, props.project.meta.screenHeight - origin.y)
  }
}

function stopInteraction() {
  if (!interactionState) {
    return
  }

  interactionState = null
  guideLines.value = {
    vertical: null,
    horizontal: null
  }
  emit('history-session-end')
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', stopInteraction)
}

function getRectFromPoints(startX, startY, endX, endY) {
  const x = Math.min(startX, endX)
  const y = Math.min(startY, endY)
  const w = Math.abs(endX - startX)
  const h = Math.abs(endY - startY)

  return { x, y, w, h }
}

function intersects(widget, rect) {
  const bounds = getWidgetBounds(widget)

  return !(
    bounds.right < rect.x ||
    bounds.left > rect.x + rect.w ||
    bounds.bottom < rect.y ||
    bounds.top > rect.y + rect.h
  )
}

function handleStagePointerDown(event) {
  if (props.previewMode || event.button !== 0 || event.target !== stageRef.value) {
    return
  }

  const point = toStagePoint(event)

  marqueeState = {
    additive: event.ctrlKey || event.metaKey,
    startX: point.x,
    startY: point.y,
    currentX: point.x,
    currentY: point.y
  }

  marqueeRect.value = null
  window.addEventListener('pointermove', handleMarqueeMove)
  window.addEventListener('pointerup', finishMarqueeSelection)
}

function handleMarqueeMove(event) {
  if (!marqueeState) {
    return
  }

  const point = toStagePoint(event)
  marqueeState.currentX = point.x
  marqueeState.currentY = point.y
  marqueeRect.value = getRectFromPoints(
    marqueeState.startX,
    marqueeState.startY,
    marqueeState.currentX,
    marqueeState.currentY
  )
}

function finishMarqueeSelection() {
  if (!marqueeState) {
    return
  }

  const rect = marqueeRect.value

  if (!rect || (rect.w < 4 && rect.h < 4)) {
    if (!marqueeState.additive) {
      emitSelection([], null)
    }
  } else {
    const ids = props.project.widgets
      .filter((widget) => intersects(widget, rect))
      .map((widget) => widget.id)
    const expandedIds = expandIdsWithGroups(ids, props.project.widgets)

    if (marqueeState.additive) {
      emitSelection(
        [...props.selectedIds, ...expandedIds],
        expandedIds.at(-1) ?? currentPrimaryId.value
      )
    } else {
      emitSelection(expandedIds, expandedIds.at(-1) ?? null)
    }
  }

  marqueeState = null
  marqueeRect.value = null
  clearMarqueeListeners()
}

function clearMarqueeListeners() {
  window.removeEventListener('pointermove', handleMarqueeMove)
  window.removeEventListener('pointerup', finishMarqueeSelection)
}

function handleDrop(event) {
  if (props.previewMode) {
    return
  }

  const source = parseDropSource(event.dataTransfer)

  if (!source) {
    return
  }

  const point = toStagePoint(event)

  if (source.kind === 'material' && source.type) {
    emit('add-widget', source.type, point)
  }

  if (source.kind === 'template' && source.templateId) {
    emit('add-template', source.templateId, point)
  }
}

function allowDrop(event) {
  if (!props.previewMode) {
    event.preventDefault()
  }
}

onMounted(() => {
  updateScale()
  resizeObserver = new ResizeObserver(() => updateScale())
  resizeObserver.observe(containerRef.value)
})

onBeforeUnmount(() => {
  stopInteraction()
  marqueeState = null
  marqueeRect.value = null
  clearMarqueeListeners()
  resizeObserver?.disconnect()
})

watch(
  () => [props.project.meta.screenWidth, props.project.meta.screenHeight],
  () => updateScale()
)
</script>

<template>
  <main ref="containerRef" class="canvas-wrap" :class="{ 'canvas-wrap--runtime': runtimeMode }">
    <div v-if="showMeta" class="canvas-meta">
      <div>
        <h2>{{ project.meta.title }}</h2>
        <p>{{ project.meta.screenWidth }} x {{ project.meta.screenHeight }} 画布</p>
      </div>
      <span>{{ previewMode ? '预览中' : '编辑中' }}</span>
    </div>

    <div class="canvas-stage-shell" :style="scaledShellStyle">
      <section
        ref="stageRef"
        class="canvas-stage"
        :class="{ 'canvas-stage--grid': project.meta.showGrid }"
        :style="[stageStyle, gridStyle]"
        @pointerdown="handleStagePointerDown"
        @dragover="allowDrop"
        @drop.prevent="handleDrop"
      >
        <StageWidget
          v-for="widget in orderedWidgets"
          :key="widget.id"
          :widget="widget"
          :selected="isSelected(widget.id)"
          :primary-selected="isPrimary(widget.id)"
          :preview-mode="previewMode"
          :can-resize="selectedIds.length === 1 && isPrimary(widget.id) && !widget.locked"
          :can-move="!widget.locked"
          :linked-active="isLinkedActive(widget.id)"
          :data-source-runtime="dataSourceRuntime"
          @select="handleWidgetSelect"
          @drag-start="beginInteraction($event, 'move')"
          @resize-start="beginInteraction($event, 'resize')"
          @trigger-action="handleWidgetAction"
        />

        <div
          v-if="selectedBounds && selectedIds.length > 1"
          class="canvas-selection-bounds"
          :style="selectionBoundsStyle"
        />
        <div
          v-if="guideLines.vertical !== null"
          class="canvas-guide canvas-guide--vertical"
          :style="{ left: `${guideLines.vertical}px` }"
        />
        <div
          v-if="guideLines.horizontal !== null"
          class="canvas-guide canvas-guide--horizontal"
          :style="{ top: `${guideLines.horizontal}px` }"
        />
        <div v-if="marqueeRect" class="canvas-marquee" :style="marqueeStyle" />
      </section>
    </div>
  </main>
</template>
