<script setup>
import { computed, defineAsyncComponent } from "vue";
import TextWidget from "./renderers/TextWidget.vue";
import StatWidget from "./renderers/StatWidget.vue";
import DigitStatWidget from "./renderers/DigitStatWidget.vue";
import PanelWidget from "./renderers/PanelWidget.vue";
import ImageWidget from "./renderers/ImageWidget.vue";
import VideoWidget from "./renderers/VideoWidget.vue";
import IframeWidget from "./renderers/IframeWidget.vue";
import ClockWidget from "./renderers/ClockWidget.vue";
import NoticeTickerWidget from "./renderers/NoticeTickerWidget.vue";
import TabPanelWidget from "./renderers/TabPanelWidget.vue";
import FilterBarWidget from "./renderers/FilterBarWidget.vue";
import TimelinePanelWidget from "./renderers/TimelinePanelWidget.vue";
import ChinaRegionMapWidget from "./renderers/ChinaRegionMapWidget.vue";
import TitleBarWidget from "./renderers/TitleBarWidget.vue";
import BorderFrameWidget from "./renderers/BorderFrameWidget.vue";
import { getInteractionActions } from "../editor/project";
import {
    applyWidgetRuntimeFilters,
    getWidgetRuntimeFilters,
} from "../editor/runtimeFilters";
import {
    createRuntimeTemplateScope,
    resolveRuntimeTemplateValue,
} from "../editor/runtimeTemplates";

const BarChartWidget = defineAsyncComponent(
    () => import("./renderers/BarChartWidget.vue"),
);
const LineChartWidget = defineAsyncComponent(
    () => import("./renderers/LineChartWidget.vue"),
);
const HeatmapChartWidget = defineAsyncComponent(
    () => import("./renderers/HeatmapChartWidget.vue"),
);
const PieChartWidget = defineAsyncComponent(
    () => import("./renderers/PieChartWidget.vue"),
);
const RankingListWidget = defineAsyncComponent(
    () => import("./renderers/RankingListWidget.vue"),
);
const DataTableWidget = defineAsyncComponent(
    () => import("./renderers/DataTableWidget.vue"),
);
const GaugeWidget = defineAsyncComponent(
    () => import("./renderers/GaugeWidget.vue"),
);

