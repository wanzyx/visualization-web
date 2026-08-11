<script setup>
import { computed } from 'vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  }
})

const textStyle = computed(() => ({
  justifyContent:
    props.widget.props.align === 'center'
      ? 'center'
      : props.widget.props.align === 'right'
        ? 'flex-end'
        : 'flex-start',
  textAlign: props.widget.props.align,
  color: props.widget.props.color,
  fontSize: `${props.widget.props.fontSize}px`,
  fontWeight: props.widget.props.fontWeight,
  letterSpacing: `${props.widget.props.letterSpacing}px`,
  textShadow: props.widget.props.shadow ? '0 0 24px rgba(67, 231, 255, 0.28)' : 'none'
}))
</script>

<template>
  <div class="widget-text" :style="textStyle">
    <span>{{ widget.props.text }}</span>
  </div>
</template>

