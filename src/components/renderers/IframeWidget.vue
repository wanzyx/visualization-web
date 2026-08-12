<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  },
  previewMode: {
    type: Boolean,
    default: false
  }
})

const isLoaded = ref(false)

const frameSrc = computed(() => String(props.widget.props.src || '').trim())
const frameTitle = computed(() => String(props.widget.props.title || props.widget.name || '').trim())
const showToolbar = computed(() => props.widget.props.showToolbar !== false)
const allowFullscreen = computed(() => props.widget.props.allowFullscreen !== false)
const sandbox = computed(() => String(props.widget.props.sandbox || '').trim())

const hostLabel = computed(() => {
  if (!frameSrc.value) {
    return ''
  }

  try {
    return new URL(frameSrc.value).host.replace(/^www\./, '')
  } catch (error) {
    return frameSrc.value
  }
})

watch(
  frameSrc,
  () => {
    isLoaded.value = false
  },
  { immediate: true }
)

function handleLoad() {
  isLoaded.value = true
}
</script>

<template>
  <div class="widget-embed" :class="{ 'is-editor': !previewMode }">
    <div v-if="frameSrc" class="widget-embed__shell">
      <div v-if="showToolbar" class="widget-embed__toolbar">
        <div class="widget-embed__meta">
          <strong>{{ frameTitle || '网页嵌入' }}</strong>
          <span>{{ hostLabel }}</span>
        </div>

        <a class="widget-embed__link" :href="frameSrc" target="_blank" rel="noreferrer" @click.stop>
          新开
        </a>
      </div>

      <div class="widget-embed__viewport">
        <iframe
          class="widget-embed__frame"
          :src="frameSrc"
          :title="frameTitle || '网页嵌入'"
          :sandbox="sandbox || undefined"
          :allowfullscreen="allowFullscreen"
          referrerpolicy="no-referrer-when-downgrade"
          @load="handleLoad"
        />

        <div v-if="!isLoaded" class="widget-embed__loading">页面加载中...</div>

        <div v-if="!previewMode" class="widget-embed__mask">
          <strong>编辑态已禁用页面交互</strong>
          <span>切换到预览或运行模式后，可以直接操作嵌入页面。</span>
        </div>
      </div>

      <p class="widget-embed__hint">若页面空白，请确认目标站点允许 iframe 嵌入。</p>
    </div>

    <div v-else class="widget-media__empty">请先配置网页地址，或绑定 iframe 数据源。</div>
  </div>
</template>
