<script setup>
import { computed, ref, watch } from "vue";
import DataSourcePanel from "./DataSourcePanel.vue";
import HistoryPanel from "./HistoryPanel.vue";
import LayerPanel from "./LayerPanel.vue";
import InspectorSection from "./inspector/InspectorSection.vue";
import SchemaFields from "./inspector/SchemaFields.vue";
import {
    baseFields,
    createPageFields,
    createWidgetFields,
    getWidgetSectionTitle,
    interactionActionOptions,
    styleFields,
} from "../editor/inspectorSchemas";
import {
    createInteractionAction,
    getInteractionActions,
} from "../editor/project";

const props = defineProps({
    page: {
        type: Object,
        default: null,
    },
    project: {
        type: Object,
        required: true,
    },
    pages: {
        type: Array,
        default: () => [],
    },
    currentPageId: {
        type: String,
        default: "",
    },
    selectedWidget: {
        type: Object,
        default: null,
    },
    selectedWidgets: {
        type: Array,
        default: () => [],
    },
    selectedBounds: {
        type: Object,
        default: null,
    },
    selectedIds: {
        type: Array,
        default: () => [],
    },
    primarySelectedId: {
        type: String,
        default: null,
    },
    currentHistoryLabel: {
        type: String,
        default: "当前项目",
    },
    undoEntries: {
        type: Array,
        default: () => [],
    },
    redoEntries: {
        type: Array,
        default: () => [],
    },
    canUndo: {
        type: Boolean,
        default: false,
    },
    canRedo: {
        type: Boolean,
        default: false,
    },
    dataSourceRuntime: {
        type: Object,
        default: () => ({}),
    },
    sourceUsageMap: {
        type: Object,
        default: () => ({}),
    },
    sourceBindingCounts: {
        type: Object,
        default: () => ({}),
    },
});

defineEmits([
    "select-layer",
    "toggle-layer-hidden",
    "toggle-layer-locked",
    "reorder-layer",
    "set-selected-hidden",
    "set-selected-locked",
    "align-selected",
    "distribute-selected",
    "create-source",
    "copy-all-sources-config",
    "clear-all-source-runtime",
    "remove-unused-sources",
    "locate-source-usage",
    "delete-source",
    "duplicate-source",
    "export-source",
    "import-source",
    "import-source-as-new",
    "apply-source-runtime-payload",
    "copy-source-runtime-payload",
    "refresh-source",
    "refresh-all-sources",
    "change-source-type",
    "update-source-payload",
    "copy-source-debug",
    "clear-source-runtime",
    "undo",
    "redo",
]);

const activeInteractionIndex = ref(0);
const interactionActionLabelMap = Object.fromEntries(
    interactionActionOptions.map((option) => [option.value, option.label]),
);
const interactionTriggerOptions = [
    { value: "click", label: "点击" },
    { value: "double-click", label: "双击" },
    { value: "hover", label: "悬停" },
    { value: "page-enter", label: "页面进入" },
];
const widgetTargetActionTypes = [
    "highlight-widgets",
    "show-widgets",
    "hide-widgets",
    "toggle-widgets-visibility",
];
const visibilityTargetActionTypes = [
    "show-widgets",
    "hide-widgets",
    "toggle-widgets-visibility",
];

const commonGroupId = computed(() => {
    if (props.selectedWidgets.length < 2) {
        return null;
    }

    const firstGroupId = props.selectedWidgets[0]?.groupId;

    if (!firstGroupId) {
        return null;
    }

    return props.selectedWidgets.every((item) => item.groupId === firstGroupId)
        ? firstGroupId
        : null;
});

const editableSelectedCount = computed(
    () =>
        props.selectedWidgets.filter((item) => !item.locked && !item.hidden)
            .length,
);

const compatibleSources = computed(() => {
    if (!props.selectedWidget) {
        return [];
    }

    return props.project.dataSources.filter(
        (source) => source.type === props.selectedWidget.type,
    );
});

const currentBoundSource = computed(() => {
    const sourceId = props.selectedWidget?.dataBinding?.sourceId;
    return sourceId
        ? (props.project.dataSources.find((source) => source.id === sourceId) ??
              null)
        : null;
});

const currentBoundRuntime = computed(() => {
    const sourceId = props.selectedWidget?.dataBinding?.sourceId;
    return sourceId ? (props.dataSourceRuntime[sourceId] ?? null) : null;
});

