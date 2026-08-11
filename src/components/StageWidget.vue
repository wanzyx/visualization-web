<script setup>
import { computed, defineAsyncComponent } from 'vue'
import TextWidget from './renderers/TextWidget.vue'
import StatWidget from './renderers/StatWidget.vue'
import PanelWidget from './renderers/PanelWidget.vue'
import { getInteractionActions } from '../editor/project'

const BarChartWidget = defineAsyncComponent(() => import('./renderers/BarChartWidget.vue'))
const LineChartWidget = defineAsyncComponent(() => import('./renderers/LineChartWidget.vue'))
const GaugeWidget = defineAsyncComponent(() => import('./renderers/GaugeWidget.vue'))

const props = defineProps({
  widget: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  },
  primarySelected: {
    type: Boolean,
    default: false
  },
  previewMode: {
    type: Boolean,
    default: false
  },
  canResize: {
    type: Boolean,
    default: false
  },
  canMove: {
    type: Boolean,
    default: true
  },
  linkedActive: {
    type: Boolean,
    default: false
  },
  dataSourceRuntime: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['select', 'drag-start', 'resize-start', 'trigger-action'])

const componentMap = {
  text: TextWidget,
  stat: StatWidget,
  barChart: BarChartWidget,
  lineChart: LineChartWidget,
  gauge: GaugeWidget,
  panel: PanelWidget
}

const widgetStyle = computed(() => ({
  left: `${props.widget.x}px`,
  top: `${props.widget.y}px`,
  width: `${props.widget.w}px`,
  height: `${props.widget.h}px`,
  zIndex: props.widget.zIndex,
  opacity: props.widget.style.opacity,
  transform: `rotate(${props.widget.style.rotate}deg)`
}))

const frameStyle = computed(() => ({
  background: props.widget.style.background,
  borderColor: props.widget.style.borderColor,
  borderRadius: `${props.widget.style.radius}px`,
  padding: `${props.widget.style.padding}px`
}))

const renderer = computed(() => componentMap[props.widget.type] || PanelWidget)
const interactionActions = computed(() =>
  getInteractionActions(props.widget.interaction).filter((action) => action.action !== 'none')
)
const interactive = computed(() => props.previewMode && interactionActions.value.length > 0)

const interactionLabelMap = {
  'highlight-widgets': '联动高亮',
  'refresh-sources': '刷新数据',
  'switch-page': '切换页面',
  'show-widgets': '显示组件',
  'hide-widgets': '隐藏组件',
  'toggle-widgets-visibility': '切换显隐'
}

const interactionLabel = computed(() => {
  if (interactionActions.value.length > 1) {
    return `${interactionActions.value.length} 个动作`
  }

  return interactionLabelMap[interactionActions.value[0]?.action] ?? ''
})

const displayWidget = computed(() => {
  const sourceId = props.widget.dataBinding?.sourceId

  if (!sourceId) {
    return props.widget
  }

  const runtimePayload = props.dataSourceRuntime[sourceId]?.payload

  if (!runtimePayload) {
    return props.widget
  }

  return {
    ...props.widget,
    props: {
      ...props.widget.props,
      ...runtimePayload
    }
  }
})

function handleSelect(event) {
  if (props.previewMode) {
    return
  }

  emit('select', {
    widgetId: props.widget.id,
    event
  })
}

function handleDragStart(event) {
  if (props.previewMode) {
    return
  }

  emit('drag-start', {
    widgetId: props.widget.id,
    event
  })
}

function handleResizeStart(event) {
  if (props.previewMode) {
    return
  }

  emit('resize-start', {
    widgetId: props.widget.id,
    event
  })
}

function handleFramePointerDown(event) {
  if (props.previewMode) {
    return
  }

  event.preventDefault()

  if (props.canMove) {
    handleDragStart(event)
    return
  }

  handleSelect(event)
}

function handleFrameClick(event) {
  if (!props.previewMode || !interactionActions.value.length) {
    return
  }

  emit('trigger-action', {
    widgetId: props.widget.id,
    event
  })
}
</script>

<template>
  <div
    class="stage-widget"
    :class="{
      'is-selected': selected,
      'is-primary': primarySelected,
      'is-grouped': Boolean(widget.groupId),
      'is-locked': widget.locked,
      'is-linked-active': linkedActive,
      'is-interactive': interactive
    }"
    :style="widgetStyle"
  >
    <div
      class="stage-widget__frame"
      :style="frameStyle"
      @pointerdown.stop="handleFramePointerDown"
      @click.stop="handleFrameClick"
    >
      <component :is="renderer" :widget="displayWidget" />
      <span v-if="!previewMode" class="stage-widget__name">{{ widget.name }}</span>
      <span v-if="widget.groupId && !previewMode" class="stage-widget__group-badge">G</span>
      <span v-if="widget.locked && !previewMode" class="stage-widget__lock-badge">锁定</span>
      <span v-if="widget.dataBinding?.sourceId && !previewMode" class="stage-widget__data-badge">数据</span>
      <span v-if="interactionLabel && !previewMode" class="stage-widget__action-badge">
        {{ interactionLabel }}
      </span>
      <button
        v-if="canResize && !previewMode"
        class="stage-widget__resize-handle"
        @pointerdown.stop.prevent="handleResizeStart"
      />
    </div>
  </div>
</template>
