<script setup>
import { ref } from 'vue'
import { dataSourceTypeOptions, getGeneratorOptions } from '../editor/dataSources'
import InspectorSection from './inspector/InspectorSection.vue'

defineProps({
  dataSources: {
    type: Array,
    default: () => []
  },
  bindingCounts: {
    type: Object,
    default: () => ({})
  },
  dataSourceRuntime: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([
  'create-source',
  'delete-source',
  'refresh-source',
  'refresh-all-sources',
  'change-source-type',
  'update-source-payload'
])

const draftType = ref('stat')

function formatPayload(payload) {
  return JSON.stringify(payload, null, 2)
}

function commitPayload(sourceId, event) {
  emit('update-source-payload', {
    sourceId,
    value: event.target.value
  })
}

function formatRuntimeTime(timestamp) {
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
</script>

<template>
  <InspectorSection
    title="数据源中心"
    caption="统一维护组件数据，支持静态配置和动态刷新策略。"
    storage-key="panel-data-source"
    :default-open="false"
  >
    <template #actions>
      <button class="ghost inspector-inline-button" @click="$emit('refresh-all-sources')">
        全部刷新
      </button>
    </template>

    <div class="data-source-panel__toolbar">
      <select v-model="draftType">
        <option v-for="option in dataSourceTypeOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <button class="ghost" @click="$emit('create-source', draftType)">新增数据源</button>
    </div>

    <div v-if="dataSources.length" class="data-source-panel__list">
      <article v-for="source in dataSources" :key="source.id" class="data-source-panel__card">
        <label>
          <span>名称</span>
          <input v-model="source.name" type="text" />
        </label>

        <div class="inspector-grid">
          <label>
            <span>类型</span>
            <select
              :value="source.type"
              @change="$emit('change-source-type', { sourceId: source.id, type: $event.target.value })"
            >
              <option
                v-for="option in dataSourceTypeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label>
            <span>刷新间隔</span>
            <select v-model.number="source.refreshInterval">
              <option :value="0">手动</option>
              <option :value="10">10 秒</option>
              <option :value="30">30 秒</option>
              <option :value="60">60 秒</option>
            </select>
          </label>
        </div>

        <label>
          <span>生成策略</span>
          <select v-model="source.generator">
            <option
              v-for="option in getGeneratorOptions(source.type)"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <div class="data-source-panel__meta">
          <span>已绑定 {{ bindingCounts[source.id] ?? 0 }} 个组件</span>
          <span>最近刷新 {{ formatRuntimeTime(dataSourceRuntime[source.id]?.updatedAt) }}</span>
        </div>

        <label>
          <span>JSON 数据</span>
          <textarea
            class="data-source-panel__textarea"
            :value="formatPayload(source.payload)"
            rows="8"
            spellcheck="false"
            @change="commitPayload(source.id, $event)"
          />
        </label>

        <div class="data-source-panel__actions">
          <button class="ghost" @click="$emit('refresh-source', source.id)">刷新</button>
          <button class="ghost danger" @click="$emit('delete-source', source.id)">删除</button>
        </div>
      </article>
    </div>

    <div v-else class="material-empty">
      <span>这里可以统一维护文本、图表和指标类数据源，再到组件属性中完成绑定。</span>
    </div>
  </InspectorSection>
</template>