const otherWidgets = computed(() => {
    if (!props.selectedWidget) {
        return [];
    }

    return props.project.widgets.filter(
        (widget) => widget.id !== props.selectedWidget.id,
    );
});

const filterTargetWidgets = computed(() =>
    otherWidgets.value.filter((widget) => widget.type !== "filterBar"),
);

const availableTargetPages = computed(() =>
    props.pages.filter((item) => item.id !== props.currentPageId),
);

const panelTitle = computed(() => {
    if (props.selectedWidgets.length > 1) {
        return "多选概览";
    }

    if (props.selectedWidget) {
        return `${props.selectedWidget.name} 属性`;
    }

    return "页面配置";
});

const panelDescription = computed(() => {
    if (props.selectedWidgets.length > 1) {
        return "查看当前多选结果的规模、尺寸、编组状态，并快速执行批量排版操作。";
    }

    if (props.selectedWidget) {
        return "集中管理组件基础属性、样式、数据绑定和事件编排。";
    }

    return "未选中组件时，在这里配置页面尺寸、背景和全局画布参数。";
});

const barCategories = computed({
    get: () => props.selectedWidget?.props.categories?.join("\n") ?? "",
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.categories = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean);
    },
});

const barValues = computed({
    get: () => props.selectedWidget?.props.values?.join(", ") ?? "",
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.values = toNumberList(value);
    },
});

const lineLabels = computed({
    get: () => props.selectedWidget?.props.labels?.join("\n") ?? "",
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.labels = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean);
    },
});

const lineValues = computed({
    get: () => props.selectedWidget?.props.values?.join(", ") ?? "",
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.values = toNumberList(value);
    },
});

const heatmapXLabels = computed({
    get: () => props.selectedWidget?.props.xLabels?.join("\n") ?? "",
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.xLabels = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean);
    },
});

const heatmapYLabels = computed({
    get: () => props.selectedWidget?.props.yLabels?.join("\n") ?? "",
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.yLabels = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean);
    },
});

const heatmapMatrix = computed({
    get: () =>
        (Array.isArray(props.selectedWidget?.props.values)
            ? props.selectedWidget.props.values
            : []
        )
            .map((row) =>
                (Array.isArray(row) ? row : [])
                    .map((value) => Number(value ?? 0))
                    .join(", "),
            )
            .join("\n"),
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.values = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => toNumberList(item));
    },
});

const chinaMapItems = computed({
    get: () =>
        (Array.isArray(props.selectedWidget?.props.items)
            ? props.selectedWidget.props.items
            : []
        )
            .map((item) =>
                `${String(item?.name ?? "").trim()}|${Number(item?.value ?? 0)}`.trim(),
            )
            .filter(Boolean)
            .join("\n"),
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.items = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => {
                const [name = "", rawValue = "0"] = item.split("|");
                return {
                    name: name.trim(),
                    value: Number(rawValue.trim() || 0),
                };
            })
            .filter((item) => item.name);
    },
});

const chinaMapPoints = computed({
    get: () =>
        (Array.isArray(props.selectedWidget?.props.points)
            ? props.selectedWidget.props.points
            : []
        )
            .map((item) =>
                [
                    String(item?.name ?? "").trim(),
                    Number(item?.value ?? 0),
                    String(item?.category ?? "").trim(),
                    String(item?.color ?? "").trim(),
                    Number.isFinite(Number(item?.size))
                        ? String(Number(item.size))
                        : "",
                ].join("|"),
            )
            .filter(Boolean)
            .join("\n"),
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.points = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => {
                const [
                    name = "",
                    rawValue = "0",
                    category = "",
                    color = "",
                    rawSize = "",
                ] = item.split("|");
                const size = Number(rawSize.trim());
                return {
                    name: name.trim(),
                    value: Number(rawValue.trim() || 0),
                    category: category.trim(),
                    color: color.trim(),
                    ...(Number.isFinite(size) ? { size } : {}),
                };
            })
            .filter((item) => item.name);
    },
});

