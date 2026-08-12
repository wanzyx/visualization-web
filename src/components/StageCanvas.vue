<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import StageWidget from './StageWidget.vue'
import { expandIdsWithGroups, getSelectionBounds } from '../editor/project'

const SNAP_THRESHOLD = 8
const MIN_SCALE = 0.25
const MAX_SCALE = 2
const SCALE_STEP = 0.1
const RULER_SIZE = 28
const RULER_STEP = 50
const RULER_MAJOR_STEP = 100
const DEFAULT_GUIDE_COLOR = 'rgba(255, 173, 92, 0.92)'

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
  },
  runtimeFilters: {
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
  'trigger-widget-action',
  'widget-command'
])

const containerRef = ref(null)
const stageRef = ref(null)
const fitScale = ref(1)
const manualScale = ref(1)
const scaleMode = ref('fit')
const guideLines = ref({
  vertical: null,
  horizontal: null
})
const marqueeRect = ref(null)
const guideDraft = ref(null)
const guideDragState = ref(null)
const transformOverlay = ref(null)

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
const scale = computed(() => (scaleMode.value === 'fit' ? fitScale.value : manualScale.value))
const scaleLabel = computed(() => `${Math.round(scale.value * 100)}%`)
const isFitMode = computed(() => scaleMode.value === 'fit')
const scaledWidth = computed(() => props.project.meta.screenWidth * scale.value)
const scaledHeight = computed(() => props.project.meta.screenHeight * scale.value)
const showRulers = computed(
  () => !props.previewMode && !props.runtimeMode && props.project.meta.showRulers !== false
)
const showGuides = computed(
  () => !props.previewMode && !props.runtimeMode && props.project.meta.showGuides !== false
)
const guideColor = computed(() => props.project.meta.guideColor || DEFAULT_GUIDE_COLOR)

const scaledShellStyle = computed(() => ({
  width: `${scaledWidth.value}px`,
  height: `${scaledHeight.value}px`
}))

