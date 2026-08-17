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
    createInteractionConditionRule,
    createRuntimeVariablePreset,
    getInteractionActions,
} from "../editor/project";
import {
    isFilterableWidgetType,
    isFilterSourceWidgetType,
} from "../editor/runtimeFilters";

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

const emit = defineEmits([
    "select-layer",
    "toggle-layer-hidden",
    "toggle-layer-locked",
    "reorder-layer",
    "locate-interaction-node",
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
    { value: "condition-match", label: "条件命中" },
];
const interactionTriggerLabelMap = Object.fromEntries(
    interactionTriggerOptions.map((option) => [option.value, option.label]),
);
const interactionConditionSourceOptions = [
    { value: "widget-props", label: "当前组件运行值" },
    { value: "source-payload", label: "绑定数据源 payload" },
    { value: "runtime-variables", label: "运行时变量" },
];
const interactionConditionLogicOptions = [
    { value: "all", label: "满足全部" },
    { value: "any", label: "满足任一" },
];
const interactionConditionOperatorOptions = [
    { value: "truthy", label: "有值/为真" },
    { value: "falsy", label: "为空/为假" },
    { value: "exists", label: "字段存在" },
    { value: "eq", label: "等于" },
    { value: "neq", label: "不等于" },
    { value: "gt", label: "大于" },
    { value: "gte", label: "大于等于" },
    { value: "lt", label: "小于" },
    { value: "lte", label: "小于等于" },
    { value: "includes", label: "包含" },
];
const interactionConditionSourceLabelMap = Object.fromEntries(
    interactionConditionSourceOptions.map((option) => [option.value, option.label]),
);
const interactionConditionLogicLabelMap = Object.fromEntries(
    interactionConditionLogicOptions.map((option) => [option.value, option.label]),
);
const interactionConditionOperatorLabelMap = Object.fromEntries(
    interactionConditionOperatorOptions.map((option) => [option.value, option.label]),
);
const widgetTargetActionTypes = [
    "highlight-widgets",
    "show-widgets",
    "hide-widgets",
    "toggle-widgets-visibility",
    "patch-widget-props",
];
const visibilityTargetActionTypes = [
    "show-widgets",
    "hide-widgets",
    "toggle-widgets-visibility",
];
const pageWidgetTargetActionTypes = [
    ...visibilityTargetActionTypes,
    "patch-widget-props",
];
const interactionConditionValueOperators = new Set([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "includes",
]);
const interactionFlowScope = ref("current-page");

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
    otherWidgets.value.filter((widget) => isFilterableWidgetType(widget.type)),
);

const showFilterTargetSection = computed(() =>
    isFilterSourceWidgetType(props.selectedWidget?.type),
);

const availableTargetPages = computed(() =>
    props.pages.filter((item) => item.id !== props.currentPageId),
);

const projectWidgetNodes = computed(() =>
    props.pages.flatMap((page) =>
        page.widgets.map((widget, index) => ({
            id: widget.id,
            name: widget.name,
            widget,
            pageId: page.id,
            pageName: page.name,
            widgetIndex: index,
        })),
    ),
);

const projectWidgetNodeMap = computed(
    () => new Map(projectWidgetNodes.value.map((node) => [node.id, node])),
);

const projectPageMap = computed(
    () => new Map(props.pages.map((page) => [page.id, page])),
);

