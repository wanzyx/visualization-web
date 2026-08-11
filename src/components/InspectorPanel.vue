<script setup>
import { computed } from 'vue'
import DataSourcePanel from './DataSourcePanel.vue'
import HistoryPanel from './HistoryPanel.vue'
import LayerPanel from './LayerPanel.vue'

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
  'create-source',
  'delete-source',
  'refresh-source',
  'refresh-all-sources',
  'change-source-type',
  'update-source-payload',
  'undo',
  'redo'
])

const interactionActionOptions = [
  { value: 'none', label: '无动作' },
  { value: 'highlight-widgets', label: '高亮组件' },
  { value: 'refresh-sources', label: '刷新数据源' },
  { value: 'switch-page', label: '切换页面' }
]

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
    <div class="panel-header">
      <h2>
        {{
          selectedWidgets.length > 1
            ? '多选概览'
            : selectedWidget
              ? '属性配置'
              : '页面配置'
        }}
      </h2>
      <p>
        {{
          selectedWidgets.length > 1
            ? '多选时可整体移动、编组、批量锁定或隐藏。'
            : selectedWidget
              ? '直接修改组件位置、样式、数据和事件联动。'
              : '未选中组件时，可配置当前页面、画布基础参数和数据源。'
        }}
      </p>
    </div>

    <div v-if="selectedWidgets.length > 1" class="inspector">
      <section class="inspector-group">
        <h3>当前选区</h3>
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
      </section>

      <section class="inspector-group">
        <h3>批量操作</h3>
        <div class="inspector-action-grid">
          <button class="ghost" @click="$emit('set-selected-hidden', true)">隐藏所选</button>
          <button class="ghost" @click="$emit('set-selected-hidden', false)">显示所选</button>
          <button class="ghost" @click="$emit('set-selected-locked', true)">锁定所选</button>
          <button class="ghost" @click="$emit('set-selected-locked', false)">解锁所选</button>
        </div>
      </section>

      <section class="inspector-group">
        <h3>交互提示</h3>
        <p class="inspector-tip">
          可以使用 Ctrl/Cmd 点选追加组件，拖动画布空白区域进行框选，Ctrl/Cmd + G 编组，Shift +
          Ctrl/Cmd + G 取消编组。
        </p>
      </section>

      <section class="inspector-group">
        <h3>已选组件</h3>
        <div class="inspector-tag-list">
          <span v-for="widget in selectedWidgets" :key="widget.id" class="inspector-tag">
            {{ widget.name }}
          </span>
        </div>
      </section>
    </div>

    <div v-else-if="selectedWidget" class="inspector">
      <section class="inspector-group">
        <h3>基础</h3>
        <label>
          <span>名称</span>
          <input v-model="selectedWidget.name" type="text" />
        </label>
        <div class="inspector-grid">
          <label>
            <span>X</span>
            <input v-model.number="selectedWidget.x" type="number" />
          </label>
          <label>
            <span>Y</span>
            <input v-model.number="selectedWidget.y" type="number" />
          </label>
          <label>
            <span>宽度</span>
            <input v-model.number="selectedWidget.w" type="number" min="120" />
          </label>
          <label>
            <span>高度</span>
            <input v-model.number="selectedWidget.h" type="number" min="80" />
          </label>
          <label>
            <span>图层</span>
            <input v-model.number="selectedWidget.zIndex" type="number" />
          </label>
          <label>
            <span>旋转</span>
            <input v-model.number="selectedWidget.style.rotate" type="number" />
          </label>
        </div>
        <label class="inspector-switch">
          <input v-model="selectedWidget.hidden" type="checkbox" />
          <span>隐藏当前组件</span>
        </label>
        <label class="inspector-switch">
          <input v-model="selectedWidget.locked" type="checkbox" />
          <span>锁定当前组件</span>
        </label>
      </section>

      <section class="inspector-group">
        <div class="inspector-group__header">
          <h3>数据绑定</h3>
          <button
            class="ghost inspector-inline-button"
            :disabled="!selectedWidget.dataBinding.sourceId"
            @click="$emit('refresh-source', selectedWidget.dataBinding.sourceId)"
          >
            刷新
          </button>
        </div>

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
      </section>

      <section class="inspector-group">
        <h3>事件联动</h3>
        <p class="inspector-caption">仅在预览模式下生效，适合做跳页、刷新数据和组件联动高亮。</p>

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
      </section>

      <section class="inspector-group">
        <h3>样式</h3>
        <label>
          <span>背景</span>
          <input v-model="selectedWidget.style.background" type="text" />
        </label>
        <label>
          <span>边框颜色</span>
          <input v-model="selectedWidget.style.borderColor" type="text" />
        </label>
        <div class="inspector-grid">
          <label>
            <span>圆角</span>
            <input v-model.number="selectedWidget.style.radius" type="number" min="0" />
          </label>
          <label>
            <span>内边距</span>
            <input v-model.number="selectedWidget.style.padding" type="number" min="0" />
          </label>
          <label>
            <span>透明度</span>
            <input v-model.number="selectedWidget.style.opacity" type="number" min="0" max="1" step="0.1" />
          </label>
        </div>
      </section>

      <section v-if="selectedWidget.type === 'text'" class="inspector-group">
        <h3>文本</h3>
        <label>
          <span>内容</span>
          <textarea v-model="selectedWidget.props.text" rows="4" />
        </label>
        <div class="inspector-grid">
          <label>
            <span>字号</span>
            <input v-model.number="selectedWidget.props.fontSize" type="number" min="12" />
          </label>
          <label>
            <span>字重</span>
            <input
              v-model.number="selectedWidget.props.fontWeight"
              type="number"
              min="300"
              max="900"
              step="100"
            />
          </label>
          <label>
            <span>字距</span>
            <input v-model.number="selectedWidget.props.letterSpacing" type="number" min="0" />
          </label>
          <label>
            <span>对齐</span>
            <select v-model="selectedWidget.props.align">
              <option value="left">left</option>
              <option value="center">center</option>
              <option value="right">right</option>
            </select>
          </label>
        </div>
        <label>
          <span>颜色</span>
          <input v-model="selectedWidget.props.color" type="text" />
        </label>
      </section>

      <section v-if="selectedWidget.type === 'stat'" class="inspector-group">
        <h3>指标卡</h3>
        <label>
          <span>标题</span>
          <input v-model="selectedWidget.props.title" type="text" />
        </label>
        <div class="inspector-grid">
          <label>
            <span>数值</span>
            <input v-model="selectedWidget.props.value" type="text" />
          </label>
          <label>
            <span>单位</span>
            <input v-model="selectedWidget.props.unit" type="text" />
          </label>
          <label>
            <span>趋势</span>
            <input v-model.number="selectedWidget.props.trend" type="number" step="0.1" />
          </label>
          <label>
            <span>趋势描述</span>
            <input v-model="selectedWidget.props.trendLabel" type="text" />
          </label>
        </div>
        <label>
          <span>主色</span>
          <input v-model="selectedWidget.props.color" type="text" />
        </label>
        <label>
          <span>强调色</span>
          <input v-model="selectedWidget.props.accent" type="text" />
        </label>
      </section>

      <section v-if="selectedWidget.type === 'barChart'" class="inspector-group">
        <h3>柱状图</h3>
        <label>
          <span>标题</span>
          <input v-model="selectedWidget.props.title" type="text" />
        </label>
        <label>
          <span>分类（每行一个）</span>
          <textarea v-model="barCategories" rows="5" />
        </label>
        <label>
          <span>数值（逗号分隔）</span>
          <textarea v-model="barValues" rows="3" />
        </label>
        <label>
          <span>柱体颜色</span>
          <input v-model="selectedWidget.props.color" type="text" />
        </label>
      </section>

      <section v-if="selectedWidget.type === 'lineChart'" class="inspector-group">
        <h3>折线图</h3>
        <label>
          <span>标题</span>
          <input v-model="selectedWidget.props.title" type="text" />
        </label>
        <label>
          <span>标签（每行一个）</span>
          <textarea v-model="lineLabels" rows="5" />
        </label>
        <label>
          <span>数值（逗号分隔）</span>
          <textarea v-model="lineValues" rows="3" />
        </label>
        <label>
          <span>线条颜色</span>
          <input v-model="selectedWidget.props.color" type="text" />
        </label>
        <label>
          <span>区域颜色</span>
          <input v-model="selectedWidget.props.areaColor" type="text" />
        </label>
      </section>

      <section v-if="selectedWidget.type === 'gauge'" class="inspector-group">
        <h3>环形进度</h3>
        <label>
          <span>标题</span>
          <input v-model="selectedWidget.props.title" type="text" />
        </label>
        <div class="inspector-grid">
          <label>
            <span>百分比</span>
            <input v-model.number="selectedWidget.props.value" type="number" min="0" max="100" />
          </label>
          <label>
            <span>主色</span>
            <input v-model="selectedWidget.props.color" type="text" />
          </label>
        </div>
        <label>
          <span>轨道色</span>
          <input v-model="selectedWidget.props.trackColor" type="text" />
        </label>
      </section>

      <section v-if="selectedWidget.type === 'panel'" class="inspector-group">
        <h3>装饰面板</h3>
        <label>
          <span>标题</span>
          <input v-model="selectedWidget.props.title" type="text" />
        </label>
        <label>
          <span>副标题</span>
          <input v-model="selectedWidget.props.subtitle" type="text" />
        </label>
        <label>
          <span>正文</span>
          <textarea v-model="selectedWidget.props.content" rows="4" />
        </label>
      </section>
    </div>

    <div v-else class="inspector">
      <section class="inspector-group">
        <h3>当前页面</h3>
        <label>
          <span>页面名称</span>
          <input v-model="page.name" type="text" />
        </label>
        <label>
          <span>画布标题</span>
          <input v-model="project.meta.title" type="text" />
        </label>
        <div class="inspector-grid">
          <label>
            <span>宽度</span>
            <input v-model.number="project.meta.screenWidth" type="number" min="1280" />
          </label>
          <label>
            <span>高度</span>
            <input v-model.number="project.meta.screenHeight" type="number" min="720" />
          </label>
        </div>
        <label>
          <span>背景</span>
          <textarea v-model="project.meta.background" rows="4" />
        </label>
        <label>
          <span>网格颜色</span>
          <input v-model="project.meta.gridColor" type="text" />
        </label>
        <label class="inspector-switch">
          <input v-model="project.meta.showGrid" type="checkbox" />
          <span>显示网格辅助线</span>
        </label>
        <p class="inspector-tip">页面名称用于管理和切换，画布标题用于大屏展示。</p>
      </section>
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
