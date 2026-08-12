<script setup>
import { computed } from 'vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  }
})

const title = computed(() => String(props.widget.props.title || '').trim())
const subtitle = computed(() => String(props.widget.props.subtitle || '').trim())
const tag = computed(() => String(props.widget.props.tag || '').trim())
const align = computed(() => String(props.widget.props.align || 'left').trim() || 'left')
const showLine = computed(() => props.widget.props.showLine !== false)
const showGlow = computed(() => props.widget.props.showGlow !== false)
const accent = computed(() => String(props.widget.props.accent || '#46eeff').trim() || '#46eeff')

const titleBarStyle = computed(() => ({
  '--titlebar-accent': accent.value,
  '--titlebar-glow': showGlow.value ? `${accent.value}44` : 'transparent'
}))
</script>

<template>
  <div class="widget-titlebar" :class="`is-${align}`" :style="titleBarStyle">
    <div class="widget-titlebar__copy">
      <span v-if="tag" class="widget-titlebar__tag">{{ tag }}</span>
      <h3>{{ title || widget.name }}</h3>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>

    <div v-if="showLine" class="widget-titlebar__line">
      <span class="widget-titlebar__line-core" />
      <span class="widget-titlebar__line-fade" />
    </div>
  </div>
</template>
