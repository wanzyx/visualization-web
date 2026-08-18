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
    debugVariableHistory: {
        type: Array,
        default: () => [],
    },
    debugPerformance: {
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
    "reset-runtime-variables",
    "clear-runtime-variables",
    "clear-runtime-variable-history",
    "clear-runtime-performance-history",
    "trigger-widget-action",
    "widget-command",
]);

const debugOpen = ref(false);
const performanceTypeFilter = ref("all");
const performanceDurationFilter = ref("all");

const PERFORMANCE_TYPE_OPTIONS = [
    { key: "all", label: "全部" },
    { key: "interaction-chain", label: "交互链路" },
    { key: "page-init", label: "页面初始化" },
    { key: "source-refresh-batch", label: "批量刷新" },
];
const PERFORMANCE_DURATION_OPTIONS = [
    { key: "all", label: "全部" },
    { key: "slow", label: ">= 1.5s" },
    { key: "very-slow", label: ">= 3s" },
    { key: "issue", label: "异常/中断" },
];

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
            (props.debugSummary.variableHistoryCount ?? 0) > 0
                ? `变更 ${(props.debugSummary.variableHistoryCount ?? 0).toString()} 次`
                : props.debugVariables.length
                  ? "已有会话变量"
                  : "尚未设置",
    },
    {
        key: "performance",
        label: "耗时",
        value:
            (props.debugSummary.performanceCount ?? 0) > 0
                ? formatDuration(props.debugSummary.lastPerformanceDuration ?? 0)
                : "--",
        helper:
            (props.debugSummary.performanceCount ?? 0) > 0
                ? `均值 ${formatDuration(props.debugSummary.averagePerformanceDuration ?? 0)}`
                : "暂无统计",
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

const performanceTypeCounts = computed(() =>
    PERFORMANCE_TYPE_OPTIONS.reduce((accumulator, option) => {
        accumulator[option.key] =
            option.key === "all"
                ? props.debugPerformance.length
                : props.debugPerformance.filter(
                      (entry) => entry.type === option.key,
                  ).length;
        return accumulator;
    }, {}),
);

const performanceTypeOptions = computed(() =>
    PERFORMANCE_TYPE_OPTIONS.map((option) => ({
        ...option,
        count: performanceTypeCounts.value[option.key] ?? 0,
    })),
);

const typeFilteredDebugPerformance = computed(() =>
    props.debugPerformance.filter((entry) =>
        performanceTypeFilter.value === "all"
            ? true
            : entry.type === performanceTypeFilter.value,
    ),
);

const performanceDurationCounts = computed(() =>
    PERFORMANCE_DURATION_OPTIONS.reduce((accumulator, option) => {
        accumulator[option.key] = typeFilteredDebugPerformance.value.filter(
            (entry) => matchesPerformanceDurationFilter(entry, option.key),
        ).length;
        return accumulator;
    }, {}),
);

const performanceDurationOptions = computed(() =>
    PERFORMANCE_DURATION_OPTIONS.map((option) => ({
        ...option,
        count: performanceDurationCounts.value[option.key] ?? 0,
    })),
);

const filteredDebugPerformance = computed(() =>
    typeFilteredDebugPerformance.value.filter((entry) =>
        matchesPerformanceDurationFilter(entry, performanceDurationFilter.value),
    ),
);

const slowestDebugPerformance = computed(() =>
    [...filteredDebugPerformance.value]
        .filter((entry) => (entry.duration ?? 0) > 0)
        .sort((left, right) => (right.duration ?? 0) - (left.duration ?? 0))
        .slice(0, 3),
);

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

function formatDuration(duration) {
    const normalizedDuration = Math.max(0, Number(duration) || 0);

    if (normalizedDuration < 1000) {
        return `${Math.round(normalizedDuration)}ms`;
    }

    if (normalizedDuration < 10000) {
        return `${(normalizedDuration / 1000).toFixed(1)}s`;
    }

    if (normalizedDuration < 60000) {
        return `${Math.round(normalizedDuration / 1000)}s`;
    }

    const minutes = Math.floor(normalizedDuration / 60000);
    const seconds = Math.round((normalizedDuration % 60000) / 1000);

    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function getVariableHistoryActionLabel(action) {
    switch (action) {
        case "set":
            return "变量写入";
        case "clear":
            return "清空变量";
        case "reset":
            return "恢复预设";
        case "init":
            return "会话初始化";
        default:
            return "变量变更";
    }
}

function getVariableHistoryTone(entry) {
    switch (entry?.action) {
        case "set":
            return "success";
        case "clear":
            return "warning";
        default:
            return "info";
    }
}

function formatVariableHistoryKeys(keys = []) {
    if (!Array.isArray(keys) || !keys.length) {
        return "";
    }

    if (keys.length <= 3) {
        return keys.join("、");
    }

    return `${keys.slice(0, 3).join("、")} 等 ${keys.length} 项`;
}

function getVariableHistorySummary(entry) {
    if (entry?.key) {
        return `变量 ${entry.key} 已更新`;
    }

    const changedCount = Math.max(
        0,
        Number(entry?.changedCount) || entry?.changedKeys?.length || 0,
    );
    const keySummary = formatVariableHistoryKeys(entry?.changedKeys);

    if (entry?.action === "clear") {
        return changedCount
            ? `已清空 ${changedCount} 个变量${keySummary ? ` · ${keySummary}` : ""}`
            : "当前没有变量可清空";
    }

    if (entry?.action === "reset") {
        return changedCount
            ? `已恢复 ${changedCount} 个预设变量${keySummary ? ` · ${keySummary}` : ""}`
            : "当前变量已与项目预设一致";
    }

    if (entry?.action === "init") {
        return changedCount
            ? `已载入 ${changedCount} 个预设变量${keySummary ? ` · ${keySummary}` : ""}`
            : "当前会话没有预设变量";
    }

    return changedCount
        ? `影响 ${changedCount} 个变量${keySummary ? ` · ${keySummary}` : ""}`
        : "记录了一次变量变更";
}

function getVariableHistoryMeta(entry) {
    return [entry?.sourceLabel, entry?.widgetName, entry?.pageName]
        .filter(Boolean)
        .join(" · ");
}

function getPerformanceTypeLabel(type) {
    switch (type) {
        case "page-init":
            return "页面初始化";
        case "source-refresh-batch":
            return "批量刷新";
        case "interaction-chain":
            return "交互链路";
        default:
            return "执行耗时";
    }
}

function getPerformanceTone(entry) {
    if ((entry?.failureCount ?? 0) > 0) {
        return "error";
    }

    if (entry?.cancelled || (entry?.duration ?? 0) >= 1500) {
        return "warning";
    }

    if (entry?.type === "interaction-chain" || entry?.type === "page-init") {
        return "success";
    }

    return "info";
}

function matchesPerformanceDurationFilter(entry, filterKey) {
    const duration = Math.max(0, Number(entry?.duration) || 0);

    switch (filterKey) {
        case "slow":
            return duration >= 1500;
        case "very-slow":
            return duration >= 3000;
        case "issue":
            return entry?.cancelled === true || (entry?.failureCount ?? 0) > 0;
        default:
            return true;
    }
}

function getPerformanceSeverityLabel(entry) {
    if ((entry?.failureCount ?? 0) > 0) {
        return "异常";
    }

    if (entry?.cancelled) {
        return "中断";
    }

    if ((entry?.duration ?? 0) >= 3000) {
        return "超慢";
    }

    if ((entry?.duration ?? 0) >= 1500) {
        return "较慢";
    }

    return "";
}

function getPerformanceEntrySummary(entry) {
    if (entry?.type === "page-init") {
        return (
            entry.detail ||
            `当前页面已完成初始化${entry.refreshDataSources ? "，并同步数据源" : ""}`
        );
    }

    if (entry?.type === "source-refresh-batch") {
        return (
            entry.detail ||
            `${entry.successCount || 0} 个数据源刷新成功 / ${entry.failureCount || 0} 个失败`
        );
    }

    if (entry?.type === "interaction-chain") {
        return (
            entry.detail ||
            `${entry.successCount || 0} 个动作生效 / ${entry.skippedCount || 0} 个条件跳过`
        );
    }

    return entry?.detail || "已记录一次执行耗时";
}

function getPerformanceEntryMeta(entry) {
    return [entry?.sourceLabel, entry?.widgetName, entry?.pageName]
        .filter(Boolean)
        .join(" · ");
}

function getPerformanceEntryStats(entry) {
    const stats = [];

    if ((entry?.actionCount ?? 0) > 0) {
        stats.push(`动作 ${entry.actionCount}`);
    }

    if ((entry?.executedCount ?? 0) > 0) {
        stats.push(`执行 ${entry.executedCount}`);
    }

    if ((entry?.sourceCount ?? 0) > 0) {
        stats.push(`数据源 ${entry.sourceCount}`);
    }

    if (entry?.averageStepDurationLabel) {
        stats.push(`步均 ${entry.averageStepDurationLabel}`);
    }

    if (entry?.cancelled) {
        stats.push("已中断");
    }

    return stats.join(" · ");
}

function getPerformanceFilterHint() {
    const activeTypeOption =
        performanceTypeOptions.value.find(
            (option) => option.key === performanceTypeFilter.value,
        ) ?? performanceTypeOptions.value[0];
    const activeDurationOption =
        performanceDurationOptions.value.find(
            (option) => option.key === performanceDurationFilter.value,
        ) ?? performanceDurationOptions.value[0];

    return `类型 ${activeTypeOption?.label || "全部"} · 阈值 ${activeDurationOption?.label || "全部"} · ${filteredDebugPerformance.value.length} 条`;
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
                                <div class="runtime-debug__section-title">
                                    <span>运行时变量</span>
                                    <strong>{{
                                        debugVariables.length
                                    }}</strong>
                                </div>

                                <div class="runtime-debug__section-actions">
                                    <button
                                        class="ghost"
                                        type="button"
                                        @click="
                                            $emit('reset-runtime-variables')
                                        "
                                    >
                                        重置变量
                                    </button>
                                    <button
                                        class="ghost"
                                        type="button"
                                        @click="
                                            $emit('clear-runtime-variables')
                                        "
                                    >
                                        清空变量
                                    </button>
                                </div>
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
                                <div class="runtime-debug__section-title">
                                    <span>变量变更历史</span>
                                    <strong>{{
                                        debugVariableHistory.length
                                    }}</strong>
                                </div>

                                <div class="runtime-debug__section-actions">
                                    <button
                                        class="ghost"
                                        type="button"
                                        @click="$emit('clear-runtime-variable-history')"
                                    >
                                        清空历史
                                    </button>
                                </div>
                            </div>

                            <div
                                v-if="debugVariableHistory.length"
                                class="runtime-debug__history-list"
                            >
                                <article
                                    v-for="entry in debugVariableHistory"
                                    :key="entry.id"
                                    class="runtime-debug__history"
                                    :class="`is-${getVariableHistoryTone(entry)}`"
                                >
                                    <div class="runtime-debug__history-head">
                                        <strong>{{
                                            getVariableHistoryActionLabel(
                                                entry.action,
                                            )
                                        }}</strong>
                                        <span>{{
                                            formatEventTime(entry.at)
                                        }}</span>
                                    </div>

                                    <p class="runtime-debug__history-summary">
                                        {{ getVariableHistorySummary(entry) }}
                                    </p>

                                    <small
                                        v-if="getVariableHistoryMeta(entry)"
                                        class="runtime-debug__history-meta"
                                    >
                                        {{ getVariableHistoryMeta(entry) }}
                                    </small>

                                    <div
                                        v-if="entry.key"
                                        class="runtime-debug__history-change"
                                    >
                                        <div
                                            class="runtime-debug__history-value"
                                        >
                                            <span>变更前</span>
                                            <em>{{
                                                entry.previousPreview ||
                                                "未设置"
                                            }}</em>
                                        </div>
                                        <div
                                            class="runtime-debug__history-value"
                                        >
                                            <span>变更后</span>
                                            <em>{{
                                                entry.nextPreview || "未设置"
                                            }}</em>
                                        </div>
                                    </div>
                                </article>
                            </div>

                            <p v-else class="runtime-debug__empty">
                                当前会话还没有变量变更记录。
                            </p>
                        </section>

                        <section class="runtime-debug__section">
                            <div class="runtime-debug__section-head">
                                <div class="runtime-debug__section-title">
                                    <span>执行耗时</span>
                                    <strong>{{ debugPerformance.length }}</strong>
                                </div>

                                <div class="runtime-debug__section-actions">
                                    <button
                                        class="ghost"
                                        type="button"
                                        @click="$emit('clear-runtime-performance-history')"
                                    >
                                        清空耗时
                                    </button>
                                </div>
                            </div>

                            <div class="runtime-debug__performance-overview">
                                <article class="runtime-debug__performance-pill">
                                    <span>最近链路</span>
                                    <strong>{{
                                        (debugSummary.performanceCount ?? 0) > 0
                                            ? formatDuration(
                                                  debugSummary.lastPerformanceDuration,
                                              )
                                            : "--"
                                    }}</strong>
                                </article>
                                <article class="runtime-debug__performance-pill">
                                    <span>平均耗时</span>
                                    <strong>{{
                                        (debugSummary.performanceCount ?? 0) > 0
                                            ? formatDuration(
                                                  debugSummary.averagePerformanceDuration,
                                              )
                                            : "--"
                                    }}</strong>
                                </article>
                                <article class="runtime-debug__performance-pill">
                                    <span>最慢一项</span>
                                    <strong>{{
                                        (debugSummary.performanceCount ?? 0) > 0
                                            ? formatDuration(
                                                  debugSummary.slowestPerformanceDuration,
                                              )
                                            : "--"
                                    }}</strong>
                                </article>
                            </div>

                            <div class="runtime-debug__performance-toolbar">
                                <div class="runtime-debug__filter-row">
                                    <button
                                        v-for="option in performanceTypeOptions"
                                        :key="option.key"
                                        class="runtime-debug__filter-chip"
                                        :class="{
                                            'is-active':
                                                performanceTypeFilter ===
                                                option.key,
                                        }"
                                        type="button"
                                        @click="
                                            performanceTypeFilter = option.key
                                        "
                                    >
                                        {{ option.label }}
                                        <small>{{ option.count }}</small>
                                    </button>
                                </div>

                                <div class="runtime-debug__filter-row">
                                    <button
                                        v-for="option in performanceDurationOptions"
                                        :key="option.key"
                                        class="runtime-debug__filter-chip runtime-debug__filter-chip--duration"
                                        :class="{
                                            'is-active':
                                                performanceDurationFilter ===
                                                option.key,
                                        }"
                                        type="button"
                                        @click="
                                            performanceDurationFilter =
                                                option.key
                                        "
                                    >
                                        {{ option.label }}
                                        <small>{{ option.count }}</small>
                                    </button>
                                </div>

                                <p class="runtime-debug__section-tip">
                                    {{ getPerformanceFilterHint() }}
                                </p>
                            </div>

                            <div
                                v-if="slowestDebugPerformance.length"
                                class="runtime-debug__performance-ranking"
                            >
                                <div class="runtime-debug__performance-subhead">
                                    <span>慢链路 Top 3</span>
                                </div>

                                <article
                                    v-for="(entry, index) in slowestDebugPerformance"
                                    :key="`rank-${entry.id}`"
                                    class="runtime-debug__performance-rank"
                                >
                                    <div class="runtime-debug__performance-rank-head">
                                        <strong>{{
                                            `#${index + 1} ${getPerformanceTypeLabel(entry.type)}`
                                        }}</strong>
                                        <span>{{ entry.durationLabel }}</span>
                                    </div>
                                    <small
                                        v-if="getPerformanceSeverityLabel(entry)"
                                        class="runtime-debug__performance-tag"
                                    >
                                        {{ getPerformanceSeverityLabel(entry) }}
                                    </small>
                                    <small>{{
                                        getPerformanceEntryMeta(entry) ||
                                        getPerformanceEntrySummary(entry)
                                    }}</small>
                                </article>
                            </div>

                            <div
                                v-if="filteredDebugPerformance.length"
                                class="runtime-debug__performance-list"
                            >
                                <article
                                    v-for="entry in filteredDebugPerformance"
                                    :key="entry.id"
                                    class="runtime-debug__performance"
                                    :class="`is-${getPerformanceTone(entry)}`"
                                >
                                    <div class="runtime-debug__performance-head">
                                        <div
                                            class="runtime-debug__performance-head-main"
                                        >
                                            <strong>{{
                                                getPerformanceTypeLabel(
                                                    entry.type,
                                                )
                                            }}</strong>
                                            <small
                                                v-if="
                                                    getPerformanceSeverityLabel(
                                                        entry,
                                                    )
                                                "
                                                class="runtime-debug__performance-tag"
                                            >
                                                {{
                                                    getPerformanceSeverityLabel(
                                                        entry,
                                                    )
                                                }}
                                            </small>
                                        </div>
                                        <span>{{ entry.durationLabel }}</span>
                                    </div>

                                    <p class="runtime-debug__performance-summary">
                                        {{ getPerformanceEntrySummary(entry) }}
                                    </p>

                                    <small
                                        v-if="getPerformanceEntryMeta(entry)"
                                        class="runtime-debug__performance-meta"
                                    >
                                        {{ getPerformanceEntryMeta(entry) }}
                                    </small>

                                    <small
                                        v-if="getPerformanceEntryStats(entry)"
                                        class="runtime-debug__performance-meta"
                                    >
                                        {{ getPerformanceEntryStats(entry) }}
                                    </small>
                                </article>
                            </div>

                            <p
                                v-else-if="debugPerformance.length"
                                class="runtime-debug__empty"
                            >
                                当前筛选下没有执行耗时记录。
                            </p>

                            <p v-else class="runtime-debug__empty">
                                当前会话还没有执行耗时记录。
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
                                        ·
                                        {{
                                            source.retryAttempts
                                                ? `重试 ${source.retryAttempts} 次`
                                                : "首轮成功"
                                        }}
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