const chinaMapLinks = computed({
    get: () =>
        (Array.isArray(props.selectedWidget?.props.links)
            ? props.selectedWidget.props.links
            : []
        )
            .map((item) =>
                [
                    String(item?.from ?? "").trim(),
                    String(item?.to ?? "").trim(),
                    Number(item?.value ?? 0),
                    String(item?.color ?? "").trim(),
                ].join("|"),
            )
            .filter(Boolean)
            .join("\n"),
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.links = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => {
                const [from = "", to = "", rawValue = "0", color = ""] =
                    item.split("|");
                return {
                    from: from.trim(),
                    to: to.trim(),
                    value: Number(rawValue.trim() || 0),
                    color: color.trim(),
                };
            })
            .filter((item) => item.from && item.to);
    },
});

const noticeItems = computed({
    get: () =>
        (Array.isArray(props.selectedWidget?.props.items)
            ? props.selectedWidget.props.items
            : []
        )
            .map((item) => String(item ?? "").trim())
            .filter(Boolean)
            .join("\n"),
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.items = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean);
    },
});

const tabItems = computed({
    get: () =>
        (Array.isArray(props.selectedWidget?.props.items)
            ? props.selectedWidget.props.items
            : []
        )
            .map((item) =>
                [
                    String(item?.label ?? "").trim(),
                    String(item?.value ?? "").trim(),
                    String(item?.unit ?? "").trim(),
                    String(item?.description ?? "").trim(),
                    String(item?.meta ?? "").trim(),
                ].join("|"),
            )
            .filter(Boolean)
            .join("\n"),
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.items = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item, index) => {
                const [
                    label = "",
                    itemValue = "",
                    unit = "",
                    description = "",
                    meta = "",
                ] = item.split("|");
                return {
                    label: label.trim() || `标签 ${index + 1}`,
                    value: itemValue.trim(),
                    unit: unit.trim(),
                    description: description.trim(),
                    meta: meta.trim(),
                };
            });
    },
});

const filterOptions = computed({
    get: () =>
        (Array.isArray(props.selectedWidget?.props.options)
            ? props.selectedWidget.props.options
            : []
        )
            .map((item) =>
                [
                    String(item?.label ?? "").trim(),
                    String(item?.value ?? "").trim(),
                    Number.isFinite(Number(item?.count))
                        ? String(Number(item.count))
                        : "",
                ].join("|"),
            )
            .filter(Boolean)
            .join("\n"),
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.options = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item, index) => {
                const [label = "", optionValue = "", count = ""] =
                    item.split("|");
                return {
                    label: label.trim() || `选项 ${index + 1}`,
                    value: optionValue.trim() || label.trim() || `${index + 1}`,
                    count: Number(count.trim() || 0),
                };
            });
    },
});

const timelineItems = computed({
    get: () =>
        (Array.isArray(props.selectedWidget?.props.items)
            ? props.selectedWidget.props.items
            : []
        )
            .map((item) =>
                [
                    String(item?.time ?? "").trim(),
                    String(item?.title ?? "").trim(),
                    String(item?.description ?? "").trim(),
                    String(item?.tag ?? "").trim(),
                    String(item?.status ?? "").trim(),
                ].join("|"),
            )
            .filter(Boolean)
            .join("\n"),
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        props.selectedWidget.props.items = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item, index) => {
                const [
                    time = "",
                    title = "",
                    description = "",
                    tag = "",
                    status = "pending",
                ] = item.split("|");
                return {
                    time: time.trim(),
                    title: title.trim() || `节点 ${index + 1}`,
                    description: description.trim(),
                    tag: tag.trim(),
                    status: String(status || "pending").trim() || "pending",
                };
            });
    },
});

const rankingNames = computed({
    get: () =>
        (Array.isArray(props.selectedWidget?.props.items)
            ? props.selectedWidget.props.items
            : []
        )
            .map((item) => item?.name ?? "")
            .filter(Boolean)
            .join("\n"),
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        const names = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean);
        const currentItems = Array.isArray(props.selectedWidget.props.items)
            ? props.selectedWidget.props.items
            : [];

        props.selectedWidget.props.items = names.map((name, index) => ({
            name,
            value: Number(currentItems[index]?.value ?? 0),
        }));
    },
});

const rankingValues = computed({
    get: () =>
        (Array.isArray(props.selectedWidget?.props.items)
            ? props.selectedWidget.props.items
            : []
        )
            .map((item) => Number(item?.value ?? 0))
            .join(", "),
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        const values = toNumberList(value);
        const currentItems = Array.isArray(props.selectedWidget.props.items)
            ? props.selectedWidget.props.items
            : [];
        const total = Math.max(currentItems.length, values.length);

        props.selectedWidget.props.items = Array.from(
            { length: total },
            (_, index) => ({
                name: String(
                    currentItems[index]?.name ?? `项目 ${index + 1}`,
                ).trim(),
                value: Number.isFinite(values[index])
                    ? values[index]
                    : Number(currentItems[index]?.value ?? 0),
            }),
        ).filter((item) => item.name);
    },
});

