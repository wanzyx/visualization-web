<script setup>
import { computed } from 'vue'
import DataSourcePanel from './DataSourcePanel.vue'
import HistoryPanel from './HistoryPanel.vue'
import LayerPanel from './LayerPanel.vue'
import InspectorSection from './inspector/InspectorSection.vue'
import SchemaFields from './inspector/SchemaFields.vue'
import {
  baseFields,
  createPageFields,
  createWidgetFields,
  getWidgetSectionTitle,
  interactionActionOptions,
  styleFields
} from '../editor/inspectorSchemas'

const props = defineProps({
  page: {
    type: Object,
    default: null
  },
  project: {
    type: Object,
    required: true
  },
  pages: {
    type: Array,
    default: () => []
  },
  currentPageId: {
    type: String,
    default: ''
  },
  selectedWidget: {
    type: Object,
    default: null
  },
  selectedWidgets: {
    type: Array,
    default: () => []
  },
  selectedBounds: {
    type: Object,
    default: null
  },
  selectedIds: {
    type: Array,
    default: () => []
  },
  primarySelectedId: {
    type: String,
    default: null
  },
  currentHistoryLabel: {
    type: String,
    default: '当前项目'
  },
  undoEntries: {
    type: Array,
    default: () => []
  },
  redoEntries: {
    type: Array,
    default: () => []
  },
  canUndo: {
    type: Boolean,
    default: false
  },
  canRedo: {
    type: Boolean,
    default: false
  },
  dataSourceRuntime: {
    type: Object,
    default: () => ({})
  },
  sourceBindingCounts: {
    type: Object,
    default: () => ({})
  }
})

defineEmits([
  'select-layer',
  'toggle-layer-hidden',
  'toggle-layer-locked',
  'reorder-layer',
  'set-selected-hidden',
  'set-selected-locked',
  'align-selected',
  'distribute-selected',
  'create-source',
  'delete-source',
  'refresh-source',
  'refresh-all-sources',
  'change-source-type',
  'update-source-payload',
  'undo',
  'redo'
])

const commonGroupId = computed(() => {
  if (props.selectedWidgets.length < 2) {
    return null
  }

  const firstGroupId = props.selectedWidgets[0]?.groupId

  if (!firstGroupId) {
    return null
  }

  return props.selectedWidgets.every((item) => item.groupId === firstGroupId) ? firstGroupId : null
})

const editableSelectedCount = computed(
  () => props.selectedWidgets.filter((item) => !item.locked && !item.hidden).length
)

const compatibleSources = computed(() => {
  if (!props.selectedWidget) {
    return []
  }

  return props.project.dataSources.filter((source) => source.type === props.selectedWidget.type)
})

const currentBoundSource = computed(() => {
  if (!props.selectedWidget?.dataBinding?.sourceId) {
    return null
  }

  return props.project.dataSources.find((source) => source.id === props.selectedWidget.dataBinding.sourceId) ?? null
})

const currentBoundRuntime = computed(() => {
  const sourceId = props.selectedWidget?.dataBinding?.sourceId
  return sourceId ? props.dataSourceRuntime[sourceId] ?? null : null
})

const otherWidgets = computed(() => {
  if (!props.selectedWidget) {
    return []
  }

  return props.project.widgets.filter((widget) => widget.id !== props.selectedWidget.id)
})

const availableTargetPages = computed(() =>
  props.pages.filter((item) => item.id !== props.currentPageId)
)

const panelTitle = computed(() => {
  if (props.selectedWidgets.length > 1) {
    return '多选概览'
  }

  if (props.selectedWidget) {
    return `${props.selectedWidget.name} 属性`
  }

  return '页面配置'
})

const panelDescription = computed(() => {
  if (props.selectedWidgets.length > 1) {
    return '批量查看选区尺寸、组件数量和编组状态，并快速执行批量操作。'
  }

  if (props.selectedWidget) {
    return '通过可折叠分组和独立 schema 配置管理组件基础属性、样式、数据和联动。'
  }

  return '未选中组件时，在这里配置页面尺寸、背景样式和全局画布参数。'
})

const clickAction = computed({
  get: () => props.selectedWidget?.interaction?.clickAction ?? 'none',
  set: (value) => {
    if (!props.selectedWidget) {
      return
    }

    ensureInteraction()
    props.selectedWidget.interaction.clickAction = value
  }
})

