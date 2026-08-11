<script setup>
import { computed } from 'vue'
import BaseEChart from './BaseEChart.vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  }
})

const labels = computed(() => {
  const source = Array.isArray(props.widget.props.labels) ? props.widget.props.labels : []

  return source.filter(Boolean)
})

const values = computed(() => {
  const source = Array.isArray(props.widget.props.values) ? props.widget.props.values : []

  return labels.value.map((_, index) => Number(source[index] ?? 0))
})

const option = computed(() => ({
  animationDuration: 650,
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(4, 11, 22, 0.94)',
    borderColor: 'rgba(72, 220, 255, 0.16)',
    textStyle: {
      color: '#eff8ff'
    }
  },
  grid: {
    top: 18,
    right: 8,
    bottom: 22,
    left: 8,
    containLabel: true
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: labels.value,
    axisTick: {
      show: false
    },
    axisLine: {
      lineStyle: {
        color: 'rgba(255, 255, 255, 0.08)'
      }
    },
    axisLabel: {
      color: 'rgba(235, 247, 255, 0.68)',
      fontSize: 11
    }
  },
  yAxis: {
    type: 'value',
    splitNumber: 4,
    axisLine: {
      show: false
    },
    axisTick: {
      show: false
    },
    axisLabel: {
      color: 'rgba(235, 247, 255, 0.56)',
      fontSize: 11
    },
    splitLine: {
      lineStyle: {
        color: 'rgba(255, 255, 255, 0.08)'
      }
    }
  },
  series: [
    {
      type: 'line',
      data: values.value,
      smooth: true,
      showSymbol: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: {
        width: 3,
        color: props.widget.props.color
      },
      itemStyle: {
        color: props.widget.props.color,
        borderColor: '#eff8ff',
        borderWidth: 2
      },
      areaStyle: {
        color: props.widget.props.areaColor
      }
    }
  ]
}))
</script>

<template>
  <div class="widget-chart">
    <div class="widget-chart__header">
      <h3>{{ widget.props.title }}</h3>
    </div>

    <div class="widget-chart__body">
      <BaseEChart :option="option" />
    </div>
  </div>
</template>

