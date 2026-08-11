<script setup>
defineProps({
  widget: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <div class="widget-panel">
    <div class="widget-panel__decoration" />
    <p class="widget-panel__subtitle">{{ widget.props.subtitle }}</p>
    <h3>{{ widget.props.title }}</h3>
    <p class="widget-panel__content">{{ widget.props.content }}</p>
  </div>
</template>

