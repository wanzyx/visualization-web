<script setup>
import StageCanvas from './StageCanvas.vue'

defineProps({
  project: {
    type: Object,
    required: true
  },
  page: {
    type: Object,
    default: null
  },
  pages: {
    type: Array,
    default: () => []
  },
  activePageId: {
    type: String,
    default: ''
  },
  linkedWidgetIds: {
    type: Array,
    default: () => []
  },
  dataSourceRuntime: {
    type: Object,
    default: () => ({})
  }
})

defineEmits(['select-page', 'exit-runtime', 'copy-runtime-link', 'trigger-widget-action'])
</script>

<template>
  <div class="runtime-shell">
    <header class="runtime-toolbar">
      <div class="runtime-toolbar__brand">
        <p>Runtime View</p>
        <h1>{{ page?.meta?.title || '运行大屏' }}</h1>
      </div>

      <div class="runtime-toolbar__actions">
        <button class="ghost" @click="$emit('copy-runtime-link')">复制运行地址</button>
        <button class="primary" @click="$emit('exit-runtime')">返回编辑</button>
      </div>
    </header>

    <nav v-if="pages.length > 1" class="runtime-page-nav">
      <button
        v-for="item in pages"
        :key="item.id"
        class="runtime-page-nav__item"
        :class="{ 'is-active': item.id === activePageId }"
        @click="$emit('select-page', item.id)"
      >
        <span>{{ item.name }}</span>
        <small>{{ item.widgets.length }} 组件</small>
      </button>
    </nav>

    <div class="runtime-shell__canvas">
      <StageCanvas
        :project="project"
        :selected-ids="[]"
        :primary-selected-id="null"
        :preview-mode="true"
        :linked-widget-ids="linkedWidgetIds"
        :data-source-runtime="dataSourceRuntime"
        :show-meta="false"
        :runtime-mode="true"
        @trigger-widget-action="$emit('trigger-widget-action', $event)"
      />
    </div>
  </div>
</template>
