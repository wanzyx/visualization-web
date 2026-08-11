<script setup>
import { onMounted, ref, watch } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  caption: {
    type: String,
    default: ''
  },
  storageKey: {
    type: String,
    default: ''
  },
  defaultOpen: {
    type: Boolean,
    default: true
  }
})

const open = ref(props.defaultOpen)

function toggleOpen() {
  open.value = !open.value
}

onMounted(() => {
  if (!props.storageKey || typeof localStorage === 'undefined') {
    return
  }

  const rawValue = localStorage.getItem(`inspector-section:${props.storageKey}`)

  if (rawValue === '0') {
    open.value = false
  }

  if (rawValue === '1') {
    open.value = true
  }
})

watch(open, (value) => {
  if (!props.storageKey || typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(`inspector-section:${props.storageKey}`, value ? '1' : '0')
})
</script>

<template>
  <section class="inspector-group inspector-section" :class="{ 'is-collapsed': !open }">
    <div class="inspector-section__header">
      <button class="inspector-section__toggle" type="button" @click="toggleOpen">
        <div class="inspector-section__copy">
          <h3>{{ title }}</h3>
          <p v-if="caption" class="inspector-section__caption">{{ caption }}</p>
        </div>
        <span class="inspector-section__chevron">{{ open ? '▾' : '▸' }}</span>
      </button>

      <div v-if="$slots.actions" class="inspector-section__actions">
        <slot name="actions" />
      </div>
    </div>

    <div v-show="open" class="inspector-section__body">
      <slot />
    </div>
  </section>
</template>
