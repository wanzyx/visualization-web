<script setup>
defineProps({
  materials: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['add-widget'])

function onDragStart(event, type) {
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/widget-type', type)
}
</script>

<template>
  <aside class="side-panel side-panel--left">
    <div class="panel-header">
      <h2>组件物料</h2>
      <p>拖入中间画布，或点击直接添加到画布中心区域。</p>
    </div>

    <div class="material-list">
      <button
        v-for="item in materials"
        :key="item.type"
        class="material-card"
        draggable="true"
        @dragstart="onDragStart($event, item.type)"
        @click="emit('add-widget', item.type)"
      >
        <span class="material-card__icon">{{ item.icon }}</span>
        <span class="material-card__label">{{ item.label }}</span>
        <span class="material-card__description">{{ item.description }}</span>
      </button>
    </div>

    <div class="panel-tip">
      <p>快捷键</p>
      <span>Delete 删除，方向键微调，Ctrl/Cmd + D 复制。</span>
    </div>
  </aside>
</template>

