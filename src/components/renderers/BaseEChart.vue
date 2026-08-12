<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

const props = defineProps({
  option: {
    type: Object,
    required: true
  },
  runtime: {
    type: String,
    default: 'core'
  }
})
const emit = defineEmits(['chart-click'])

const chartElement = shallowRef(null)
const isChartReady = ref(false)

let chart = null
let resizeObserver = null
let disposed = false
let echartsModulePromise = null
let loadedRuntime = ''
let resizeFrameId = 0

const runtimeLoaders = {
  core: () => import('../../lib/echarts-core.js'),
  'china-map': () => import('../../lib/echarts-china-map-runtime.js')
}

function renderChart() {
  if (!chart || !props.option) {
    return
  }

  chart.setOption(props.option, {
    notMerge: true,
    lazyUpdate: true
  })
}

function scheduleResize() {
  if (!chart) {
    return
  }

  cancelAnimationFrame(resizeFrameId)
  resizeFrameId = requestAnimationFrame(() => {
    resizeFrameId = 0
    chart?.resize()
  })
}

function bindChartEvents() {
  if (!chart) {
    return
  }

  chart.off('click')
  chart.on('click', (params) => {
    emit('chart-click', params)
  })
}

async function loadECharts() {
  const runtimeKey = runtimeLoaders[props.runtime] ? props.runtime : 'core'

  if (!echartsModulePromise || loadedRuntime !== runtimeKey) {
    loadedRuntime = runtimeKey
    echartsModulePromise = runtimeLoaders[runtimeKey]()
  }

  return echartsModulePromise
}

async function initChart() {
  if (!chartElement.value) {
    return
  }

  await nextTick()

  const { echarts } = await loadECharts()

  if (disposed || !chartElement.value) {
    return
  }

  chart = echarts.getInstanceByDom(chartElement.value) ?? echarts.init(chartElement.value, null, {
    renderer: 'canvas'
  })

  isChartReady.value = true
  bindChartEvents()
  renderChart()

  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => {
    scheduleResize()
  })
  resizeObserver.observe(chartElement.value)
}

watch(
  () => props.option,
  () => {
    renderChart()
    scheduleResize()
  },
  { deep: true }
)

onMounted(() => {
  initChart().catch((error) => {
    console.warn('Failed to initialize ECharts widget:', error)
  })
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(resizeFrameId)
  resizeObserver?.disconnect()
  resizeObserver = null
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div class="widget-echart">
    <div ref="chartElement" class="widget-echart__canvas" />
    <div v-if="!isChartReady" class="widget-echart__loading">Loading chart...</div>
  </div>
</template>