const projectSourceMap = computed(
    () =>
        new Map(
            (props.project.dataSources ?? []).map((source) => [source.id, source]),
        ),
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
const runtimeVariablePresets = computed(() =>
    Array.isArray(props.project.runtimeVariablePresets)
        ? props.project.runtimeVariablePresets
        : [],
);
const interactionFlowHint = computed(() => {
    switch (props.selectedWidget?.interaction?.trigger) {
        case "double-click":
            return "双击当前组件后，会从上到下依次执行这里配置的动作。";
        case "hover":
            return "鼠标移入当前组件后，会从上到下依次执行这里配置的动作。";
        case "page-enter":
            return "进入当前页面后，会自动按顺序执行这里配置的动作。";
        case "condition-match":
            return "当前组件的条件命中后，会自动按顺序执行这里配置的动作。";
        default:
            return "点击当前组件后，会从上到下依次执行这里配置的动作。";
    }
});

const interactionFlowEntries = computed(() =>
    props.pages.flatMap((page, pageIndex) =>
        page.widgets.flatMap((widget, widgetIndex) =>
            getInteractionActions(widget.interaction)
                .filter((action) => action.action !== "none")
                .map((action, actionIndex) => {
                    const trigger = widget.interaction?.trigger || "click";

                    return {
                        id: action.id || `${page.id}-${widget.id}-${actionIndex}`,
                        pageId: page.id,
                        pageName: page.name,
                        pageIndex,
                        widgetIndex,
                        actionIndex,
                        sourceWidgetId: widget.id,
                        sourceWidgetName: widget.name,
                        trigger,
                        triggerLabel:
                            interactionTriggerLabelMap[trigger] ?? "点击",
                        actionType: action.action,
                        actionLabel: getInteractionActionLabel(action.action),
                        delay: action.delay ?? 0,
                        delayLabel: getInteractionDelayLabel(action),
                        conditionEnabled: hasInteractionCondition(action),
                        conditionSummary: getInteractionConditionSummary(action),
                        targetPropsPatch:
                            typeof action.targetPropsPatch === "string"
                                ? action.targetPropsPatch
                                : "{}",
                        targetVariableKey:
                            typeof action.targetVariableKey === "string"
                                ? action.targetVariableKey
                                : "",
                        targetVariableValue:
                            action.targetVariableValue == null
                                ? ""
                                : String(action.targetVariableValue),
                        targetWidgets: (action.targetWidgetIds ?? []).map(
                            (targetId) => {
                                const target =
                                    projectWidgetNodeMap.value.get(targetId);

                                return target
                                    ? {
                                          id: target.id,
                                          name: target.name,
                                          pageId: target.pageId,
                                          pageName: target.pageName,
                                          missing: false,
                                      }
                                    : {
                                          id: targetId,
                                          name: "目标组件已失效",
                                          pageId: "",
                                          pageName: "",
                                          missing: true,
                                      };
                            },
                        ),
                        targetSources: (action.targetSourceIds ?? []).map(
                            (sourceId) => {
                                const source = projectSourceMap.value.get(sourceId);

                                return source
                                    ? {
                                          id: source.id,
                                          name: source.name,
                                          missing: false,
                                      }
                                    : {
                                          id: sourceId,
                                          name: "目标数据源已失效",
                                          missing: true,
                                      };
                            },
                        ),
                        targetPage: action.targetPageId
                            ? projectPageMap.value.get(action.targetPageId)
                                ? {
                                      id: action.targetPageId,
                                      name:
                                          projectPageMap.value.get(
                                              action.targetPageId,
                                          )?.name ?? "目标页面",
                                      missing: false,
                                  }
                                : {
                                      id: action.targetPageId,
                                      name: "目标页面已失效",
                                      missing: true,
                                  }
                            : null,
                    };
                }),
        ),
    ),
);

const visibleInteractionFlowEntries = computed(() =>
    interactionFlowScope.value === "all-pages"
        ? interactionFlowEntries.value
        : interactionFlowEntries.value.filter(
              (entry) => entry.pageId === props.currentPageId,
          ),
);

const interactionConfiguredWidgetCount = computed(
    () => new Set(interactionFlowEntries.value.map((entry) => entry.sourceWidgetId)).size,
);

const selectedWidgetOutgoingEntries = computed(() => {
    if (!props.selectedWidget) {
        return [];
    }

    return interactionFlowEntries.value.filter(
        (entry) => entry.sourceWidgetId === props.selectedWidget.id,
    );
});

const selectedWidgetIncomingEntries = computed(() => {
    if (!props.selectedWidget) {
        return [];
    }

    return interactionFlowEntries.value.filter((entry) =>
        entry.targetWidgets.some(
            (target) =>
                !target.missing && target.id === props.selectedWidget?.id,
        ),
    );
});

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

    if (value !== "patch-widget-props") {
        action.targetPropsPatch = "{}";
    } else if (
        typeof action.targetPropsPatch !== "string" ||
        !action.targetPropsPatch.trim()
    ) {
        action.targetPropsPatch = "{\n  \"value\": \"\"\n}";
    }

    if (value !== "set-runtime-variable") {
        action.targetVariableKey = "";
        action.targetVariableValue = "";
    }
}