const tableColumns = computed({
    get: () =>
        (Array.isArray(props.selectedWidget?.props.columns)
            ? props.selectedWidget.props.columns
            : []
        )
            .map((column) =>
                `${column?.key ?? ""}|${column?.label ?? ""}`.trim(),
            )
            .filter(Boolean)
            .join("\n"),
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        const columns = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item, index) => {
                const [rawKey = "", rawLabel = ""] = item.split("|");
                const key = rawKey.trim() || `column${index + 1}`;
                const label = rawLabel.trim() || key;
                return { key, label };
            });

        props.selectedWidget.props.columns = columns;
        const rows = Array.isArray(props.selectedWidget.props.rows)
            ? props.selectedWidget.props.rows
            : [];
        props.selectedWidget.props.rows = rows.map((row) =>
            Object.fromEntries(
                columns.map((column) => [column.key, row?.[column.key] ?? ""]),
            ),
        );
    },
});

const tableRows = computed({
    get: () => {
        const columns = Array.isArray(props.selectedWidget?.props.columns)
            ? props.selectedWidget.props.columns
            : [];
        const rows = Array.isArray(props.selectedWidget?.props.rows)
            ? props.selectedWidget.props.rows
            : [];
        return rows
            .map((row) =>
                columns
                    .map((column) => String(row?.[column.key] ?? ""))
                    .join("|"),
            )
            .join("\n");
    },
    set: (value) => {
        if (!props.selectedWidget) {
            return;
        }

        const columns = Array.isArray(props.selectedWidget.props.columns)
            ? props.selectedWidget.props.columns
            : [];
        props.selectedWidget.props.rows = value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => {
                const cells = item.split("|");
                return Object.fromEntries(
                    columns.map((column, index) => [
                        column.key,
                        String(cells[index] ?? "").trim(),
                    ]),
                );
            });
    },
});

const pageFields = computed(() =>
    createPageFields({
        page: props.page,
        project: props.project,
    }),
);

const widgetFields = computed(() =>
    createWidgetFields({
        widget: props.selectedWidget,
        barCategories,
        barValues,
        lineLabels,
        lineValues,
        heatmapXLabels,
        heatmapYLabels,
        heatmapMatrix,
        chinaMapItems,
        chinaMapPoints,
        chinaMapLinks,
        noticeItems,
        tabItems,
        filterOptions,
        timelineItems,
        rankingNames,
        rankingValues,
        tableColumns,
        tableRows,
    }),
);

const widgetSectionTitle = computed(() =>
    getWidgetSectionTitle(props.selectedWidget?.type),
);
const interactionActions = computed(
    () => props.selectedWidget?.interaction?.actions ?? [],
);
const selectedInteractionAction = computed(
    () => interactionActions.value[activeInteractionIndex.value] ?? null,
);

function ensureInteraction() {
    if (!props.selectedWidget) {
        return;
    }

    if (
        !props.selectedWidget.interaction ||
        typeof props.selectedWidget.interaction !== "object"
    ) {
        props.selectedWidget.interaction = {
            trigger: "click",
            actions: [],
        };
        return;
    }

    if (
        !interactionTriggerOptions.some(
            (option) =>
                option.value === props.selectedWidget.interaction.trigger,
        )
    ) {
        props.selectedWidget.interaction.trigger = "click";
    }

    if (!Array.isArray(props.selectedWidget.interaction.actions)) {
        props.selectedWidget.interaction.actions = getInteractionActions(
            props.selectedWidget.interaction,
        );
    }
}

watch(
    () => props.selectedWidget?.id ?? "",
    () => {
        activeInteractionIndex.value = 0;
        ensureInteraction();
    },
    { immediate: true },
);

watch(
    interactionActions,
    (actions) => {
        if (!actions.length) {
            activeInteractionIndex.value = 0;
            return;
        }

        if (activeInteractionIndex.value > actions.length - 1) {
            activeInteractionIndex.value = actions.length - 1;
        }
    },
    { deep: true },
);