const boardStyle = computed(() => ({
  '--ruler-size': `${RULER_SIZE}px`,
  width: `${scaledWidth.value + (showRulers.value ? RULER_SIZE : 0)}px`,
  height: `${scaledHeight.value + (showRulers.value ? RULER_SIZE : 0)}px`
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

const verticalGuides = computed(() =>
  normalizeGuideValues(props.project.meta.guides?.vertical, props.project.meta.screenWidth)
)
const horizontalGuides = computed(() =>
  normalizeGuideValues(props.project.meta.guides?.horizontal, props.project.meta.screenHeight)
)
const hasGuides = computed(() => verticalGuides.value.length > 0 || horizontalGuides.value.length > 0)

const transformOverlayMetrics = computed(() => {
  if (!transformOverlay.value) {
    return []
  }

  return [
    { label: 'X', value: transformOverlay.value.x },
    { label: 'Y', value: transformOverlay.value.y },
    { label: 'W', value: transformOverlay.value.w },
    { label: 'H', value: transformOverlay.value.h }
  ]
})

const transformOverlayStyle = computed(() => {
  if (!transformOverlay.value) {
    return null
  }

  const bounds = transformOverlay.value
  const width = 196
  const top =
    bounds.y > 42
      ? bounds.y - 36
      : Math.min(bounds.y + bounds.h + 12, props.project.meta.screenHeight - 34)

  return {
    left: `${clamp(bounds.x, 8, Math.max(8, props.project.meta.screenWidth - width - 8))}px`,
    top: `${top}px`
  }
})

const measurementLines = computed(() => {
  if (!transformOverlay.value) {
    return []
  }

  return buildMeasurementLines(transformOverlay.value)
})

const activeGuideLabels = computed(() => {
  if (!transformOverlay.value) {
    return []
  }

  const labels = []

  if (guideLines.value.vertical !== null) {
    labels.push({
      key: `v-${guideLines.value.vertical}`,
      value: Math.round(guideLines.value.vertical),
      style: {
        left: `${clamp(guideLines.value.vertical, 18, props.project.meta.screenWidth - 18)}px`,
        top: '14px'
      }
    })
  }

  if (guideLines.value.horizontal !== null) {
    labels.push({
      key: `h-${guideLines.value.horizontal}`,
      value: Math.round(guideLines.value.horizontal),
      style: {
        left: '32px',
        top: `${clamp(guideLines.value.horizontal, 18, props.project.meta.screenHeight - 18)}px`
      }
    })
  }

  return labels
})

const verticalGuideItems = computed(() => {
  if (!showGuides.value) {
    return []
  }

  const hiddenIndex =
    guideDragState.value?.orientation === 'vertical' ? guideDragState.value.index : null

  return verticalGuides.value
    .map((value, index) => ({
      index,
      value
    }))
    .filter((item) => item.index !== hiddenIndex)
})

const horizontalGuideItems = computed(() => {
  if (!showGuides.value) {
    return []
  }

  const hiddenIndex =
    guideDragState.value?.orientation === 'horizontal' ? guideDragState.value.index : null

  return horizontalGuides.value
    .map((value, index) => ({
      index,
      value
    }))
    .filter((item) => item.index !== hiddenIndex)
})

const horizontalRulerTicks = computed(() => buildRulerTicks(props.project.meta.screenWidth))
const verticalRulerTicks = computed(() => buildRulerTicks(props.project.meta.screenHeight))

function updateScale() {
  if (!containerRef.value) {
    return
  }

  const bounds = containerRef.value.getBoundingClientRect()
  const reservedWidth = showRulers.value ? RULER_SIZE + 40 : 40
  const reservedHeight = showRulers.value ? RULER_SIZE + 40 : 40
  const horizontal = (bounds.width - reservedWidth) / props.project.meta.screenWidth
  const vertical = (bounds.height - reservedHeight) / props.project.meta.screenHeight
  fitScale.value = Math.max(MIN_SCALE, Math.min(horizontal, vertical, 1))
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function clampScale(value) {
  return clamp(Number(value) || 1, MIN_SCALE, MAX_SCALE)
}

function normalizeGuideValues(values, max) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item))
        .map((item) => clamp(item, 0, max))
    )
  ).sort((a, b) => a - b)
}

function toRoundedBounds(bounds, mode) {
  return {
    mode,
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    w: Math.round(bounds.w),
    h: Math.round(bounds.h)
  }
}

function updateTransformOverlay(mode, bounds) {
  transformOverlay.value = toRoundedBounds(bounds, mode)
}

function clearTransformOverlay() {
  transformOverlay.value = null
}

function createHorizontalMeasureLine(key, start, end, y, label) {
  const left = Math.min(start, end)
  const width = Math.abs(end - start)

  if (width < 1) {
    return null
  }

  const clampedY = clamp(y, 12, props.project.meta.screenHeight - 12)

  return {
    key,
    orientation: 'horizontal',
    label: Math.round(label),
    lineStyle: {
      left: `${left}px`,
      top: `${clampedY}px`,
      width: `${width}px`
    },
    labelStyle: {
      left: `${left + width / 2}px`,
      top: `${clampedY}px`
    },
    startCapStyle: {
      left: `${left}px`,
      top: `${clampedY}px`
    },
    endCapStyle: {
      left: `${left + width}px`,
      top: `${clampedY}px`
    }
  }
}

function createVerticalMeasureLine(key, start, end, x, label) {
  const top = Math.min(start, end)
  const height = Math.abs(end - start)

  if (height < 1) {
    return null
  }

  const clampedX = clamp(x, 12, props.project.meta.screenWidth - 12)

  return {
    key,
    orientation: 'vertical',
    label: Math.round(label),
    lineStyle: {
      left: `${clampedX}px`,
      top: `${top}px`,
      height: `${height}px`
    },
    labelStyle: {
      left: `${clampedX}px`,
      top: `${top + height / 2}px`
    },
    startCapStyle: {
      left: `${clampedX}px`,
      top: `${top}px`
    },
    endCapStyle: {
      left: `${clampedX}px`,
      top: `${top + height}px`
    }
  }
}

