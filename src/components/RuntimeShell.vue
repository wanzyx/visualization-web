<script setup>
import { computed, ref } from "vue";
import StageCanvas from "./StageCanvas.vue";

const props = defineProps({
    project: {
        type: Object,
        required: true,
    },
    page: {
        type: Object,
        default: null,
    },
    pages: {
        type: Array,
        default: () => [],
    },
    activePageId: {
        type: String,
        default: "",
    },
    linkedWidgetIds: {
        type: Array,
        default: () => [],
    },
    dataSourceRuntime: {
        type: Object,
        default: () => ({}),
    },
    runtimeVariables: {
        type: Object,
        default: () => ({}),
    },
    runtimeFilters: {
        type: Object,
        default: () => ({}),
    },
    debugSummary: {
        type: Object,
        default: () => ({}),
    },
    debugFilters: {
        type: Array,
        default: () => [],
    },
    debugVariables: {
        type: Array,
        default: () => [],
    },
    debugSources: {
        type: Array,
        default: () => [],
    },
    debugEvents: {
        type: Array,
        default: () => [],
    },
});

defineEmits([
    "select-page",
    "exit-runtime",
    "copy-runtime-link",
    "copy-debug-snapshot",
    "clear-debug-events",
    "trigger-widget-action",
    "widget-command",
]);

const debugOpen = ref(false);

const debugMetrics = computed(() => [
    {
        key: "widgets",
        label: "组件",
        value: props.debugSummary.widgetCount ?? 0,
        helper: `可见 ${props.debugSummary.visibleWidgetCount ?? 0}`,
    },
    {
        key: "sources",
        label: "数据源",
        value: props.debugSummary.sourceCount ?? 0,
        helper: `已刷新 ${props.debugSummary.refreshedSourceCount ?? 0}`,
    },
    {
        key: "filters",
        label: "筛选",
        value: props.debugSummary.activeFilterCount ?? 0,
        helper: `联动高亮 ${props.debugSummary.linkedWidgetCount ?? 0}`,
    },
    {
        key: "variables",
        label: "变量",
        value: props.debugSummary.variableCount ?? 0,
        helper:
            props.debugVariables[0]?.key
                ? `最近 ${props.debugVariables[0].key}`
                : "尚未设置",
    },
    {
        key: "errors",
        label: "异常",
        value: props.debugSummary.errorSourceCount ?? 0,
        helper:
            (props.debugSummary.errorSourceCount ?? 0) > 0
                ? "需要排查"
                : "运行正常",
    },
]);

function formatEventTime(timestamp) {
    if (!timestamp) {
        return "--:--:--";
    }

    return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date(timestamp));
}

function getEventLevelLabel(level) {
    switch (level) {
        case "success":
            return "成功";
        case "warning":
            return "提醒";
        case "error":
            return "异常";
        default:
            return "记录";
    }
}

function getSourceState(source) {
    if (source.error) {
        return "异常";
    }

    if (source.updatedAt) {
        return "已刷新";
    }

    return "待刷新";
}

function formatSourceTime(timestamp) {
    if (!timestamp) {
        return "尚未刷新";
    }

    return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date(timestamp));
}
</script>

