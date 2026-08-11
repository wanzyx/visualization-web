<script setup>
import { computed, ref } from 'vue'
import InspectorSection from './inspector/InspectorSection.vue'

const props = defineProps({
  widgets: {
    type: Array,
    required: true
  },
  selectedIds: {
    type: Array,
    default: () => []
  },
  primarySelectedId: {
    type: String,
    default: null
  }
})

const emit = defineEmits([
  'select-layer',
  'toggle-layer-hidden',
  'toggle-layer-locked',
  'reorder-layer'
])

const dragState = ref({
  draggedId: null,
  overId: null,
  placement: null
})

const orderedLayers = computed(() => [...props.widgets].sort((a, b) => b.zIndex - a.zIndex))

function handleSelect(widget, event) {
  emit('select-layer', {
    widgetId: widget.id,
    additive: event.ctrlKey || event.metaKey
  })
}

function handleDragStart(widgetId) {
  dragState.value = {
    draggedId: widgetId,
    overId: null,
    placement: null
  }
}

function handleDragOver(widgetId, event) {
  if (!dragState.value.draggedId || dragState.value.draggedId === widgetId) {
    return
  }

  event.preventDefault()
  const placement = event.offsetY < event.currentTarget.clientHeight / 2 ? 'before' : 'after'

  dragState.value = {
    ...dragState.value,
    overId: widgetId,
    placement
  }
}

function handleDrop(widgetId, event) {
  event.preventDefault()

  if (!dragState.value.draggedId || dragState.value.draggedId === widgetId) {
    clearDragState()
    return
  }

  emit('reorder-layer', {
    draggedId: dragState.value.draggedId,
    targetId: widgetId,
    placement: dragState.value.placement || 'before'
  })

  clearDragState()
}

function clearDragState() {
  dragState.value = {
    draggedId: null,
    overId: null,
    placement: null
  }
}

function isSelected(widgetId) {
  return props.selectedIds.includes(widgetId)
}

function isPrimary(widgetId) {
  return props.primarySelectedId === widgetId
}

function isDropBefore(widgetId) {
  return dragState.value.overId === widgetId && dragState.value.placement === 'before'
}

function isDropAfter(widgetId) {
  return dragState.value.overId === widgetId && dragState.value.placement === 'after'
}
</script>

<template>
  <InspectorSection
    title="图层面板"
    caption="按 z-index 管理显示顺序，可拖拽调整前后层级。"
    storage-key="panel-layer"
  >
    <div class="layer-list">
      <div
        v-for="widget in orderedLayers"
        :key="widget.id"
        class="layer-item"
        :class="{
          'is-selected': isSelected(widget.id),
          'is-primary': isPrimary(widget.id),
          'is-hidden': widget.hidden,
          'is-drop-before': isDropBefore(widget.id),
          'is-drop-after': isDropAfter(widget.id)
        }"
        draggable="true"
        @dragstart="handleDragStart(widget.id)"
        @dragend="clearDragState"
        @dragover="handleDragOver(widget.id, $event)"
        @drop="handleDrop(widget.id, $event)"
      >
        <button class="layer-item__select" type="button" @click="handleSelect(widget, $event)">
          <div class="layer-item__meta">
            <span class="layer-item__name">
              {{ widget.name }}
              <b v-if="widget.groupId">G</b>
            </span>
            <span class="layer-item__subline">{{ widget.type }} / z{{ widget.zIndex }}</span>
          </div>
        </button>

        <div class="layer-item__actions">
          <span v-if="widget.locked" class="layer-item__state">锁定</span>
          <button
            class="layer-item__action"
            type="button"
            draggable="false"
            @click.stop="$emit('toggle-layer-hidden', widget.id)"
          >
            {{ widget.hidden ? '显' : '藏' }}
          </button>
          <button
            class="layer-item__action"
            type="button"
            draggable="false"
            @click.stop="$emit('toggle-layer-locked', widget.id)"
          >
            {{ widget.locked ? '解' : '锁' }}
          </button>
        </div>
      </div>
    </div>
  </InspectorSection>
</template>
