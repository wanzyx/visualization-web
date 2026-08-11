<script setup>
defineProps({
  previewMode: {
    type: Boolean,
    default: false
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
  }
})

defineEmits([
  'toggle-preview',
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
  'undo',
  'redo'
])
</script>

<template>
  <header class="toolbar">
    <div class="toolbar__brand">
      <div class="toolbar__logo">DV</div>
      <div>
        <p class="toolbar__eyebrow">Vue 3 + Vite</p>
        <h1>大屏低代码编辑器</h1>
      </div>
    </div>

    <div class="toolbar__actions">
      <span v-if="selectionCount" class="toolbar__selection-chip">已选 {{ selectionCount }} 项</span>
      <button class="ghost" :disabled="!canUndo" @click="$emit('undo')">撤销</button>
      <button class="ghost" :disabled="!canRedo" @click="$emit('redo')">重做</button>
      <button class="ghost" @click="$emit('reset-project')">恢复示例</button>
      <button class="ghost" @click="$emit('import-project')">导入 JSON</button>
      <button class="ghost" @click="$emit('export-project')">导出 JSON</button>
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
        {{ previewMode ? '退出预览' : '预览模式' }}
      </button>
    </div>
  </header>
</template>
