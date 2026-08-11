<script setup>
import PagePanel from './PagePanel.vue'

defineProps({
  pages: {
    type: Array,
    default: () => []
  },
  activePageId: {
    type: String,
    default: ''
  },
  canDeletePage: {
    type: Boolean,
    default: false
  },
  materials: {
    type: Array,
    required: true
  },
  templates: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'select-page',
  'create-page',
  'duplicate-page',
  'delete-page',
  'add-widget',
  'add-template',
  'remove-template'
])

function startDrag(event, payload) {
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/widget-source', JSON.stringify(payload))

  if (payload.kind === 'material') {
    event.dataTransfer.setData('application/widget-type', payload.type)
  }
}

function describeTemplate(template) {
  const count = template.preview?.count ?? template.widgets?.length ?? 0
  const width = template.preview?.width ?? 0
  const height = template.preview?.height ?? 0

  return `${count} 个组件 · ${width} x ${height}`
}
</script>

<template>
  <aside class="side-panel side-panel--left">
    <div class="panel-header panel-header--hero">
      <span class="panel-header__eyebrow">Materials</span>
      <h2>组件物料台</h2>
      <p>先选页面，再从基础组件和模板库里快速拼出大屏布局。</p>
    </div>

    <PagePanel
      :pages="pages"
      :active-page-id="activePageId"
      :can-delete-page="canDeletePage"
      @select-page="emit('select-page', $event)"
      @create-page="emit('create-page')"
      @duplicate-page="emit('duplicate-page', $event)"
      @delete-page="emit('delete-page', $event)"
    />

    <section class="material-section">
      <div class="material-section__header">
        <div>
          <h3>基础组件</h3>
          <p class="material-section__caption">适合快速搭建标题、图表、指标卡和装饰面板。</p>
        </div>
        <span>{{ materials.length }} 项</span>
      </div>

      <div class="material-list">
        <button
          v-for="item in materials"
          :key="item.type"
          class="material-card"
          draggable="true"
          @dragstart="startDrag($event, { kind: 'material', type: item.type })"
          @click="emit('add-widget', item.type)"
        >
          <span class="material-card__icon">{{ item.icon }}</span>
          <span class="material-card__label">{{ item.label }}</span>
          <span class="material-card__description">{{ item.description }}</span>
          <span class="material-card__hint">点击添加 / 拖拽到画布</span>
        </button>
      </div>
    </section>

    <section class="material-section">
      <div class="material-section__header">
        <div>
          <h3>自定义模板</h3>
          <p class="material-section__caption">把常用布局沉淀下来，后续复用更快。</p>
        </div>
        <span>{{ templates.length }} 项</span>
      </div>

      <div v-if="templates.length" class="material-list">
        <div v-for="template in templates" :key="template.id" class="template-card">
          <button
            class="material-card material-card--template"
            draggable="true"
            @dragstart="startDrag($event, { kind: 'template', templateId: template.id })"
            @click="emit('add-template', template.id)"
          >
            <div class="material-card__meta">
              <span class="material-card__icon">Tpl</span>
              <span class="material-card__badge">模板</span>
            </div>
            <span class="material-card__label">{{ template.name }}</span>
            <span class="material-card__description">{{ describeTemplate(template) }}</span>
            <span class="material-card__hint">拖拽整组布局到当前页面</span>
          </button>

          <button class="template-card__remove" @click="emit('remove-template', template.id)">
            删除
          </button>
        </div>
      </div>

      <div v-else class="material-empty">
        <span>选中画布上的组件后，点击顶部“保存模板”即可沉淀成可复用模板。</span>
      </div>
    </section>

    <div class="panel-tip panel-tip--accent">
      <p>工作流建议</p>
      <span>先搭页面结构，再绑定数据源，最后通过事件联动完成跳页和高亮交互。</span>
    </div>
  </aside>
</template>