const targetPageId = computed({
  get: () => props.selectedWidget?.interaction?.targetPageId ?? '',
  set: (value) => {
    if (!props.selectedWidget) {
      return
    }

    ensureInteraction()
    props.selectedWidget.interaction.targetPageId = value
  }
})

const barCategories = computed({
  get: () => props.selectedWidget?.props.categories?.join('\n') ?? '',
  set: (value) => {
    if (!props.selectedWidget) {
      return
    }

    props.selectedWidget.props.categories = value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  }
})

const barValues = computed({
  get: () => props.selectedWidget?.props.values?.join(', ') ?? '',
  set: (value) => {
    if (!props.selectedWidget) {
      return
    }

    props.selectedWidget.props.values = toNumberList(value)
  }
})

const lineLabels = computed({
  get: () => props.selectedWidget?.props.labels?.join('\n') ?? '',
  set: (value) => {
    if (!props.selectedWidget) {
      return
    }

    props.selectedWidget.props.labels = value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  }
})

const lineValues = computed({
  get: () => props.selectedWidget?.props.values?.join(', ') ?? '',
  set: (value) => {
    if (!props.selectedWidget) {
      return
    }

    props.selectedWidget.props.values = toNumberList(value)
  }
})

const pageFields = computed(() =>
  createPageFields({
    page: props.page,
    project: props.project
  })
)

const widgetFields = computed(() =>
  createWidgetFields({
    widget: props.selectedWidget,
    barCategories,
    barValues,
    lineLabels,
    lineValues
  })
)

const widgetSectionTitle = computed(() => getWidgetSectionTitle(props.selectedWidget?.type))

function ensureInteraction() {
  if (!props.selectedWidget) {
    return
  }

  if (!props.selectedWidget.interaction) {
    props.selectedWidget.interaction = {
      clickAction: 'none',
      targetWidgetIds: [],
      targetSourceIds: [],
      targetPageId: ''
    }
  }
}

function toNumberList(value) {
  return value
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
}

function formatTime(timestamp) {
  if (!timestamp) {
    return '未刷新'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(timestamp))
}

function toggleTargetWidget(widgetId) {
  if (!props.selectedWidget) {
    return
  }

  ensureInteraction()
  const selected = new Set(props.selectedWidget.interaction.targetWidgetIds ?? [])

  if (selected.has(widgetId)) {
    selected.delete(widgetId)
  } else {
    selected.add(widgetId)
  }

  props.selectedWidget.interaction.targetWidgetIds = Array.from(selected)
}

function toggleTargetSource(sourceId) {
  if (!props.selectedWidget) {
    return
  }

  ensureInteraction()
  const selected = new Set(props.selectedWidget.interaction.targetSourceIds ?? [])

  if (selected.has(sourceId)) {
    selected.delete(sourceId)
  } else {
    selected.add(sourceId)
  }

  props.selectedWidget.interaction.targetSourceIds = Array.from(selected)
}

function isTargetWidgetSelected(widgetId) {
  return Boolean(props.selectedWidget?.interaction?.targetWidgetIds?.includes(widgetId))
}

function isTargetSourceSelected(sourceId) {
  return Boolean(props.selectedWidget?.interaction?.targetSourceIds?.includes(sourceId))
}
</script>