function updateInteractionActionDelay(action, value) {
    action.delay = Math.max(0, Number(value) || 0);
}

function isLegacyInteractionConditionShape(condition) {
    return Boolean(
        condition &&
            typeof condition === "object" &&
            !Array.isArray(condition) &&
            ("source" in condition ||
                "field" in condition ||
                "operator" in condition ||
                "value" in condition),
    );
}

function ensureInteractionCondition(action) {
    if (!action) {
        return;
    }

    if (
        !action.condition ||
        typeof action.condition !== "object" ||
        Array.isArray(action.condition)
    ) {
        action.condition = {
            enabled: false,
            logic: "all",
            rules: [],
        };
    }

    const legacyRule = isLegacyInteractionConditionShape(action.condition)
        ? createInteractionConditionRule(action.condition)
        : null;

    action.condition.enabled = Boolean(action.condition.enabled);
    action.condition.logic =
        interactionConditionLogicLabelMap[action.condition.logic]
            ? action.condition.logic
            : "all";
    action.condition.rules = Array.isArray(action.condition.rules)
        ? action.condition.rules.map((rule) => createInteractionConditionRule(rule))
        : legacyRule
          ? [legacyRule]
          : [];

    if (action.condition.enabled && !action.condition.rules.length) {
        action.condition.rules = [createInteractionConditionRule()];
    }
}

function hasInteractionCondition(action) {
    ensureInteractionCondition(action);
    return Boolean(action?.condition?.enabled);
}

function doesInteractionConditionUseValue(operator) {
    return interactionConditionValueOperators.has(operator);
}

function getInteractionConditionRules(action) {
    ensureInteractionCondition(action);
    return Array.isArray(action?.condition?.rules) ? action.condition.rules : [];
}

function setInteractionConditionEnabled(action, enabled) {
    ensureInteractionCondition(action);
    action.condition.enabled = Boolean(enabled);

    if (action.condition.enabled && !action.condition.rules.length) {
        action.condition.rules = [createInteractionConditionRule()];
    }
}

function addInteractionConditionRule(action) {
    ensureInteractionCondition(action);
    action.condition.rules = [
        ...getInteractionConditionRules(action),
        createInteractionConditionRule(),
    ];
}

function removeInteractionConditionRule(action, ruleIndex) {
    const rules = getInteractionConditionRules(action);

    if (rules.length <= 1) {
        return;
    }

    action.condition.rules = rules.filter((_, index) => index !== ruleIndex);
}

function getInteractionConditionRuleSummary(rule) {
    const sourceLabel =
        interactionConditionSourceLabelMap[rule?.source] ?? "当前组件运行值";
    const fieldLabel =
        typeof rule?.field === "string" && rule.field.trim().length
            ? rule.field.trim()
            : "(整体值)";
    const operatorLabel =
        interactionConditionOperatorLabelMap[rule?.operator] ?? "命中";

    if (!doesInteractionConditionUseValue(rule?.operator)) {
        return `${sourceLabel} · ${fieldLabel} ${operatorLabel}`;
    }

    return `${sourceLabel} · ${fieldLabel} ${operatorLabel} ${rule?.value ?? ""}`;
}

function getInteractionConditionSummary(action) {
    if (!hasInteractionCondition(action)) {
        return "未启用条件判断";
    }

    const rules = getInteractionConditionRules(action);

    if (!rules.length) {
        return "已启用，但尚未配置条件";
    }

    const joiner = action.condition.logic === "any" ? " 或 " : " 且 ";
    const summary = rules.map((rule) => getInteractionConditionRuleSummary(rule));

    return summary.length > 1
        ? `${interactionConditionLogicLabelMap[action.condition.logic] ?? "满足全部"}：${summary.join(joiner)}`
        : summary[0];
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
    return pageWidgetTargetActionTypes.includes(actionType)
        ? props.project.widgets
        : otherWidgets.value;
}

function getTargetWidgetEmptyText(actionType) {
    if (actionType === "patch-widget-props") {
        return "当前页面还没有可编排状态的组件。";
    }

    return usesVisibilityTargets(actionType)
        ? "当前页面还没有可配置显隐的组件。"
        : "当前页面没有可联动的其他组件。";
}