function buildMeasurementLines(bounds) {
  const lines = []
  const preferredTop = bounds.y > 24 ? bounds.y - 14 : bounds.y + bounds.h + 14
  const preferredLeft = bounds.x > 24 ? bounds.x - 14 : bounds.x + bounds.w + 14

  if (bounds.mode === 'move') {
    const horizontal = createHorizontalMeasureLine('move-x', 0, bounds.x, preferredTop, bounds.x)
    const vertical = createVerticalMeasureLine('move-y', 0, bounds.y, preferredLeft, bounds.y)

    if (horizontal) {
      lines.push(horizontal)
    }

    if (vertical) {
      lines.push(vertical)
    }
  }

  if (bounds.mode === 'resize') {
    const horizontal = createHorizontalMeasureLine(
      'resize-w',
      bounds.x,
      bounds.x + bounds.w,
      preferredTop,
      bounds.w
    )
    const vertical = createVerticalMeasureLine(
      'resize-h',
      bounds.y,
      bounds.y + bounds.h,
      preferredLeft,
      bounds.h
    )

    if (horizontal) {
      lines.push(horizontal)
    }

    if (vertical) {
      lines.push(vertical)
    }
  }

  return lines
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((item, index) => item === right[index])
}

function ensureGuideCollections() {
  if (!props.project.meta.guides || typeof props.project.meta.guides !== 'object') {
    props.project.meta.guides = {
      vertical: [],
      horizontal: []
    }
    return
  }

  if (!Array.isArray(props.project.meta.guides.vertical)) {
    props.project.meta.guides.vertical = []
  }

  if (!Array.isArray(props.project.meta.guides.horizontal)) {
    props.project.meta.guides.horizontal = []
  }
}

function syncGuideCollections() {
  ensureGuideCollections()

  const nextVertical = normalizeGuideValues(
    props.project.meta.guides.vertical,
    props.project.meta.screenWidth
  )
  const nextHorizontal = normalizeGuideValues(
    props.project.meta.guides.horizontal,
    props.project.meta.screenHeight
  )

  if (!arraysEqual(nextVertical, props.project.meta.guides.vertical)) {
    props.project.meta.guides.vertical = nextVertical
  }

  if (!arraysEqual(nextHorizontal, props.project.meta.guides.horizontal)) {
    props.project.meta.guides.horizontal = nextHorizontal
  }
}

function getGuideValues(orientation) {
  return orientation === 'vertical' ? [...verticalGuides.value] : [...horizontalGuides.value]
}

function setGuideValues(orientation, values) {
  ensureGuideCollections()
  const max =
    orientation === 'vertical' ? props.project.meta.screenWidth : props.project.meta.screenHeight

  props.project.meta.guides[orientation] = normalizeGuideValues(values, max)
}

function buildRulerTicks(length) {
  const ticks = []

  for (let value = 0; value <= length; value += RULER_STEP) {
    ticks.push(value)
  }

  if (ticks.at(-1) !== length) {
    ticks.push(length)
  }

  return ticks
}

function setFitScaleMode() {
  scaleMode.value = 'fit'
}

function setManualScale(value) {
  manualScale.value = clampScale(value)
  scaleMode.value = 'manual'
}

function zoomIn() {
  setManualScale(scale.value + SCALE_STEP)
}

function zoomOut() {
  setManualScale(scale.value - SCALE_STEP)
}

function resetScaleToActual() {
  setManualScale(1)
}

