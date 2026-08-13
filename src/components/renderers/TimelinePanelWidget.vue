<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
    widget: {
        type: Object,
        required: true,
    },
});

function normalizeIndex(value, total) {
    if (!total) {
        return 0;
    }

    const numericValue = Math.trunc(Number(value) || 0);
    return Math.min(Math.max(numericValue, 0), total - 1);
}

function normalizeStatus(value, fallback = "pending") {
    const status = String(value || "")
        .trim()
        .toLowerCase();

    if (["done", "active", "pending", "warning"].includes(status)) {
        return status;
    }

    return fallback;
}

const items = computed(() =>
    (Array.isArray(props.widget.props.items) ? props.widget.props.items : [])
        .map((item, index) => ({
            time:
                String(item?.time ?? "").trim() ||
                `${index + 1}`.padStart(2, "0"),
            title:
                String(item?.title ?? `节点 ${index + 1}`).trim() ||
                `节点 ${index + 1}`,
            description: String(item?.description ?? "").trim(),
            tag: String(item?.tag ?? "").trim(),
            status: normalizeStatus(item?.status),
        }))
        .filter((item) => item.title),
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
const completedCount = computed(
    () => items.value.filter((item) => item.status === "done").length,
);

const summaryText = computed(() => {
    if (props.widget.props.subtitle) {
        return props.widget.props.subtitle;
    }

    return `共 ${items.value.length} 个节点，已完成 ${completedCount.value} 个`;
});

const themeStyle = computed(() => ({
    "--timeline-accent":
        String(props.widget.props.accent || "#46eeff").trim() || "#46eeff",
    "--timeline-secondary":
        String(
            props.widget.props.secondaryColor || "rgba(123, 254, 203, 0.16)",
        ).trim() || "rgba(123, 254, 203, 0.16)",
}));

function stopPointer(event) {
    event.stopPropagation();
}

function activateItem(index, event) {
    event.stopPropagation();
    activeIndex.value = index;
}
</script>

<template>
    <div class="widget-timeline" :style="themeStyle">
        <div class="widget-timeline__head">
            <div class="widget-timeline__copy">
                <h3>{{ widget.props.title || widget.name }}</h3>
                <p>{{ summaryText }}</p>
            </div>

            <div class="widget-timeline__stats">
                <strong>{{ items.length }}</strong>
                <span>节点总数</span>
            </div>
        </div>

        <div v-if="items.length" class="widget-timeline__body">
            <div class="widget-timeline__track">
                <button
                    v-for="(item, index) in items"
                    :key="`${item.time}-${item.title}-${index}`"
                    type="button"
                    class="widget-timeline__item"
                    :class="[
                        `is-${item.status}`,
                        {
                            'is-active': index === activeIndex,
                            'has-pulse': widget.props.showPulse !== false,
                            'hide-connector':
                                widget.props.showConnector === false,
                        },
                    ]"
                    @pointerdown.stop="stopPointer"
                    @click.stop="activateItem(index, $event)"
                >
                    <span class="widget-timeline__item-time">{{
                        item.time
                    }}</span>

                    <div class="widget-timeline__item-line">
                        <i class="widget-timeline__item-dot" />
                    </div>

                    <div class="widget-timeline__item-body">
                        <div class="widget-timeline__item-top">
                            <strong>{{ item.title }}</strong>
                            <em
                                v-if="item.tag"
                                class="widget-timeline__item-tag"
                                >{{ item.tag }}</em
                            >
                        </div>
                        <p v-if="item.description">{{ item.description }}</p>
                    </div>
                </button>
            </div>

            <div class="widget-timeline__detail">
                <span class="widget-timeline__detail-label">当前节点</span>
                <strong>{{ activeItem?.title || "--" }}</strong>
                <span>{{ activeItem?.time || "--" }}</span>
                <p>
                    {{
                        activeItem?.description ||
                        "请在属性面板中配置时间轴节点。"
                    }}
                </p>

                <div class="widget-timeline__detail-meta">
                    <span class="widget-timeline__detail-chip"
                        >高亮序号 {{ activeIndex + 1 }}</span
                    >
                    <span
                        v-if="activeItem?.tag"
                        class="widget-timeline__detail-chip"
                        >{{ activeItem.tag }}</span
                    >
                    <span class="widget-timeline__detail-chip"
                        >状态 {{ activeItem?.status || "pending" }}</span
                    >
                </div>
            </div>
        </div>

        <div v-else class="widget-tab-panel__empty">
            <span>请在属性面板中配置时间轴节点</span>
        </div>
    </div>
</template>