function getInteractionPropsPatchPreview(action) {
    const preview = String(action?.targetPropsPatch ?? "").trim() || "{}";
    return preview.length > 44 ? `${preview.slice(0, 43)}…` : preview;
}

function getInteractionVariablePreview(action) {
    const key = String(action?.targetVariableKey ?? "").trim();
    const value = String(action?.targetVariableValue ?? "").trim();

    if (!key) {
        return "未填写变量名";
    }

    return value ? `${key} = ${value}` : `${key} = ""`;
}

function getInteractionActionSummary(action) {
    const conditionSuffix = hasInteractionCondition(action)
        ? ` · 条件：${getInteractionConditionSummary(action)}`
        : "";

    switch (action.action) {
        case "highlight-widgets":
            return action.targetWidgetIds?.length
                ? `高亮 ${action.targetWidgetIds.length} 个组件${conditionSuffix}`
                : `未选择目标组件${conditionSuffix}`;
        case "show-widgets":
            return action.targetWidgetIds?.length
                ? `显示 ${action.targetWidgetIds.length} 个组件${conditionSuffix}`
                : `未选择目标组件${conditionSuffix}`;
        case "hide-widgets":
            return action.targetWidgetIds?.length
                ? `隐藏 ${action.targetWidgetIds.length} 个组件${conditionSuffix}`
                : `未选择目标组件${conditionSuffix}`;
        case "toggle-widgets-visibility":
            return action.targetWidgetIds?.length
                ? `切换 ${action.targetWidgetIds.length} 个组件显隐${conditionSuffix}`
                : `未选择目标组件${conditionSuffix}`;
        case "refresh-sources":
            return action.targetSourceIds?.length
                ? `${action.targetSourceIds.length} 个数据源${conditionSuffix}`
                : `未选择目标数据源${conditionSuffix}`;
        case "switch-page":
            return action.targetPageId
                ? (props.pages.find((page) => page.id === action.targetPageId)
                      ?.name ?? "已选择目标页面") + conditionSuffix
                : `未选择目标页面${conditionSuffix}`;
        case "patch-widget-props":
            return action.targetWidgetIds?.length
                ? `更新 ${action.targetWidgetIds.length} 个组件属性 · ${getInteractionPropsPatchPreview(action)}${conditionSuffix}`
                : `未选择目标组件${conditionSuffix}`;
        case "set-runtime-variable":
            return `${getInteractionVariablePreview(action)}${conditionSuffix}`;
        default:
            return hasInteractionCondition(action)
                ? `请选择动作类型 · 条件：${getInteractionConditionSummary(action)}`
                : "请选择动作类型";
    }
}

function getInteractionDelayLabel(action) {
    return action.delay > 0 ? `延时 ${action.delay} ms` : "立即执行";
}

function getInteractionEntryTargetSummary(entry) {
    switch (entry.actionType) {
        case "highlight-widgets":
            return entry.targetWidgets.length
                ? `高亮 ${entry.targetWidgets.map((item) => item.name).join("、")}`
                : "未配置高亮目标";
        case "show-widgets":
            return entry.targetWidgets.length
                ? `显示 ${entry.targetWidgets.map((item) => item.name).join("、")}`
                : "未配置显示目标";
        case "hide-widgets":
            return entry.targetWidgets.length
                ? `隐藏 ${entry.targetWidgets.map((item) => item.name).join("、")}`
                : "未配置隐藏目标";
        case "toggle-widgets-visibility":
            return entry.targetWidgets.length
                ? `切换 ${entry.targetWidgets.map((item) => item.name).join("、")} 的显隐`
                : "未配置显隐目标";
        case "refresh-sources":
            return entry.targetSources.length
                ? `刷新 ${entry.targetSources.map((item) => item.name).join("、")}`
                : "未配置数据源目标";
        case "switch-page":
            return entry.targetPage
                ? `切换到 ${entry.targetPage.name}`
                : "未配置目标页面";
        case "patch-widget-props":
            return entry.targetWidgets.length
                ? `更新 ${entry.targetWidgets.map((item) => item.name).join("、")} · ${getInteractionPropsPatchPreview(entry)}`
                : "未配置属性更新目标";
        case "set-runtime-variable":
            return getInteractionVariablePreview(entry);
        default:
            return "请先配置动作目标";
    }
}