const props = defineProps({
    widget: {
        type: Object,
        required: true,
    },
    selected: {
        type: Boolean,
        default: false,
    },
    primarySelected: {
        type: Boolean,
        default: false,
    },
    previewMode: {
        type: Boolean,
        default: false,
    },
    canResize: {
        type: Boolean,
        default: false,
    },
    canMove: {
        type: Boolean,
        default: true,
    },
    linkedActive: {
        type: Boolean,
        default: false,
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
    pageContext: {
        type: Object,
        default: () => ({}),
    },
});

const emit = defineEmits([
    "select",
    "drag-start",
    "resize-start",
    "trigger-action",
    "widget-command",
]);

const componentMap = {
    text: TextWidget,
    stat: StatWidget,
    digitStat: DigitStatWidget,
    image: ImageWidget,
    video: VideoWidget,
    iframe: IframeWidget,
    clock: ClockWidget,
    noticeTicker: NoticeTickerWidget,
    tabPanel: TabPanelWidget,
    filterBar: FilterBarWidget,
    timelinePanel: TimelinePanelWidget,
    chinaRegionMap: ChinaRegionMapWidget,
    titleBar: TitleBarWidget,
    borderFrame: BorderFrameWidget,
    barChart: BarChartWidget,
    lineChart: LineChartWidget,
    heatmapChart: HeatmapChartWidget,
    pieChart: PieChartWidget,
    rankingList: RankingListWidget,
    dataTable: DataTableWidget,
    gauge: GaugeWidget,
    panel: PanelWidget,
};

const widgetStyle = computed(() => ({
    left: `${props.widget.x}px`,
    top: `${props.widget.y}px`,
    width: `${props.widget.w}px`,
    height: `${props.widget.h}px`,
    zIndex: props.widget.zIndex,
    opacity: props.widget.style.opacity,
    transform: `rotate(${props.widget.style.rotate}deg)`,
}));

const frameStyle = computed(() => ({
    background: props.widget.style.background,
    borderColor: props.widget.style.borderColor,
    borderRadius: `${props.widget.style.radius}px`,
    padding: `${props.widget.style.padding}px`,
}));

const renderer = computed(() => componentMap[props.widget.type] || PanelWidget);
const interactionActions = computed(() =>
    getInteractionActions(props.widget.interaction).filter(
        (action) => action.action !== "none",
    ),
);
const interactionTrigger = computed(
    () => props.widget.interaction?.trigger || "click",
);
const interactive = computed(
    () =>
        props.previewMode &&
        interactionActions.value.length > 0 &&
        ["click", "double-click", "hover"].includes(interactionTrigger.value),
);

const interactionLabelMap = {
    "highlight-widgets": "联动高亮",
    "refresh-sources": "刷新数据",
    "switch-page": "切换页面",
    "show-widgets": "显示组件",
    "hide-widgets": "隐藏组件",
    "toggle-widgets-visibility": "切换显隐",
    "patch-widget-props": "更新属性",
    "set-runtime-variable": "设置变量",
};

const interactionLabel = computed(() => {
    if (interactionActions.value.length > 1) {
        return `${interactionActions.value.length} 个动作`;
    }

    return interactionLabelMap[interactionActions.value[0]?.action] ?? "";
});

function finalizeDisplayWidget(widget, sourcePayload = null) {
    const runtimeFilters = getWidgetRuntimeFilters(
        props.widget.id,
        props.runtimeFilters,
        props.widget.type,
    );
    const filteredWidget = {
        ...widget,
        props: applyWidgetRuntimeFilters(widget, runtimeFilters),
    };

    if (!props.previewMode) {
        return filteredWidget;
    }

    const resolvedProps = resolveRuntimeTemplateValue(
        filteredWidget.props,
        createRuntimeTemplateScope({
            widgetProps: filteredWidget.props,
            sourcePayload,
            runtimeVariables: props.runtimeVariables,
            page: props.pageContext,
        }),
    );

    return {
        ...filteredWidget,
        props: resolvedProps,
    };
}

const displayWidget = computed(() => {
    const sourceId = props.widget.dataBinding?.sourceId;

    if (!sourceId) {
        return finalizeDisplayWidget(props.widget, null);
    }

    const runtimePayload = props.dataSourceRuntime[sourceId]?.payload;

    if (!runtimePayload) {
        return finalizeDisplayWidget(props.widget, null);
    }

    const mergedProps = {
        ...props.widget.props,
        ...runtimePayload,
    };

    if (
        props.widget.type === "filterBar" &&
        Object.hasOwn(props.widget.props, "activeValue")
    ) {
        mergedProps.activeValue = props.widget.props.activeValue;
    }

    if (
        props.widget.type === "chinaRegionMap" &&
        Object.hasOwn(props.widget.props, "activeProvince")
    ) {
        mergedProps.activeProvince = props.widget.props.activeProvince;
    }

    if (
        ["barChart", "lineChart", "pieChart", "heatmapChart"].includes(
            props.widget.type,
        ) &&
        Object.hasOwn(props.widget.props, "activeCategory")
    ) {
        mergedProps.activeCategory = props.widget.props.activeCategory;
    }

    return finalizeDisplayWidget(
        {
            ...props.widget,
            props: mergedProps,
        },
        runtimePayload,
    );
});

let suppressClickInteraction = false;

function handleWidgetCommand(command) {
    if (
        command?.command === "select-category" ||
        command?.command === "select-region"
    ) {
        // 图表/地图点选优先走筛选，避免同一次点击再触发外框 click 交互
        suppressClickInteraction = true;
        queueMicrotask(() => {
            suppressClickInteraction = false;
        });
    }

    emit("widget-command", {
        widgetId: props.widget.id,
        ...(command ?? {}),
    });
}

function emitTriggerAction(event) {
    emit("trigger-action", {
        widgetId: props.widget.id,
        event,
    });
}

function handleSelect(event) {
    if (props.previewMode) {
        return;
    }

    emit("select", {
        widgetId: props.widget.id,
        event,
    });
}

function handleDragStart(event) {
    if (props.previewMode) {
        return;
    }

    emit("drag-start", {
        widgetId: props.widget.id,
        event,
    });
}

function handleResizeStart(event) {
    if (props.previewMode) {
        return;
    }

    emit("resize-start", {
        widgetId: props.widget.id,
        event,
    });
}

function handleFramePointerDown(event) {
    if (props.previewMode) {
        return;
    }

    event.preventDefault();

    if (props.canMove) {
        handleDragStart(event);
        return;
    }

    handleSelect(event);
}

function handleFrameClick(event) {
    if (suppressClickInteraction) {
        suppressClickInteraction = false;
        return;
    }

    if (
        !props.previewMode ||
        !interactionActions.value.length ||
        interactionTrigger.value !== "click"
    ) {
        return;
    }

    emitTriggerAction(event);
}

function handleFrameDoubleClick(event) {
    if (
        !props.previewMode ||
        !interactionActions.value.length ||
        interactionTrigger.value !== "double-click"
    ) {
        return;
    }

    emitTriggerAction(event);
}

function handleFrameMouseEnter(event) {
    if (
        !props.previewMode ||
        !interactionActions.value.length ||
        interactionTrigger.value !== "hover"
    ) {
        return;
    }

    emitTriggerAction(event);
}
</script>

<template>
    <div
        class="stage-widget"
        :class="{
            'is-selected': selected,
            'is-primary': primarySelected,
            'is-grouped': Boolean(widget.groupId),
            'is-locked': widget.locked,
            'is-linked-active': linkedActive,
            'is-interactive': interactive,
        }"
        :style="widgetStyle"
    >
        <div
            class="stage-widget__frame"
            :style="frameStyle"
            @pointerdown.stop="handleFramePointerDown"
            @click.stop="handleFrameClick"
            @dblclick.stop="handleFrameDoubleClick"
            @mouseenter="handleFrameMouseEnter"
        >
            <component
                :is="renderer"
                :widget="displayWidget"
                :preview-mode="previewMode"
                @widget-command="handleWidgetCommand"
            />
            <span v-if="!previewMode" class="stage-widget__name">{{
                widget.name
            }}</span>
            <span
                v-if="widget.groupId && !previewMode"
                class="stage-widget__group-badge"
                >G</span
            >
            <span
                v-if="widget.locked && !previewMode"
                class="stage-widget__lock-badge"
                >锁定</span
            >
            <span
                v-if="widget.dataBinding?.sourceId && !previewMode"
                class="stage-widget__data-badge"
                >数据</span
            >
            <span
                v-if="interactionLabel && !previewMode"
                class="stage-widget__action-badge"
            >
                {{ interactionLabel }}
            </span>
            <button
                v-if="canResize && !previewMode"
                class="stage-widget__resize-handle"
                @pointerdown.stop.prevent="handleResizeStart"
            />
        </div>
    </div>
</template>