<template>
  <aside class="side-panel side-panel--right">
    <div class="panel-header panel-header--hero">
      <span class="panel-header__eyebrow">Inspector</span>
      <h2>{{ panelTitle }}</h2>
      <p>{{ panelDescription }}</p>
    </div>

    <div v-if="selectedWidgets.length > 1" class="inspector">
      <InspectorSection
        title="当前选区"
        caption="查看当前多选结果的规模、尺寸和编组状态。"
        storage-key="panel-multi-summary"
      >
        <div class="inspector-stat-list">
          <div>
            <span>组件数量</span>
            <strong>{{ selectedWidgets.length }}</strong>
          </div>
          <div>
            <span>编组状态</span>
            <strong>{{ commonGroupId ? '已统一编组' : '未统一编组' }}</strong>
          </div>
          <div v-if="selectedBounds">
            <span>整体宽度</span>
            <strong>{{ selectedBounds.w }}</strong>
          </div>
          <div v-if="selectedBounds">
            <span>整体高度</span>
            <strong>{{ selectedBounds.h }}</strong>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection
        title="批量操作"
        caption="对当前选区统一执行显隐和锁定控制。"
        storage-key="panel-multi-actions"
      >
        <div class="inspector-action-grid">
          <button class="ghost" @click="$emit('set-selected-hidden', true)">隐藏所选</button>
          <button class="ghost" @click="$emit('set-selected-hidden', false)">显示所选</button>
          <button class="ghost" @click="$emit('set-selected-locked', true)">锁定所选</button>
          <button class="ghost" @click="$emit('set-selected-locked', false)">解锁所选</button>
        </div>
      </InspectorSection>

      <InspectorSection
        title="排版操作"
        caption="针对未锁定且可见的组件执行对齐和分布。"
        storage-key="panel-multi-layout"
      >
        <p class="inspector-tip">当前可参与排版的组件：{{ editableSelectedCount }} 个</p>

        <div class="inspector-action-grid inspector-action-grid--wide">
          <button
            class="ghost"
            :disabled="editableSelectedCount < 2"
            @click="$emit('align-selected', 'left')"
          >
            左对齐
          </button>
          <button
            class="ghost"
            :disabled="editableSelectedCount < 2"
            @click="$emit('align-selected', 'center-x')"
          >
            水平居中
          </button>
          <button
            class="ghost"
            :disabled="editableSelectedCount < 2"
            @click="$emit('align-selected', 'right')"
          >
            右对齐
          </button>
          <button
            class="ghost"
            :disabled="editableSelectedCount < 2"
            @click="$emit('align-selected', 'top')"
          >
            顶部对齐
          </button>
          <button
            class="ghost"
            :disabled="editableSelectedCount < 2"
            @click="$emit('align-selected', 'center-y')"
          >
            垂直居中
          </button>
          <button
            class="ghost"
            :disabled="editableSelectedCount < 2"
            @click="$emit('align-selected', 'bottom')"
          >
            底部对齐
          </button>
          <button
            class="ghost"
            :disabled="editableSelectedCount < 3"
            @click="$emit('distribute-selected', 'horizontal')"
          >
            横向分布
          </button>
          <button
            class="ghost"
            :disabled="editableSelectedCount < 3"
            @click="$emit('distribute-selected', 'vertical')"
          >
            纵向分布
          </button>
        </div>
      </InspectorSection>

      <InspectorSection
        title="交互提示"
        caption="常用快捷键和选择方式一览。"
        storage-key="panel-multi-tips"
      >
        <p class="inspector-tip">
          可以使用 Ctrl/Cmd 点选追加组件，拖动画布空白区域进行框选，Ctrl/Cmd + G 编组，Shift +
          Ctrl/Cmd + G 取消编组，Ctrl/Cmd + C 复制，Ctrl/Cmd + V 粘贴，Ctrl/Cmd + A 全选。
        </p>
      </InspectorSection>

      <InspectorSection
        title="已选组件"
        caption="快速确认当前选区包含哪些组件。"
        storage-key="panel-multi-tags"
      >
        <div class="inspector-tag-list">
          <span v-for="widget in selectedWidgets" :key="widget.id" class="inspector-tag">
            {{ widget.name }}
          </span>
        </div>
      </InspectorSection>
    </div>

    <div v-else-if="selectedWidget" class="inspector">
      <InspectorSection
        title="基础属性"
        caption="控制组件名称、位置尺寸、层级和显隐状态。"
        storage-key="panel-widget-base"
      >
        <SchemaFields :fields="baseFields" :model="selectedWidget" />
      </InspectorSection>

      <InspectorSection
        title="数据绑定"
        caption="为当前组件连接同类型数据源，并查看实时刷新状态。"
        storage-key="panel-widget-binding"
      >
        <template #actions>
          <button
            class="ghost inspector-inline-button"
            :disabled="!selectedWidget.dataBinding.sourceId"
            @click="$emit('refresh-source', selectedWidget.dataBinding.sourceId)"
          >
            刷新
          </button>
        </template>

        <label>
          <span>绑定数据源</span>
          <select v-model="selectedWidget.dataBinding.sourceId">
            <option value="">未绑定</option>
            <option v-for="source in compatibleSources" :key="source.id" :value="source.id">
              {{ source.name }}
            </option>
          </select>
        </label>

        <p v-if="compatibleSources.length" class="inspector-tip">
          当前组件可绑定 {{ compatibleSources.length }} 个同类型数据源，预览模式下会按刷新间隔自动更新。
        </p>
        <p v-else class="inspector-tip">
          当前没有匹配 {{ selectedWidget.type }} 类型的数据源，可在下方数据源中心新增。
        </p>

        <div v-if="currentBoundSource" class="binding-preview">
          <span>当前来源</span>
          <strong>{{ currentBoundSource.name }}</strong>
          <span>最近刷新 {{ formatTime(currentBoundRuntime?.updatedAt) }}</span>
          <span>绑定数量 {{ sourceBindingCounts[currentBoundSource.id] ?? 0 }}</span>
        </div>
      </InspectorSection>

      <InspectorSection
        title="事件联动"
        caption="仅在预览模式下生效，可触发高亮、刷新数据源或切换页面。"
        storage-key="panel-widget-interaction"
      >
        <label>
          <span>点击动作</span>
          <select v-model="clickAction">
            <option v-for="option in interactionActionOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <template v-if="clickAction === 'highlight-widgets'">
          <span>目标组件</span>
          <div v-if="otherWidgets.length" class="inspector-choice-grid">
            <button
              v-for="widget in otherWidgets"
              :key="widget.id"
              type="button"
              class="inspector-choice-button"
              :class="{ 'is-active': isTargetWidgetSelected(widget.id) }"
              @click="toggleTargetWidget(widget.id)"
            >
              {{ widget.name }}
            </button>
          </div>
          <div v-else class="inspector-empty">当前页没有可联动的其他组件。</div>
        </template>

        <template v-if="clickAction === 'refresh-sources'">
          <span>目标数据源</span>
          <div v-if="project.dataSources.length" class="inspector-choice-grid">
            <button
              v-for="source in project.dataSources"
              :key="source.id"
              type="button"
              class="inspector-choice-button"
              :class="{ 'is-active': isTargetSourceSelected(source.id) }"
              @click="toggleTargetSource(source.id)"
            >
              {{ source.name }}
            </button>
          </div>
          <div v-else class="inspector-empty">当前项目还没有数据源。</div>
        </template>

        <template v-if="clickAction === 'switch-page'">
          <label>
            <span>目标页面</span>
            <select v-model="targetPageId">
              <option value="">请选择</option>
              <option v-for="item in availableTargetPages" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </select>
          </label>
          <div v-if="!availableTargetPages.length" class="inspector-empty">当前只有一个页面，无法切换。</div>
        </template>
      </InspectorSection>

      <InspectorSection
        title="样式"
        caption="统一调整组件背景、边框、圆角和透明度。"
        storage-key="panel-widget-style"
      >
        <SchemaFields :fields="styleFields" :model="selectedWidget" />
      </InspectorSection>

      <InspectorSection
        :title="widgetSectionTitle"
        caption="基于组件类型动态展示对应的专属配置字段。"
        storage-key="panel-widget-schema"
      >
        <SchemaFields :fields="widgetFields" :model="selectedWidget" />
      </InspectorSection>
    </div>

    <div v-else class="inspector">
      <InspectorSection
        title="当前页面"
        caption="配置页面名称、画布尺寸、背景和网格表现。"
        storage-key="panel-page-config"
      >
        <SchemaFields :fields="pageFields" :model="project" />
        <p class="inspector-tip">页面名称用于管理和切换，画布标题用于大屏展示。</p>
        <p class="inspector-tip">开启标尺后可从上方或左侧拖出参考线，拖出画布即可删除。</p>
      </InspectorSection>
    </div>

    <LayerPanel
      :widgets="project.widgets"
      :selected-ids="selectedIds"
      :primary-selected-id="primarySelectedId"
      @select-layer="$emit('select-layer', $event)"
      @toggle-layer-hidden="$emit('toggle-layer-hidden', $event)"
      @toggle-layer-locked="$emit('toggle-layer-locked', $event)"
      @reorder-layer="$emit('reorder-layer', $event)"
    />

    <DataSourcePanel
      :data-sources="project.dataSources"
      :binding-counts="sourceBindingCounts"
      :data-source-runtime="dataSourceRuntime"
      @create-source="$emit('create-source', $event)"
      @delete-source="$emit('delete-source', $event)"
      @refresh-source="$emit('refresh-source', $event)"
      @refresh-all-sources="$emit('refresh-all-sources')"
      @change-source-type="$emit('change-source-type', $event)"
      @update-source-payload="$emit('update-source-payload', $event)"
    />

    <HistoryPanel
      :current-label="currentHistoryLabel"
      :undo-entries="undoEntries"
      :redo-entries="redoEntries"
      :can-undo="canUndo"
      :can-redo="canRedo"
      @undo="$emit('undo')"
      @redo="$emit('redo')"
    />
  </aside>
</template>
