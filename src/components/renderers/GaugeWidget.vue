<script setup>
import { computed } from 'vue'
import BaseEChart from './BaseEChart.vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  }
})

const option = computed(() => {
  const safeValue = Math.max(0, Math.min(100, Number(props.widget.props.value ?? 0)))

  return {
    animationDuration: 700,
    series: [
      {
        type: 'gauge',
        center: ['50%', '54%'],
        radius: '96%',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        pointer: {
          show: false
        },
        progress: {
          show: true,
          roundCap: true,
          clip: false,
          width: 16,
          itemStyle: {
            color: props.widget.props.color
          }
        },
        axisLine: {
          lineStyle: {
            width: 16,
            color: [[1, props.widget.props.trackColor]]
          }
        },
        splitLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          show: false
        },
        anchor: {
          show: false
        },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '10%'],
          formatter: '{value}%',
          color: '#eff8ff',
          fontSize: 36,
          fontWeight: 700
        },
        title: {
          offsetCenter: [0, '46%'],
          color: 'rgba(235, 247, 255, 0.68)',
          fontSize: 14
        },
        data: [
          {
            value: safeValue,
            name: props.widget.props.title
          }
        ]
      }
    ]
  }
})
</script>

<template>
  <div class="widget-gauge-chart">
    <BaseEChart :option="option" />
  </div>
</template>

