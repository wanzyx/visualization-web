<script setup>
import { computed, defineAsyncComponent } from 'vue'
import TextWidget from './renderers/TextWidget.vue'
import StatWidget from './renderers/StatWidget.vue'
import PanelWidget from './renderers/PanelWidget.vue'

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
  }
})

const emit = defineEmits(['select', 'drag-start', 'resize-start'])

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
</script>

<template>
  <div
    class="stage-widget"
    :class="{
      'is-selected': selected,
      'is-primary': primarySelected,
      'is-grouped': Boolean(widget.groupId)
    }"
    :style="widgetStyle"
    @click.stop="handleSelect"
  >
    <div class="stage-widget__frame" :style="frameStyle" @pointerdown.stop.prevent="handleDragStart">
      <component :is="renderer" :widget="widget" />
      <span v-if="!previewMode" class="stage-widget__name">{{ widget.name }}</span>
      <span v-if="widget.groupId && !previewMode" class="stage-widget__group-badge">G</span>
      <button
        v-if="canResize && !previewMode"
        class="stage-widget__resize-handle"
        @pointerdown.stop.prevent="handleResizeStart"
      />
    </div>
  </div>
</template>
