<script setup>
import { computed } from 'vue'

const props = defineProps({
  previewMode: {
    type: Boolean,
    default: false
  },
  pages: {
    type: Array,
    default: () => []
  },
  activePageId: {
    type: String,
    default: ''
  },
  canOperate: {
    type: Boolean,
    default: false
  },
  selectionCount: {
    type: Number,
    default: 0
  },
  canGroup: {
    type: Boolean,
    default: false
  },
  canUngroup: {
    type: Boolean,
    default: false
  },
  canUndo: {
    type: Boolean,
    default: false
  },
  canRedo: {
    type: Boolean,
    default: false
  },
  canSaveTemplate: {
    type: Boolean,
    default: false
  },
  hasDataSources: {
    type: Boolean,
    default: false
  },
  runtimeMode: {
    type: Boolean,
    default: false
  }
})

defineEmits([
  'toggle-preview',
  'open-runtime',
  'copy-runtime-link',
  'select-page',
  'reset-project',
  'export-project',
  'import-project',
  'duplicate-selected',
  'delete-selected',
  'bring-to-front',
  'send-to-back',
  'group-selected',
  'ungroup-selected',
  'save-selection-template',
  'refresh-data-sources',
  'undo',
  'redo'
])

const activePageName = computed(() =>
  props.pages.find((page) => page.id === props.activePageId)?.name ?? '未命名页面'
)

const modeLabel = computed(() => (props.previewMode ? '预览模式' : '编辑模式'))
const selectionLabel = computed(() => (props.selectionCount ? `已选 ${props.selectionCount} 项` : '未选中'))
</script>

<template>
  <header class="toolbar">
    <div class="toolbar__main">
      <div class="toolbar__brand-card">
        <div class="toolbar__brand">
          <div class="toolbar__logo">DV</div>
          <div class="toolbar__brand-copy">
            <p class="toolbar__eyebrow">Vue 3 + Vite</p>
            <h1>大屏低代码编辑器</h1>
            <p class="toolbar__description">拖拽搭建、数据联动、预览发布一体化工作台</p>
          </div>
        </div>

        <div class="toolbar__stats">
          <div class="toolbar__metric">
            <span>当前模式</span>
            <strong>{{ modeLabel }}</strong>
          </div>
          <div class="toolbar__metric">
            <span>活动页面</span>
            <strong>{{ activePageName }}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="toolbar__control-row">
      <div class="toolbar__control-meta">
        <label v-if="pages.length" class="toolbar__page-switch">
          <span>页面切换</span>
          <select :value="activePageId" @change="$emit('select-page', $event.target.value)">
            <option v-for="page in pages" :key="page.id" :value="page.id">
              {{ page.name }}
            </option>
          </select>
        </label>

        <span class="toolbar__selection-chip">{{ selectionLabel }}</span>
      </div>

      <div class="toolbar__actions">
        <div class="toolbar__action-group">
          <button class="ghost" :disabled="!canUndo" @click="$emit('undo')">撤销</button>
          <button class="ghost" :disabled="!canRedo" @click="$emit('redo')">重做</button>
          <button class="ghost" @click="$emit('import-project')">导入 JSON</button>
          <button class="ghost" @click="$emit('export-project')">导出 JSON</button>
          <button class="ghost" @click="$emit('reset-project')">恢复示例</button>
        </div>

        <div class="toolbar__action-group">
          <button class="ghost" @click="$emit('copy-runtime-link')">复制运行地址</button>
          <button class="ghost" @click="$emit('open-runtime')">
            {{ runtimeMode ? '运行页已打开' : '打开运行页' }}
          </button>
          <button class="ghost" :disabled="!hasDataSources" @click="$emit('refresh-data-sources')">
            刷新数据
          </button>
        </div>

        <div class="toolbar__action-group toolbar__action-group--editing">
          <button class="ghost" :disabled="!canGroup" @click="$emit('group-selected')">编组</button>
          <button class="ghost" :disabled="!canUngroup" @click="$emit('ungroup-selected')">取消编组</button>
          <button class="ghost" :disabled="!canOperate" @click="$emit('send-to-back')">下移图层</button>
          <button class="ghost" :disabled="!canOperate" @click="$emit('bring-to-front')">上移图层</button>
          <button class="ghost" :disabled="!canOperate" @click="$emit('duplicate-selected')">复制组件</button>
          <button class="ghost" :disabled="!canSaveTemplate" @click="$emit('save-selection-template')">
            保存模板
          </button>
          <button class="ghost danger" :disabled="!canOperate" @click="$emit('delete-selected')">删除组件</button>
          <button class="primary" @click="$emit('toggle-preview')">
            {{ previewMode ? '退出预览' : '进入预览' }}
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
