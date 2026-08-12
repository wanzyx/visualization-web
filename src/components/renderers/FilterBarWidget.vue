<script setup>
import { computed } from 'vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  },
  previewMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['widget-command'])

const options = computed(() =>
  (Array.isArray(props.widget.props.options) ? props.widget.props.options : [])
    .map((item, index) => ({
      label: String(item?.label ?? `选项 ${index + 1}`).trim() || `选项 ${index + 1}`,
      value: String(item?.value ?? '').trim() || String(index + 1),
      count: Number(item?.count ?? 0)
    }))
    .filter((item) => item.label && item.value)
)

const activeValue = computed(() => String(props.widget.props.activeValue ?? '').trim())

const themeStyle = computed(() => ({
  '--filter-bar-accent': String(props.widget.props.accent || '#46eeff').trim() || '#46eeff',
  '--filter-bar-secondary':
    String(props.widget.props.secondaryColor || 'rgba(123, 254, 203, 0.16)').trim() ||
    'rgba(123, 254, 203, 0.16)'
}))

function stopPointer(event) {
  event.stopPropagation()
}

function emitFilter(value, label = '') {
  emit('widget-command', {
    command: 'apply-filter',
    value,
    label
  })
}

function handleOptionClick(option, event) {
  event.stopPropagation()

  if (!props.previewMode) {
    return
  }

  const isActive = activeValue.value === option.value
  const allowClear = props.widget.props.allowClear !== false
  emitFilter(isActive && allowClear ? '' : option.value, option.label)
}

function clearFilter(event) {
  event.stopPropagation()

  if (!props.previewMode) {
    return
  }

  emitFilter('', '')
}
</script>

<template>
  <div class="widget-filter-bar" :style="themeStyle">
    <div v-if="widget.props.showTitle !== false || (options.length && widget.props.allowClear !== false)" class="widget-filter-bar__head">
      <strong v-if="widget.props.showTitle !== false">{{ widget.props.title || widget.name }}</strong>
      <button
        v-if="widget.props.allowClear !== false && activeValue"
        type="button"
        class="widget-filter-bar__clear"
        @pointerdown.stop="stopPointer"
        @click.stop="clearFilter"
      >
        清空
      </button>
    </div>

    <div v-if="options.length" class="widget-filter-bar__options">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="widget-filter-bar__option"
        :class="{ 'is-active': activeValue === option.value }"
        @pointerdown.stop="stopPointer"
        @click.stop="handleOptionClick(option, $event)"
      >
        <span>{{ option.label }}</span>
        <small v-if="option.count > 0">{{ option.count }}</small>
      </button>
    </div>

    <div v-else class="widget-tab-panel__empty">
      <span>请在属性面板中配置筛选项</span>
    </div>
  </div>
</template>