<template>
    <div class="runtime-shell" :class="{ 'runtime-shell--debug-open': debugOpen }">
        <header class="runtime-toolbar">
            <div class="runtime-toolbar__brand">
                <p>Runtime View</p>
                <h1>{{ page?.meta?.title || "运行大屏" }}</h1>
            </div>

            <div class="runtime-toolbar__actions">
                <button class="ghost" @click="debugOpen = !debugOpen">
                    {{ debugOpen ? "收起调试" : "调试概览" }}
                </button>
                <button class="ghost" @click="$emit('copy-runtime-link')">
                    复制运行地址
                </button>
                <button class="primary" @click="$emit('exit-runtime')">
                    返回编辑
                </button>
            </div>
        </header>

        <nav v-if="pages.length > 1" class="runtime-page-nav">
            <button
                v-for="item in pages"
                :key="item.id"
                class="runtime-page-nav__item"
                :class="{ 'is-active': item.id === activePageId }"
                @click="$emit('select-page', item.id)"
            >
                <span>{{ item.name }}</span>
                <small>{{ item.widgets.length }} 组件</small>
            </button>
        </nav>

        <div class="runtime-shell__canvas">
            <StageCanvas
                :project="project"
                :selected-ids="[]"
                :primary-selected-id="null"
                :preview-mode="true"
                :linked-widget-ids="linkedWidgetIds"
                :data-source-runtime="dataSourceRuntime"
                :runtime-variables="runtimeVariables"
                :runtime-filters="runtimeFilters"
                :show-meta="false"
                :runtime-mode="true"
                @trigger-widget-action="$emit('trigger-widget-action', $event)"
                @widget-command="$emit('widget-command', $event)"
            />

            <aside
                class="runtime-debug"
                :class="{ 'is-open': debugOpen }"
                aria-label="运行态调试抽屉"
            >
                <div class="runtime-debug__panel">
                    <div class="runtime-debug__header">
                        <div>
                            <p>Runtime Debug</p>
                            <h3>联动与数据状态</h3>
                        </div>

                        <div class="runtime-debug__actions">
                            <button
                                class="ghost"
                                type="button"
                                @click="$emit('copy-debug-snapshot')"
                            >
                                复制快照
                            </button>
                            <button
                                class="ghost"
                                type="button"
                                @click="$emit('clear-debug-events')"
                            >
                                清空记录
                            </button>
                        </div>
                    </div>

                    <div class="runtime-debug__summary">
                        <div
                            v-for="metric in debugMetrics"
                            :key="metric.key"
                            class="runtime-debug__metric"
                            :class="{
                                'is-warning':
                                    metric.key === 'errors' &&
                                    Number(metric.value) > 0,
                            }"
                        >
                            <span>{{ metric.label }}</span>
                            <strong>{{ metric.value }}</strong>
                            <small>{{ metric.helper }}</small>
                        </div>
                    </div>

                    <div class="runtime-debug__content">
                        <section class="runtime-debug__section">
                            <div class="runtime-debug__section-head">
                                <span>当前页面</span>
                                <strong>{{ debugSummary.pageName || "未命名页面" }}</strong>
                            </div>
                            <p class="runtime-debug__section-tip">
                                {{
                                    debugSummary.pageTitle ||
                                    page?.meta?.title ||
                                    "运行大屏"
                                }}
                            </p>
                        </section>

                        <section class="runtime-debug__section">
                            <div class="runtime-debug__section-head">
                                <span>激活筛选</span>
                                <strong>{{ debugFilters.length }}</strong>
                            </div>

                            <div
                                v-if="debugFilters.length"
                                class="runtime-debug__chip-list"
                            >
                                <article
                                    v-for="filter in debugFilters"
                                    :key="filter.widgetId"
                                    class="runtime-debug__chip"
                                >
                                    <strong>{{ filter.widgetName }}</strong>
                                    <span>{{ filter.field }}</span>
                                    <em>{{
                                        filter.label ||
                                        filter.value ||
                                        "全部"
                                    }}</em>
                                </article>
                            </div>

                            <p v-else class="runtime-debug__empty">
                                当前没有激活的联动筛选条件。
                            </p>
                        </section>

                        <section class="runtime-debug__section">
                            <div class="runtime-debug__section-head">
                                <span>运行时变量</span>
                                <strong>{{ debugVariables.length }}</strong>
                            </div>

                            <div
                                v-if="debugVariables.length"
                                class="runtime-debug__chip-list"
                            >
                                <article
                                    v-for="variable in debugVariables"
                                    :key="variable.key"
                                    class="runtime-debug__chip"
                                >
                                    <strong>{{ variable.key }}</strong>
                                    <span>{{ variable.type }}</span>
                                    <em>{{ variable.preview }}</em>
                                </article>
                            </div>

                            <p v-else class="runtime-debug__empty">
                                当前没有写入运行时变量。
                            </p>
                        </section>

                        <section class="runtime-debug__section">
                            <div class="runtime-debug__section-head">
                                <span>数据源状态</span>
                                <strong>{{ debugSources.length }}</strong>
                            </div>

                            <div
                                v-if="debugSources.length"
                                class="runtime-debug__source-list"
                            >
                                <article
                                    v-for="source in debugSources"
                                    :key="source.id"
                                    class="runtime-debug__source"
                                    :class="{
                                        'is-error': Boolean(source.error),
                                    }"
                                >
                                    <div class="runtime-debug__source-head">
                                        <strong>{{ source.name }}</strong>
                                        <span>{{ getSourceState(source) }}</span>
                                    </div>
                                    <p>
                                        {{ source.generator }} / {{ source.type }}
                                    </p>
                                    <small>
                                        刷新 {{ source.refreshCount || 0 }} 次 ·
                                        {{ formatSourceTime(source.updatedAt) }}
                                    </small>
                                    <em v-if="source.error">{{ source.error }}</em>
                                    <small
                                        v-else-if="source.responseStatus"
                                    >
                                        HTTP
                                        {{ source.responseStatus }}
                                        {{
                                            source.responseStatusText || ""
                                        }}
                                        · 字段映射
                                        {{ source.mappedFieldCount || 0 }}
                                    </small>
                                </article>
                            </div>

                            <p v-else class="runtime-debug__empty">
                                当前项目没有数据源。
                            </p>
                        </section>

                        <section class="runtime-debug__section">
                            <div class="runtime-debug__section-head">
                                <span>最近事件</span>
                                <strong>{{ debugEvents.length }}</strong>
                            </div>

                            <div
                                v-if="debugEvents.length"
                                class="runtime-debug__event-list"
                            >
                                <article
                                    v-for="event in debugEvents"
                                    :key="event.id"
                                    class="runtime-debug__event"
                                    :class="`is-${event.level || 'info'}`"
                                >
                                    <div class="runtime-debug__event-head">
                                        <strong>{{ event.title }}</strong>
                                        <span>{{
                                            getEventLevelLabel(event.level)
                                        }}</span>
                                    </div>
                                    <p v-if="event.detail">{{ event.detail }}</p>
                                    <small>
                                        {{ formatEventTime(event.at) }}
                                        <template v-if="event.pageName">
                                            · {{ event.pageName }}
                                        </template>
                                    </small>
                                </article>
                            </div>

                            <p v-else class="runtime-debug__empty">
                                暂无事件记录，进入页面后触发筛选或交互会显示在这里。
                            </p>
                        </section>
                    </div>
                </div>
            </aside>
        </div>
    </div>
</template>
