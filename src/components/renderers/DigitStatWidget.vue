<script setup>
import { computed } from 'vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  }
})

function clampDecimals(value) {
  const decimals = Math.trunc(Number(value) || 0)
  return Math.min(Math.max(decimals, 0), 4)
}

function formatNumericText(value, decimals, useGrouping) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return String(value ?? '0')
  }

  const fixedText = numericValue.toFixed(decimals)

  if (!useGrouping) {
    return fixedText
  }

  const [integerPart, decimalPart] = fixedText.split('.')
  const sign = integerPart.startsWith('-') ? '-' : ''
  const rawIntegerPart = sign ? integerPart.slice(1) : integerPart
  const groupedIntegerPart = rawIntegerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  return `${sign}${groupedIntegerPart}${decimalPart !== undefined ? `.${decimalPart}` : ''}`
}

const decimals = computed(() => clampDecimals(props.widget.props.decimals))
const numberText = computed(() =>
  formatNumericText(
    props.widget.props.value,
    decimals.value,
    props.widget.props.groupSeparator !== false
  )
)
const characters = computed(() =>
  numberText.value.split('').map((value, index) => ({
    id: `${value}-${index}`,
    value,
    isDigit: /\d/.test(value)
  }))
)
const themeStyle = computed(() => ({
  '--digit-stat-accent': props.widget.props.accent || '#46eeff',
  '--digit-stat-color': props.widget.props.color || '#ecf7ff',
  '--digit-stat-unit-color': props.widget.props.unitColor || 'rgba(235, 247, 255, 0.72)'
}))
</script>

<template>
  <div class="widget-digit-stat" :style="themeStyle">
    <div class="widget-digit-stat__head">
      <p>{{ widget.props.title }}</p>
      <span v-if="widget.props.tag">{{ widget.props.tag }}</span>
    </div>

    <div class="widget-digit-stat__body">
      <span v-if="widget.props.prefix" class="widget-digit-stat__affix">{{ widget.props.prefix }}</span>

      <div class="widget-digit-stat__digits">
        <span
          v-for="character in characters"
          :key="character.id"
          class="widget-digit-stat__char"
          :class="character.isDigit ? 'is-digit' : 'is-separator'"
        >
          {{ character.value }}
        </span>
      </div>

      <span v-if="widget.props.suffix" class="widget-digit-stat__affix">{{ widget.props.suffix }}</span>
      <span v-if="widget.props.unit" class="widget-digit-stat__unit">{{ widget.props.unit }}</span>
    </div>

    <div class="widget-digit-stat__footer">
      <span class="widget-digit-stat__line" />
      <span class="widget-digit-stat__glow" />
    </div>
  </div>
</template>
