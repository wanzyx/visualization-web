<script setup>
import { computed } from 'vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  }
})

const items = computed(() => {
  const source = Array.isArray(props.widget.props.items) ? props.widget.props.items : []

  return source
    .map((item) => ({
      name: String(item?.name ?? '').trim(),
      value: Number(item?.value ?? 0)
    }))
    .filter((item) => item.name)
    .sort((left, right) => right.value - left.value)
})

const maxValue = computed(() =>
  items.value.length ? Math.max(...items.value.map((item) => item.value), 1) : 1
)

function getBarWidth(value) {
  return `${Math.max((value / maxValue.value) * 100, 8)}%`
}

function getRankLabel(index) {
  return String(index + 1).padStart(2, '0')
}

function getItemValue(value) {
  const unit = String(props.widget.props.unit || '').trim()
  return unit ? `${value}${unit}` : String(value)
}
</script>

<template>
  <div class="widget-ranking">
    <div class="widget-chart__header">
      <h3>{{ widget.props.title }}</h3>
    </div>

    <div class="widget-ranking__list">
      <article v-for="(item, index) in items" :key="`${item.name}-${index}`" class="widget-ranking__item">
        <span class="widget-ranking__order" :class="{ 'is-top': index < 3 }">
          {{ getRankLabel(index) }}
        </span>

        <div class="widget-ranking__content">
          <div class="widget-ranking__meta">
            <strong>{{ item.name }}</strong>
            <span>{{ getItemValue(item.value) }}</span>
          </div>

          <div class="widget-ranking__track">
            <span
              class="widget-ranking__bar"
              :style="{
                width: getBarWidth(item.value),
                background: `linear-gradient(90deg, ${widget.props.accent}, rgba(255, 255, 255, 0.12))`
              }"
            />
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
