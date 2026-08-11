<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

const props = defineProps({
  option: {
    type: Object,
    required: true
  }
})

const chartElement = shallowRef(null)
const isChartReady = ref(false)

let chart = null
let resizeObserver = null
let disposed = false
let echartsModulePromise = null

function renderChart() {
  if (!chart || !props.option) {
    return
  }

  chart.setOption(props.option, true)
}

async function loadECharts() {
  if (!echartsModulePromise) {
    echartsModulePromise = import('../../lib/echarts-runtime.js')
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
  renderChart()

  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => {
    chart?.resize()
  })
  resizeObserver.observe(chartElement.value)
}

watch(
  () => props.option,
  () => {
    renderChart()
    chart?.resize()
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