function getStagePointer(event) {
  if (!stageRef.value) {
    return {
      x: 0,
      y: 0,
      clampedX: 0,
      clampedY: 0,
      withinStage: false
    }
  }

  const stageBounds = stageRef.value.getBoundingClientRect()
  const x = (event.clientX - stageBounds.left) / scale.value
  const y = (event.clientY - stageBounds.top) / scale.value

  return {
    x,
    y,
    clampedX: clamp(x, 0, props.project.meta.screenWidth),
    clampedY: clamp(y, 0, props.project.meta.screenHeight),
    withinStage:
      x >= 0 &&
      x <= props.project.meta.screenWidth &&
      y >= 0 &&
      y <= props.project.meta.screenHeight
  }
}

function toStagePoint(event) {
  const point = getStagePointer(event)

  return {
    x: point.clampedX,
    y: point.clampedY
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

function handleWidgetCommand(payload) {
  emit('widget-command', payload)
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
  updateTransformOverlay(mode, referenceBounds)

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopInteraction)
}

function buildSnapTargets(ignoreIds) {
  const ignored = new Set(ignoreIds)
  const xTargets = [0, props.project.meta.screenWidth / 2, props.project.meta.screenWidth].map(
    (value) => ({
      value
    })
  )
  const yTargets = [0, props.project.meta.screenHeight / 2, props.project.meta.screenHeight].map(
    (value) => ({
      value
    })
  )

  if (showGuides.value) {
    verticalGuides.value.forEach((value) => {
      xTargets.push({ value })
    })

    horizontalGuides.value.forEach((value) => {
      yTargets.push({ value })
    })
  }

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

    updateTransformOverlay(interactionState.mode, {
      x: snapped.left,
      y: snapped.top,
      w: interactionState.referenceBounds.w,
      h: interactionState.referenceBounds.h
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
    updateTransformOverlay(interactionState.mode, {
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h
    })
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
  clearTransformOverlay()
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

function runMetaMutation(label, handler) {
  emit('history-session-start', label)
  handler()
  emit('history-session-end')
}

function toggleRulers() {
  runMetaMutation(props.project.meta.showRulers === false ? '打开标尺' : '关闭标尺', () => {
    props.project.meta.showRulers = !(props.project.meta.showRulers !== false)
  })
}

function toggleGuides() {
  runMetaMutation(props.project.meta.showGuides === false ? '启用参考线' : '关闭参考线', () => {
    props.project.meta.showGuides = !(props.project.meta.showGuides !== false)
  })
}

function clearGuides() {
  if (!hasGuides.value) {
    return
  }

  runMetaMutation('清空参考线', () => {
    setGuideValues('vertical', [])
    setGuideValues('horizontal', [])
  })
}

function startGuideFromRuler(orientation, event) {
  if (!showRulers.value || !showGuides.value || event.button !== 0) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const pointer = getStagePointer(event)

  emit('history-session-start', '新建参考线')
  guideDragState.value = {
    orientation,
    index: null,
    withinStage: pointer.withinStage
  }
  guideDraft.value = {
    orientation,
    value: orientation === 'vertical' ? pointer.clampedX : pointer.clampedY
  }

  window.addEventListener('pointermove', handleGuideMove)
  window.addEventListener('pointerup', finishGuideDrag)
}

function startGuideDrag(orientation, index, event) {
  if (!showGuides.value || event.button !== 0) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const values = getGuideValues(orientation)
  const value = values[index]

  if (!Number.isFinite(value)) {
    return
  }

  emit('history-session-start', '调整参考线')
  guideDragState.value = {
    orientation,
    index,
    withinStage: true
  }
  guideDraft.value = {
    orientation,
    value
  }

  window.addEventListener('pointermove', handleGuideMove)
  window.addEventListener('pointerup', finishGuideDrag)
}

function handleGuideMove(event) {
  if (!guideDragState.value) {
    return
  }

  const pointer = getStagePointer(event)
  const orientation = guideDragState.value.orientation

  guideDragState.value = {
    ...guideDragState.value,
    withinStage: pointer.withinStage
  }
  guideDraft.value = {
    orientation,
    value: orientation === 'vertical' ? pointer.clampedX : pointer.clampedY
  }
}

function finishGuideDrag() {
  if (!guideDragState.value) {
    return
  }

  const state = guideDragState.value
  const draft = guideDraft.value

  if (draft) {
    const values = getGuideValues(state.orientation)

    if (state.withinStage) {
      if (state.index === null) {
        values.push(draft.value)
      } else {
        values[state.index] = draft.value
      }

      setGuideValues(state.orientation, values)
    } else if (state.index !== null) {
      values.splice(state.index, 1)
      setGuideValues(state.orientation, values)
    }
  }

  guideDragState.value = null
  guideDraft.value = null
  emit('history-session-end')
  clearGuideListeners()
}

function clearGuideListeners() {
  window.removeEventListener('pointermove', handleGuideMove)
  window.removeEventListener('pointerup', finishGuideDrag)
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

function handleCanvasWheel(event) {
  if (!(event.ctrlKey || event.metaKey)) {
    return
  }

  event.preventDefault()

  if (event.deltaY < 0) {
    zoomIn()
    return
  }

  zoomOut()
}

onMounted(() => {
  syncGuideCollections()
  updateScale()
  resizeObserver = new ResizeObserver(() => updateScale())
  resizeObserver.observe(containerRef.value)
})

onBeforeUnmount(() => {
  stopInteraction()
  marqueeState = null
  marqueeRect.value = null
  guideDraft.value = null
  guideDragState.value = null
  clearMarqueeListeners()
  clearGuideListeners()
  resizeObserver?.disconnect()
})

watch(
  () => [props.project.meta.screenWidth, props.project.meta.screenHeight, showRulers.value],
  () => {
    syncGuideCollections()
    updateScale()
  }
)
</script>

<template>
  <main
    ref="containerRef"
    class="canvas-wrap"
    :class="{ 'canvas-wrap--runtime': runtimeMode }"
    @wheel="handleCanvasWheel"
  >
    <div v-if="showMeta" class="canvas-meta">
      <div>
        <h2>{{ project.meta.title }}</h2>
        <p>{{ project.meta.screenWidth }} x {{ project.meta.screenHeight }} 画布</p>
      </div>

      <div class="canvas-meta__actions">
        <span>{{ previewMode ? '预览中' : '编辑中' }}</span>

        <div v-if="!previewMode && !runtimeMode" class="canvas-toolset">
          <button
            class="ghost canvas-toolset__button"
            type="button"
            :class="{ 'is-active': showRulers }"
            @click="toggleRulers"
          >
            标尺
          </button>
          <button
            class="ghost canvas-toolset__button"
            type="button"
            :class="{ 'is-active': showGuides }"
            @click="toggleGuides"
          >
            参考线
          </button>
          <button
            class="ghost canvas-toolset__button"
            type="button"
            :disabled="!hasGuides"
            @click="clearGuides"
          >
            清空参考线
          </button>
        </div>

        <div class="canvas-scale">
          <button class="ghost canvas-scale__button" type="button" @click="zoomOut">-</button>
          <button
            class="ghost canvas-scale__button"
            type="button"
            :class="{ 'is-active': isFitMode }"
            @click="setFitScaleMode"
          >
            适应
          </button>
          <button
            class="ghost canvas-scale__value"
            type="button"
            :class="{ 'is-active': !isFitMode }"
            @click="resetScaleToActual"
          >
            {{ scaleLabel }}
          </button>
          <button class="ghost canvas-scale__button" type="button" @click="zoomIn">+</button>
        </div>
      </div>
    </div>

    <div
      class="canvas-stage-board"
      :class="{ 'canvas-stage-board--with-rulers': showRulers }"
      :style="boardStyle"
    >
      <div v-if="showRulers" class="canvas-ruler-corner" />

      <div
        v-if="showRulers"
        class="canvas-ruler canvas-ruler--horizontal"
        :style="{ width: `${scaledWidth}px` }"
        @pointerdown="startGuideFromRuler('vertical', $event)"
      >
        <div
          v-for="tick in horizontalRulerTicks"
          :key="`h-${tick}`"
          class="canvas-ruler__tick canvas-ruler__tick--horizontal"
          :class="{ 'is-major': tick % RULER_MAJOR_STEP === 0 }"
          :style="{ left: `${tick * scale}px` }"
        >
          <span v-if="tick % RULER_MAJOR_STEP === 0">{{ tick }}</span>
        </div>
      </div>

      <div
        v-if="showRulers"
        class="canvas-ruler canvas-ruler--vertical"
        :style="{ height: `${scaledHeight}px` }"
        @pointerdown="startGuideFromRuler('horizontal', $event)"
      >
        <div
          v-for="tick in verticalRulerTicks"
          :key="`v-${tick}`"
          class="canvas-ruler__tick canvas-ruler__tick--vertical"
          :class="{ 'is-major': tick % RULER_MAJOR_STEP === 0 }"
          :style="{ top: `${tick * scale}px` }"
        >
          <span v-if="tick % RULER_MAJOR_STEP === 0">{{ tick }}</span>
        </div>
      </div>

      <div
        class="canvas-stage-shell"
        :class="{ 'canvas-stage-shell--with-rulers': showRulers }"
        :style="scaledShellStyle"
      >
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
            :runtime-filters="runtimeFilters"
            @select="handleWidgetSelect"
            @drag-start="beginInteraction($event, 'move')"
            @resize-start="beginInteraction($event, 'resize')"
            @trigger-action="handleWidgetAction"
            @widget-command="handleWidgetCommand"
          />

          <button
            v-for="guide in verticalGuideItems"
            :key="`guide-v-${guide.index}`"
            type="button"
            class="canvas-reference-guide canvas-reference-guide--vertical"
            :style="{ left: `${guide.value}px`, color: guideColor }"
            @pointerdown="startGuideDrag('vertical', guide.index, $event)"
          />
          <button
            v-for="guide in horizontalGuideItems"
            :key="`guide-h-${guide.index}`"
            type="button"
            class="canvas-reference-guide canvas-reference-guide--horizontal"
            :style="{ top: `${guide.value}px`, color: guideColor }"
            @pointerdown="startGuideDrag('horizontal', guide.index, $event)"
          />
          <div
            v-if="showGuides && guideDraft?.orientation === 'vertical'"
            class="canvas-reference-guide canvas-reference-guide--vertical is-draft"
            :style="{ left: `${guideDraft.value}px`, color: guideColor }"
          />
          <div
            v-if="showGuides && guideDraft?.orientation === 'horizontal'"
            class="canvas-reference-guide canvas-reference-guide--horizontal is-draft"
            :style="{ top: `${guideDraft.value}px`, color: guideColor }"
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
          <div
            v-for="item in activeGuideLabels"
            :key="item.key"
            class="canvas-guide-label"
            :style="item.style"
          >
            {{ item.value }}
          </div>
          <template v-for="line in measurementLines" :key="line.key">
            <div
              class="canvas-measure-line"
              :class="`canvas-measure-line--${line.orientation}`"
              :style="line.lineStyle"
            />
            <div
              class="canvas-measure-line__cap"
              :class="`canvas-measure-line__cap--${line.orientation}`"
              :style="line.startCapStyle"
            />
            <div
              class="canvas-measure-line__cap"
              :class="`canvas-measure-line__cap--${line.orientation}`"
              :style="line.endCapStyle"
            />
            <div class="canvas-measure-line__label" :style="line.labelStyle">
              {{ line.label }}
            </div>
          </template>
          <div v-if="transformOverlay" class="canvas-transform-hud" :style="transformOverlayStyle">
            <span
              v-for="metric in transformOverlayMetrics"
              :key="metric.label"
              class="canvas-transform-hud__item"
            >
              <b>{{ metric.label }}</b>
              <strong>{{ metric.value }}</strong>
            </span>
          </div>
          <div v-if="marqueeRect" class="canvas-marquee" :style="marqueeStyle" />
        </section>
      </div>
    </div>
  </main>
</template>