function toNumberList(value) {
    return value
        .split(/[\s,，]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item));
}

function formatTime(timestamp) {
    if (!timestamp) {
        return "未刷新";
    }

    return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date(timestamp));
}

function addInteractionAction() {
    if (!props.selectedWidget) {
        return;
    }

    ensureInteraction();
    props.selectedWidget.interaction.actions.push(createInteractionAction());
    activeInteractionIndex.value =
        props.selectedWidget.interaction.actions.length - 1;
}

function removeInteractionAction(index) {
    if (!props.selectedWidget) {
        return;
    }

    ensureInteraction();
    props.selectedWidget.interaction.actions.splice(index, 1);

    if (activeInteractionIndex.value > index) {
        activeInteractionIndex.value -= 1;
    }
}

function moveInteractionAction(index, delta) {
    if (!props.selectedWidget) {
        return;
    }

    ensureInteraction();
    const nextIndex = index + delta;

    if (
        nextIndex < 0 ||
        nextIndex >= props.selectedWidget.interaction.actions.length
    ) {
        return;
    }

    const actions = props.selectedWidget.interaction.actions;
    const [action] = actions.splice(index, 1);
    actions.splice(nextIndex, 0, action);
    activeInteractionIndex.value = nextIndex;
}

function updateInteractionActionType(action, value) {
    action.action = value;

    if (!widgetTargetActionTypes.includes(value)) {
        action.targetWidgetIds = [];
    }

    if (value !== "refresh-sources") {
        action.targetSourceIds = [];
    }

    if (value !== "switch-page") {
        action.targetPageId = "";
    }
}

function updateInteractionActionDelay(action, value) {
    action.delay = Math.max(0, Number(value) || 0);
}

function getInteractionActionLabel(actionType) {
    return interactionActionLabelMap[actionType] ?? "未配置动作";
}

function usesWidgetTargets(actionType) {
    return widgetTargetActionTypes.includes(actionType);
}

function usesVisibilityTargets(actionType) {
    return visibilityTargetActionTypes.includes(actionType);
}

function getTargetWidgets(actionType) {
    return usesVisibilityTargets(actionType)
        ? props.project.widgets
        : otherWidgets.value;
}

function getTargetWidgetEmptyText(actionType) {
    return usesVisibilityTargets(actionType)
        ? "当前页面还没有可配置显隐的组件。"
        : "当前页面没有可联动的其他组件。";
}

function getInteractionActionSummary(action) {
    switch (action.action) {
        case "highlight-widgets":
            return action.targetWidgetIds?.length
                ? `高亮 ${action.targetWidgetIds.length} 个组件`
                : "未选择目标组件";
        case "show-widgets":
            return action.targetWidgetIds?.length
                ? `显示 ${action.targetWidgetIds.length} 个组件`
                : "未选择目标组件";
        case "hide-widgets":
            return action.targetWidgetIds?.length
                ? `隐藏 ${action.targetWidgetIds.length} 个组件`
                : "未选择目标组件";
        case "toggle-widgets-visibility":
            return action.targetWidgetIds?.length
                ? `切换 ${action.targetWidgetIds.length} 个组件显隐`
                : "未选择目标组件";
        case "refresh-sources":
            return action.targetSourceIds?.length
                ? `${action.targetSourceIds.length} 个数据源`
                : "未选择目标数据源";
        case "switch-page":
            return action.targetPageId
                ? (props.pages.find((page) => page.id === action.targetPageId)
                      ?.name ?? "已选择目标页面")
                : "未选择目标页面";
        default:
            return "请选择动作类型";
    }
}

function getInteractionDelayLabel(action) {
    return action.delay > 0 ? `延时 ${action.delay} ms` : "立即执行";
}

function toggleTargetWidget(
    widgetId,
    action = selectedInteractionAction.value,
) {
    if (!action) {
        return;
    }

    const selected = new Set(action.targetWidgetIds ?? []);

    if (selected.has(widgetId)) {
        selected.delete(widgetId);
    } else {
        selected.add(widgetId);
    }

    action.targetWidgetIds = Array.from(selected);
}

function toggleTargetSource(
    sourceId,
    action = selectedInteractionAction.value,
) {
    if (!action) {
        return;
    }

    const selected = new Set(action.targetSourceIds ?? []);

    if (selected.has(sourceId)) {
        selected.delete(sourceId);
    } else {
        selected.add(sourceId);
    }

    action.targetSourceIds = Array.from(selected);
}

