<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
    widget: {
        type: Object,
        required: true,
    },
    previewMode: {
        type: Boolean,
        default: false,
    },
});

function normalizeIndex(value, total) {
    if (!total) {
        return 0;
    }

    const numericValue = Math.trunc(Number(value) || 0);
    return Math.min(Math.max(numericValue, 0), total - 1);
}

const items = computed(() =>
    (Array.isArray(props.widget.props.items) ? props.widget.props.items : [])
        .map((item, index) => ({
            label:
                String(item?.label ?? `标签 ${index + 1}`).trim() ||
                `标签 ${index + 1}`,
            value: String(item?.value ?? "").trim(),
            unit: String(item?.unit ?? "").trim(),
            description: String(item?.description ?? "").trim(),
            meta: String(item?.meta ?? "").trim(),
        }))
        .filter(
            (item) => item.label || item.value || item.description || item.meta,
        ),
);

const activeIndex = ref(0);

watch(
    () => [props.widget.props.activeIndex, items.value.length],
    ([value, total]) => {
        activeIndex.value = normalizeIndex(value, total);
    },
    { immediate: true },
);

const activeItem = computed(() => items.value[activeIndex.value] ?? null);
const showTitle = computed(() => props.widget.props.showTitle !== false);

const panelStyle = computed(() => ({
    "--tab-panel-accent":
        String(props.widget.props.accent || "#46eeff").trim() || "#46eeff",
    "--tab-panel-secondary":
        String(
            props.widget.props.secondaryColor || "rgba(235, 247, 255, 0.16)",
        ).trim() || "rgba(235, 247, 255, 0.16)",
}));

function stopPointer(event) {
    event.stopPropagation();
}

function activateTab(index, event) {
    event.stopPropagation();
    activeIndex.value = index;
}
</script>

<template>
    <div class="widget-tab-panel" :style="panelStyle">
        <div v-if="showTitle || items.length" class="widget-tab-panel__head">
            <strong v-if="showTitle">{{
                widget.props.title || widget.name
            }}</strong>
            <span v-if="items.length"
                >{{ activeIndex + 1 }}/{{ items.length }}</span
            >
        </div>

        <div v-if="items.length" class="widget-tab-panel__tabs">
            <button
                v-for="(item, index) in items"
                :key="`${item.label}-${index}`"
                type="button"
                class="widget-tab-panel__tab"
                :class="{ 'is-active': index === activeIndex }"
                @pointerdown.stop="stopPointer"
                @click.stop="activateTab(index, $event)"
            >
                <span>{{ item.label }}</span>
                <small v-if="item.meta">{{ item.meta }}</small>
            </button>
        </div>

        <div v-if="activeItem" class="widget-tab-panel__content">
            <p v-if="activeItem.meta" class="widget-tab-panel__meta">
                {{ activeItem.meta }}
            </p>
            <div class="widget-tab-panel__value-row">
                <strong>{{ activeItem.value || "--" }}</strong>
                <span v-if="activeItem.unit">{{ activeItem.unit }}</span>
            </div>
            <h4>{{ activeItem.label }}</h4>
            <p
                v-if="activeItem.description"
                class="widget-tab-panel__description"
            >
                {{ activeItem.description }}
            </p>
        </div>

        <div v-else class="widget-tab-panel__empty">
            <span>请在属性面板中配置 Tabs 项</span>
        </div>
    </div>
</template>