function locateInteractionNode(payload = {}) {
    if (!payload.pageId && !payload.widgetId) {
        return;
    }

    emit("locate-interaction-node", payload);
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
    if (
        !props.selectedWidget ||
        !isFilterSourceWidgetType(props.selectedWidget.type)
    ) {
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

function addRuntimeVariablePreset() {
    if (!Array.isArray(props.project.runtimeVariablePresets)) {
        props.project.runtimeVariablePresets = [];
    }

    props.project.runtimeVariablePresets.push(createRuntimeVariablePreset());
}

function removeRuntimeVariablePreset(index) {
    if (!Array.isArray(props.project.runtimeVariablePresets)) {
        return;
    }

    props.project.runtimeVariablePresets.splice(index, 1);
}

function isRuntimeVariablePresetKeyDuplicated(index) {
    const preset = runtimeVariablePresets.value[index];
    const key = String(preset?.key ?? "").trim();

    if (!key) {
        return false;
    }

    return (
        runtimeVariablePresets.value.filter(
            (item) => String(item?.key ?? "").trim() === key,
        ).length > 1
    );
}

function getRuntimeVariablePresetSummary(preset, index) {
    const key = String(preset?.key ?? "").trim();

    if (!key) {
        return `变量 ${index + 1}：请填写变量名`;
    }

    if (isRuntimeVariablePresetKeyDuplicated(index)) {
        return `变量 ${key} 重复，运行时会以后面的配置为准`;
    }

    const value = String(preset?.value ?? "").trim();
    return value ? `${key} = ${value}` : `${key} = ""`;
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
                        {{ interactionFlowHint }}
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

                            <template
                                v-else-if="
                                    action.action === 'set-runtime-variable'
                                "
                            >
                                <div class="inspector-grid">
                                    <label>
                                        <span>变量名</span>
                                        <input
                                            v-model.trim="
                                                action.targetVariableKey
                                            "
                                            type="text"
                                            placeholder="例如 region / dashboard.filter"
                                        />
                                    </label>

                                    <label>
                                        <span>变量值</span>
                                        <input
                                            v-model="action.targetVariableValue"
                                            type="text"
                                            placeholder="例如 {{ widget.value }} 或 华东"
                                        />
                                    </label>
                                </div>

                                <p class="inspector-tip">
                                    支持使用
                                    <code v-pre>{{ widget.value }}</code>、
                                    <code v-pre>{{ source.total }}</code>、
                                    <code v-pre>{{ runtime.region }}</code>
                                    这类模板引用当前组件、绑定数据源和已有运行时变量。
                                </p>
                            </template>

                            <div v-else class="inspector-empty">
                                请选择动作类型后，再配置具体目标。
                            </div>

                            <template
                                v-if="action.action === 'patch-widget-props'"
                            >
                                <label>
                                    <span>属性补丁（JSON）</span>
                                    <textarea
                                        v-model="action.targetPropsPatch"
                                        class="interaction-config__textarea"
                                        rows="6"
                                        placeholder='例如 {&#10;  "title": "{{ runtime.region }}",&#10;  "value": "{{ widget.value }}"&#10;}'
                                    />
                                </label>

                                <p class="inspector-tip">
                                    JSON 会按对象合并到目标组件运行态属性上；模板表达式支持保留原始类型，
                                    比如 <code v-pre>{{ source.rows[0] }}</code>。
                                </p>
                            </template>

                            <div class="interaction-condition">
                                <div class="interaction-condition__head">
                                    <span>执行条件</span>
                                    <label class="interaction-condition__toggle">
                                        <input
                                            :checked="
                                                hasInteractionCondition(action)
                                            "
                                            type="checkbox"
                                            @change="
                                                setInteractionConditionEnabled(
                                                    action,
                                                    $event.target.checked,
                                                )
                                            "
                                        />
                                        <em>{{
                                            hasInteractionCondition(action)
                                                ? '已启用'
                                                : '未启用'
                                        }}</em>
                                    </label>
                                </div>

                                <p class="inspector-tip">
                                    支持使用
                                    <code>value</code>、
                                    <code>items.length</code>、
                                    <code>rows[0].status</code>
                                    这类路径读取运行值。
                                </p>

                                <div
                                    v-if="hasInteractionCondition(action)"
                                    class="interaction-condition__body"
                                >
                                    <div class="interaction-condition__toolbar">
                                        <label>
                                            <span>组合方式</span>
                                            <select
                                                v-model="action.condition.logic"
                                            >
                                                <option
                                                    v-for="option in interactionConditionLogicOptions"
                                                    :key="option.value"
                                                    :value="option.value"
                                                >
                                                    {{ option.label }}
                                                </option>
                                            </select>
                                        </label>

                                        <button
                                            class="ghost inspector-inline-button"
                                            type="button"
                                            @click="
                                                addInteractionConditionRule(
                                                    action,
                                                )
                                            "
                                        >
                                            新增条件
                                        </button>
                                    </div>

                                    <div class="interaction-condition__rules">
                                        <article
                                            v-for="(
                                                rule, ruleIndex
                                            ) in getInteractionConditionRules(
                                                action,
                                            )"
                                            :key="
                                                rule.id ||
                                                `${action.id}-${ruleIndex}`
                                            "
                                            class="interaction-condition__rule"
                                        >
                                            <div
                                                class="interaction-condition__rule-head"
                                            >
                                                <strong>
                                                    条件 {{ ruleIndex + 1 }}
                                                </strong>
                                                <button
                                                    v-if="
                                                        getInteractionConditionRules(
                                                            action,
                                                        ).length > 1
                                                    "
                                                    class="ghost danger inspector-inline-button"
                                                    type="button"
                                                    @click="
                                                        removeInteractionConditionRule(
                                                            action,
                                                            ruleIndex,
                                                        )
                                                    "
                                                >
                                                    删除
                                                </button>
                                            </div>

                                            <div class="inspector-grid">
                                                <label>
                                                    <span>数据来源</span>
                                                    <select
                                                        v-model="rule.source"
                                                    >
                                                        <option
                                                            v-for="option in interactionConditionSourceOptions"
                                                            :key="option.value"
                                                            :value="option.value"
                                                        >
                                                            {{ option.label }}
                                                        </option>
                                                    </select>
                                                </label>

                                                <label>
                                                    <span>字段路径</span>
                                                    <input
                                                        v-model.trim="
                                                            rule.field
                                                        "
                                                        type="text"
                                                        placeholder="例如 value 或 rows[0].status"
                                                    />
                                                </label>

                                                <label>
                                                    <span>判断方式</span>
                                                    <select
                                                        v-model="
                                                            rule.operator
                                                        "
                                                    >
                                                        <option
                                                            v-for="option in interactionConditionOperatorOptions"
                                                            :key="option.value"
                                                            :value="option.value"
                                                        >
                                                            {{ option.label }}
                                                        </option>
                                                    </select>
                                                </label>

                                                <label
                                                    v-if="
                                                        doesInteractionConditionUseValue(
                                                            rule.operator,
                                                        )
                                                    "
                                                >
                                                    <span>比较值</span>
                                                    <input
                                                        v-model="rule.value"
                                                        type="text"
                                                        placeholder="例如 80、online、true"
                                                    />
                                                </label>
                                            </div>

                                            <p
                                                v-if="
                                                    rule.source ===
                                                        'source-payload' &&
                                                    !selectedWidget.dataBinding
                                                        .sourceId
                                                "
                                                class="inspector-tip"
                                            >
                                                当前组件还没有绑定数据源，payload
                                                条件暂时不会命中。
                                            </p>
                                        </article>
                                    </div>

                                    <p
                                        v-if="
                                            selectedWidget.interaction.trigger ===
                                                'condition-match'
                                        "
                                        class="inspector-tip"
                                    >
                                        条件命中会在页面进入后、以及当前组件绑定数据源刷新后自动评估；仅在条件从未命中变为命中时触发一次。
                                    </p>

                                    <p class="inspector-tip">
                                        当前条件组合：
                                        {{ getInteractionConditionSummary(action) }}
                                    </p>
                                </div>
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
                v-if="showFilterTargetSection"
                title="联动目标"
                caption="选择当前筛选来源要作用的组件。不选时默认作用于排行/表格/时间轴/地图；图表不会被默认命中，需显式勾选。"
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

            <InspectorSection
                title="运行时变量"
                caption="项目级变量预设会在进入预览或运行页时自动载入，可通过模板直接引用。"
                storage-key="panel-runtime-variables"
            >
                <template #actions>
                    <button
                        class="ghost inspector-inline-button"
                        type="button"
                        @click="addRuntimeVariablePreset"
                    >
                        新增变量
                    </button>
                </template>

                <p class="inspector-tip">
                    支持字符串、数字、布尔值、<code>null</code>、JSON
                    对象和数组。模板中可通过
                    <code v-pre>{{ runtime.region }}</code>、
                    <code v-pre>{{ runtime.panel.title }}</code>
                    这类路径读取。
                </p>

                <div
                    v-if="runtimeVariablePresets.length"
                    class="runtime-variable-list"
                >
                    <article
                        v-for="(preset, index) in runtimeVariablePresets"
                        :key="preset.id || index"
                        class="runtime-variable-card"
                    >
                        <div class="runtime-variable-card__head">
                            <strong>变量 {{ index + 1 }}</strong>
                            <button
                                class="ghost danger inspector-inline-button"
                                type="button"
                                @click="removeRuntimeVariablePreset(index)"
                            >
                                删除
                            </button>
                        </div>

                        <div class="inspector-grid">
                            <label>
                                <span>变量名</span>
                                <input
                                    v-model.trim="preset.key"
                                    type="text"
                                    placeholder="例如 region 或 panel.title"
                                />
                            </label>
                        </div>

                        <label>
                            <span>默认值</span>
                            <textarea
                                v-model="preset.value"
                                class="runtime-variable-card__textarea"
                                rows="4"
                                placeholder='例如 全国、128、true、{"city":"杭州"}'
                            />
                        </label>

                        <p
                            class="inspector-tip runtime-variable-card__meta"
                            :class="{
                                'is-warning':
                                    isRuntimeVariablePresetKeyDuplicated(index),
                            }"
                        >
                            {{ getRuntimeVariablePresetSummary(preset, index) }}
                        </p>
                    </article>
                </div>

                <div v-else class="inspector-empty">
                    当前项目还没有运行时变量预设，可先新增一个变量，再在组件文案或交互动作里通过
                    <code v-pre>{{ runtime.xxx }}</code>
                    引用。
                </div>
            </InspectorSection>
        </div>

        <InspectorSection
            title="交互链路"
            caption="查看当前项目的触发组件、动作目标和跨页跳转关系，并可快速定位到对应节点。"
            storage-key="panel-interaction-overview"
        >
            <div class="interaction-overview">
                <div class="interaction-overview__toolbar">
                    <div class="interaction-overview__stats">
                        <span class="interaction-overview__stat">
                            已配置触发组件
                            {{ interactionConfiguredWidgetCount }}
                            个
                        </span>
                        <span class="interaction-overview__stat">
                            当前范围动作
                            {{ visibleInteractionFlowEntries.length }}
                            条
                        </span>
                    </div>

                    <div class="interaction-overview__scope">
                        <button
                            type="button"
                            class="ghost inspector-inline-button"
                            :class="{
                                'is-active':
                                    interactionFlowScope === 'current-page',
                            }"
                            @click="interactionFlowScope = 'current-page'"
                        >
                            当前页
                        </button>
                        <button
                            type="button"
                            class="ghost inspector-inline-button"
                            :class="{
                                'is-active': interactionFlowScope === 'all-pages',
                            }"
                            @click="interactionFlowScope = 'all-pages'"
                        >
                            全部页面
                        </button>
                    </div>
                </div>

                <div
                    v-if="selectedWidget"
                    class="interaction-overview__focus-grid"
                >
                    <div class="interaction-overview__focus-card">
                        <div class="interaction-overview__focus-head">
                            <span>当前组件发出</span>
                            <strong>{{
                                selectedWidgetOutgoingEntries.length
                            }}</strong>
                        </div>

                        <div
                            v-if="selectedWidgetOutgoingEntries.length"
                            class="interaction-overview__mini-list"
                        >
                            <button
                                v-for="entry in selectedWidgetOutgoingEntries"
                                :key="`outgoing-${entry.id}`"
                                type="button"
                                class="interaction-overview__mini-item"
                                @click="
                                    locateInteractionNode({
                                        pageId: entry.pageId,
                                        widgetId: entry.sourceWidgetId,
                                    })
                                "
                            >
                                <strong>{{ entry.actionLabel }}</strong>
                                <span>{{
                                    getInteractionEntryTargetSummary(entry)
                                }}</span>
                            </button>
                        </div>

                        <div v-else class="inspector-empty">
                            当前组件还没有配置动作。
                        </div>
                    </div>

                    <div class="interaction-overview__focus-card">
                        <div class="interaction-overview__focus-head">
                            <span>当前组件被引用</span>
                            <strong>{{
                                selectedWidgetIncomingEntries.length
                            }}</strong>
                        </div>

                        <div
                            v-if="selectedWidgetIncomingEntries.length"
                            class="interaction-overview__mini-list"
                        >
                            <button
                                v-for="entry in selectedWidgetIncomingEntries"
                                :key="`incoming-${entry.id}`"
                                type="button"
                                class="interaction-overview__mini-item"
                                @click="
                                    locateInteractionNode({
                                        pageId: entry.pageId,
                                        widgetId: entry.sourceWidgetId,
                                    })
                                "
                            >
                                <strong>{{ entry.sourceWidgetName }}</strong>
                                <span>
                                    {{ entry.actionLabel }} ·
                                    {{ entry.pageName }}
                                </span>
                            </button>
                        </div>

                        <div v-else class="inspector-empty">
                            当前组件还没有被其他动作引用。
                        </div>
                    </div>
                </div>

                <div
                    v-if="visibleInteractionFlowEntries.length"
                    class="interaction-overview__list"
                >
                    <article
                        v-for="entry in visibleInteractionFlowEntries"
                        :key="entry.id"
                        class="interaction-edge"
                    >
                        <div class="interaction-edge__head">
                            <button
                                type="button"
                                class="interaction-edge__source"
                                @click="
                                    locateInteractionNode({
                                        pageId: entry.pageId,
                                        widgetId: entry.sourceWidgetId,
                                    })
                                "
                            >
                                <span>{{ entry.pageName }}</span>
                                <strong>{{ entry.sourceWidgetName }}</strong>
                            </button>

                            <div class="interaction-edge__meta">
                                <span>{{ entry.triggerLabel }}</span>
                                <span>{{ entry.actionLabel }}</span>
                                <span>{{ entry.delayLabel }}</span>
                            </div>
                        </div>

                        <p class="interaction-edge__summary">
                            {{ getInteractionEntryTargetSummary(entry) }}
                        </p>

                        <p
                            v-if="entry.conditionEnabled"
                            class="interaction-edge__condition"
                        >
                            条件：{{ entry.conditionSummary }}
                        </p>

                        <div class="interaction-edge__targets">
                            <button
                                v-for="target in entry.targetWidgets"
                                :key="`${entry.id}-${target.id}`"
                                type="button"
                                class="interaction-edge__target"
                                :disabled="target.missing"
                                @click="
                                    locateInteractionNode({
                                        pageId: target.pageId,
                                        widgetId: target.id,
                                    })
                                "
                            >
                                <strong>{{ target.name }}</strong>
                                <small>{{
                                    target.pageName || "目标缺失"
                                }}</small>
                            </button>

                            <span
                                v-for="source in entry.targetSources"
                                :key="`${entry.id}-${source.id}`"
                                class="interaction-edge__badge"
                                :class="{
                                    'is-missing': source.missing,
                                }"
                            >
                                {{ source.name }}
                            </span>

                            <button
                                v-if="entry.targetPage"
                                type="button"
                                class="interaction-edge__target interaction-edge__target--page"
                                :disabled="entry.targetPage.missing"
                                @click="
                                    locateInteractionNode({
                                        pageId: entry.targetPage.id,
                                    })
                                "
                            >
                                <strong>{{ entry.targetPage.name }}</strong>
                                <small>目标页面</small>
                            </button>
                        </div>
                    </article>
                </div>

                <div v-else class="inspector-empty">
                    当前范围还没有配置交互动作。
                </div>
            </div>
        </InspectorSection>

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