function isTargetWidgetSelected(
    widgetId,
    action = selectedInteractionAction.value,
) {
    return Boolean(action?.targetWidgetIds?.includes(widgetId));
}

function isTargetSourceSelected(
    sourceId,
    action = selectedInteractionAction.value,
) {
    return Boolean(action?.targetSourceIds?.includes(sourceId));
}

function toggleFilterTargetWidget(widgetId) {
    if (!props.selectedWidget || props.selectedWidget.type !== "filterBar") {
        return;
    }

    const selected = new Set(
        Array.isArray(props.selectedWidget.props.targetWidgetIds)
            ? props.selectedWidget.props.targetWidgetIds
            : [],
    );

    if (selected.has(widgetId)) {
        selected.delete(widgetId);
    } else {
        selected.add(widgetId);
    }

    props.selectedWidget.props.targetWidgetIds = Array.from(selected);
}

function isFilterTargetWidgetSelected(widgetId) {
    return Boolean(
        props.selectedWidget?.props?.targetWidgetIds?.includes(widgetId),
    );
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
                        <strong>{{
                            commonGroupId ? "已统一编组" : "未统一编组"
                        }}</strong>
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
                caption="统一控制当前选区的显示与锁定状态。"
                storage-key="panel-multi-actions"
            >
                <div class="inspector-action-grid">
                    <button
                        class="ghost"
                        @click="$emit('set-selected-hidden', true)"
                    >
                        隐藏所选
                    </button>
                    <button
                        class="ghost"
                        @click="$emit('set-selected-hidden', false)"
                    >
                        显示所选
                    </button>
                    <button
                        class="ghost"
                        @click="$emit('set-selected-locked', true)"
                    >
                        锁定所选
                    </button>
                    <button
                        class="ghost"
                        @click="$emit('set-selected-locked', false)"
                    >
                        解锁所选
                    </button>
                </div>
            </InspectorSection>

            <InspectorSection
                title="排版操作"
                caption="对未锁定且可见的组件执行对齐与分布。"
                storage-key="panel-multi-layout"
            >
                <p class="inspector-tip">
                    当前可参与排版的组件：{{ editableSelectedCount }} 个
                </p>

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
                    可使用 Ctrl/Cmd
                    点选追加组件，拖动画布空白区域进行框选，Ctrl/Cmd + G
                    编组，Shift + Ctrl/Cmd + G 解组，Ctrl/Cmd + C 复制，Ctrl/Cmd
                    + V 粘贴，Ctrl/Cmd + A 全选。
                </p>
            </InspectorSection>

            <InspectorSection
                title="已选组件"
                caption="快速确认当前选区包含哪些组件。"
                storage-key="panel-multi-tags"
            >
                <div class="inspector-tag-list">
                    <span
                        v-for="widget in selectedWidgets"
                        :key="widget.id"
                        class="inspector-tag"
                    >
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
                        @click="
                            $emit(
                                'refresh-source',
                                selectedWidget.dataBinding.sourceId,
                            )
                        "
                    >
                        刷新
                    </button>
                </template>

                <label>
                    <span>绑定数据源</span>
                    <select v-model="selectedWidget.dataBinding.sourceId">
                        <option value="">未绑定</option>
                        <option
                            v-for="source in compatibleSources"
                            :key="source.id"
                            :value="source.id"
                        >
                            {{ source.name }}
                        </option>
                    </select>
                </label>

                <p v-if="compatibleSources.length" class="inspector-tip">
                    当前组件可绑定
                    {{ compatibleSources.length }}
                    个同类型数据源，预览模式下会按刷新间隔自动更新。
                </p>
                <p v-else class="inspector-tip">
                    当前没有匹配
                    {{ selectedWidget.type }}
                    类型的数据源，可在下方数据源中心新增。
                </p>

                <div v-if="currentBoundSource" class="binding-preview">
                    <span>当前来源</span>
                    <strong>{{ currentBoundSource.name }}</strong>
                    <span
                        >最近刷新：{{
                            formatTime(currentBoundRuntime?.updatedAt)
                        }}</span
                    >
                    <span
                        >绑定数量：{{
                            sourceBindingCounts[currentBoundSource.id] ?? 0
                        }}</span
                    >
                </div>
            </InspectorSection>

            <InspectorSection
                title="事件编排"
                caption="仅在预览模式生效，可按顺序执行多个动作，并为每一步设置延时。"
                storage-key="panel-widget-interaction"
            >
                <div class="interaction-flow__toolbar">
                    <p class="inspector-tip">
                        点击当前组件后，会从上到下依次执行这里配置的动作。
                    </p>
                    <button
                        class="ghost inspector-inline-button"
                        @click="addInteractionAction"
                    >
                        新增动作
                    </button>
                </div>

                <div v-if="interactionActions.length" class="interaction-flow">
                    <article
                        v-for="(action, index) in interactionActions"
                        :key="action.id"
                        class="interaction-card"
                        :class="{
                            'is-active': index === activeInteractionIndex,
                        }"
                    >
                        <div class="interaction-card__header">
                            <button
                                type="button"
                                class="interaction-card__summary"
                                @click="activeInteractionIndex = index"
                            >
                                <span class="interaction-card__eyebrow"
                                    >动作 {{ index + 1 }}</span
                                >
                                <strong class="interaction-card__title">{{
                                    getInteractionActionLabel(action.action)
                                }}</strong>
                                <span class="interaction-card__meta">{{
                                    getInteractionActionSummary(action)
                                }}</span>
                                <span class="interaction-card__delay">{{
                                    getInteractionDelayLabel(action)
                                }}</span>
                            </button>

                            <div class="interaction-card__controls">
                                <button
                                    class="ghost interaction-card__control"
                                    :disabled="index === 0"
                                    @click="moveInteractionAction(index, -1)"
                                >
                                    上移
                                </button>
                                <button
                                    class="ghost interaction-card__control"
                                    :disabled="
                                        index === interactionActions.length - 1
                                    "
                                    @click="moveInteractionAction(index, 1)"
                                >
                                    下移
                                </button>
                                <button
                                    class="ghost danger interaction-card__control"
                                    @click="removeInteractionAction(index)"
                                >
                                    删除
                                </button>
                            </div>
                        </div>

                        <div
                            v-if="index === activeInteractionIndex"
                            class="interaction-card__body"
                        >
                            <div class="inspector-grid">
                                <label>
                                    <span>触发方式</span>
                                    <select
                                        v-model="
                                            selectedWidget.interaction.trigger
                                        "
                                    >
                                        <option
                                            v-for="option in interactionTriggerOptions"
                                            :key="option.value"
                                            :value="option.value"
                                        >
                                            {{ option.label }}
                                        </option>
                                    </select>
                                </label>
                                <label>
                                    <span>动作类型</span>
                                    <select
                                        :value="action.action"
                                        @change="
                                            updateInteractionActionType(
                                                action,
                                                $event.target.value,
                                            )
                                        "
                                    >
                                        <option
                                            v-for="option in interactionActionOptions"
                                            :key="option.value"
                                            :value="option.value"
                                        >
                                            {{ option.label }}
                                        </option>
                                    </select>
                                </label>

                                <label>
                                    <span>延时（ms）</span>
                                    <input
                                        :value="action.delay"
                                        type="number"
                                        min="0"
                                        step="100"
                                        @input="
                                            updateInteractionActionDelay(
                                                action,
                                                $event.target.value,
                                            )
                                        "
                                    />
                                </label>
                            </div>

                            <template v-if="usesWidgetTargets(action.action)">
                                <span>目标组件</span>
                                <div
                                    v-if="
                                        getTargetWidgets(action.action).length
                                    "
                                    class="inspector-choice-grid"
                                >
                                    <button
                                        v-for="widget in getTargetWidgets(
                                            action.action,
                                        )"
                                        :key="widget.id"
                                        type="button"
                                        class="inspector-choice-button"
                                        :class="{
                                            'is-active': isTargetWidgetSelected(
                                                widget.id,
                                                action,
                                            ),
                                        }"
                                        @click="
                                            toggleTargetWidget(
                                                widget.id,
                                                action,
                                            )
                                        "
                                    >
                                        {{ widget.name }}
                                    </button>
                                </div>
                                <div v-else class="inspector-empty">
                                    {{
                                        getTargetWidgetEmptyText(action.action)
                                    }}
                                </div>
                            </template>

                            <template
                                v-else-if="action.action === 'refresh-sources'"
                            >
                                <span>目标数据源</span>
                                <div
                                    v-if="project.dataSources.length"
                                    class="inspector-choice-grid"
                                >
                                    <button
                                        v-for="source in project.dataSources"
                                        :key="source.id"
                                        type="button"
                                        class="inspector-choice-button"
                                        :class="{
                                            'is-active': isTargetSourceSelected(
                                                source.id,
                                                action,
                                            ),
                                        }"
                                        @click="
                                            toggleTargetSource(
                                                source.id,
                                                action,
                                            )
                                        "
                                    >
                                        {{ source.name }}
                                    </button>
                                </div>
                                <div v-else class="inspector-empty">
                                    当前项目还没有数据源。
                                </div>
                            </template>

                            <template
                                v-else-if="action.action === 'switch-page'"
                            >
                                <label>
                                    <span>目标页面</span>
                                    <select v-model="action.targetPageId">
                                        <option value="">请选择</option>
                                        <option
                                            v-for="item in availableTargetPages"
                                            :key="item.id"
                                            :value="item.id"
                                        >
                                            {{ item.name }}
                                        </option>
                                    </select>
                                </label>
                                <div
                                    v-if="!availableTargetPages.length"
                                    class="inspector-empty"
                                >
                                    当前只有一个页面，无法切换。
                                </div>
                            </template>

                            <div v-else class="inspector-empty">
                                请选择动作类型后，再配置具体目标。
                            </div>
                        </div>
                    </article>
                </div>

                <div v-else class="inspector-empty">
                    当前还没有配置事件动作，点击“新增动作”开始编排。
                </div>
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
                caption="根据组件类型展示对应的专属配置字段。"
                storage-key="panel-widget-schema"
            >
                <SchemaFields :fields="widgetFields" :model="selectedWidget" />
            </InspectorSection>

            <InspectorSection
                v-if="selectedWidget.type === 'filterBar'"
                title="联动目标"
                caption="选择当前筛选条要作用的组件；如果不选，默认作用于当前页面所有支持筛选的组件。"
                storage-key="panel-widget-filter-targets"
            >
                <div
                    v-if="filterTargetWidgets.length"
                    class="inspector-choice-grid"
                >
                    <button
                        v-for="widget in filterTargetWidgets"
                        :key="widget.id"
                        type="button"
                        class="inspector-choice-button"
                        :class="{
                            'is-active': isFilterTargetWidgetSelected(
                                widget.id,
                            ),
                        }"
                        @click="toggleFilterTargetWidget(widget.id)"
                    >
                        {{ widget.name }}
                    </button>
                </div>
                <div v-else class="inspector-empty">
                    当前页面暂无可联动的其他组件。
                </div>
            </InspectorSection>
        </div>

        <div v-else class="inspector">
            <InspectorSection
                title="当前页面"
                caption="配置页面名称、画布尺寸、背景和网格表现。"
                storage-key="panel-page-config"
            >
                <SchemaFields :fields="pageFields" :model="project" />
                <p class="inspector-tip">
                    页面名称用于管理和切换，画布标题用于大屏展示。
                </p>
                <p class="inspector-tip">
                    开启标尺后可从顶部或左侧拖出参考线，拖出画布即可删除。
                </p>
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
            :source-usages="sourceUsageMap"
            :data-source-runtime="dataSourceRuntime"
            @create-source="$emit('create-source', $event)"
            @copy-all-sources-config="$emit('copy-all-sources-config')"
            @clear-all-source-runtime="$emit('clear-all-source-runtime')"
            @remove-unused-sources="$emit('remove-unused-sources')"
            @locate-source-usage="$emit('locate-source-usage', $event)"
            @delete-source="$emit('delete-source', $event)"
            @duplicate-source="$emit('duplicate-source', $event)"
            @export-source="$emit('export-source', $event)"
            @import-source="$emit('import-source', $event)"
            @import-source-as-new="$emit('import-source-as-new')"
            @apply-source-runtime-payload="
                $emit('apply-source-runtime-payload', $event)
            "
            @copy-source-runtime-payload="
                $emit('copy-source-runtime-payload', $event)
            "
            @refresh-source="$emit('refresh-source', $event)"
            @refresh-all-sources="$emit('refresh-all-sources')"
            @change-source-type="$emit('change-source-type', $event)"
            @update-source-payload="$emit('update-source-payload', $event)"
            @copy-source-debug="$emit('copy-source-debug', $event)"
            @clear-source-runtime="$emit('clear-source-runtime', $event)"
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
