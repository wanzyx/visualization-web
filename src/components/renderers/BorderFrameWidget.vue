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
const badge = computed(() => String(props.widget.props.badge || '').trim())
const showHeader = computed(() => props.widget.props.showHeader !== false)
const showGrid = computed(() => props.widget.props.showGrid !== false)
const showGlow = computed(() => props.widget.props.showGlow !== false)
const accent = computed(() => String(props.widget.props.accent || '#46eeff').trim() || '#46eeff')
const secondaryColor = computed(
  () => String(props.widget.props.secondaryColor || '#7bfecb').trim() || '#7bfecb'
)

const frameStyle = computed(() => ({
  '--frame-accent': accent.value,
  '--frame-secondary': secondaryColor.value,
  '--frame-glow': showGlow.value ? `${accent.value}44` : 'transparent'
}))
</script>

<template>
  <div class="widget-border-frame" :class="{ 'has-grid': showGrid, 'has-glow': showGlow }" :style="frameStyle">
    <div v-if="showGrid" class="widget-border-frame__grid" />

    <div v-if="showHeader && (title || subtitle || badge)" class="widget-border-frame__header">
      <div class="widget-border-frame__copy">
        <strong>{{ title || widget.name }}</strong>
        <span v-if="subtitle">{{ subtitle }}</span>
      </div>
      <em v-if="badge" class="widget-border-frame__badge">{{ badge }}</em>
    </div>

    <span class="widget-border-frame__corner widget-border-frame__corner--lt" />
    <span class="widget-border-frame__corner widget-border-frame__corner--rt" />
    <span class="widget-border-frame__corner widget-border-frame__corner--lb" />
    <span class="widget-border-frame__corner widget-border-frame__corner--rb" />
    <span class="widget-border-frame__edge widget-border-frame__edge--top" />
    <span class="widget-border-frame__edge widget-border-frame__edge--right" />
    <span class="widget-border-frame__edge widget-border-frame__edge--bottom" />
    <span class="widget-border-frame__edge widget-border-frame__edge--left" />
  </div>
</template>
