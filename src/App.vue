<script setup>
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from "vue";
import MaterialPanel from "./components/MaterialPanel.vue";
import RuntimeShell from "./components/RuntimeShell.vue";
import StageCanvas from "./components/StageCanvas.vue";
import InspectorPanel from "./components/InspectorPanel.vue";
import TopToolbar from "./components/TopToolbar.vue";
import { materials, createWidget } from "./editor/materials";
import {
    createDataSource,
    createDataSourceRequestConfig,
    getValueByPath,
    normalizeDataSource,
    resolveDataSourceRuntime,
} from "./editor/dataSources";
import {
    isFilterSourceWidgetType,
    resolveFilterField,
} from "./editor/runtimeFilters";
import {
    createRuntimeTemplateScope,
    resolveRuntimeTemplateString,
    resolveRuntimeTemplateValue,
} from "./editor/runtimeTemplates";
import {
    STORAGE_KEY,
    TEMPLATE_STORAGE_KEY,
    createDemoProject,
    createProjectPage,
    createTemplateFromSelection,
    createWidgetGroup,
    defaultPageMeta,
    duplicateProjectPage,
    duplicateWidgets,
    expandIdsWithGroups,
    getInteractionActions,
    getNextZIndex,
    getSelectionBounds,
    instantiateTemplate,
    loadTemplateLibrary,
    normalizeProjectSchema,
    removeWidgetGroup,
    sortWidgets,
} from "./editor/project";

const HISTORY_LIMIT = 80;
const HISTORY_MERGE_WINDOW = 600;
const PROJECT_SYNC_DELAY = 120;
const TEMPLATE_LIMIT = 30;
const LINKED_WIDGET_DURATION = 1800;
const RUNTIME_DEBUG_EVENT_LIMIT = 80;
const RUNTIME_VARIABLE_HISTORY_LIMIT = 80;
const RUNTIME_PERFORMANCE_LIMIT = 80;
const INTERACTION_CHAIN_MAX_DEPTH = 12;
const INTERACTION_CHAIN_MAX_STEPS = 60;
const INTERACTION_CHAIN_REPEAT_LIMIT = 2;
const CONDITION_VALUE_OPERATORS = new Set([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "includes",
]);
const CONDITION_LOGICS = new Set(["all", "any"]);
const CONDITION_SOURCE_LABEL_MAP = {
    "widget-props": "当前组件运行值",
    "source-payload": "绑定数据源 payload",
    "runtime-variables": "运行时变量",
};
const CONDITION_LOGIC_LABEL_MAP = {
    all: "满足全部",
    any: "满足任一",
};
const CONDITION_OPERATOR_LABEL_MAP = {
    truthy: "有值/为真",
    falsy: "为空/为假",
    exists: "字段存在",
    eq: "等于",
    neq: "不等于",
    gt: "大于",
    gte: "大于等于",
    lt: "小于",
    lte: "小于等于",
    includes: "包含",
};
const PROJECT_LIBRARY_STORAGE_KEY = "visualization-web-project-library-v1";
const ACTIVE_PROJECT_STORAGE_KEY = "visualization-web-active-project-v1";
const DATA_SOURCE_SECRET_STORAGE_KEY = "visualization-web-source-secrets-v1";
const PUBLISHED_SNAPSHOT_STORAGE_KEY = "visualization-web-published-snapshots-v1";
const DATA_SOURCE_SECRET_FIELDS = [
    "authToken",
    "authUsername",
    "authPassword",
];

let dataSourceSecretStoreState = loadDataSourceSecretStore();

const initialRoute = getInitialRouteState();
const initialProjectState = loadProjectState();
const initialPublishedSnapshots = loadPublishedSnapshotLibrary();
const initialPublishedRuntimeState = resolvePublishedRuntimeState(
    initialRoute,
    initialPublishedSnapshots,
);
const shouldUsePublishedRuntime =
    initialRoute.mode === "runtime" &&
    Boolean(initialRoute.publishId) &&
    Boolean(initialPublishedRuntimeState);
const initialProject = shouldUsePublishedRuntime
    ? initialPublishedRuntimeState.project
    : initialProjectState.project;
const initialAppMode =
    initialRoute.mode === "runtime" && initialRoute.publishId
        ? shouldUsePublishedRuntime
            ? "runtime"
            : "editor"
        : initialRoute.mode;
const appMode = ref(initialAppMode);
const previewMode = ref(false);
const dialogMode = ref(null);
const dialogText = ref("");
const templateDraftName = ref("");
const projectDraftName = ref("");
const publishedSnapshotDraftName = ref("");
const publishedSnapshotDraftNote = ref("");
const dialogSourceId = ref("");
const statusMessage = ref("已启用多页面、模板库、数据源和事件联动");

const project = ref(initialProject);
const projectLibrary = ref(initialProjectState.library);
const activeProjectRecordId = ref(initialProjectState.activeProjectId);
const publishedSnapshots = ref(initialPublishedSnapshots);
const templates = ref(loadTemplateLibrary());
const dataSourceRuntime = ref({});
const widgetRuntimeState = ref({});
const runtimeVariables = ref(
    buildRuntimeVariablePresetState(initialProject),
);
const runtimeVariableHistory = ref([]);
const runtimePerformanceHistory = ref([]);
const runtimeFilters = ref({});
const runtimeDebugEvents = ref([]);
const linkedWidgetIds = ref([]);
const runtimePageId = ref(
    shouldUsePublishedRuntime
        ? initialPublishedRuntimeState.pageId
        : initialRoute.pageId || "",
);
const runtimePublishedSnapshotId = ref(
    shouldUsePublishedRuntime ? initialPublishedRuntimeState.snapshot.id : "",
);
const clipboardTemplate = ref(null);

const sourceRefreshTimers = new Map();
const sourceRefreshRunState = new Map();
const conditionMatchState = new Map();
const interactionTimers = new Set();
let linkedWidgetTimerId = 0;
let projectSyncTimerId = 0;
let interactionRunToken = 0;
let interactivePageInitToken = 0;
let interactionChainSeed = 0;
let lastProjectSnapshot = JSON.stringify(project.value);

const isRuntimeMode = computed(() => appMode.value === "runtime");
const isPublishedRuntime = computed(
    () => isRuntimeMode.value && Boolean(runtimePublishedSnapshotId.value),
);

const currentPageId = computed(() => {
    const fallbackPageId =
        project.value.activePageId || project.value.pages[0]?.id || "";
    const preferredPageId = isRuntimeMode.value
        ? runtimePageId.value
        : project.value.activePageId;

    return project.value.pages.some((page) => page.id === preferredPageId)
        ? preferredPageId
        : fallbackPageId;
});

const currentPage = computed(() => {
    const pages = project.value.pages ?? [];
    return (
        pages.find((page) => page.id === currentPageId.value) ??
        pages[0] ??
        null
    );
});

const runtimeWidgets = computed(() =>
    (currentPage.value?.widgets ?? []).map((widget) => {
        const runtimeState = widgetRuntimeState.value[widget.id] ?? {};
        const runtimeHidden = runtimeState.hidden;
        const propsPatch =
            runtimeState.propsPatch &&
            typeof runtimeState.propsPatch === "object" &&
            !Array.isArray(runtimeState.propsPatch)
                ? runtimeState.propsPatch
                : null;

        return {
            ...widget,
            hidden: runtimeHidden ?? widget.hidden,
            props: propsPatch
                ? {
                      ...widget.props,
                      ...propsPatch,
                  }
                : widget.props,
        };
    }),
);

const currentWidgets = computed(() =>
    previewMode.value || isRuntimeMode.value
        ? runtimeWidgets.value
        : (currentPage.value?.widgets ?? []),
);

const currentCanvas = computed(() => ({
    id: currentPage.value?.id ?? "",
    name: currentPage.value?.name ?? "",
    meta: currentPage.value?.meta ?? defaultPageMeta,
    widgets: currentWidgets.value,
    dataSources: project.value.dataSources ?? [],
    runtimeVariablePresets: project.value.runtimeVariablePresets ?? [],
}));

const selectedIds = ref(
    currentWidgets.value[0]?.id ? [currentWidgets.value[0].id] : [],
);
const primarySelectedId = ref(currentWidgets.value[0]?.id ?? null);

const undoStack = ref([]);
const redoStack = ref([]);
const pendingHistoryLabel = ref(null);
const activeHistoryLabel = ref(null);
const currentHistoryLabel = ref("当前项目");
const isRestoringHistory = ref(false);
const lastHistoryCommitAt = ref(0);
const lastHistoryCommitLabel = ref("");

const selectedWidgets = computed(() => {
    const selection = new Set(selectedIds.value);
    return currentWidgets.value.filter((item) => selection.has(item.id));
});

const selectedWidget = computed(() => {
    if (selectedIds.value.length !== 1) {
        return null;
    }

    return (
        currentWidgets.value.find((item) => item.id === selectedIds.value[0]) ??
        null
    );
});

const selectedBounds = computed(() =>
    getSelectionBounds(selectedWidgets.value),
);
const canOperate = computed(() => selectedIds.value.length > 0);
const canGroup = computed(() => selectedIds.value.length > 1);
const canUngroup = computed(() =>
    selectedWidgets.value.some((item) => item.groupId),
);
const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);
const canCopy = computed(() => selectedIds.value.length > 0);
const canPaste = computed(() =>
    Boolean(clipboardTemplate.value?.widgets?.length),
);
const canSaveTemplate = computed(() => selectedIds.value.length > 0);
const canDeletePage = computed(() => project.value.pages.length > 1);
const hasDataSources = computed(() => project.value.dataSources.length > 0);
const activeDialogSource = computed(
    () =>
        project.value.dataSources.find(
            (source) => source.id === dialogSourceId.value,
        ) ?? null,
);
const currentProjectRecord = computed(
    () =>
        projectLibrary.value.find(
            (item) => item.id === activeProjectRecordId.value,
        ) ?? null,
);
const currentProjectName = computed(
    () =>
        currentProjectRecord.value?.name ??
        deriveProjectRecordName(project.value),
);
const currentPublishedSnapshot = computed(
    () =>
        publishedSnapshots.value.find(
            (item) => item.id === runtimePublishedSnapshotId.value,
        ) ?? null,
);
const currentProjectPublishedSnapshots = computed(() =>
    publishedSnapshots.value
        .filter((item) => item.projectRecordId === activeProjectRecordId.value)
        .sort((left, right) => right.updatedAt - left.updatedAt),
);
const latestProjectPublishedSnapshot = computed(
    () => currentProjectPublishedSnapshots.value[0] ?? null,
);

const runtimeDebugSummary = computed(() => {
    const sourceEntries = project.value.dataSources.map((source) => {
        const runtime =
            dataSourceRuntime.value[source.id] ?? createSourceRuntimeEntry(source);
        return {
            id: source.id,
            updatedAt: runtime.updatedAt,
            error: runtime.error,
        };
    });
    const visibleWidgetCount = currentWidgets.value.filter(
        (widget) => !widget.hidden,
    ).length;
    const performanceEntries = runtimePerformanceHistory.value;
    const performanceDurations = performanceEntries
        .map((entry) => Math.max(0, Number(entry.duration) || 0))
        .filter((duration) => duration > 0);
    const latestPageInitEntry = performanceEntries.find(
        (entry) => entry.type === "page-init",
    );
    const latestSourceRefreshEntry = performanceEntries.find(
        (entry) => entry.type === "source-refresh-batch",
    );
    const latestInteractionEntry = performanceEntries.find(
        (entry) => entry.type === "interaction-chain",
    );

    return {
        mode: isPublishedRuntime.value
            ? "published-runtime"
            : isRuntimeMode.value
              ? "runtime"
              : previewMode.value
                ? "preview"
                : "editor",
        pageId: currentPageId.value,
        pageName: currentPage.value?.name ?? "未命名页面",
        pageTitle: currentPage.value?.meta?.title ?? "未命名大屏",
        widgetCount: currentWidgets.value.length,
        visibleWidgetCount,
        hiddenWidgetCount: Math.max(
            currentWidgets.value.length - visibleWidgetCount,
            0,
        ),
        sourceCount: sourceEntries.length,
        refreshedSourceCount: sourceEntries.filter((item) => item.updatedAt)
            .length,
        errorSourceCount: sourceEntries.filter((item) => item.error).length,
        activeFilterCount: Object.keys(runtimeFilters.value).length,
        linkedWidgetCount: linkedWidgetIds.value.length,
        variableCount: Object.keys(runtimeVariables.value).length,
        variableHistoryCount: runtimeVariableHistory.value.length,
        performanceCount: performanceEntries.length,
        lastPerformanceDuration: performanceDurations[0] ?? 0,
        averagePerformanceDuration: performanceDurations.length
            ? Math.round(
                  performanceDurations.reduce(
                      (sum, duration) => sum + duration,
                      0,
                  ) / performanceDurations.length,
              )
            : 0,
        slowestPerformanceDuration: performanceDurations.length
            ? Math.max(...performanceDurations)
            : 0,
        lastPageInitDuration: latestPageInitEntry?.duration ?? 0,
        lastSourceRefreshDuration: latestSourceRefreshEntry?.duration ?? 0,
        lastInteractionDuration: latestInteractionEntry?.duration ?? 0,
    };
});

const runtimeDebugFilters = computed(() =>
    Object.values(runtimeFilters.value).map((filter) => {
        const widget = findWidgetAcrossPages(filter.widgetId);

        return {
            widgetId: filter.widgetId,
            widgetName: widget?.name ?? "未命名组件",
            field: filter.field,
            value: filter.value,
            label: filter.label,
            targetWidgetIds: Array.isArray(filter.targetWidgetIds)
                ? filter.targetWidgetIds
                : [],
        };
    }),
);

const runtimeDebugVariables = computed(() =>
    Object.entries(runtimeVariables.value)
        .map(([key, value]) => ({
            key,
            value,
            preview: formatRuntimeDebugValue(value, 96),
            type: Array.isArray(value) ? "array" : typeof value,
        }))
        .sort((left, right) => left.key.localeCompare(right.key, "zh-CN")),
);

const runtimeDebugVariableHistory = computed(() =>
    runtimeVariableHistory.value.map((entry) => ({
        ...entry,
        previousPreview:
            entry.previousValue === undefined
                ? ""
                : formatRuntimeDebugValue(entry.previousValue, 80),
        nextPreview:
            entry.nextValue === undefined
                ? ""
                : formatRuntimeDebugValue(entry.nextValue, 80),
    })),
);

const runtimeDebugPerformance = computed(() =>
    runtimePerformanceHistory.value.map((entry) => ({
        ...entry,
        durationLabel: formatRuntimeDebugDuration(entry.duration),
        averageStepDurationLabel:
            entry.executedCount > 0
                ? formatRuntimeDebugDuration(entry.duration / entry.executedCount)
                : "",
    })),
);

const runtimeDebugSources = computed(() =>
    project.value.dataSources
        .map((source) => {
            const runtime =
                dataSourceRuntime.value[source.id] ??
                createSourceRuntimeEntry(source);

            return {
                id: source.id,
                name: source.name,
                type: source.type,
                generator: source.generator,
                updatedAt: runtime.updatedAt,
                refreshCount: runtime.refreshCount ?? 0,
                responseStatus: runtime.responseStatus,
                responseStatusText: runtime.responseStatusText ?? "",
                mappedFieldCount: runtime.mappedFieldCount ?? 0,
                retryAttempts: runtime.retryAttempts ?? 0,
                attemptCount: runtime.attemptCount ?? 0,
                error: runtime.error ?? "",
            };
        })
        .sort((left, right) => {
            const leftWeight = left.error ? 0 : left.updatedAt ? 1 : 2;
            const rightWeight = right.error ? 0 : right.updatedAt ? 1 : 2;

            if (leftWeight !== rightWeight) {
                return leftWeight - rightWeight;
            }

            return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
        }),
);

function getSourceInteractionLabel(actionType) {
    switch (actionType) {
        case "refresh-sources":
            return "交互刷新";
        case "highlight-widgets":
            return "交互高亮";
        case "switch-page":
            return "交互切页";
        case "show-widgets":
            return "交互显示";
        case "hide-widgets":
            return "交互隐藏";
        case "toggle-widgets-visibility":
            return "交互显隐切换";
        default:
            return "交互引用";
    }
}

function getInteractionTriggerLabel(trigger) {
    switch (trigger) {
        case "page-enter":
            return "页面进入";
        case "condition-match":
            return "条件命中";
        default:
            return "组件点击";
    }
}

const sourceUsageMap = computed(() => {
    const usages = Object.fromEntries(
        project.value.dataSources.map((source) => [source.id, []]),
    );

    project.value.pages.forEach((page) => {
        page.widgets.forEach((widget) => {
            const sourceId = widget.dataBinding?.sourceId;

            if (sourceId) {
                (usages[sourceId] ??= []).push({
                    id: `binding-${page.id}-${widget.id}`,
                    sourceId,
                    pageId: page.id,
                    pageName: page.name,
                    widgetId: widget.id,
                    widgetName: widget.name,
                    type: "binding",
                    label: "数据绑定",
                });
            }

            const actions = Array.isArray(widget.interaction?.actions)
                ? widget.interaction.actions
                : getInteractionActions(widget.interaction);

            actions.forEach((action, actionIndex) => {
                (action.targetSourceIds ?? []).forEach((targetSourceId) => {
                    if (targetSourceId) {
                        (usages[targetSourceId] ??= []).push({
                            id: `action-${page.id}-${widget.id}-${action.id ?? actionIndex}-${targetSourceId}`,
                            sourceId: targetSourceId,
                            pageId: page.id,
                            pageName: page.name,
                            widgetId: widget.id,
                            widgetName: widget.name,
                            type: "interaction",
                            label: getSourceInteractionLabel(action.action),
                        });
                    }
                });
            });
        });
    });

    return usages;
});

const sourceBindingCounts = computed(() =>
    Object.fromEntries(
        project.value.dataSources.map((source) => [
            source.id,
            sourceUsageMap.value[source.id]?.length ?? 0,
        ]),
    ),
);

function getSourceUsages(sourceId) {
    return sourceUsageMap.value[sourceId] ?? [];
}

function cloneDeep(value) {
    return JSON.parse(JSON.stringify(value));
}

function clearConditionMatchState() {
    conditionMatchState.clear();
}

function canCaptureRuntimeDebug() {
    return previewMode.value || isRuntimeMode.value;
}

function pushRuntimeDebugEvent(entry = {}) {
    if (!entry.title || (!canCaptureRuntimeDebug() && entry.force !== true)) {
        return;
    }

    const nextEvent = {
        id:
            globalThis.crypto?.randomUUID?.() ??
            `runtime-debug-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: entry.at ?? Date.now(),
        level: entry.level ?? "info",
        category: entry.category ?? "runtime",
        title: entry.title,
        detail: entry.detail ?? "",
        pageId: entry.pageId ?? currentPageId.value,
        pageName: entry.pageName ?? currentPage.value?.name ?? "",
    };

    runtimeDebugEvents.value = [nextEvent, ...runtimeDebugEvents.value].slice(
        0,
        RUNTIME_DEBUG_EVENT_LIMIT,
    );
}

function clearRuntimeDebugEvents(options = {}) {
    runtimeDebugEvents.value = [];

    if (!options.silent) {
        statusMessage.value = "已清空运行态调试记录";
    }
}

function formatRuntimeDebugDuration(duration) {
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

function pushRuntimePerformanceEntry(entry = {}) {
    if (!entry.type || (!canCaptureRuntimeDebug() && entry.force !== true)) {
        return;
    }

    const nextEntry = {
        id:
            globalThis.crypto?.randomUUID?.() ??
            `runtime-performance-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: entry.at ?? Date.now(),
        type: String(entry.type ?? "").trim(),
        duration: Math.max(0, Number(entry.duration) || 0),
        sourceLabel:
            typeof entry.sourceLabel === "string" && entry.sourceLabel.trim()
                ? entry.sourceLabel.trim()
                : "运行态链路",
        detail:
            typeof entry.detail === "string" ? entry.detail.trim() : "",
        pageId: typeof entry.pageId === "string" ? entry.pageId.trim() : "",
        pageName:
            typeof entry.pageName === "string" && entry.pageName.trim()
                ? entry.pageName.trim()
                : currentPage.value?.name ?? "",
        widgetId: typeof entry.widgetId === "string" ? entry.widgetId.trim() : "",
        widgetName:
            typeof entry.widgetName === "string" ? entry.widgetName.trim() : "",
        actionCount: Math.max(0, Number(entry.actionCount) || 0),
        executedCount: Math.max(0, Number(entry.executedCount) || 0),
        skippedCount: Math.max(0, Number(entry.skippedCount) || 0),
        successCount: Math.max(0, Number(entry.successCount) || 0),
        failureCount: Math.max(0, Number(entry.failureCount) || 0),
        sourceCount: Math.max(0, Number(entry.sourceCount) || 0),
        refreshDataSources: entry.refreshDataSources === true,
        cancelled: entry.cancelled === true,
    };

    runtimePerformanceHistory.value = [
        nextEntry,
        ...runtimePerformanceHistory.value,
    ].slice(0, RUNTIME_PERFORMANCE_LIMIT);
}

function clearRuntimePerformanceHistory(options = {}) {
    runtimePerformanceHistory.value = [];

    if (!options.silent) {
        statusMessage.value = "已清空执行耗时记录";
    }
}

function cloneRuntimeVariableValue(value) {
    return value === undefined ? undefined : cloneDeep(value);
}

function compareRuntimeVariableValue(left, right) {
    if (
        left &&
        right &&
        typeof left === "object" &&
        typeof right === "object"
    ) {
        try {
            return JSON.stringify(left) === JSON.stringify(right);
        } catch (error) {
            console.warn(error);
            return false;
        }
    }

    return left === right;
}

function getRuntimeVariableChangedKeys(previousState = {}, nextState = {}) {
    const changedKeys = [];
    const keys = new Set([
        ...Object.keys(previousState ?? {}),
        ...Object.keys(nextState ?? {}),
    ]);

    keys.forEach((key) => {
        if (
            !compareRuntimeVariableValue(previousState?.[key], nextState?.[key])
        ) {
            changedKeys.push(key);
        }
    });

    return changedKeys.sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function pushRuntimeVariableHistoryEntry(entry = {}) {
    if (!entry.action) {
        return;
    }

    const nextEntry = {
        id:
            globalThis.crypto?.randomUUID?.() ??
            `runtime-variable-history-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: entry.at ?? Date.now(),
        action: entry.action,
        key: typeof entry.key === "string" ? entry.key.trim() : "",
        previousValue: cloneRuntimeVariableValue(entry.previousValue),
        nextValue: cloneRuntimeVariableValue(entry.nextValue),
        changedCount: Math.max(0, Number(entry.changedCount) || 0),
        changedKeys: Array.isArray(entry.changedKeys)
            ? entry.changedKeys.filter((item) => typeof item === "string" && item)
            : [],
        sourceLabel:
            typeof entry.sourceLabel === "string" && entry.sourceLabel.trim()
                ? entry.sourceLabel.trim()
                : "运行时变量",
        widgetName:
            typeof entry.widgetName === "string" ? entry.widgetName.trim() : "",
        pageName:
            typeof entry.pageName === "string" && entry.pageName.trim()
                ? entry.pageName.trim()
                : currentPage.value?.name ?? "",
    };

    runtimeVariableHistory.value = [
        nextEntry,
        ...runtimeVariableHistory.value,
    ].slice(0, RUNTIME_VARIABLE_HISTORY_LIMIT);
}

function clearRuntimeVariableHistory(options = {}) {
    runtimeVariableHistory.value = [];

    if (!options.silent) {
        statusMessage.value = "已清空变量变更历史";
    }
}

function startRuntimeVariableSession(options = {}) {
    clearRuntimeVariableHistory({ silent: true });
    clearRuntimePerformanceHistory({ silent: true });
    return resetRuntimeVariables(options.projectSchema ?? project.value, {
        recordHistory: options.recordHistory !== false,
        action: options.action ?? "init",
        sourceLabel: options.sourceLabel ?? "项目预设",
        pageName: options.pageName ?? currentPage.value?.name ?? "",
        forceHistory: options.forceHistory !== false,
    });
}

function buildRuntimeVariablePresetState(projectSchema = project.value) {
    return (Array.isArray(projectSchema?.runtimeVariablePresets)
        ? projectSchema.runtimeVariablePresets
        : []
    ).reduce((accumulator, preset) => {
        const key = String(preset?.key ?? "").trim();

        if (!key) {
            return accumulator;
        }

        accumulator[key] = parseDynamicRuntimeValue(preset?.value);
        return accumulator;
    }, {});
}

function resetWidgetRuntimeState() {
    widgetRuntimeState.value = {};
}

function clearRuntimeVariables(options = {}) {
    const previousState = runtimeVariables.value;
    const changedKeys = Object.keys(previousState).sort((left, right) =>
        left.localeCompare(right, "zh-CN"),
    );

    runtimeVariables.value = {};

    if ((options.recordHistory || options.forceHistory) && changedKeys.length) {
        pushRuntimeVariableHistoryEntry({
            action: "clear",
            changedCount: changedKeys.length,
            changedKeys,
            sourceLabel: options.sourceLabel ?? "调试抽屉",
            pageName: options.pageName,
        });
    }

    return changedKeys.length;
}

function resetRuntimeVariables(projectSchema = project.value, options = {}) {
    const previousState = runtimeVariables.value;
    const nextState = buildRuntimeVariablePresetState(projectSchema);
    const changedKeys = getRuntimeVariableChangedKeys(previousState, nextState);

    runtimeVariables.value = nextState;

    if (
        options.recordHistory &&
        (changedKeys.length || options.forceHistory === true)
    ) {
        pushRuntimeVariableHistoryEntry({
            action: options.action ?? "reset",
            changedCount: changedKeys.length || Object.keys(nextState).length,
            changedKeys: changedKeys.length
                ? changedKeys
                : Object.keys(nextState).sort((left, right) =>
                      left.localeCompare(right, "zh-CN"),
                  ),
            sourceLabel: options.sourceLabel ?? "项目预设",
            pageName: options.pageName,
        });
    }

    return changedKeys.length;
}

function resetRuntimeFilters() {
    runtimeFilters.value = {};

    const nextState = {};

    Object.entries(widgetRuntimeState.value).forEach(([widgetId, state]) => {
        const currentState =
            state && typeof state === "object" ? { ...state } : {};
        const nextPropsPatch =
            currentState.propsPatch &&
            typeof currentState.propsPatch === "object" &&
            !Array.isArray(currentState.propsPatch)
                ? { ...currentState.propsPatch }
                : null;

        ["activeValue", "activeProvince", "activeCategory"].forEach((key) => {
            if (nextPropsPatch && key in nextPropsPatch) {
                delete nextPropsPatch[key];
            }
        });

        if (nextPropsPatch && Object.keys(nextPropsPatch).length) {
            currentState.propsPatch = nextPropsPatch;
        } else {
            delete currentState.propsPatch;
        }

        if (Object.keys(currentState).length) {
            nextState[widgetId] = currentState;
        }
    });

    widgetRuntimeState.value = nextState;
}

function setRuntimeWidgetPropsPatch(widgetId, propsPatch = {}) {
    if (!widgetId) {
        return;
    }

    const widget = project.value.pages
        .flatMap((page) => page.widgets)
        .find((item) => item.id === widgetId);

    if (!widget) {
        return;
    }

    const currentState = widgetRuntimeState.value[widgetId] ?? {};
    const currentPatch =
        currentState.propsPatch &&
        typeof currentState.propsPatch === "object" &&
        !Array.isArray(currentState.propsPatch)
            ? currentState.propsPatch
            : {};

    widgetRuntimeState.value = {
        ...widgetRuntimeState.value,
        [widgetId]: {
            ...currentState,
            propsPatch: {
                ...currentPatch,
                ...propsPatch,
            },
        },
    };
}

function setRuntimeVariable(key, value, options = {}) {
    const nextKey = String(key ?? "").trim();

    if (!nextKey) {
        return {
            updated: false,
            changed: false,
        };
    }

    const previousValue = runtimeVariables.value[nextKey];
    const changed = !compareRuntimeVariableValue(previousValue, value);

    if (!changed) {
        return {
            updated: true,
            changed: false,
            previousValue,
            nextValue: value,
        };
    }

    runtimeVariables.value = {
        ...runtimeVariables.value,
        [nextKey]: value,
    };

    if (options.recordHistory && changed) {
        pushRuntimeVariableHistoryEntry({
            action: "set",
            key: nextKey,
            previousValue,
            nextValue: value,
            changedCount: 1,
            changedKeys: [nextKey],
            sourceLabel: options.sourceLabel ?? "交互动作",
            widgetName: options.widgetName,
            pageName: options.pageName,
        });
    }

    return {
        updated: true,
        changed,
        previousValue,
        nextValue: value,
    };
}

function applyRuntimeFilterWidget(widget, value, label = "") {
    if (!widget || !isFilterSourceWidgetType(widget.type)) {
        return;
    }

    const nextValue = String(value ?? "").trim();
    const targetWidgetIds = Array.isArray(widget.props?.targetWidgetIds)
        ? widget.props.targetWidgetIds.filter(
              (item) => typeof item === "string" && item,
          )
        : [];

    if (widget.type === "filterBar") {
        setRuntimeWidgetPropsPatch(widget.id, {
            activeValue: nextValue,
        });
    } else if (widget.type === "chinaRegionMap") {
        setRuntimeWidgetPropsPatch(widget.id, {
            activeProvince: nextValue,
        });
    } else {
        setRuntimeWidgetPropsPatch(widget.id, {
            activeCategory: nextValue,
        });
    }

    if (
        widget.type !== "filterBar" &&
        widget.props?.enableFilterLinkage === false
    ) {
        const nextFilters = { ...runtimeFilters.value };
        delete nextFilters[widget.id];
        runtimeFilters.value = nextFilters;
        return;
    }

    const field = resolveFilterField(widget);

    if (!field || !nextValue) {
        const nextFilters = { ...runtimeFilters.value };
        delete nextFilters[widget.id];
        runtimeFilters.value = nextFilters;
        return;
    }

    runtimeFilters.value = {
        ...runtimeFilters.value,
        [widget.id]: {
            widgetId: widget.id,
            field,
            value: nextValue,
            label: String(label || "").trim(),
            targetWidgetIds,
        },
    };
}

function syncPageRuntimeFilters(pageId = currentPageId.value) {
    if (!previewMode.value && !isRuntimeMode.value) {
        return;
    }

    const page = project.value.pages.find((item) => item.id === pageId);

    if (!page) {
        return;
    }

    page.widgets
        .filter((widget) => isFilterSourceWidgetType(widget.type))
        .forEach((widget) => {
            const runtimeWidget = buildRuntimeWidgetView(widget) ?? widget;

            if (runtimeWidget.type === "filterBar") {
                const activeValue = String(
                    runtimeWidget.props?.activeValue ?? "",
                ).trim();
                const option = (
                    Array.isArray(runtimeWidget.props?.options)
                        ? runtimeWidget.props.options
                        : []
                ).find(
                    (item) => String(item?.value ?? "").trim() === activeValue,
                );

                applyRuntimeFilterWidget(
                    runtimeWidget,
                    activeValue,
                    String(option?.label ?? "").trim(),
                );
                return;
            }

            if (runtimeWidget.type === "chinaRegionMap") {
                const activeProvince = String(
                    runtimeWidget.props?.activeProvince ?? "",
                ).trim();
                applyRuntimeFilterWidget(
                    runtimeWidget,
                    activeProvince,
                    activeProvince,
                );
                return;
            }

            const activeCategory = String(
                runtimeWidget.props?.activeCategory ?? "",
            ).trim();
            applyRuntimeFilterWidget(
                runtimeWidget,
                activeCategory,
                activeCategory,
            );
        });
}

function findWidgetAcrossPages(widgetId) {
    if (!widgetId) {
        return null;
    }

    return (
        currentPage.value?.widgets.find((item) => item.id === widgetId) ??
        project.value.pages
            .flatMap((page) => page.widgets)
            .find((item) => item.id === widgetId) ??
        null
    );
}

function getWidgetRuntimePageContext(widget) {
    const page = widget?.id
        ? project.value.pages.find((item) =>
              item.widgets.some((entry) => entry.id === widget.id),
          ) ?? currentPage.value
        : currentPage.value;

    return {
        id: page?.id ?? "",
        name: page?.name ?? "",
        title: page?.meta?.title ?? "",
    };
}

function buildRuntimeWidgetView(widget) {
    if (!widget) {
        return null;
    }

    const sourceId = widget.dataBinding?.sourceId;
    const runtimePayload = sourceId
        ? (dataSourceRuntime.value[sourceId]?.payload ?? null)
        : null;
    const propsPatch =
        widgetRuntimeState.value[widget.id]?.propsPatch &&
        typeof widgetRuntimeState.value[widget.id].propsPatch === "object" &&
        !Array.isArray(widgetRuntimeState.value[widget.id].propsPatch)
            ? widgetRuntimeState.value[widget.id].propsPatch
            : null;

    return {
        ...widget,
        props: resolveRuntimeTemplateValue(
            {
                ...widget.props,
                ...(runtimePayload ?? {}),
                ...(propsPatch ?? {}),
            },
            createRuntimeTemplateScope({
                widgetProps: {
                    ...widget.props,
                    ...(runtimePayload ?? {}),
                    ...(propsPatch ?? {}),
                },
                sourcePayload: runtimePayload,
                runtimeVariables: runtimeVariables.value,
                page: getWidgetRuntimePageContext(widget),
            }),
        ),
    };
}

function formatRuntimeDebugValue(value, maxLength = 72) {
    const serialized =
        value == null
            ? "null"
            : typeof value === "string"
              ? value
              : (() => {
                    try {
                        return JSON.stringify(value);
                    } catch (error) {
                        console.warn(error);
                        return String(value);
                    }
                })();

    if (serialized.length <= maxLength) {
        return serialized;
    }

    return `${serialized.slice(0, Math.max(maxLength - 1, 0))}…`;
}

function getInteractionTemplateScope(widget) {
    const runtimeWidget = buildRuntimeWidgetView(widget) ?? widget;
    const sourceId = runtimeWidget.dataBinding?.sourceId || widget?.dataBinding?.sourceId;
    const sourcePayload = sourceId
        ? (dataSourceRuntime.value[sourceId]?.payload ??
          findDataSource(sourceId)?.payload ??
          null)
        : null;

    return createRuntimeTemplateScope({
        widgetProps: runtimeWidget?.props ?? {},
        sourcePayload,
        runtimeVariables: runtimeVariables.value,
        page: getWidgetRuntimePageContext(widget),
    });
}

function parseInteractionPropsPatch(text, scope) {
    const rawText = String(text ?? "").trim() || "{}";

    try {
        const parsed = JSON.parse(rawText);

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {
                ok: false,
                error: "组件属性更新仅支持 JSON 对象",
            };
        }

        return {
            ok: true,
            value: resolveRuntimeTemplateValue(parsed, scope),
        };
    } catch (error) {
        console.warn(error);
        return {
            ok: false,
            error: "组件属性 JSON 解析失败",
        };
    }
}

function parseDynamicRuntimeValue(value) {
    if (typeof value !== "string") {
        return value;
    }

    const trimmed = value.trim();

    if (!trimmed.length) {
        return "";
    }

    if (trimmed === "true") {
        return true;
    }

    if (trimmed === "false") {
        return false;
    }

    if (trimmed === "null") {
        return null;
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return Number(trimmed);
    }

    if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
        try {
            return JSON.parse(trimmed);
        } catch (error) {
            console.warn(error);
        }
    }

    return trimmed;
}

function normalizeConditionOperand(value) {
    return parseDynamicRuntimeValue(value);
}

function doesConditionOperatorUseValue(operator) {
    return CONDITION_VALUE_OPERATORS.has(operator);
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

function normalizeInteractionConditionRule(rule) {
    return {
        source:
            rule?.source === "source-payload" ? "source-payload" : "widget-props",
        field: typeof rule?.field === "string" ? rule.field.trim() : "",
        operator:
            typeof rule?.operator === "string" && rule.operator.trim()
                ? rule.operator
                : "truthy",
        value: rule?.value == null ? "" : String(rule.value),
    };
}

function getInteractionConditionConfig(action) {
    const condition = action?.condition;

    if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
        return {
            enabled: false,
            logic: "all",
            rules: [],
        };
    }

    const rules = Array.isArray(condition.rules)
        ? condition.rules.map((rule) => normalizeInteractionConditionRule(rule))
        : isLegacyInteractionConditionShape(condition)
          ? [normalizeInteractionConditionRule(condition)]
          : [];

    return {
        enabled: Boolean(condition.enabled),
        logic: CONDITION_LOGICS.has(condition.logic) ? condition.logic : "all",
        rules,
    };
}

function hasConfiguredInteractionCondition(action) {
    return getInteractionConditionConfig(action).enabled;
}

function formatInteractionConditionRuleSummary(rule) {
    const sourceLabel =
        CONDITION_SOURCE_LABEL_MAP[rule.source] ?? "当前组件运行值";
    const fieldLabel = rule.field?.trim() || "(整体值)";
    const operatorLabel = CONDITION_OPERATOR_LABEL_MAP[rule.operator] ?? "命中";

    if (!doesConditionOperatorUseValue(rule.operator)) {
        return `${sourceLabel} · ${fieldLabel} ${operatorLabel}`;
    }

    return `${sourceLabel} · ${fieldLabel} ${operatorLabel} ${rule.value}`;
}

function formatInteractionConditionSummary(action) {
    const condition = getInteractionConditionConfig(action);

    if (!condition.enabled) {
        return "";
    }

    if (!condition.rules.length) {
        return "已启用，但尚未配置条件";
    }

    const summary = condition.rules.map((rule) =>
        formatInteractionConditionRuleSummary(rule),
    );

    return summary.length > 1
        ? `${CONDITION_LOGIC_LABEL_MAP[condition.logic] ?? "满足全部"}：${summary.join(
              condition.logic === "any" ? " 或 " : " 且 ",
          )}`
        : summary[0];
}

function isConditionValuePresent(value) {
    if (value === null || value === undefined) {
        return false;
    }

    if (typeof value === "string") {
        return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
        return value.length > 0;
    }

    return true;
}

function compareConditionEquality(actual, expected) {
    const normalizedActual = normalizeConditionOperand(actual);
    const normalizedExpected = normalizeConditionOperand(expected);

    if (
        normalizedActual &&
        normalizedExpected &&
        typeof normalizedActual === "object" &&
        typeof normalizedExpected === "object"
    ) {
        return JSON.stringify(normalizedActual) === JSON.stringify(normalizedExpected);
    }

    return normalizedActual === normalizedExpected;
}

function evaluateConditionComparison(actual, operator, expectedRaw) {
    const expected = normalizeConditionOperand(expectedRaw);

    switch (operator) {
        case "truthy":
            return Boolean(actual);
        case "falsy":
            return !actual;
        case "exists":
            return isConditionValuePresent(actual);
        case "eq":
            return compareConditionEquality(actual, expected);
        case "neq":
            return !compareConditionEquality(actual, expected);
        case "gt":
        case "gte":
        case "lt":
        case "lte": {
            const left = Number(actual);
            const right = Number(expected);

            if (!Number.isFinite(left) || !Number.isFinite(right)) {
                return false;
            }

            if (operator === "gt") {
                return left > right;
            }

            if (operator === "gte") {
                return left >= right;
            }

            if (operator === "lt") {
                return left < right;
            }

            return left <= right;
        }
        case "includes":
            if (typeof actual === "string") {
                return actual.includes(String(expected ?? ""));
            }

            if (Array.isArray(actual)) {
                return actual.some((item) =>
                    compareConditionEquality(item, expected),
                );
            }

            return false;
        default:
            return true;
    }
}

function getInteractionConditionScope(widget, rule) {
    const scope = getInteractionTemplateScope(widget);

    if (rule?.source === "source-payload") {
        return scope.source;
    }

    if (rule?.source === "runtime-variables") {
        return scope.runtime;
    }

    return scope.widget;
}

function evaluateInteractionConditionRule(widget, rule) {
    const scope = getInteractionConditionScope(widget, rule);
    const actualValue = rule.field?.trim()
        ? getValueByPath(scope, rule.field)
        : scope;

    return evaluateConditionComparison(actualValue, rule.operator, rule.value);
}

function evaluateInteractionActionCondition(widget, action) {
    const condition = getInteractionConditionConfig(action);

    if (!condition.enabled) {
        return {
            matched: true,
            conditional: false,
            summary: "",
        };
    }

    if (!condition.rules.length) {
        return {
            matched: false,
            conditional: true,
            summary: formatInteractionConditionSummary(action),
        };
    }

    const matched =
        condition.logic === "any"
            ? condition.rules.some((rule) =>
                  evaluateInteractionConditionRule(widget, rule),
              )
            : condition.rules.every((rule) =>
                  evaluateInteractionConditionRule(widget, rule),
              );

    return {
        matched,
        conditional: true,
        summary: formatInteractionConditionSummary(action),
    };
}

function getConditionMatchStateKey(pageId, widgetId, actionId) {
    return `${pageId}:${widgetId}:${actionId}`;
}

function loadDataSourceSecretStore() {
    if (typeof localStorage === "undefined") {
        return {};
    }

    const rawValue = localStorage.getItem(DATA_SOURCE_SECRET_STORAGE_KEY);

    if (!rawValue) {
        return {};
    }

    try {
        const parsed = JSON.parse(rawValue);

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(parsed)
                .map(([projectId, sources]) => {
                    if (
                        !sources ||
                        typeof sources !== "object" ||
                        Array.isArray(sources)
                    ) {
                        return null;
                    }

                    const normalizedSources = Object.fromEntries(
                        Object.entries(sources)
                            .map(([sourceId, secretPayload]) => {
                                if (
                                    !secretPayload ||
                                    typeof secretPayload !== "object" ||
                                    Array.isArray(secretPayload)
                                ) {
                                    return null;
                                }

                                const normalizedSecrets = Object.fromEntries(
                                    DATA_SOURCE_SECRET_FIELDS.filter(
                                        (field) =>
                                            typeof secretPayload[field] ===
                                                "string" &&
                                            secretPayload[field] !== "",
                                    ).map((field) => [
                                        field,
                                        secretPayload[field],
                                    ]),
                                );

                                return Object.keys(normalizedSecrets).length
                                    ? [sourceId, normalizedSecrets]
                                    : null;
                            })
                            .filter(Boolean),
                    );

                    return Object.keys(normalizedSources).length
                        ? [projectId, normalizedSources]
                        : null;
                })
                .filter(Boolean),
        );
    } catch (error) {
        console.warn(error);
        return {};
    }
}

function persistDataSourceSecretStore() {
    if (typeof localStorage === "undefined") {
        return;
    }

    localStorage.setItem(
        DATA_SOURCE_SECRET_STORAGE_KEY,
        JSON.stringify(dataSourceSecretStoreState),
    );
}

function extractSourceRequestSecrets(request = {}) {
    return Object.fromEntries(
        DATA_SOURCE_SECRET_FIELDS.filter(
            (field) =>
                typeof request?.[field] === "string" && request[field] !== "",
        ).map((field) => [field, request[field]]),
    );
}

function projectContainsSourceSecrets(projectData) {
    return (projectData?.dataSources ?? []).some((source) =>
        Object.keys(extractSourceRequestSecrets(source?.request ?? {})).length,
    );
}

function sanitizeSourceRequestSecrets(request = {}) {
    const nextRequest = createDataSourceRequestConfig(request);

    DATA_SOURCE_SECRET_FIELDS.forEach((field) => {
        nextRequest[field] = "";
    });

    return nextRequest;
}

function sanitizeProjectSourceSecrets(projectData) {
    const nextProject = cloneDeep(projectData);

    nextProject.dataSources = Array.isArray(nextProject.dataSources)
        ? nextProject.dataSources.map((source) => ({
              ...source,
              request: sanitizeSourceRequestSecrets(source?.request ?? {}),
          }))
        : [];

    return nextProject;
}

function rememberProjectSourceSecrets(projectId, projectData) {
    const normalizedProjectId = String(projectId || "").trim();

    if (!normalizedProjectId) {
        return;
    }

    const nextProjectSecrets = Object.fromEntries(
        (projectData?.dataSources ?? [])
            .map((source) => {
                if (!source?.id) {
                    return null;
                }

                const secretPayload = extractSourceRequestSecrets(
                    source.request ?? {},
                );

                return Object.keys(secretPayload).length
                    ? [source.id, secretPayload]
                    : null;
            })
            .filter(Boolean),
    );

    if (Object.keys(nextProjectSecrets).length) {
        dataSourceSecretStoreState = {
            ...dataSourceSecretStoreState,
            [normalizedProjectId]: nextProjectSecrets,
        };
    } else if (dataSourceSecretStoreState[normalizedProjectId]) {
        const nextStore = {
            ...dataSourceSecretStoreState,
        };

        delete nextStore[normalizedProjectId];
        dataSourceSecretStoreState = nextStore;
    }

    persistDataSourceSecretStore();
}

function hydrateProjectSourceSecrets(projectData, projectId) {
    const normalizedProject = normalizeProjectSchema(cloneDeep(projectData));
    const normalizedProjectId = String(projectId || "").trim();
    const projectSecrets = normalizedProjectId
        ? dataSourceSecretStoreState[normalizedProjectId]
        : null;

    if (!projectSecrets) {
        return normalizedProject;
    }

    normalizedProject.dataSources.forEach((source) => {
        if (!source?.id) {
            return;
        }

        const sourceSecrets = projectSecrets[source.id];

        if (!sourceSecrets) {
            return;
        }

        const nextRequest = createDataSourceRequestConfig(source.request ?? {});

        DATA_SOURCE_SECRET_FIELDS.forEach((field) => {
            if (
                (typeof nextRequest[field] !== "string" ||
                    nextRequest[field] === "") &&
                typeof sourceSecrets[field] === "string"
            ) {
                nextRequest[field] = sourceSecrets[field];
            }
        });

        source.request = nextRequest;
    });

    return normalizedProject;
}

function removeProjectSourceSecrets(projectId) {
    const normalizedProjectId = String(projectId || "").trim();

    if (!normalizedProjectId || !dataSourceSecretStoreState[normalizedProjectId]) {
        return;
    }

    const nextStore = {
        ...dataSourceSecretStoreState,
    };

    delete nextStore[normalizedProjectId];
    dataSourceSecretStoreState = nextStore;
    persistDataSourceSecretStore();
}

function copyProjectSourceSecrets(fromProjectId, toProjectId) {
    const sourceProjectId = String(fromProjectId || "").trim();
    const targetProjectId = String(toProjectId || "").trim();

    if (!sourceProjectId || !targetProjectId) {
        return;
    }

    const sourceSecrets = dataSourceSecretStoreState[sourceProjectId];

    if (!sourceSecrets) {
        removeProjectSourceSecrets(targetProjectId);
        return;
    }

    dataSourceSecretStoreState = {
        ...dataSourceSecretStoreState,
        [targetProjectId]: cloneDeep(sourceSecrets),
    };
    persistDataSourceSecretStore();
}

function buildProjectExportPayload(projectData) {
    return JSON.stringify(sanitizeProjectSourceSecrets(projectData), null, 2);
}

function getRestorableEditorProject() {
    if (currentProjectRecord.value) {
        return hydrateProjectSourceSecrets(
            JSON.parse(currentProjectRecord.value.snapshot),
            currentProjectRecord.value.id,
        );
    }

    return loadProject();
}

function createPublishedSnapshotId() {
    return (
        globalThis.crypto?.randomUUID?.() ??
        `publish-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
}

function normalizePublishedSnapshotRecord(rawRecord, index = 0) {
    if (
        !rawRecord ||
        typeof rawRecord !== "object" ||
        typeof rawRecord.snapshot !== "string"
    ) {
        return null;
    }

    try {
        const normalizedProject = normalizeProjectSchema(
            JSON.parse(rawRecord.snapshot),
        );
        const pageId =
            typeof rawRecord.pageId === "string" &&
            normalizedProject.pages.some((page) => page.id === rawRecord.pageId)
                ? rawRecord.pageId
                : normalizedProject.activePageId ||
                  normalizedProject.pages[0]?.id ||
                  "";
        const pageName =
            normalizedProject.pages.find((page) => page.id === pageId)?.name ??
            rawRecord.pageName ??
            "未命名页面";

        return {
            id:
                typeof rawRecord.id === "string" && rawRecord.id
                    ? rawRecord.id
                    : `publish-${index + 1}`,
            name:
                typeof rawRecord.name === "string" && rawRecord.name.trim()
                    ? rawRecord.name.trim()
                    : deriveProjectRecordName(normalizedProject),
            projectRecordId:
                typeof rawRecord.projectRecordId === "string"
                    ? rawRecord.projectRecordId
                    : "",
            projectName:
                typeof rawRecord.projectName === "string" &&
                rawRecord.projectName.trim()
                    ? rawRecord.projectName.trim()
                    : deriveProjectRecordName(normalizedProject),
            pageId,
            pageName,
            createdAt: Number.isFinite(Number(rawRecord.createdAt))
                ? Number(rawRecord.createdAt)
                : Date.now(),
            updatedAt: Number.isFinite(Number(rawRecord.updatedAt))
                ? Number(rawRecord.updatedAt)
                : Date.now(),
            snapshot: JSON.stringify(
                sanitizeProjectSourceSecrets(normalizedProject),
            ),
        };
    } catch (error) {
        console.warn(error);
        return null;
    }
}

function loadPublishedSnapshotLibrary() {
    if (typeof localStorage === "undefined") {
        return [];
    }

    const rawValue = localStorage.getItem(PUBLISHED_SNAPSHOT_STORAGE_KEY);

    if (!rawValue) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawValue);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map((item, index) => normalizePublishedSnapshotRecord(item, index))
            .filter(Boolean)
            .sort((left, right) => right.updatedAt - left.updatedAt);
    } catch (error) {
        console.warn(error);
        return [];
    }
}

function persistPublishedSnapshotLibrary(library) {
    if (typeof localStorage === "undefined") {
        return;
    }

    localStorage.setItem(
        PUBLISHED_SNAPSHOT_STORAGE_KEY,
        JSON.stringify(library),
    );
}

function resolvePublishedRuntimeState(routeState, snapshotLibrary) {
    if (!routeState?.publishId) {
        return null;
    }

    const snapshot =
        snapshotLibrary.find((item) => item.id === routeState.publishId) ?? null;

    if (!snapshot) {
        return null;
    }

    const normalizedProject = normalizeProjectSchema(JSON.parse(snapshot.snapshot));
    const pageId =
        typeof routeState.pageId === "string" &&
        normalizedProject.pages.some((page) => page.id === routeState.pageId)
            ? routeState.pageId
            : snapshot.pageId ||
              normalizedProject.activePageId ||
              normalizedProject.pages[0]?.id ||
              "";

    if (pageId) {
        normalizedProject.activePageId = pageId;
    }

    return {
        snapshot,
        project: normalizedProject,
        pageId,
    };
}

function buildPublishedSnapshotRecord(projectData, options = {}) {
    const normalizedProject = normalizeProjectSchema(cloneDeep(projectData));
    const pageId =
        typeof options.pageId === "string" &&
        normalizedProject.pages.some((page) => page.id === options.pageId)
            ? options.pageId
            : normalizedProject.activePageId ||
              normalizedProject.pages[0]?.id ||
              "";
    const pageName =
        normalizedProject.pages.find((page) => page.id === pageId)?.name ??
        "未命名页面";

    if (pageId) {
        normalizedProject.activePageId = pageId;
    }

    return {
        id: createPublishedSnapshotId(),
        name:
            typeof options.name === "string" && options.name.trim()
                ? options.name.trim()
                : `${deriveProjectRecordName(normalizedProject)} 发布版`,
        projectRecordId:
            typeof options.projectRecordId === "string"
                ? options.projectRecordId
                : "",
        projectName:
            typeof options.projectName === "string" && options.projectName.trim()
                ? options.projectName.trim()
                : deriveProjectRecordName(normalizedProject),
        pageId,
        pageName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        snapshot: JSON.stringify(
            sanitizeProjectSourceSecrets(normalizedProject),
        ),
    };
}

function buildPublishedRuntimeLink(snapshotId, pageId = "") {
    if (typeof window === "undefined") {
        return "";
    }

    const url = new URL(window.location.href);
    url.searchParams.set("mode", "runtime");

    if (snapshotId) {
        url.searchParams.set("publishId", snapshotId);
    } else {
        url.searchParams.delete("publishId");
    }

    if (pageId) {
        url.searchParams.set("page", pageId);
    } else {
        url.searchParams.delete("page");
    }

    return url.toString();
}

function getInteractionActionLabel(actionType) {
    switch (actionType) {
        case "highlight-widgets":
            return "高亮组件";
        case "refresh-sources":
            return "刷新数据源";
        case "switch-page":
            return "切换页面";
        case "show-widgets":
            return "显示组件";
        case "hide-widgets":
            return "隐藏组件";
        case "toggle-widgets-visibility":
            return "切换显隐";
        case "patch-widget-props":
            return "更新组件属性";
        case "set-runtime-variable":
            return "设置运行时变量";
        default:
            return "动作";
    }
}

function setRuntimeWidgetHidden(widgetIds, hidden) {
    const targetIds = Array.from(new Set(widgetIds.filter(Boolean)));

    if (!targetIds.length) {
        return 0;
    }

    const nextState = { ...widgetRuntimeState.value };
    let count = 0;

    targetIds.forEach((widgetId) => {
        const widget = currentPage.value?.widgets.find(
            (item) => item.id === widgetId,
        );

        if (!widget) {
            return;
        }

        nextState[widgetId] = {
            ...(nextState[widgetId] ?? {}),
            hidden,
        };
        count += 1;
    });

    widgetRuntimeState.value = nextState;
    return count;
}

function toggleRuntimeWidgetHidden(widgetIds) {
    const targetIds = Array.from(new Set(widgetIds.filter(Boolean)));

    if (!targetIds.length) {
        return 0;
    }

    const nextState = { ...widgetRuntimeState.value };
    let count = 0;

    targetIds.forEach((widgetId) => {
        const widget = currentPage.value?.widgets.find(
            (item) => item.id === widgetId,
        );

        if (!widget) {
            return;
        }

        const currentHidden = nextState[widgetId]?.hidden ?? widget.hidden;
        nextState[widgetId] = {
            ...(nextState[widgetId] ?? {}),
            hidden: !currentHidden,
        };
        count += 1;
    });

    widgetRuntimeState.value = nextState;
    return count;
}

function getActiveInteractivePageId() {
    return isRuntimeMode.value
        ? runtimePageId.value || currentPageId.value
        : currentPageId.value;
}

function shouldSyncRuntimeFilterState(widgetIds = []) {
    return widgetIds.some((widgetId) =>
        isFilterSourceWidgetType(findWidgetAcrossPages(widgetId)?.type),
    );
}

function createProjectRecordId() {
    return (
        globalThis.crypto?.randomUUID?.() ??
        `project-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
}

function createBlankProjectState(name = "页面 1") {
    const page = createProjectPage(name, {
        meta: {
            ...cloneDeep(defaultPageMeta),
            title: "新建大屏",
        },
        widgets: [],
    });

    return {
        dataSources: [],
        runtimeVariablePresets: [],
        pages: [page],
        activePageId: page.id,
    };
}

function deriveProjectRecordName(projectData) {
    return (
        projectData?.pages?.[0]?.meta?.title ||
        projectData?.pages?.[0]?.name ||
        projectData?.activePageId ||
        "未命名项目"
    );
}

function normalizeProjectRecord(rawRecord, index = 0) {
    if (
        !rawRecord ||
        typeof rawRecord !== "object" ||
        typeof rawRecord.snapshot !== "string"
    ) {
        return null;
    }

    try {
        const normalizedProject = normalizeProjectSchema(
            JSON.parse(rawRecord.snapshot),
        );
        const recordId =
            typeof rawRecord.id === "string" && rawRecord.id
                ? rawRecord.id
                : `project-${index + 1}`;

        if (projectContainsSourceSecrets(normalizedProject)) {
            rememberProjectSourceSecrets(recordId, normalizedProject);
        }

        const sanitizedProject = sanitizeProjectSourceSecrets(normalizedProject);

        return {
            id: recordId,
            name:
                typeof rawRecord.name === "string" && rawRecord.name.trim()
                    ? rawRecord.name.trim()
                    : deriveProjectRecordName(normalizedProject),
            updatedAt: Number.isFinite(Number(rawRecord.updatedAt))
                ? Number(rawRecord.updatedAt)
                : Date.now(),
            snapshot: JSON.stringify(sanitizedProject),
        };
    } catch (error) {
        console.warn(error);
        return null;
    }
}

function buildProjectRecord(projectData, overrides = {}) {
    const normalizedProject = normalizeProjectSchema(cloneDeep(projectData));
    const recordId = overrides.id ?? createProjectRecordId();

    rememberProjectSourceSecrets(recordId, normalizedProject);

    return {
        id: recordId,
        name:
            typeof overrides.name === "string" && overrides.name.trim()
                ? overrides.name.trim()
                : deriveProjectRecordName(normalizedProject),
        updatedAt: overrides.updatedAt ?? Date.now(),
        snapshot: JSON.stringify(sanitizeProjectSourceSecrets(normalizedProject)),
    };
}

function persistProjectLibraryState(library, activeProjectId) {
    if (typeof localStorage === "undefined") {
        return;
    }

    localStorage.setItem(PROJECT_LIBRARY_STORAGE_KEY, JSON.stringify(library));

    if (activeProjectId) {
        localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, activeProjectId);
    } else {
        localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
    }
}

function loadProjectLibrary() {
    if (typeof localStorage === "undefined") {
        return [];
    }

    const rawValue = localStorage.getItem(PROJECT_LIBRARY_STORAGE_KEY);

    if (!rawValue) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawValue);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map((item, index) => normalizeProjectRecord(item, index))
            .filter(Boolean);
    } catch (error) {
        console.warn(error);
        return [];
    }
}

function loadProject() {
    if (typeof localStorage === "undefined") {
        return createDemoProject();
    }

    const localValue = localStorage.getItem(STORAGE_KEY);

    if (!localValue) {
        return createDemoProject();
    }

    try {
        return normalizeProjectSchema(JSON.parse(localValue));
    } catch (error) {
        console.warn(error);
        return createDemoProject();
    }
}

function loadProjectState() {
    const fallbackProject = loadProject();
    const library = loadProjectLibrary();

    if (!library.length) {
        const initialRecord = buildProjectRecord(fallbackProject);
        persistProjectLibraryState([initialRecord], initialRecord.id);

        return {
            project: hydrateProjectSourceSecrets(
                JSON.parse(initialRecord.snapshot),
                initialRecord.id,
            ),
            library: [initialRecord],
            activeProjectId: initialRecord.id,
        };
    }

    const storedActiveId =
        typeof localStorage === "undefined"
            ? ""
            : localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) || "";
    const activeRecord =
        library.find((item) => item.id === storedActiveId) ?? library[0];

    persistProjectLibraryState(library, activeRecord.id);

    return {
        project: hydrateProjectSourceSecrets(
            JSON.parse(activeRecord.snapshot),
            activeRecord.id,
        ),
        library,
        activeProjectId: activeRecord.id,
    };
}

function getInitialRouteState() {
    if (typeof window === "undefined") {
        return {
            mode: "editor",
            pageId: "",
            publishId: "",
        };
    }

    const url = new URL(window.location.href);
    return {
        mode: url.searchParams.get("mode") === "runtime" ? "runtime" : "editor",
        pageId: url.searchParams.get("page") || "",
        publishId: url.searchParams.get("publishId") || "",
    };
}

function syncRoute() {
    if (typeof window === "undefined") {
        return;
    }

    const url = new URL(window.location.href);

    if (isRuntimeMode.value) {
        url.searchParams.set("mode", "runtime");

        if (currentPageId.value) {
            url.searchParams.set("page", currentPageId.value);
        } else {
            url.searchParams.delete("page");
        }

        if (runtimePublishedSnapshotId.value) {
            url.searchParams.set("publishId", runtimePublishedSnapshotId.value);
        } else {
            url.searchParams.delete("publishId");
        }
    } else {
        url.searchParams.delete("mode");
        url.searchParams.delete("page");
        url.searchParams.delete("publishId");
    }

    window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
    );
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function createHistoryEntry(snapshot, label) {
    return {
        snapshot,
        label,
        at: Date.now(),
    };
}

function queueHistoryLabel(label) {
    pendingHistoryLabel.value = label;
}

function clearQueuedHistoryLabel() {
    pendingHistoryLabel.value = null;
}

function startHistorySession(label) {
    activeHistoryLabel.value = label;
}

function endHistorySession() {
    flushProjectSync();
    activeHistoryLabel.value = null;
}

function cleanupInteractionReferences(options = {}) {
    const removedWidgetIds = new Set(options.widgetIds ?? []);
    const removedSourceIds = new Set(options.sourceIds ?? []);
    const removedPageIds = new Set(options.pageIds ?? []);

    if (
        !removedWidgetIds.size &&
        !removedSourceIds.size &&
        !removedPageIds.size
    ) {
        return;
    }

    project.value.pages.forEach((page) => {
        page.widgets.forEach((widget) => {
            if (!widget.interaction) {
                return;
            }

            if (!Array.isArray(widget.interaction.actions)) {
                widget.interaction.actions = getInteractionActions(
                    widget.interaction,
                );
            }

            widget.interaction.actions.forEach((action) => {
                if (removedWidgetIds.size) {
                    action.targetWidgetIds = (
                        action.targetWidgetIds ?? []
                    ).filter((id) => !removedWidgetIds.has(id));
                }

                if (removedSourceIds.size) {
                    action.targetSourceIds = (
                        action.targetSourceIds ?? []
                    ).filter((id) => !removedSourceIds.has(id));
                }

                if (
                    removedPageIds.size &&
                    removedPageIds.has(action.targetPageId)
                ) {
                    action.targetPageId = "";
                }
            });
        });
    });
}

function flushProjectSync() {
    if (projectSyncTimerId) {
        window.clearTimeout(projectSyncTimerId);
        projectSyncTimerId = 0;
    }

    if (isPublishedRuntime.value) {
        lastProjectSnapshot = JSON.stringify(project.value);
        return;
    }

    const nextSnapshot = JSON.stringify(project.value);

    if (nextSnapshot === lastProjectSnapshot) {
        return;
    }

    rememberProjectSourceSecrets(activeProjectRecordId.value, project.value);
    const persistedSnapshot = JSON.stringify(
        sanitizeProjectSourceSecrets(project.value),
    );

    if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, persistedSnapshot);
    }

    syncActiveProjectRecord(persistedSnapshot);

    if (!isRestoringHistory.value) {
        const previousSnapshot = lastProjectSnapshot;
        const label =
            pendingHistoryLabel.value || activeHistoryLabel.value || "编辑画布";
        const now = Date.now();
        const shouldMerge =
            undoStack.value.length > 0 &&
            label === lastHistoryCommitLabel.value &&
            now - lastHistoryCommitAt.value < HISTORY_MERGE_WINDOW;

        if (!shouldMerge) {
            pushUndoEntry(
                createHistoryEntry(previousSnapshot, currentHistoryLabel.value),
            );
        }

        redoStack.value = [];
        currentHistoryLabel.value = label;
        lastHistoryCommitAt.value = now;
        lastHistoryCommitLabel.value = label;
        pendingHistoryLabel.value = null;
    }

    lastProjectSnapshot = nextSnapshot;
}

function scheduleProjectSync(delay = PROJECT_SYNC_DELAY) {
    if (projectSyncTimerId) {
        window.clearTimeout(projectSyncTimerId);
    }

    projectSyncTimerId = window.setTimeout(() => {
        flushProjectSync();
    }, delay);
}

function sanitizeSelection(ids, primaryId = null) {
    const availableIds = new Set(currentWidgets.value.map((item) => item.id));
    const uniqueIds = Array.from(
        new Set(ids.filter((id) => availableIds.has(id))),
    );

    selectedIds.value = uniqueIds;
    primarySelectedId.value = uniqueIds.includes(primaryId)
        ? primaryId
        : (uniqueIds.at(-1) ?? null);
}

function selectDefaultWidget(page = currentPage.value) {
    const firstId = page?.widgets[0]?.id ?? null;
    sanitizeSelection(firstId ? [firstId] : [], firstId);
}

function selectAllWidgets() {
    if (!currentWidgets.value.length) {
        return;
    }

    sanitizeSelection(
        currentWidgets.value.map((item) => item.id),
        currentWidgets.value.at(-1)?.id ?? null,
    );
    statusMessage.value = `已选中当前页 ${currentWidgets.value.length} 个组件`;
}

function updateSelection(payload) {
    sanitizeSelection(payload?.ids ?? [], payload?.primaryId ?? null);
}

function toggleSelectionByIds(idsToToggle, primaryId) {
    const selection = new Set(selectedIds.value);
    const fullySelected = idsToToggle.every((id) => selection.has(id));

    if (fullySelected) {
        idsToToggle.forEach((id) => selection.delete(id));
    } else {
        idsToToggle.forEach((id) => selection.add(id));
    }

    const ids = Array.from(selection);
    sanitizeSelection(
        ids,
        ids.includes(primaryId) ? primaryId : (ids.at(-1) ?? null),
    );
}

function getExpandedSelectedIds() {
    return expandIdsWithGroups(selectedIds.value, currentWidgets.value);
}

function getEditableSelectedWidgets(minCount = 1) {
    const editable = selectedWidgets.value.filter(
        (item) => !item.locked && !item.hidden,
    );
    return editable.length >= minCount ? editable : [];
}

function createSourceRuntimeEntry(source, overrides = {}) {
    return {
        payload: cloneDeep(overrides.payload ?? source.payload),
        updatedAt: overrides.updatedAt ?? null,
        refreshCount: overrides.refreshCount ?? 0,
        error: overrides.error ?? "",
        requestPreview: overrides.requestPreview ?? null,
        responseStatus: overrides.responseStatus ?? null,
        responseStatusText: overrides.responseStatusText ?? "",
        responsePreview: overrides.responsePreview ?? "",
        extractedPreview: overrides.extractedPreview ?? "",
        mappedFieldCount: overrides.mappedFieldCount ?? 0,
        retryAttempts: overrides.retryAttempts ?? 0,
        attemptCount: overrides.attemptCount ?? 0,
    };
}

function findDataSource(sourceId) {
    return (
        project.value.dataSources.find((item) => item.id === sourceId) ?? null
    );
}

function getSourceRefreshRunState(sourceId) {
    const existing = sourceRefreshRunState.get(sourceId);

    if (existing) {
        return existing;
    }

    const nextState = {
        inFlight: false,
        queued: false,
        queuedSilent: true,
        promise: null,
    };

    sourceRefreshRunState.set(sourceId, nextState);
    return nextState;
}

function clearStaleSourceRefreshRunState() {
    const validIds = new Set(
        project.value.dataSources.map((source) => source.id),
    );

    Array.from(sourceRefreshRunState.keys()).forEach((sourceId) => {
        if (!validIds.has(sourceId)) {
            sourceRefreshRunState.delete(sourceId);
        }
    });
}

function normalizeRefreshOptions(options = {}) {
    return {
        silent: options.silent === true,
        triggerConditionMatch: options.triggerConditionMatch !== false,
        runContext: options.runContext ?? null,
    };
}

function cancelInteractivePageInitialization() {
    interactivePageInitToken += 1;
}

function isInteractivePageInitializationActive(token, pageId) {
    if (token !== interactivePageInitToken) {
        return false;
    }

    if (isRuntimeMode.value) {
        return runtimePageId.value === pageId;
    }

    return previewMode.value && currentPageId.value === pageId;
}

function formatRefreshSummary(successCount, failureCount) {
    if (successCount <= 0 && failureCount <= 0) {
        return "当前没有可刷新的数据源";
    }

    if (failureCount <= 0) {
        return `已刷新 ${successCount} 个数据源`;
    }

    if (successCount <= 0) {
        return `数据源刷新失败：${failureCount} 个失败`;
    }

    return `已刷新 ${successCount} 个数据源，${failureCount} 个失败`;
}

function syncDataSourceRuntime() {
    const previousRuntime = dataSourceRuntime.value;
    const nextRuntime = {};

    project.value.dataSources.forEach((source) => {
        nextRuntime[source.id] = createSourceRuntimeEntry(source, {
            ...(previousRuntime[source.id] ?? {}),
            payload: source.payload,
        });
    });

    dataSourceRuntime.value = nextRuntime;
    clearStaleSourceRefreshRunState();
    clearConditionMatchState();
}

function clearSourceRefreshTimers() {
    sourceRefreshTimers.forEach((timerId) => {
        window.clearInterval(timerId);
    });

    sourceRefreshTimers.clear();
}

function clearInteractionTimers() {
    interactionTimers.forEach((timerId) => {
        window.clearTimeout(timerId);
    });

    interactionTimers.clear();
}

function cancelInteractionRuns() {
    interactionRunToken += 1;
    clearInteractionTimers();
}

function isInteractionRunActive(token) {
    return (
        token === interactionRunToken &&
        (previewMode.value || isRuntimeMode.value)
    );
}

function waitForInteractionDelay(delay, token) {
    if (delay <= 0) {
        return Promise.resolve(isInteractionRunActive(token));
    }

    return new Promise((resolve) => {
        const timerId = window.setTimeout(() => {
            interactionTimers.delete(timerId);
            resolve(isInteractionRunActive(token));
        }, delay);

        interactionTimers.add(timerId);
    });
}

function createInteractionRunContext(options = {}) {
    interactionChainSeed += 1;

    return {
        id: `interaction-chain-${Date.now()}-${interactionChainSeed}`,
        sourceLabel:
            typeof options.sourceLabel === "string" && options.sourceLabel.trim()
                ? options.sourceLabel.trim()
                : "交互执行",
        totalSteps: 0,
        activeDepth: 0,
        blocked: false,
        blockedReason: "",
        activeKeys: new Set(),
        visitedKeys: new Map(),
    };
}

function stopInteractionRunContext(runContext, detail) {
    if (!runContext || runContext.blocked) {
        return false;
    }

    runContext.blocked = true;
    runContext.blockedReason = detail;
    statusMessage.value = "检测到联动循环，已自动停止本次执行";
    pushRuntimeDebugEvent({
        level: "warning",
        category: "interaction",
        title: "联动已自动停止",
        detail,
    });
    return true;
}

function buildInteractionStepKey(widget, action, pageId = currentPageId.value) {
    return [
        pageId || "unknown-page",
        widget?.id || "unknown-widget",
        action?.id || action?.action || "unknown-action",
        action?.action || "none",
    ].join(":");
}

function enterInteractionRunStep(
    runContext,
    widget,
    action,
    pageId = currentPageId.value,
) {
    if (!runContext) {
        return {
            ok: true,
            release() {},
        };
    }

    if (runContext.blocked) {
        return {
            ok: false,
            reason: runContext.blockedReason,
            release() {},
        };
    }

    const widgetName = widget?.name || "未命名组件";
    const actionLabel = getInteractionActionLabel(action?.action || "none");
    const stepKey = buildInteractionStepKey(widget, action, pageId);

    if (runContext.activeKeys.has(stepKey)) {
        stopInteractionRunContext(
            runContext,
            `${runContext.sourceLabel} · ${widgetName} / ${actionLabel} 出现递归回路`,
        );
        return {
            ok: false,
            reason: runContext.blockedReason,
            release() {},
        };
    }

    if (runContext.activeDepth + 1 > INTERACTION_CHAIN_MAX_DEPTH) {
        stopInteractionRunContext(
            runContext,
            `${runContext.sourceLabel} · 嵌套层级超过 ${INTERACTION_CHAIN_MAX_DEPTH} 层`,
        );
        return {
            ok: false,
            reason: runContext.blockedReason,
            release() {},
        };
    }

    if (runContext.totalSteps + 1 > INTERACTION_CHAIN_MAX_STEPS) {
        stopInteractionRunContext(
            runContext,
            `${runContext.sourceLabel} · 单次联动超过 ${INTERACTION_CHAIN_MAX_STEPS} 步`,
        );
        return {
            ok: false,
            reason: runContext.blockedReason,
            release() {},
        };
    }

    const nextVisitCount = (runContext.visitedKeys.get(stepKey) ?? 0) + 1;

    if (nextVisitCount > INTERACTION_CHAIN_REPEAT_LIMIT) {
        stopInteractionRunContext(
            runContext,
            `${runContext.sourceLabel} · ${widgetName} / ${actionLabel} 在单次链路内重复触发过多`,
        );
        return {
            ok: false,
            reason: runContext.blockedReason,
            release() {},
        };
    }

    runContext.totalSteps += 1;
    runContext.activeDepth += 1;
    runContext.visitedKeys.set(stepKey, nextVisitCount);
    runContext.activeKeys.add(stepKey);

    return {
        ok: true,
        release() {
            runContext.activeKeys.delete(stepKey);
            runContext.activeDepth = Math.max(runContext.activeDepth - 1, 0);
        },
    };
}

function syncSourceRefreshTimers() {
    clearSourceRefreshTimers();

    if (!previewMode.value && !isRuntimeMode.value) {
        return;
    }

    project.value.dataSources.forEach((source) => {
        if (source.refreshInterval <= 0) {
            return;
        }

        const timerId = window.setInterval(() => {
            refreshDataSource(source.id, { silent: true }).catch((error) => {
                console.warn(error);
            });
        }, source.refreshInterval * 1000);

        sourceRefreshTimers.set(source.id, timerId);
    });
}

async function performDataSourceRefresh(sourceId, options = {}) {
    const normalizedOptions = normalizeRefreshOptions(options);
    const source = findDataSource(sourceId);
    const refreshStartedAt = Date.now();

    if (!source) {
        return false;
    }

    const current =
        dataSourceRuntime.value[source.id] ?? createSourceRuntimeEntry(source);

    const now = new Date();
    const requestContext = {
        timestamp: now.getTime(),
        isoNow: now.toISOString(),
        today: now.toISOString().slice(0, 10),
        pageId: currentPageId.value,
        pageName: currentPage.value?.name ?? "",
        projectTitle: currentCanvas.value.meta.title ?? "",
        sourceId: source.id,
        sourceName: source.name,
    };

    try {
        const result = await resolveDataSourceRuntime(source, requestContext);
        const activeSource = findDataSource(source.id);

        if (!activeSource) {
            return false;
        }

        const committedCurrent =
            dataSourceRuntime.value[source.id] ?? current;

        dataSourceRuntime.value = {
            ...dataSourceRuntime.value,
            [source.id]: createSourceRuntimeEntry(activeSource, {
                payload: result.payload,
                updatedAt: Date.now(),
                refreshCount: (committedCurrent.refreshCount ?? 0) + 1,
                error: "",
                requestPreview: result.meta?.requestPreview ?? null,
                responseStatus: result.meta?.responseStatus ?? null,
                responseStatusText: result.meta?.responseStatusText ?? "",
                responsePreview: result.meta?.responsePreview ?? "",
                extractedPreview: result.meta?.extractedPreview ?? "",
                mappedFieldCount: result.meta?.mappedFieldCount ?? 0,
                retryAttempts: result.meta?.retryAttempts ?? 0,
                attemptCount: result.meta?.attemptCount ?? 0,
            }),
        };

        pushRuntimeDebugEvent({
            level: "success",
            category: "source",
            title: "数据源刷新完成",
            detail: [
                activeSource.name,
                result.meta?.responseStatus
                    ? `${result.meta.responseStatus}${result.meta?.responseStatusText ? ` ${result.meta.responseStatusText}` : ""}`
                    : activeSource.generator === "remote"
                      ? "远程接口"
                      : "本地数据",
                `${Date.now() - refreshStartedAt}ms`,
                result.meta?.retryAttempts
                    ? `重试 ${result.meta.retryAttempts} 次`
                    : "首轮成功",
            ]
                .filter(Boolean)
                .join(" · "),
        });

        if (
            normalizedOptions.triggerConditionMatch &&
            (previewMode.value || isRuntimeMode.value)
        ) {
            await triggerConditionMatchInteractions(
                isRuntimeMode.value
                    ? runtimePageId.value || currentPageId.value
                    : currentPageId.value,
                {
                    sourceId: activeSource.id,
                    reason: "source-refresh",
                    runContext: normalizedOptions.runContext,
                },
            );
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";
        const activeSource = findDataSource(source.id);

        if (!activeSource) {
            return false;
        }

        const fallbackCurrent =
            dataSourceRuntime.value[source.id] ?? current;

        dataSourceRuntime.value = {
            ...dataSourceRuntime.value,
            [source.id]: createSourceRuntimeEntry(activeSource, {
                ...fallbackCurrent,
                payload: fallbackCurrent.payload ?? activeSource.payload,
                error: message,
                retryAttempts:
                    typeof error?.retryAttempts === "number"
                        ? error.retryAttempts
                        : fallbackCurrent.retryAttempts ?? 0,
                attemptCount:
                    typeof error?.attemptCount === "number"
                        ? error.attemptCount
                        : fallbackCurrent.attemptCount ?? 0,
            }),
        };

        statusMessage.value = `数据源 ${activeSource.name} 刷新失败：${message}`;
        pushRuntimeDebugEvent({
            level: "error",
            category: "source",
            title: "数据源刷新失败",
            detail: `${activeSource.name} · ${message}`,
        });
        console.warn(error);
        return false;
    }

    if (!normalizedOptions.silent) {
        statusMessage.value = `已刷新数据源：${source.name}`;
    }

    return true;
}

async function refreshDataSource(sourceId, options = {}) {
    const normalizedOptions = normalizeRefreshOptions(options);
    const runState = getSourceRefreshRunState(sourceId);

    if (runState.inFlight) {
        runState.queued = true;
        runState.queuedSilent = runState.queuedSilent && normalizedOptions.silent;
        return runState.promise ?? Promise.resolve(false);
    }

    runState.inFlight = true;
    runState.queued = false;
    runState.queuedSilent = true;
    runState.promise = (async () => {
        let effectiveOptions = normalizedOptions;
        let lastResult = false;

        while (true) {
            lastResult = await performDataSourceRefresh(
                sourceId,
                effectiveOptions,
            );

            if (!runState.queued) {
                return lastResult;
            }

            effectiveOptions = {
                silent: runState.queuedSilent,
            };
            runState.queued = false;
            runState.queuedSilent = true;
        }
    })().finally(() => {
        runState.inFlight = false;
        runState.queued = false;
        runState.queuedSilent = true;
        runState.promise = null;
    });

    return runState.promise;
}

async function refreshAllDataSources(options = {}) {
    const normalizedOptions = normalizeRefreshOptions(options);
    const refreshStartedAt = Date.now();

    if (!project.value.dataSources.length) {
        if (!normalizedOptions.silent) {
            statusMessage.value = "当前没有可刷新的数据源";
        }
        return {
            successCount: 0,
            failureCount: 0,
        };
    }

    const results = await Promise.all(
        project.value.dataSources.map((source) =>
            refreshDataSource(source.id, { silent: true }),
        ),
    );
    const successCount = results.filter(Boolean).length;
    const failureCount = results.length - successCount;

    if (!normalizedOptions.silent) {
        statusMessage.value = formatRefreshSummary(
            successCount,
            failureCount,
        );
    }

    if (options.recordPerformance !== false) {
        pushRuntimePerformanceEntry({
            type: "source-refresh-batch",
            duration: Date.now() - refreshStartedAt,
            sourceLabel:
                typeof options.sourceLabel === "string" &&
                options.sourceLabel.trim()
                    ? options.sourceLabel.trim()
                    : normalizedOptions.silent
                      ? "系统刷新"
                      : "手动刷新",
            detail: `${successCount} 成功 / ${failureCount} 失败`,
            sourceCount: project.value.dataSources.length,
            successCount,
            failureCount,
            pageId: currentPageId.value,
            pageName: currentPage.value?.name ?? "",
        });
    }

    return {
        successCount,
        failureCount,
    };
}

async function initializeInteractivePage(
    pageId = currentPageId.value,
    options = {},
) {
    const activePageId = pageId || currentPageId.value;
    const refreshDataSources = options.refreshDataSources !== false;
    const initializeStartedAt = Date.now();

    if (!activePageId) {
        return;
    }

    const token = ++interactivePageInitToken;
    const activePage =
        project.value.pages.find((page) => page.id === activePageId) ?? null;
    let refreshResult = {
        successCount: 0,
        failureCount: 0,
    };

    if (refreshDataSources) {
        refreshResult = await refreshAllDataSources({
            silent: true,
            triggerConditionMatch: false,
            sourceLabel: "页面初始化",
        });
    }

    if (!isInteractivePageInitializationActive(token, activePageId)) {
        return;
    }

    syncPageRuntimeFilters(activePageId);
    await nextTick();

    if (!isInteractivePageInitializationActive(token, activePageId)) {
        return;
    }

    await triggerPageEnterInteractions(activePageId);

    if (!isInteractivePageInitializationActive(token, activePageId)) {
        return;
    }

    await triggerConditionMatchInteractions(activePageId, {
        reason: "page-init",
    });
    const initializeDuration = Date.now() - initializeStartedAt;
    pushRuntimeDebugEvent({
        level: "info",
        category: "page",
        title: "页面运行态已初始化",
        detail: `${activePage?.name ?? activePageId}${refreshDataSources ? " · 已同步数据与联动" : " · 已同步联动状态"} · ${formatRuntimeDebugDuration(initializeDuration)}`,
        pageId: activePageId,
        pageName: activePage?.name ?? "",
    });
    if (options.recordPerformance !== false) {
        pushRuntimePerformanceEntry({
            type: "page-init",
            duration: initializeDuration,
            sourceLabel: "页面初始化",
            detail: refreshDataSources
                ? `${refreshResult.successCount} 个数据源已同步`
                : "已跳过数据源刷新",
            pageId: activePageId,
            pageName: activePage?.name ?? "",
            sourceCount: project.value.dataSources.length,
            successCount: refreshResult.successCount,
            failureCount: refreshResult.failureCount,
            refreshDataSources,
        });
    }
}

function formatClipboardValue(value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

async function copyTextToClipboard(value, messages) {
    const text = formatClipboardValue(value);

    if (!text) {
        statusMessage.value = messages.emptyMessage ?? "当前没有可复制的内容";
        return false;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
        statusMessage.value = messages.failureMessage;
        return false;
    }

    try {
        await navigator.clipboard.writeText(text);
        statusMessage.value = messages.successMessage;
        return true;
    } catch (error) {
        statusMessage.value = messages.failureMessage;
        console.warn(error);
        return false;
    }
}

async function copySourceDebug(payload) {
    const source = project.value.dataSources.find(
        (item) => item.id === payload.sourceId,
    );

    if (!source) {
        return false;
    }

    const runtime = dataSourceRuntime.value[source.id] ?? {};
    const targetMap = {
        request: {
            value: runtime.requestPreview,
            label: "最终请求预览",
        },
        extracted: {
            value: runtime.extractedPreview,
            label: "提取结果预览",
        },
        response: {
            value: runtime.responsePreview,
            label: "原始响应预览",
        },
    };
    const target = targetMap[payload.target];

    if (!target) {
        return false;
    }

    return copyTextToClipboard(target.value, {
        successMessage: `已复制 ${source.name} 的${target.label}`,
        failureMessage: `复制 ${source.name} 的${target.label}失败，请稍后重试`,
        emptyMessage: `数据源 ${source.name} 暂无可复制的${target.label}`,
    });
}

async function copyAllSourcesConfig() {
    if (!project.value.dataSources.length) {
        statusMessage.value = "当前没有可复制的数据源配置";
        return false;
    }

    return copyTextToClipboard(
        buildAllSourcesExportPayload(project.value.dataSources),
        {
            successMessage: `已复制 ${project.value.dataSources.length} 个数据源配置`,
            failureMessage: "复制全部数据源配置失败，请稍后重试",
        },
    );
}

async function copySourceRuntimePayload(sourceId) {
    const source = project.value.dataSources.find(
        (item) => item.id === sourceId,
    );

    if (!source) {
        return false;
    }

    const runtime =
        dataSourceRuntime.value[source.id] ?? createSourceRuntimeEntry(source);

    return copyTextToClipboard(runtime.payload, {
        successMessage: `已复制 ${source.name} 的运行值`,
        failureMessage: `复制 ${source.name} 的运行值失败，请稍后重试`,
        emptyMessage: `数据源 ${source.name} 暂无可复制的运行值`,
    });
}

function applySourceRuntimePayload(sourceId) {
    const source = project.value.dataSources.find(
        (item) => item.id === sourceId,
    );

    if (!source) {
        return false;
    }

    const runtime =
        dataSourceRuntime.value[source.id] ?? createSourceRuntimeEntry(source);
    const runtimePayload = runtime.payload;

    if (
        !runtimePayload ||
        typeof runtimePayload !== "object" ||
        Array.isArray(runtimePayload)
    ) {
        statusMessage.value = `数据源 ${source.name} 当前没有可应用的运行值`;
        return false;
    }

    queueHistoryLabel("应用运行值");
    source.payload = cloneDeep(runtimePayload);
    dataSourceRuntime.value = {
        ...dataSourceRuntime.value,
        [source.id]: createSourceRuntimeEntry(source, {
            ...runtime,
            payload: cloneDeep(runtimePayload),
        }),
    };
    statusMessage.value = `已将 ${source.name} 的运行值设为默认 payload`;
    return true;
}

function clearSourceRuntime(sourceId, options = {}) {
    const source = project.value.dataSources.find(
        (item) => item.id === sourceId,
    );

    if (!source) {
        return false;
    }

    resetSourceRuntime(source);
    clearConditionMatchState();

    if (!options.silent) {
        statusMessage.value = `已清空数据源调试结果：${source.name}`;
    }

    return true;
}

function clearAllSourceRuntime(options = {}) {
    if (!project.value.dataSources.length) {
        if (!options.silent) {
            statusMessage.value = "当前没有可清空的数据源调试结果";
        }
        return false;
    }

    const nextRuntime = {};
    project.value.dataSources.forEach((source) => {
        nextRuntime[source.id] = createSourceRuntimeEntry(source);
    });
    dataSourceRuntime.value = nextRuntime;
    clearConditionMatchState();

    if (!options.silent) {
        statusMessage.value = `已清空 ${project.value.dataSources.length} 个数据源调试结果`;
    }

    return true;
}

function serializeSourceConfig(source) {
    return {
        name: source.name,
        type: source.type,
        generator: source.generator,
        refreshInterval: source.refreshInterval,
        request: sanitizeSourceRequestSecrets(source.request),
        payload: cloneDeep(source.payload),
    };
}

function buildSourceExportPayload(source) {
    return JSON.stringify(serializeSourceConfig(source), null, 2);
}

function buildAllSourcesExportPayload(sources) {
    return JSON.stringify(
        {
            dataSources: sources.map((source) => serializeSourceConfig(source)),
        },
        null,
        2,
    );
}

function parseImportedSourceConfigs(text, options = {}) {
    const parsed = JSON.parse(text);
    const rawSources = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.dataSources)
          ? parsed.dataSources
          : parsed && typeof parsed === "object"
            ? [parsed]
            : [];

    if (!rawSources.length) {
        throw new Error("No data sources found");
    }

    const normalizedSources = rawSources.map((item, index) =>
        normalizeDataSource(item, index),
    );

    if (!options.allowMultiple && normalizedSources.length !== 1) {
        throw new Error("Multiple sources are not supported in overwrite mode");
    }

    return normalizedSources;
}

function resetSourceRuntime(source, overrides = {}) {
    dataSourceRuntime.value = {
        ...dataSourceRuntime.value,
        [source.id]: createSourceRuntimeEntry(source, overrides),
    };
}

function clearIncompatibleSourceBindings(sourceId, sourceType) {
    project.value.pages.forEach((page) => {
        page.widgets.forEach((widget) => {
            if (
                widget.dataBinding?.sourceId === sourceId &&
                widget.type !== sourceType
            ) {
                widget.dataBinding.sourceId = "";
            }
        });
    });
}

function openSourceExportDialog(sourceId) {
    const source = project.value.dataSources.find(
        (item) => item.id === sourceId,
    );

    if (!source) {
        return;
    }

    dialogSourceId.value = source.id;
    dialogMode.value = "source-export";
    dialogText.value = buildSourceExportPayload(source);
}

function openSourceImportDialog(sourceId) {
    const source = project.value.dataSources.find(
        (item) => item.id === sourceId,
    );

    if (!source) {
        return;
    }

    dialogSourceId.value = source.id;
    dialogMode.value = "source-import";
    dialogText.value = "";
}

function openSourceCreateDialog() {
    dialogSourceId.value = "";
    dialogMode.value = "source-create-import";
    dialogText.value = "";
}

function buildPublishedSnapshotDraftName() {
    const timestamp = new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date());

    return `${currentProjectName.value} ${timestamp}`;
}

function openPublishManagerDialog() {
    publishedSnapshotDraftName.value = buildPublishedSnapshotDraftName();
    dialogMode.value = "project-publish";
}

function publishCurrentProjectSnapshot() {
    const snapshot = buildPublishedSnapshotRecord(project.value, {
        name: publishedSnapshotDraftName.value,
        projectRecordId: activeProjectRecordId.value,
        projectName: currentProjectName.value,
        pageId: currentPageId.value,
    });

    publishedSnapshots.value = [snapshot, ...publishedSnapshots.value].sort(
        (left, right) => right.updatedAt - left.updatedAt,
    );
    persistPublishedSnapshotLibrary(publishedSnapshots.value);
    publishedSnapshotDraftName.value = snapshot.name;
    statusMessage.value = `已发布快照：${snapshot.name}`;
}

async function copyPublishedSnapshotLink(snapshotId, options = {}) {
    const snapshot =
        publishedSnapshots.value.find((item) => item.id === snapshotId) ?? null;

    if (!snapshot) {
        statusMessage.value = "发布快照不存在，无法复制链接";
        return false;
    }

    const targetPageId =
        options.pageId ||
        (runtimePublishedSnapshotId.value === snapshot.id
            ? currentPageId.value
            : snapshot.pageId);
    const copied = await copyTextToClipboard(
        buildPublishedRuntimeLink(snapshot.id, targetPageId),
        {
            successMessage: "发布地址已复制到剪贴板",
            failureMessage: "发布地址复制失败，请手动复制浏览器地址",
        },
    );

    if (copied) {
        pushRuntimeDebugEvent({
            level: "info",
            category: "runtime",
            title: "已复制发布地址",
            detail: `${snapshot.name} · ${snapshot.pageName}`,
            force: true,
        });
    }

    return copied;
}

function deletePublishedSnapshot(snapshotId) {
    const snapshot =
        publishedSnapshots.value.find((item) => item.id === snapshotId) ?? null;

    if (!snapshot) {
        return;
    }

    publishedSnapshots.value = publishedSnapshots.value.filter(
        (item) => item.id !== snapshotId,
    );
    persistPublishedSnapshotLibrary(publishedSnapshots.value);
    statusMessage.value = `已删除发布快照：${snapshot.name}`;
}

function deletePublishedSnapshotsByProject(projectRecordId) {
    if (!projectRecordId) {
        return;
    }

    const nextSnapshots = publishedSnapshots.value.filter(
        (item) => item.projectRecordId !== projectRecordId,
    );

    if (nextSnapshots.length === publishedSnapshots.value.length) {
        return;
    }

    publishedSnapshots.value = nextSnapshots;
    persistPublishedSnapshotLibrary(publishedSnapshots.value);
}

function activatePublishedRuntime(snapshotId, options = {}) {
    const resolved = resolvePublishedRuntimeState(
        {
            mode: "runtime",
            pageId: options.pageId ?? "",
            publishId: snapshotId,
        },
        publishedSnapshots.value,
    );

    if (!resolved) {
        statusMessage.value = "发布快照不存在，无法打开运行态";
        return false;
    }

    closeDialog();
    cancelInteractionRuns();
    cancelInteractivePageInitialization();
    clearConditionMatchState();
    previewMode.value = false;
    project.value = resolved.project;
    lastProjectSnapshot = JSON.stringify(project.value);
    runtimePublishedSnapshotId.value = resolved.snapshot.id;
    runtimePageId.value = resolved.pageId;
    resetWidgetRuntimeState();
    clearRuntimeDebugEvents({ silent: true });
    startRuntimeVariableSession({
        sourceLabel: "发布快照会话",
    });
    resetRuntimeFilters();
    clearLinkedWidgetState();
    appMode.value = "runtime";
    syncSourceRefreshTimers();
    statusMessage.value = `已打开发布快照：${resolved.snapshot.name}`;
    pushRuntimeDebugEvent({
        level: "info",
        category: "runtime",
        title: "已进入发布运行态",
        detail: `${resolved.snapshot.name} · ${resolved.snapshot.pageName}`,
        force: true,
    });
    void initializeInteractivePage(resolved.pageId);
    return true;
}

async function copyRuntimeLink() {
    if (isPublishedRuntime.value && currentPublishedSnapshot.value) {
        await copyPublishedSnapshotLink(currentPublishedSnapshot.value.id, {
            pageId: currentPageId.value,
        });
        return;
    }

    const pageId =
        currentPageId.value ||
        project.value.activePageId ||
        project.value.pages[0]?.id ||
        "";
    const url = buildPublishedRuntimeLink("", pageId);
    const runtimeUrl = new URL(url || window.location.href);
    runtimeUrl.searchParams.delete("publishId");

    const copied = await copyTextToClipboard(runtimeUrl.toString(), {
        successMessage: "运行地址已复制到剪贴板",
        failureMessage: "运行地址复制失败，请手动复制浏览器地址",
    });

    if (copied) {
        pushRuntimeDebugEvent({
            level: "info",
            category: "runtime",
            title: "已复制运行地址",
            detail: pageId
                ? `页面 ${currentPage.value?.name ?? pageId}`
                : "当前项目运行入口",
        });
    }
}

function buildRuntimeDebugSnapshot() {
    return {
        exportedAt: new Date().toISOString(),
        summary: runtimeDebugSummary.value,
        filters: runtimeDebugFilters.value,
        variables: runtimeDebugVariables.value,
        variableHistory: runtimeDebugVariableHistory.value,
        performance: runtimeDebugPerformance.value,
        sources: runtimeDebugSources.value,
        events: runtimeDebugEvents.value,
    };
}

async function copyRuntimeDebugSnapshot() {
    const copied = await copyTextToClipboard(buildRuntimeDebugSnapshot(), {
        successMessage: "运行态调试快照已复制到剪贴板",
        failureMessage: "复制运行态调试快照失败，请稍后重试",
        emptyMessage: "当前没有可复制的运行态调试快照",
    });

    if (copied) {
        pushRuntimeDebugEvent({
            level: "info",
            category: "runtime",
            title: "已复制调试快照",
            detail: `${runtimeDebugEvents.value.length} 条事件，${runtimeDebugSources.value.length} 个数据源，${runtimeDebugVariables.value.length} 个变量，${runtimeDebugVariableHistory.value.length} 条变量历史，${runtimeDebugPerformance.value.length} 条耗时记录`,
        });
    }
}

async function resetRuntimeVariablesToPresets() {
    const changedCount = resetRuntimeVariables(project.value, {
        recordHistory: true,
        action: "reset",
        sourceLabel: "调试抽屉",
        pageName: currentPage.value?.name ?? "",
        forceHistory: true,
    });
    await triggerConditionMatchInteractions(getActiveInteractivePageId(), {
        reason: "runtime-variable-reset",
    });
    statusMessage.value = "已按项目预设重置运行时变量";
    pushRuntimeDebugEvent({
        level: "info",
        category: "runtime",
        title: "运行时变量已重置",
        detail: changedCount
            ? `${changedCount} 个变量已恢复为项目预设`
            : "当前变量与项目预设一致",
    });
}

async function clearRuntimeVariablesForSession() {
    const clearedCount = clearRuntimeVariables({
        recordHistory: true,
        sourceLabel: "调试抽屉",
        pageName: currentPage.value?.name ?? "",
    });
    await triggerConditionMatchInteractions(getActiveInteractivePageId(), {
        reason: "runtime-variable-clear",
    });
    statusMessage.value = "已清空当前运行时变量";
    pushRuntimeDebugEvent({
        level: "warning",
        category: "runtime",
        title: "运行时变量已清空",
        detail: clearedCount
            ? `当前会话共移除 ${clearedCount} 个变量值`
            : "当前会话没有可清空的变量",
    });
}

function clearRuntimeVariableHistoryForSession() {
    const removedCount = runtimeVariableHistory.value.length;
    clearRuntimeVariableHistory({ silent: true });
    statusMessage.value = "已清空变量变更历史";
    pushRuntimeDebugEvent({
        level: "info",
        category: "runtime",
        title: "变量变更历史已清空",
        detail: removedCount
            ? `已移除 ${removedCount} 条变量变更记录`
            : "当前没有变量变更记录",
    });
}

function clearRuntimePerformanceHistoryForSession() {
    const removedCount = runtimePerformanceHistory.value.length;
    clearRuntimePerformanceHistory({ silent: true });
    statusMessage.value = "已清空执行耗时记录";
    pushRuntimeDebugEvent({
        level: "info",
        category: "runtime",
        title: "执行耗时记录已清空",
        detail: removedCount
            ? `已移除 ${removedCount} 条耗时记录`
            : "当前没有执行耗时记录",
    });
}

function clearLinkedWidgetState() {
    linkedWidgetIds.value = [];

    if (linkedWidgetTimerId) {
        window.clearTimeout(linkedWidgetTimerId);
        linkedWidgetTimerId = 0;
    }
}

function flashLinkedWidgets(widgetIds) {
    const validIds = widgetIds.filter((id) =>
        currentWidgets.value.some((widget) => widget.id === id),
    );

    if (!validIds.length) {
        return;
    }

    linkedWidgetIds.value = validIds;

    if (linkedWidgetTimerId) {
        window.clearTimeout(linkedWidgetTimerId);
    }

    linkedWidgetTimerId = window.setTimeout(() => {
        linkedWidgetIds.value = [];
        linkedWidgetTimerId = 0;
    }, LINKED_WIDGET_DURATION);
}

function enterRuntimeMode() {
    closeDialog();
    cancelInteractionRuns();
    cancelInteractivePageInitialization();
    clearConditionMatchState();
    previewMode.value = false;
    resetWidgetRuntimeState();
    runtimePublishedSnapshotId.value = "";
    startRuntimeVariableSession({
        sourceLabel: "运行页会话",
    });
    resetRuntimeFilters();
    clearLinkedWidgetState();
    runtimePageId.value =
        currentPageId.value ||
        project.value.activePageId ||
        project.value.pages[0]?.id ||
        "";
    appMode.value = "runtime";
    syncSourceRefreshTimers();
    statusMessage.value = "已进入运行页";
    pushRuntimeDebugEvent({
        level: "info",
        category: "runtime",
        title: "已进入运行页",
        detail: currentPage.value?.name ?? runtimePageId.value,
        force: true,
    });
}

function exitRuntimeMode() {
    if (isPublishedRuntime.value) {
        const nextProject = getRestorableEditorProject();

        runtimePublishedSnapshotId.value = "";
        applyProjectState(nextProject, {
            closeDialog: false,
            statusMessage: "已退出发布运行态",
        });
        return;
    }

    cancelInteractionRuns();
    cancelInteractivePageInitialization();
    clearConditionMatchState();
    resetWidgetRuntimeState();
    clearRuntimeVariableHistory({ silent: true });
    clearRuntimePerformanceHistory({ silent: true });
    resetRuntimeVariables();
    resetRuntimeFilters();
    const pageId = currentPageId.value;

    if (pageId) {
        project.value.activePageId = pageId;
    }

    appMode.value = "editor";
    clearLinkedWidgetState();
    selectDefaultWidget(
        project.value.pages.find((page) => page.id === pageId) ??
            currentPage.value,
    );
    syncSourceRefreshTimers();
    statusMessage.value = "已返回编辑器";
    clearRuntimeDebugEvents({ silent: true });
}

function createSource(type) {
    queueHistoryLabel("新增数据源");
    const source = createDataSource(type);
    project.value.dataSources.unshift(source);
    statusMessage.value = `已新增数据源：${source.name}`;
}

function duplicateSource(sourceId) {
    const sourceIndex = project.value.dataSources.findIndex(
        (item) => item.id === sourceId,
    );

    if (sourceIndex < 0) {
        return;
    }

    const source = project.value.dataSources[sourceIndex];
    const nextSource = createDataSource(source.type, {
        name: `${source.name} 副本`,
        generator: source.generator,
        refreshInterval: source.refreshInterval,
        request: cloneDeep(source.request),
        payload: cloneDeep(source.payload),
    });

    queueHistoryLabel("复制数据源");
    project.value.dataSources.splice(sourceIndex + 1, 0, nextSource);
    statusMessage.value = `已复制数据源：${nextSource.name}`;
}

function applySourceImport() {
    const source = activeDialogSource.value;

    if (!source) {
        closeDialog();
        return;
    }

    try {
        const [normalized] = parseImportedSourceConfigs(dialogText.value);

        queueHistoryLabel("导入数据源配置");
        source.name = normalized.name;
        source.type = normalized.type;
        source.generator = normalized.generator;
        source.refreshInterval = normalized.refreshInterval;
        source.request = cloneDeep(normalized.request);
        source.payload = cloneDeep(normalized.payload);
        clearIncompatibleSourceBindings(source.id, source.type);
        resetSourceRuntime(source);
        closeDialog();
        statusMessage.value = `已导入数据源配置：${source.name}`;
    } catch (error) {
        statusMessage.value = "数据源配置导入失败，请检查 JSON 结构";
        console.warn(error);
    }
}

function legacyCreateSourceFromImport() {
    try {
        const normalizedSources = parseImportedSourceConfigs(dialogText.value, {
            allowMultiple: true,
        });
        const importedSources = normalizedSources.map((normalized) =>
            createDataSource(normalized.type, {
                name: normalized.name,
                generator: normalized.generator,
                refreshInterval: normalized.refreshInterval,
                request: cloneDeep(normalized.request),
                payload: cloneDeep(normalized.payload),
            }),
        );

        queueHistoryLabel(
            importedSources.length > 1 ? "批量导入数据源" : "导入数据源",
        );
        project.value.dataSources = [
            ...importedSources,
            ...project.value.dataSources,
        ];
        importedSources.forEach((source) => {
            resetSourceRuntime(source);
        });
        closeDialog();
        statusMessage.value =
            importedSources.length > 1
                ? `已批量导入 ${importedSources.length} 个数据源`
                : `已导入并新建数据源：${importedSources[0].name}`;
        return;

        const normalized = normalizeDataSource(
            JSON.parse(dialogText.value),
            project.value.dataSources.length,
        );
        const source = createDataSource(normalized.type, {
            name: normalized.name,
            generator: normalized.generator,
            refreshInterval: normalized.refreshInterval,
            request: cloneDeep(normalized.request),
            payload: cloneDeep(normalized.payload),
        });

        queueHistoryLabel("导入数据源");
        project.value.dataSources.unshift(source);
        resetSourceRuntime(source);
        closeDialog();
        statusMessage.value = `已导入并新建数据源：${source.name}`;
    } catch (error) {
        statusMessage.value = "数据源配置导入失败，请检查 JSON 结构";
        console.warn(error);
    }
}

function legacyDeleteSource(sourceId) {
    const source = project.value.dataSources.find(
        (item) => item.id === sourceId,
    );

    if (!source) {
        return;
    }

    queueHistoryLabel("删除数据源");
    project.value.dataSources = project.value.dataSources.filter(
        (item) => item.id !== sourceId,
    );

    project.value.pages.forEach((page) => {
        page.widgets.forEach((widget) => {
            if (widget.dataBinding?.sourceId === sourceId) {
                widget.dataBinding.sourceId = "";
            }
        });
    });
    cleanupInteractionReferences({
        sourceIds: [sourceId],
    });

    const nextRuntime = { ...dataSourceRuntime.value };
    delete nextRuntime[sourceId];
    dataSourceRuntime.value = nextRuntime;
    statusMessage.value = `已删除数据源：${source.name}`;
}

function createSourceFromImport() {
    try {
        const normalizedSources = parseImportedSourceConfigs(dialogText.value, {
            allowMultiple: true,
        });
        const importedSources = normalizedSources.map((normalized) =>
            createDataSource(normalized.type, {
                name: normalized.name,
                generator: normalized.generator,
                refreshInterval: normalized.refreshInterval,
                request: cloneDeep(normalized.request),
                payload: cloneDeep(normalized.payload),
            }),
        );

        queueHistoryLabel(
            importedSources.length > 1 ? "批量导入数据源" : "导入数据源",
        );
        project.value.dataSources = [
            ...importedSources,
            ...project.value.dataSources,
        ];
        importedSources.forEach((source) => {
            resetSourceRuntime(source);
        });
        closeDialog();
        statusMessage.value =
            importedSources.length > 1
                ? `已批量导入 ${importedSources.length} 个数据源`
                : `已导入并新建数据源：${importedSources[0].name}`;
    } catch (error) {
        statusMessage.value = "数据源配置导入失败，请检查 JSON 结构";
        console.warn(error);
    }
}

function removeSources(sourceIds, options = {}) {
    const uniqueSourceIds = Array.from(new Set(sourceIds.filter(Boolean)));

    if (!uniqueSourceIds.length) {
        return [];
    }

    const sourceIdSet = new Set(uniqueSourceIds);
    const removedSources = project.value.dataSources.filter((item) =>
        sourceIdSet.has(item.id),
    );

    if (!removedSources.length) {
        return [];
    }

    queueHistoryLabel(
        options.historyLabel ??
            (removedSources.length > 1 ? "批量删除数据源" : "删除数据源"),
    );
    project.value.dataSources = project.value.dataSources.filter(
        (item) => !sourceIdSet.has(item.id),
    );

    project.value.pages.forEach((page) => {
        page.widgets.forEach((widget) => {
            if (sourceIdSet.has(widget.dataBinding?.sourceId)) {
                widget.dataBinding.sourceId = "";
            }
        });
    });

    cleanupInteractionReferences({
        sourceIds: uniqueSourceIds,
    });

    const nextRuntime = { ...dataSourceRuntime.value };
    uniqueSourceIds.forEach((sourceId) => {
        delete nextRuntime[sourceId];
    });
    dataSourceRuntime.value = nextRuntime;

    statusMessage.value =
        options.successMessage ??
        (removedSources.length > 1
            ? `已批量删除 ${removedSources.length} 个数据源`
            : `已删除数据源：${removedSources[0].name}`);

    return removedSources;
}

function removeUnusedSources() {
    const unusedSources = project.value.dataSources.filter(
        (source) => (sourceBindingCounts.value[source.id] ?? 0) <= 0,
    );

    if (!unusedSources.length) {
        statusMessage.value = "当前没有可清理的未使用数据源";
        return;
    }

    removeSources(
        unusedSources.map((source) => source.id),
        {
            historyLabel: "清理未使用数据源",
            successMessage: `已清理 ${unusedSources.length} 个未使用数据源`,
        },
    );
}

function deleteSource(sourceId) {
    removeSources([sourceId]);
}

function changeSourceType(payload) {
    const source = project.value.dataSources.find(
        (item) => item.id === payload.sourceId,
    );

    if (!source || source.type === payload.type) {
        return;
    }

    const nextSource = createDataSource(payload.type, { name: source.name });

    queueHistoryLabel("切换数据源类型");
    source.type = nextSource.type;
    source.generator = nextSource.generator;
    source.payload = nextSource.payload;

    clearIncompatibleSourceBindings(source.id, source.type);
    resetSourceRuntime(source);

    statusMessage.value = `已切换数据源类型：${source.name}`;
}

function updateSourcePayload(payload) {
    const source = project.value.dataSources.find(
        (item) => item.id === payload.sourceId,
    );

    if (!source) {
        return;
    }

    try {
        const parsed = JSON.parse(payload.value);

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Payload must be an object");
        }

        queueHistoryLabel("更新数据源数据");
        source.payload = {
            ...source.payload,
            ...parsed,
        };
        statusMessage.value = `已更新数据源：${source.name}`;
    } catch (error) {
        statusMessage.value = "数据源 JSON 解析失败，请检查格式";
        console.warn(error);
    }
}

function switchPage(pageId, options = {}) {
    const nextPage = project.value.pages.find((page) => page.id === pageId);

    if (!nextPage) {
        return;
    }

    if (isRuntimeMode.value) {
        if (nextPage.id === runtimePageId.value) {
            return;
        }

        runtimePageId.value = nextPage.id;
        clearLinkedWidgetState();
        statusMessage.value = `已切换页面：${nextPage.name}`;
        pushRuntimeDebugEvent({
            level: "info",
            category: "page",
            title: "运行页切换",
            detail: nextPage.name,
            pageId: nextPage.id,
            pageName: nextPage.name,
        });
        return;
    }

    if (nextPage.id === project.value.activePageId) {
        return;
    }

    project.value.activePageId = nextPage.id;
    clearLinkedWidgetState();

    if (previewMode.value || options.previewNavigation) {
        sanitizeSelection([], null);
    } else {
        selectDefaultWidget(nextPage);
    }

    statusMessage.value = `已切换页面：${nextPage.name}`;

    if (previewMode.value || options.previewNavigation) {
        pushRuntimeDebugEvent({
            level: "info",
            category: "page",
            title: "预览页切换",
            detail: nextPage.name,
            pageId: nextPage.id,
            pageName: nextPage.name,
        });
    }
}

function locateSourceUsage(usage) {
    const pageId = usage?.pageId;
    const widgetId = usage?.widgetId;

    if (!pageId || !widgetId) {
        return;
    }

    const targetPage = project.value.pages.find((page) => page.id === pageId);
    const targetWidget = targetPage?.widgets.find(
        (widget) => widget.id === widgetId,
    );

    if (!targetPage || !targetWidget) {
        statusMessage.value = "引用组件不存在，可能已经被删除";
        return;
    }

    if (isRuntimeMode.value) {
        appMode.value = "editor";
        runtimePageId.value = "";
    }

    if (previewMode.value) {
        previewMode.value = false;
    }

    if (project.value.activePageId !== targetPage.id) {
        project.value.activePageId = targetPage.id;
        clearLinkedWidgetState();
    }

    sanitizeSelection([targetWidget.id], targetWidget.id);
    flashLinkedWidgets([targetWidget.id]);
    statusMessage.value = `已定位到 ${targetPage.name} / ${targetWidget.name}`;
}

function locateInteractionNode(payload = {}) {
    const targetPage = payload.pageId
        ? project.value.pages.find((page) => page.id === payload.pageId)
        : currentPage.value;

    if (!targetPage) {
        statusMessage.value = "目标页面不存在，可能已经被删除";
        return;
    }

    const targetWidget = payload.widgetId
        ? targetPage.widgets.find((widget) => widget.id === payload.widgetId) ??
          null
        : null;

    if (payload.widgetId && !targetWidget) {
        statusMessage.value = "目标组件不存在，可能已经被删除";
        return;
    }

    if (isRuntimeMode.value) {
        appMode.value = "editor";
        runtimePageId.value = "";
    }

    if (previewMode.value) {
        previewMode.value = false;
    }

    if (project.value.activePageId !== targetPage.id) {
        project.value.activePageId = targetPage.id;
        clearLinkedWidgetState();
    }

    if (targetWidget) {
        sanitizeSelection([targetWidget.id], targetWidget.id);
        flashLinkedWidgets([targetWidget.id]);
        statusMessage.value = `已定位到交互节点：${targetPage.name} / ${targetWidget.name}`;
        return;
    }

    sanitizeSelection([], null);
    statusMessage.value = `已定位到交互页面：${targetPage.name}`;
}

function createPage() {
    const nextIndex = project.value.pages.length + 1;
    const page = createProjectPage(`页面 ${nextIndex}`, {
        meta: {
            ...cloneDeep(currentPage.value?.meta ?? defaultPageMeta),
            title: `新建页面 ${nextIndex}`,
        },
    });

    queueHistoryLabel("新建页面");
    const currentIndex = project.value.pages.findIndex(
        (item) => item.id === project.value.activePageId,
    );
    project.value.pages.splice(currentIndex + 1, 0, page);
    project.value.activePageId = page.id;
    selectDefaultWidget(page);
    statusMessage.value = `已新建页面：${page.name}`;
}

function duplicatePage(pageId) {
    const sourcePage = project.value.pages.find((page) => page.id === pageId);

    if (!sourcePage) {
        return;
    }

    queueHistoryLabel("复制页面");
    const nextPage = duplicateProjectPage(sourcePage);
    const index = project.value.pages.findIndex((page) => page.id === pageId);
    project.value.pages.splice(index + 1, 0, nextPage);
    project.value.activePageId = nextPage.id;
    selectDefaultWidget(nextPage);
    statusMessage.value = `已复制页面：${nextPage.name}`;
}

function deletePage(pageId) {
    if (project.value.pages.length <= 1) {
        return;
    }

    const index = project.value.pages.findIndex((page) => page.id === pageId);

    if (index === -1) {
        return;
    }

    queueHistoryLabel("删除页面");
    const [removedPage] = project.value.pages.splice(index, 1);
    cleanupInteractionReferences({
        widgetIds: removedPage.widgets.map((widget) => widget.id),
        pageIds: [removedPage.id],
    });

    if (removedPage.id === project.value.activePageId) {
        const fallbackPage =
            project.value.pages[index] ??
            project.value.pages[index - 1] ??
            project.value.pages[0];
        project.value.activePageId = fallbackPage.id;

        if (previewMode.value) {
            sanitizeSelection([], null);
        } else {
            selectDefaultWidget(fallbackPage);
        }
    }

    statusMessage.value = `已删除页面：${removedPage.name}`;
}

function addWidget(type, position = {}) {
    queueHistoryLabel("添加组件");

    const nextWidget = createWidget(type, {
        x: clamp(
            position.x ?? 180,
            0,
            Math.max(currentCanvas.value.meta.screenWidth - 160, 0),
        ),
        y: clamp(
            position.y ?? 180,
            0,
            Math.max(currentCanvas.value.meta.screenHeight - 120, 0),
        ),
        zIndex: getNextZIndex(currentWidgets.value),
    });

    currentWidgets.value.push(nextWidget);
    sortWidgets(currentWidgets.value);
    sanitizeSelection([nextWidget.id], nextWidget.id);
    statusMessage.value = `已添加组件：${nextWidget.name}`;
}

function addTemplate(templateId, position = {}) {
    const template = templates.value.find((item) => item.id === templateId);

    if (!template) {
        return;
    }

    const width = template.preview?.width ?? 180;
    const height = template.preview?.height ?? 120;
    const nextX = clamp(
        position.x ?? 180,
        0,
        Math.max(currentCanvas.value.meta.screenWidth - width, 0),
    );
    const nextY = clamp(
        position.y ?? 180,
        0,
        Math.max(currentCanvas.value.meta.screenHeight - height, 0),
    );

    queueHistoryLabel(
        template.widgets.length > 1 ? "添加组合模板" : "添加组件模板",
    );
    const createdWidgets = instantiateTemplate(currentCanvas.value, template, {
        x: nextX,
        y: nextY,
    });

    if (!createdWidgets.length) {
        clearQueuedHistoryLabel();
        return;
    }

    currentWidgets.value.push(...createdWidgets);
    sortWidgets(currentWidgets.value);
    sanitizeSelection(
        createdWidgets.map((item) => item.id),
        createdWidgets.at(-1)?.id ?? null,
    );
    statusMessage.value = `已添加模板：${template.name}`;
}

function copySelected() {
    if (!canCopy.value) {
        return;
    }

    const template = createTemplateFromSelection(
        currentCanvas.value,
        selectedIds.value,
        "剪贴板选区",
    );
    const bounds = getSelectionBounds(selectedWidgets.value);

    if (!template || !bounds) {
        return;
    }

    clipboardTemplate.value = {
        ...template,
        origin: {
            x: bounds.x,
            y: bounds.y,
        },
        pasteCount: 0,
    };
    statusMessage.value = `已复制 ${selectedWidgets.value.length} 个组件`;
}

function pasteClipboard() {
    const template = clipboardTemplate.value;

    if (!template?.widgets?.length) {
        return;
    }

    const width = template.preview?.width ?? 0;
    const height = template.preview?.height ?? 0;
    const pasteCount = (template.pasteCount ?? 0) + 1;
    const baseX = template.origin?.x ?? 80;
    const baseY = template.origin?.y ?? 80;
    const offset = 28 * pasteCount;
    const nextX = clamp(
        baseX + offset,
        0,
        Math.max(currentCanvas.value.meta.screenWidth - width, 0),
    );
    const nextY = clamp(
        baseY + offset,
        0,
        Math.max(currentCanvas.value.meta.screenHeight - height, 0),
    );

    queueHistoryLabel(
        template.widgets.length > 1 ? "粘贴组件组合" : "粘贴组件",
    );
    const createdWidgets = instantiateTemplate(currentCanvas.value, template, {
        x: nextX,
        y: nextY,
    });

    if (!createdWidgets.length) {
        clearQueuedHistoryLabel();
        return;
    }

    currentWidgets.value.push(...createdWidgets);
    sortWidgets(currentWidgets.value);
    sanitizeSelection(
        createdWidgets.map((item) => item.id),
        createdWidgets.at(-1)?.id ?? null,
    );
    clipboardTemplate.value = {
        ...template,
        pasteCount,
    };
    statusMessage.value = `已粘贴 ${createdWidgets.length} 个组件到当前页`;
}

function removeTemplate(templateId) {
    const template = templates.value.find((item) => item.id === templateId);

    if (!template) {
        return;
    }

    templates.value = templates.value.filter((item) => item.id !== templateId);
    statusMessage.value = `已删除模板：${template.name}`;
}

function buildDefaultTemplateName() {
    if (selectedWidgets.value.length === 1) {
        return `${selectedWidgets.value[0].name} 模板`;
    }

    return `组合模板 ${selectedWidgets.value.length} 项`;
}

function openTemplateDialog() {
    if (!canSaveTemplate.value) {
        return;
    }

    templateDraftName.value = buildDefaultTemplateName();
    dialogMode.value = "template";
}

function saveSelectionAsTemplate() {
    if (!canSaveTemplate.value) {
        return;
    }

    const template = createTemplateFromSelection(
        currentCanvas.value,
        selectedIds.value,
        templateDraftName.value.trim() || buildDefaultTemplateName(),
    );

    if (!template) {
        return;
    }

    templates.value = [template, ...templates.value].slice(0, TEMPLATE_LIMIT);
    dialogMode.value = null;
    templateDraftName.value = "";
    statusMessage.value = `已保存模板：${template.name}`;
}

function handleLayerSelection(payload) {
    const relatedIds = expandIdsWithGroups(
        [payload.widgetId],
        currentWidgets.value,
    );

    if (payload.additive) {
        toggleSelectionByIds(relatedIds, payload.widgetId);
        return;
    }

    sanitizeSelection(relatedIds, payload.widgetId);
}

function alignSelected(mode) {
    const targets = getEditableSelectedWidgets(2);
    const bounds = getSelectionBounds(targets);

    if (!bounds) {
        return;
    }

    queueHistoryLabel("对齐组件");

    targets.forEach((widget) => {
        switch (mode) {
            case "left":
                widget.x = bounds.x;
                break;
            case "center-x":
                widget.x = bounds.x + (bounds.w - widget.w) / 2;
                break;
            case "right":
                widget.x = bounds.x + bounds.w - widget.w;
                break;
            case "top":
                widget.y = bounds.y;
                break;
            case "center-y":
                widget.y = bounds.y + (bounds.h - widget.h) / 2;
                break;
            case "bottom":
                widget.y = bounds.y + bounds.h - widget.h;
                break;
            default:
                break;
        }
    });

    const actionLabelMap = {
        left: "左对齐",
        "center-x": "水平居中",
        right: "右对齐",
        top: "顶部对齐",
        "center-y": "垂直居中",
        bottom: "底部对齐",
    };

    statusMessage.value = `已${actionLabelMap[mode] ?? "对齐"} ${targets.length} 个组件`;
}

function distributeSelected(axis) {
    const targets = [...getEditableSelectedWidgets(3)];

    if (!targets.length) {
        return;
    }

    const bounds = getSelectionBounds(targets);

    if (!bounds) {
        return;
    }

    const horizontal = axis === "horizontal";
    targets.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));

    const totalSize = targets.reduce(
        (sum, widget) => sum + (horizontal ? widget.w : widget.h),
        0,
    );
    const availableSize = horizontal ? bounds.w : bounds.h;
    const gap = (availableSize - totalSize) / (targets.length - 1);
    let cursor = horizontal ? bounds.x : bounds.y;

    queueHistoryLabel(horizontal ? "横向分布组件" : "纵向分布组件");

    targets.forEach((widget) => {
        if (horizontal) {
            widget.x = cursor;
            cursor += widget.w + gap;
            return;
        }

        widget.y = cursor;
        cursor += widget.h + gap;
    });

    statusMessage.value = horizontal
        ? `已横向分布 ${targets.length} 个组件`
        : `已纵向分布 ${targets.length} 个组件`;
}

function setWidgetHidden(widgetId, hidden) {
    const widget = currentWidgets.value.find((item) => item.id === widgetId);

    if (!widget || widget.hidden === hidden) {
        return;
    }

    queueHistoryLabel(hidden ? "隐藏图层" : "显示图层");
    widget.hidden = hidden;
    statusMessage.value = hidden
        ? `已隐藏图层：${widget.name}`
        : `已显示图层：${widget.name}`;
}

function toggleLayerHidden(widgetId) {
    const widget = currentWidgets.value.find((item) => item.id === widgetId);

    if (!widget) {
        return;
    }

    setWidgetHidden(widgetId, !widget.hidden);
}

function setWidgetLocked(widgetId, locked) {
    const widget = currentWidgets.value.find((item) => item.id === widgetId);

    if (!widget || widget.locked === locked) {
        return;
    }

    queueHistoryLabel(locked ? "锁定图层" : "解锁图层");
    widget.locked = locked;
    statusMessage.value = locked
        ? `已锁定图层：${widget.name}`
        : `已解锁图层：${widget.name}`;
}

function toggleLayerLocked(widgetId) {
    const widget = currentWidgets.value.find((item) => item.id === widgetId);

    if (!widget) {
        return;
    }

    setWidgetLocked(widgetId, !widget.locked);
}

function setSelectedHidden(hidden) {
    const ids = getExpandedSelectedIds();
    const targets = currentWidgets.value.filter(
        (item) => ids.includes(item.id) && item.hidden !== hidden,
    );

    if (!targets.length) {
        return;
    }

    queueHistoryLabel(hidden ? "批量隐藏组件" : "批量显示组件");
    targets.forEach((widget) => {
        widget.hidden = hidden;
    });
    statusMessage.value = hidden
        ? `已隐藏 ${targets.length} 个组件`
        : `已显示 ${targets.length} 个组件`;
}

function setSelectedLocked(locked) {
    const ids = getExpandedSelectedIds();
    const targets = currentWidgets.value.filter(
        (item) => ids.includes(item.id) && item.locked !== locked,
    );

    if (!targets.length) {
        return;
    }

    queueHistoryLabel(locked ? "批量锁定组件" : "批量解锁组件");
    targets.forEach((widget) => {
        widget.locked = locked;
    });
    statusMessage.value = locked
        ? `已锁定 ${targets.length} 个组件`
        : `已解锁 ${targets.length} 个组件`;
}

function reorderLayers(payload) {
    const ordered = [...currentWidgets.value].sort(
        (a, b) => b.zIndex - a.zIndex,
    );
    const draggedIndex = ordered.findIndex(
        (item) => item.id === payload.draggedId,
    );

    if (draggedIndex === -1) {
        return;
    }

    const [dragged] = ordered.splice(draggedIndex, 1);
    let targetIndex = ordered.findIndex((item) => item.id === payload.targetId);

    if (targetIndex === -1) {
        return;
    }

    if (payload.placement === "after") {
        targetIndex += 1;
    }

    ordered.splice(targetIndex, 0, dragged);
    queueHistoryLabel("调整图层顺序");

    const total = ordered.length;
    ordered.forEach((widget, index) => {
        widget.zIndex = total - index;
    });

    sortWidgets(currentWidgets.value);
    statusMessage.value = `已调整图层顺序：${dragged.name}`;
}

function deleteSelected() {
    const expandedIds = getExpandedSelectedIds();

    if (!expandedIds.length) {
        return;
    }

    queueHistoryLabel("删除组件");
    const deleteSet = new Set(expandedIds);
    currentPage.value.widgets = currentPage.value.widgets.filter(
        (item) => !deleteSet.has(item.id),
    );
    cleanupInteractionReferences({
        widgetIds: expandedIds,
    });
    sanitizeSelection([], null);
    statusMessage.value = `已删除 ${expandedIds.length} 个组件`;
}

function duplicateSelected() {
    if (!selectedIds.value.length) {
        return;
    }

    queueHistoryLabel("复制组件");
    const duplicates = duplicateWidgets(currentCanvas.value, selectedIds.value);

    if (!duplicates.length) {
        clearQueuedHistoryLabel();
        return;
    }

    sanitizeSelection(
        duplicates.map((item) => item.id),
        duplicates.at(-1)?.id ?? null,
    );
    statusMessage.value = `已复制 ${duplicates.length} 个组件`;
}

function bringToFront() {
    if (!selectedWidgets.value.length) {
        return;
    }

    queueHistoryLabel("上移图层");
    const orderedSelection = [...selectedWidgets.value].sort(
        (a, b) => a.zIndex - b.zIndex,
    );
    const nextBase = getNextZIndex(currentWidgets.value);

    orderedSelection.forEach((widget, index) => {
        widget.zIndex = nextBase + index;
    });

    sortWidgets(currentWidgets.value);
    statusMessage.value = "已上移所选图层";
}

function sendToBack() {
    if (!selectedWidgets.value.length) {
        return;
    }

    queueHistoryLabel("下移图层");
    const orderedSelection = [...selectedWidgets.value].sort(
        (a, b) => a.zIndex - b.zIndex,
    );
    const minZIndex = Math.min(
        ...currentWidgets.value.map((item) => item.zIndex || 0),
    );
    const start = minZIndex - orderedSelection.length;

    orderedSelection.forEach((widget, index) => {
        widget.zIndex = start + index;
    });

    sortWidgets(currentWidgets.value);
    statusMessage.value = "已下移所选图层";
}

function groupSelected() {
    if (!canGroup.value) {
        return;
    }

    queueHistoryLabel("编组组件");
    const groupId = createWidgetGroup(currentCanvas.value, selectedIds.value);

    if (!groupId) {
        clearQueuedHistoryLabel();
        return;
    }

    statusMessage.value = `已编组 ${selectedIds.value.length} 个组件`;
}

function ungroupSelected() {
    if (!canUngroup.value) {
        return;
    }

    queueHistoryLabel("取消编组");
    const count = removeWidgetGroup(currentCanvas.value, selectedIds.value);

    if (!count) {
        clearQueuedHistoryLabel();
        return;
    }

    statusMessage.value = "已取消组件编组";
}

function applyProjectState(nextProject, options = {}) {
    project.value = normalizeProjectSchema(cloneDeep(nextProject));
    lastProjectSnapshot = JSON.stringify(project.value);
    undoStack.value = [];
    redoStack.value = [];
    pendingHistoryLabel.value = null;
    activeHistoryLabel.value = null;
    currentHistoryLabel.value = "当前项目";
    lastHistoryCommitAt.value = 0;
    lastHistoryCommitLabel.value = "";
    runtimePublishedSnapshotId.value = "";
    appMode.value = "editor";
    previewMode.value = false;
    runtimePageId.value = "";
    clipboardTemplate.value = null;
    cancelInteractionRuns();
    clearConditionMatchState();
    clearRuntimeDebugEvents({ silent: true });
    clearRuntimeVariableHistory({ silent: true });
    clearRuntimePerformanceHistory({ silent: true });
    resetWidgetRuntimeState();
    resetRuntimeVariables();
    clearLinkedWidgetState();
    syncDataSourceRuntime();
    syncSourceRefreshTimers();
    selectDefaultWidget(
        project.value.pages.find(
            (page) => page.id === project.value.activePageId,
        ) ?? currentPage.value,
    );

    if (options.closeDialog !== false) {
        closeDialog();
    }

    if (options.statusMessage) {
        statusMessage.value = options.statusMessage;
    }
}

function syncActiveProjectRecord(snapshot = JSON.stringify(project.value)) {
    if (!activeProjectRecordId.value) {
        return;
    }

    const nextLibrary = projectLibrary.value.map((item) =>
        item.id === activeProjectRecordId.value
            ? {
                  ...item,
                  updatedAt: Date.now(),
                  snapshot,
              }
            : item,
    );

    projectLibrary.value = nextLibrary;
    persistProjectLibraryState(nextLibrary, activeProjectRecordId.value);
}

function openProjectManagerDialog() {
    projectDraftName.value = currentProjectName.value;
    dialogMode.value = "project-library";
}

function openProjectSaveDialog() {
    projectDraftName.value = `${currentProjectName.value} 副本`;
    dialogMode.value = "project-save";
}

function openProjectCreateDialog() {
    projectDraftName.value = `导入项目 ${projectLibrary.value.length + 1}`;
    dialogText.value = "";
    dialogMode.value = "project-create-import";
}

function openProjectRecord(recordId, options = {}) {
    const record = projectLibrary.value.find((item) => item.id === recordId);

    if (!record) {
        return;
    }

    activeProjectRecordId.value = record.id;
    persistProjectLibraryState(projectLibrary.value, record.id);
    applyProjectState(hydrateProjectSourceSecrets(JSON.parse(record.snapshot), record.id), {
        closeDialog: options.closeDialog,
        statusMessage: options.statusMessage ?? `已打开项目：${record.name}`,
    });
}

function saveProjectAsNewRecord() {
    const record = buildProjectRecord(project.value, {
        name: projectDraftName.value,
    });

    projectLibrary.value = [record, ...projectLibrary.value];
    activeProjectRecordId.value = record.id;
    persistProjectLibraryState(projectLibrary.value, record.id);
    closeDialog();
    statusMessage.value = `已另存为项目：${record.name}`;
}

function updateProjectRecordName(recordId, rawName) {
    const record = projectLibrary.value.find((item) => item.id === recordId);

    if (!record) {
        return;
    }

    const nextName =
        rawName.trim() || deriveProjectRecordName(JSON.parse(record.snapshot));

    if (nextName === record.name) {
        return;
    }

    const nextLibrary = projectLibrary.value.map((item) =>
        item.id === recordId
            ? {
                  ...item,
                  name: nextName,
              }
            : item,
    );

    projectLibrary.value = nextLibrary;
    persistProjectLibraryState(nextLibrary, activeProjectRecordId.value);
    statusMessage.value = `已重命名项目：${nextName}`;
}

function duplicateProjectRecord(recordId) {
    const record = projectLibrary.value.find((item) => item.id === recordId);

    if (!record) {
        return;
    }

    const duplicated = buildProjectRecord(JSON.parse(record.snapshot), {
        name: `${record.name} 副本`,
    });

    copyProjectSourceSecrets(record.id, duplicated.id);

    projectLibrary.value = [duplicated, ...projectLibrary.value];
    persistProjectLibraryState(
        projectLibrary.value,
        activeProjectRecordId.value,
    );
    statusMessage.value = `已复制项目：${duplicated.name}`;
}

function createProjectFromImport() {
    try {
        const nextProject = normalizeProjectSchema(
            JSON.parse(dialogText.value),
        );
        const record = buildProjectRecord(nextProject, {
            name:
                projectDraftName.value || deriveProjectRecordName(nextProject),
        });

        projectLibrary.value = [record, ...projectLibrary.value];
        activeProjectRecordId.value = record.id;
        persistProjectLibraryState(projectLibrary.value, record.id);
        applyProjectState(nextProject, {
            statusMessage: `已导入项目：${record.name}`,
        });
    } catch (error) {
        statusMessage.value = "导入失败，请检查项目 JSON 结构";
        console.warn(error);
    }
}

function createBlankProjectRecord() {
    const name = `新建项目 ${projectLibrary.value.length + 1}`;
    const record = buildProjectRecord(createBlankProjectState(), { name });

    projectLibrary.value = [record, ...projectLibrary.value];
    activeProjectRecordId.value = record.id;
    persistProjectLibraryState(projectLibrary.value, record.id);
    applyProjectState(
        hydrateProjectSourceSecrets(JSON.parse(record.snapshot), record.id),
        {
            statusMessage: `已创建项目：${record.name}`,
        },
    );
}

function togglePreviewMode() {
    previewMode.value = !previewMode.value;
}

function openRuntimeWorkspace() {
    enterRuntimeMode();
    void initializeInteractivePage(runtimePageId.value || currentPageId.value);
}

function navigateToPage(pageId, options = {}) {
    const previousRuntimePageId = runtimePageId.value;
    const previousEditorPageId = project.value.activePageId;

    switchPage(pageId, options);

    const activePageId = isRuntimeMode.value
        ? runtimePageId.value
        : project.value.activePageId;
    const changed = isRuntimeMode.value
        ? activePageId !== previousRuntimePageId
        : activePageId !== previousEditorPageId;

    if (
        (isRuntimeMode.value ||
            previewMode.value ||
            options.previewNavigation) &&
        changed
    ) {
        cancelInteractivePageInitialization();
        clearConditionMatchState();
        resetRuntimeFilters();
        void initializeInteractivePage(activePageId, {
            refreshDataSources: false,
        });
    }
}

function deleteProjectRecord(recordId) {
    const record = projectLibrary.value.find((item) => item.id === recordId);

    if (!record) {
        return;
    }

    const deletingActive = activeProjectRecordId.value === recordId;
    const remaining = projectLibrary.value.filter(
        (item) => item.id !== recordId,
    );

    removeProjectSourceSecrets(record.id);
    deletePublishedSnapshotsByProject(record.id);

    if (!remaining.length) {
        const fallbackRecord = buildProjectRecord(createBlankProjectState(), {
            name: "新建项目 1",
        });

        projectLibrary.value = [fallbackRecord];
        activeProjectRecordId.value = fallbackRecord.id;
        persistProjectLibraryState(projectLibrary.value, fallbackRecord.id);
        applyProjectState(
            hydrateProjectSourceSecrets(
                JSON.parse(fallbackRecord.snapshot),
                fallbackRecord.id,
            ),
            {
            closeDialog: false,
            statusMessage: `已删除项目：${record.name}`,
            },
        );
        return;
    }

    projectLibrary.value = remaining;
    const nextActiveId = deletingActive
        ? remaining[0].id
        : activeProjectRecordId.value;
    activeProjectRecordId.value = nextActiveId;
    persistProjectLibraryState(remaining, nextActiveId);

    if (deletingActive) {
        openProjectRecord(nextActiveId, {
            closeDialog: false,
            statusMessage: `已删除项目：${record.name}`,
        });
        return;
    }

    statusMessage.value = `已删除项目：${record.name}`;
}

function resetProject() {
    queueHistoryLabel("恢复示例项目");
    project.value = createDemoProject();
    appMode.value = "editor";
    previewMode.value = false;
    runtimePageId.value = "";
    clipboardTemplate.value = null;
    clearConditionMatchState();
    clearRuntimeDebugEvents({ silent: true });
    clearRuntimeVariableHistory({ silent: true });
    clearRuntimePerformanceHistory({ silent: true });
    resetWidgetRuntimeState();
    resetRuntimeVariables();
    clearLinkedWidgetState();
    selectDefaultWidget(currentPage.value);
    statusMessage.value = "已恢复示例项目";
}

function openExportDialog() {
    dialogSourceId.value = "";
    dialogMode.value = "export";
    dialogText.value = buildProjectExportPayload(project.value);
}

function openImportDialog() {
    dialogSourceId.value = "";
    dialogMode.value = "import";
    dialogText.value = "";
}

function getJsonDialogEyebrow() {
    return getActiveJsonDialogEyebrow();
}

function getJsonDialogTitle() {
    return getActiveJsonDialogTitle();
}

function isJsonDialogReadonly() {
    return isActiveJsonDialogReadonly();
}

function getJsonDialogActionLabel() {
    return getActiveJsonDialogActionLabel();
}

async function copyExport() {
    await copyTextToClipboard(dialogText.value, {
        successMessage: "JSON 已复制到剪贴板",
        failureMessage: "复制失败，请手动复制 JSON",
    });
}

function applyImport() {
    try {
        const nextProject = normalizeProjectSchema(
            JSON.parse(dialogText.value),
        );
        rememberProjectSourceSecrets(activeProjectRecordId.value, nextProject);
        queueHistoryLabel("导入项目");
        project.value = nextProject;
        dialogMode.value = null;
        appMode.value = "editor";
        previewMode.value = false;
        runtimePageId.value = "";
        clipboardTemplate.value = null;
        clearConditionMatchState();
        clearRuntimeDebugEvents({ silent: true });
        clearRuntimeVariableHistory({ silent: true });
        clearRuntimePerformanceHistory({ silent: true });
        resetWidgetRuntimeState();
        resetRuntimeVariables();
        clearLinkedWidgetState();
        selectDefaultWidget(currentPage.value);
        statusMessage.value = "项目 JSON 已导入";
    } catch (error) {
        statusMessage.value = "导入失败，请检查 JSON 结构";
        console.warn(error);
    }
}

function getJsonDialogEyebrowLabel() {
    if (dialogMode.value === "source-export") {
        return "数据源导出";
    }

    if (
        dialogMode.value === "source-import" ||
        dialogMode.value === "source-create-import"
    ) {
        return "数据源导入";
    }

    return dialogMode.value === "export" ? "项目导出" : "项目导入";
}

function getJsonDialogTitleLabel() {
    const sourceName = activeDialogSource.value?.name ?? "当前数据源";

    if (dialogMode.value === "source-export") {
        return `复制 ${sourceName} 的配置 JSON`;
    }

    if (dialogMode.value === "source-import") {
        return `粘贴配置 JSON 并覆盖 ${sourceName}`;
    }

    if (dialogMode.value === "source-create-import") {
        return "粘贴配置 JSON 并新建数据源";
    }

    return dialogMode.value === "export"
        ? "复制当前项目 JSON"
        : "粘贴项目 JSON 并导入";
}

function isJsonDialogReadonlyState() {
    return (
        dialogMode.value === "export" || dialogMode.value === "source-export"
    );
}

function getJsonDialogActionLabelText() {
    if (dialogMode.value === "source-export") {
        return "复制配置 JSON";
    }

    if (dialogMode.value === "source-import") {
        return "确认导入配置";
    }

    if (dialogMode.value === "source-create-import") {
        return "确认新建数据源";
    }

    return dialogMode.value === "export" ? "复制 JSON" : "确认导入";
}

function getJsonDialogHintText() {
    if (dialogMode.value === "source-create-import") {
        return "支持单个配置对象、配置数组，或包含 dataSources 字段的 JSON 结构。";
    }

    if (dialogMode.value === "source-import") {
        return "覆盖当前数据源时仅支持单个配置对象。";
    }

    return "";
}

async function handleJsonDialogAction() {
    if (dialogMode.value === "source-export") {
        const exportLabel = `${activeDialogSource.value?.name ?? "数据源"} 配置 JSON`;

        await copyTextToClipboard(dialogText.value, {
            successMessage: `${exportLabel} 已复制到剪贴板`,
            failureMessage: `复制失败，请手动复制${exportLabel}`,
        });
        return;
    }

    if (dialogMode.value === "source-import") {
        applySourceImport();
        return;
    }

    if (dialogMode.value === "source-create-import") {
        createSourceFromImport();
        return;
    }

    if (dialogMode.value === "export") {
        await copyExport();
        return;
    }

    applyImport();
}

function getActiveJsonDialogEyebrow() {
    if (dialogMode.value === "source-export") {
        return "数据源导出";
    }

    if (dialogMode.value === "source-import") {
        return "数据源导入";
    }

    return dialogMode.value === "export" ? "项目导出" : "项目导入";
}

function getActiveJsonDialogTitle() {
    const sourceName = activeDialogSource.value?.name ?? "当前数据源";

    if (dialogMode.value === "source-export") {
        return `复制 ${sourceName} 的配置 JSON`;
    }

    if (dialogMode.value === "source-import") {
        return `粘贴配置 JSON 并覆盖 ${sourceName}`;
    }

    return dialogMode.value === "export"
        ? "复制当前项目 JSON"
        : "粘贴项目 JSON 并导入";
}

function isActiveJsonDialogReadonly() {
    return (
        dialogMode.value === "export" || dialogMode.value === "source-export"
    );
}

function getActiveJsonDialogActionLabel() {
    if (dialogMode.value === "source-export") {
        return "复制配置 JSON";
    }

    if (dialogMode.value === "source-import") {
        return "确认导入配置";
    }

    return dialogMode.value === "export" ? "复制 JSON" : "确认导入";
}

async function handleActiveJsonDialogAction() {
    if (dialogMode.value === "source-export") {
        const exportLabel = `${activeDialogSource.value?.name ?? "数据源"} 配置 JSON`;

        await copyTextToClipboard(dialogText.value, {
            successMessage: `${exportLabel} 已复制到剪贴板`,
            failureMessage: `复制失败，请手动复制${exportLabel}`,
        });
        return;
    }

    if (dialogMode.value === "source-import") {
        applySourceImport();
        return;
    }

    if (dialogMode.value === "export") {
        await copyExport();
        return;
    }

    applyImport();
}

function closeDialog() {
    dialogMode.value = null;
    dialogText.value = "";
    templateDraftName.value = "";
    projectDraftName.value = "";
    publishedSnapshotDraftName.value = "";
    dialogSourceId.value = "";
}

function createProjectSnapshot() {
    return lastProjectSnapshot;
}

function pushUndoEntry(entry) {
    undoStack.value.push(entry);

    if (undoStack.value.length > HISTORY_LIMIT) {
        undoStack.value.shift();
    }
}

async function restoreHistoryEntry(entry) {
    isRestoringHistory.value = true;
    project.value = normalizeProjectSchema(JSON.parse(entry.snapshot));
    cancelInteractionRuns();
    cancelInteractivePageInitialization();
    clearConditionMatchState();
    resetWidgetRuntimeState();
    if (previewMode.value || isRuntimeMode.value) {
        startRuntimeVariableSession({
            sourceLabel: "历史快照",
        });
    } else {
        clearRuntimeVariableHistory({ silent: true });
        clearRuntimePerformanceHistory({ silent: true });
        resetRuntimeVariables();
    }
    resetRuntimeFilters();
    clearLinkedWidgetState();
    await nextTick();
    flushProjectSync();
    syncSourceRefreshTimers();

    if (previewMode.value) {
        sanitizeSelection([], null);
    } else {
        sanitizeSelection(selectedIds.value, primarySelectedId.value);

        if (!selectedIds.value.length) {
            selectDefaultWidget(currentPage.value);
        }
    }

    currentHistoryLabel.value = entry.label;
    pendingHistoryLabel.value = null;
    activeHistoryLabel.value = null;
    lastHistoryCommitAt.value = 0;
    lastHistoryCommitLabel.value = "";
    isRestoringHistory.value = false;

    if (previewMode.value || isRuntimeMode.value) {
        await initializeInteractivePage(
            isRuntimeMode.value
                ? runtimePageId.value || currentPageId.value
                : currentPageId.value,
            {
                refreshDataSources: false,
            },
        );
    }
}

async function undoProject() {
    flushProjectSync();
    const entry = undoStack.value.pop();

    if (!entry) {
        return;
    }

    redoStack.value.push(
        createHistoryEntry(createProjectSnapshot(), currentHistoryLabel.value),
    );
    await restoreHistoryEntry(entry);
    statusMessage.value = "已撤销上一步操作";
}

async function redoProject() {
    flushProjectSync();
    const entry = redoStack.value.pop();

    if (!entry) {
        return;
    }

    pushUndoEntry(
        createHistoryEntry(createProjectSnapshot(), currentHistoryLabel.value),
    );
    await restoreHistoryEntry(entry);
    statusMessage.value = "已重做上一步操作";
}

function moveSelectionBy(deltaX, deltaY) {
    const movableWidgets = selectedWidgets.value.filter(
        (item) => !item.locked && !item.hidden,
    );
    const movableBounds = getSelectionBounds(movableWidgets);

    if (!movableWidgets.length || !movableBounds) {
        return;
    }

    queueHistoryLabel("移动组件");
    const minDeltaX = -movableBounds.x;
    const maxDeltaX =
        currentCanvas.value.meta.screenWidth -
        (movableBounds.x + movableBounds.w);
    const minDeltaY = -movableBounds.y;
    const maxDeltaY =
        currentCanvas.value.meta.screenHeight -
        (movableBounds.y + movableBounds.h);
    const nextDeltaX = clamp(deltaX, minDeltaX, maxDeltaX);
    const nextDeltaY = clamp(deltaY, minDeltaY, maxDeltaY);

    movableWidgets.forEach((widget) => {
        widget.x += nextDeltaX;
        widget.y += nextDeltaY;
    });
}

async function executeInteractionAction(widget, action, options = {}) {
    const runContext = options.runContext ?? null;

    switch (action.action) {
        case "highlight-widgets": {
            const targetIds = action.targetWidgetIds ?? [];
            flashLinkedWidgets(targetIds);

            if (targetIds.length) {
                statusMessage.value = `已联动高亮 ${targetIds.length} 个组件`;
                pushRuntimeDebugEvent({
                    level: "success",
                    category: "interaction",
                    title: "联动高亮完成",
                    detail: `${widget.name} · ${targetIds.length} 个目标组件`,
                });
            }

            return targetIds.length > 0;
        }
        case "refresh-sources": {
            const fallbackSourceId = widget.dataBinding?.sourceId;
            const targetSourceIds = action.targetSourceIds?.length
                ? action.targetSourceIds
                : fallbackSourceId
                  ? [fallbackSourceId]
                  : [];
            let refreshCount = 0;

            for (const sourceId of targetSourceIds) {
                const refreshed = await refreshDataSource(sourceId, {
                    silent: true,
                    runContext,
                });

                if (refreshed) {
                    refreshCount += 1;
                }

                if (runContext?.blocked) {
                    return false;
                }
            }

            if (refreshCount > 0) {
                statusMessage.value = `已联动刷新 ${refreshCount} 个数据源`;
                pushRuntimeDebugEvent({
                    level: "success",
                    category: "interaction",
                    title: "联动刷新完成",
                    detail: `${widget.name} · ${refreshCount} 个数据源`,
                });
            }

            return refreshCount > 0;
        }
        case "switch-page":
            if (action.targetPageId) {
                navigateToPage(action.targetPageId, {
                    previewNavigation: true,
                });
                pushRuntimeDebugEvent({
                    level: "info",
                    category: "interaction",
                    title: "联动触发切页",
                    detail: `${widget.name} · ${project.value.pages.find((page) => page.id === action.targetPageId)?.name ?? action.targetPageId}`,
                    pageId: action.targetPageId,
                    pageName:
                        project.value.pages.find(
                            (page) => page.id === action.targetPageId,
                        )?.name ?? "",
                });
                return true;
            }
            return false;
        case "show-widgets": {
            const visibleCount = setRuntimeWidgetHidden(
                action.targetWidgetIds ?? [],
                false,
            );

            if (visibleCount > 0) {
                statusMessage.value = `已显示 ${visibleCount} 个组件`;
                pushRuntimeDebugEvent({
                    level: "success",
                    category: "interaction",
                    title: "联动显示组件",
                    detail: `${widget.name} · ${visibleCount} 个目标组件`,
                });
            }

            return visibleCount > 0;
        }
        case "hide-widgets": {
            const hiddenCount = setRuntimeWidgetHidden(
                action.targetWidgetIds ?? [],
                true,
            );

            if (hiddenCount > 0) {
                statusMessage.value = `已隐藏 ${hiddenCount} 个组件`;
                pushRuntimeDebugEvent({
                    level: "warning",
                    category: "interaction",
                    title: "联动隐藏组件",
                    detail: `${widget.name} · ${hiddenCount} 个目标组件`,
                });
            }

            return hiddenCount > 0;
        }
        case "toggle-widgets-visibility": {
            const toggledCount = toggleRuntimeWidgetHidden(
                action.targetWidgetIds ?? [],
            );

            if (toggledCount > 0) {
                statusMessage.value = `已切换 ${toggledCount} 个组件的显隐状态`;
                pushRuntimeDebugEvent({
                    level: "info",
                    category: "interaction",
                    title: "联动切换显隐",
                    detail: `${widget.name} · ${toggledCount} 个目标组件`,
                });
            }

            return toggledCount > 0;
        }
        case "patch-widget-props": {
            const targetIds = Array.from(
                new Set((action.targetWidgetIds ?? []).filter(Boolean)),
            );

            if (!targetIds.length) {
                return false;
            }

            const patchResult = parseInteractionPropsPatch(
                action.targetPropsPatch,
                getInteractionTemplateScope(widget),
            );

            if (!patchResult.ok) {
                statusMessage.value = patchResult.error;
                pushRuntimeDebugEvent({
                    level: "error",
                    category: "interaction",
                    title: "组件属性更新失败",
                    detail: `${widget.name} · ${patchResult.error}`,
                });
                return false;
            }

            targetIds.forEach((widgetId) => {
                setRuntimeWidgetPropsPatch(widgetId, patchResult.value);
            });

            if (shouldSyncRuntimeFilterState(targetIds)) {
                syncRuntimeFiltersToWidgets();
            }

            await triggerConditionMatchInteractions(
                getActiveInteractivePageId(),
                {
                    reason: "widget-props-patch",
                    runContext,
                },
            );

            if (runContext?.blocked) {
                return false;
            }

            statusMessage.value = `已更新 ${targetIds.length} 个组件属性`;
            pushRuntimeDebugEvent({
                level: "success",
                category: "interaction",
                title: "联动更新组件属性",
                detail: `${widget.name} · ${targetIds.length} 个目标组件 · ${formatRuntimeDebugValue(patchResult.value, 88)}`,
            });
            return true;
        }
        case "set-runtime-variable": {
            const variableKey = String(action.targetVariableKey ?? "").trim();

            if (!variableKey) {
                return false;
            }

            const resolvedValue = resolveRuntimeTemplateString(
                action.targetVariableValue,
                getInteractionTemplateScope(widget),
            );
            const nextValue =
                typeof resolvedValue === "string"
                    ? normalizeConditionOperand(resolvedValue)
                    : resolvedValue;
            const variableResult = setRuntimeVariable(variableKey, nextValue, {
                recordHistory: true,
                sourceLabel: widget.name || "交互动作",
                widgetName: widget.name,
                pageName: currentPage.value?.name ?? "",
            });

            if (!variableResult.updated || !variableResult.changed) {
                return false;
            }

            await triggerConditionMatchInteractions(
                getActiveInteractivePageId(),
                {
                    reason: "runtime-variable-set",
                    runContext,
                },
            );

            if (runContext?.blocked) {
                return false;
            }

            statusMessage.value = `已设置运行时变量 ${variableKey}`;
            pushRuntimeDebugEvent({
                level: "success",
                category: "interaction",
                title: "运行时变量已更新",
                detail: `${widget.name} · ${variableKey} = ${formatRuntimeDebugValue(nextValue, 88)}`,
            });
            return true;
        }
        default:
            return false;
    }
}

async function runWidgetActions(widget, options = {}) {
    const actions = Array.isArray(options.actions)
        ? options.actions.filter((action) => action.action !== "none")
        : getInteractionActions(widget.interaction).filter(
              (action) => action.action !== "none",
          );

    if (!actions.length) {
        return {
            actionCount: 0,
            executedCount: 0,
            skippedCount: 0,
            successCount: 0,
            cancelled: false,
            duration: 0,
        };
    }

    const token = options.token ?? interactionRunToken;
    const runContext =
        options.runContext ??
        createInteractionRunContext({
            sourceLabel:
                options.sourceLabel ??
                getInteractionTriggerLabel(widget.interaction?.trigger || "click"),
        });
    const actionRunStartedAt = Date.now();
    const performancePageId = options.pageId ?? currentPageId.value;
    const performancePageName = options.pageName ?? currentPage.value?.name ?? "";
    let executedCount = 0;
    let skippedCount = 0;
    let successCount = 0;

    for (const action of actions) {
        const canContinue = await waitForInteractionDelay(
            action.delay ?? 0,
            token,
        );

        if (!canContinue) {
            const cancelledResult = {
                actionCount: actions.length,
                executedCount,
                skippedCount,
                successCount,
                cancelled: true,
                duration: Date.now() - actionRunStartedAt,
            };

            if (
                options.recordPerformance !== false &&
                (executedCount > 0 || skippedCount > 0 || options.forcePerformance)
            ) {
                pushRuntimePerformanceEntry({
                    type: "interaction-chain",
                    duration: cancelledResult.duration,
                    sourceLabel:
                        options.sourceLabel ??
                        getInteractionTriggerLabel(
                            widget.interaction?.trigger || "click",
                        ),
                    detail: "执行过程中被中断",
                    pageId: performancePageId,
                    pageName: performancePageName,
                    widgetId: widget.id,
                    widgetName: widget.name,
                    actionCount: actions.length,
                    executedCount,
                    skippedCount,
                    successCount,
                    cancelled: true,
                });
            }

            return cancelledResult;
        }

        if (!options.skipConditionEvaluation) {
            const conditionResult = evaluateInteractionActionCondition(
                widget,
                action,
            );

            if (!conditionResult.matched) {
                skippedCount += 1;
                continue;
            }
        }

        const stepGuard = enterInteractionRunStep(
            runContext,
            widget,
            action,
            performancePageId,
        );

        if (!stepGuard.ok) {
            skippedCount += 1;
            break;
        }

        executedCount += 1;
        let actionSucceeded = false;

        try {
            actionSucceeded = await executeInteractionAction(widget, action, {
                runContext,
            });
        } finally {
            stepGuard.release();
        }

        if (actionSucceeded) {
            successCount += 1;
        }

        if (runContext.blocked) {
            break;
        }
    }

    const completedResult = {
        actionCount: actions.length,
        executedCount,
        skippedCount,
        successCount,
        cancelled: false,
        duration: Date.now() - actionRunStartedAt,
        blocked: runContext.blocked,
        blockedReason: runContext.blockedReason,
    };

    if (
        options.recordPerformance !== false &&
        (executedCount > 0 || skippedCount > 0 || options.forcePerformance)
    ) {
        pushRuntimePerformanceEntry({
            type: "interaction-chain",
            duration: completedResult.duration,
            sourceLabel:
                options.sourceLabel ??
                getInteractionTriggerLabel(widget.interaction?.trigger || "click"),
            detail: runContext.blocked
                ? `执行已中止 · ${successCount} 个动作生效 / ${skippedCount} 个条件跳过`
                : `${successCount} 个动作生效 / ${skippedCount} 个条件跳过`,
            pageId: performancePageId,
            pageName: performancePageName,
            widgetId: widget.id,
            widgetName: widget.name,
            actionCount: actions.length,
            executedCount,
            skippedCount,
            successCount,
            failureCount: Math.max(executedCount - successCount, 0),
            blocked: runContext.blocked,
        });
    }

    return completedResult;
}

async function triggerPageEnterInteractions(pageId = currentPageId.value) {
    const page = project.value.pages.find((item) => item.id === pageId);

    if (!page) {
        return;
    }

    const widgets = page.widgets.filter(
        (widget) =>
            (widget.interaction?.trigger || "click") === "page-enter" &&
            getInteractionActions(widget.interaction).some(
                (action) => action.action !== "none",
            ),
    );

    if (!widgets.length) {
        return;
    }

    cancelInteractionRuns();
    const token = interactionRunToken;

    for (const widget of widgets) {
        await runWidgetActions(widget, {
            token,
            sourceLabel: "页面进入",
            runContext: createInteractionRunContext({
                sourceLabel: "页面进入",
            }),
        });
    }
}

async function triggerConditionMatchInteractions(
    pageId = currentPageId.value,
    options = {},
) {
    if (!previewMode.value && !isRuntimeMode.value) {
        return;
    }

    const page = project.value.pages.find((item) => item.id === pageId);

    if (!page) {
        return;
    }

    const widgets = page.widgets.filter((widget) => {
        if ((widget.interaction?.trigger || "click") !== "condition-match") {
            return false;
        }

        if (!options.sourceId) {
            return true;
        }

        return widget.dataBinding?.sourceId === options.sourceId;
    });

    if (!widgets.length) {
        return;
    }

    const token = options.token ?? interactionRunToken;
    const runContext =
        options.runContext ??
        createInteractionRunContext({
            sourceLabel: options.sourceLabel ?? "条件联动",
        });

    for (const widget of widgets) {
        if (runContext.blocked) {
            return;
        }

        const matchedActions = [];

        getInteractionActions(widget.interaction)
            .filter((action) => action.action !== "none")
            .forEach((action) => {
                const stateKey = getConditionMatchStateKey(
                    page.id,
                    widget.id,
                    action.id,
                );

                if (!hasConfiguredInteractionCondition(action)) {
                    conditionMatchState.set(stateKey, false);
                    return;
                }

                const conditionResult = evaluateInteractionActionCondition(
                    widget,
                    action,
                );
                const wasMatched = conditionMatchState.get(stateKey) === true;

                conditionMatchState.set(stateKey, conditionResult.matched);

                if (conditionResult.matched && !wasMatched) {
                    matchedActions.push(action);
                }
            });

        if (!matchedActions.length) {
            continue;
        }

        pushRuntimeDebugEvent({
            level: "success",
            category: "condition",
            title: "条件命中，已触发动作",
            detail: `${widget.name} · ${matchedActions
                .map((action) =>
                    [
                        getInteractionActionLabel(action.action),
                        formatInteractionConditionSummary(action),
                    ]
                        .filter(Boolean)
                        .join(" / "),
                )
                .join("、")}`,
            pageId: page.id,
            pageName: page.name,
        });

        await runWidgetActions(widget, {
            token,
            actions: matchedActions,
            skipConditionEvaluation: true,
            sourceLabel: "条件命中",
            runContext,
        });
    }
}

async function handleWidgetAction(widgetId) {
    if (!previewMode.value && !isRuntimeMode.value) {
        return;
    }

    const widget = currentWidgets.value.find((item) => item.id === widgetId);

    if (!widget) {
        return;
    }

    cancelInteractionRuns();
    pushRuntimeDebugEvent({
        level: "info",
        category: "interaction",
        title: "触发组件动作",
        detail: widget.name,
    });
    const runContext = createInteractionRunContext({
        sourceLabel: "组件点击",
    });
    await runWidgetActions(widget, {
        token: interactionRunToken,
        sourceLabel: "组件点击",
        runContext,
    });
}

function handleWidgetCommand(payload = {}) {
    if (!previewMode.value && !isRuntimeMode.value) {
        return;
    }

    const widget = findWidgetAcrossPages(payload.widgetId);
    const runtimeWidget = buildRuntimeWidgetView(widget);

    if (!runtimeWidget) {
        return;
    }

    if (
        payload.command === "apply-filter" &&
        runtimeWidget.type === "filterBar"
    ) {
        const nextValue = String(payload.value ?? "").trim();
        const nextLabel = String(payload.label ?? "").trim();

        applyRuntimeFilterWidget(runtimeWidget, nextValue, nextLabel);
        statusMessage.value = nextValue
            ? `Filter applied: ${runtimeWidget.props?.title || runtimeWidget.name} / ${nextLabel || nextValue}`
            : `Filter cleared: ${runtimeWidget.props?.title || runtimeWidget.name}`;
        pushRuntimeDebugEvent({
            level: nextValue ? "success" : "info",
            category: "filter",
            title: nextValue ? "筛选条件已应用" : "筛选条件已清空",
            detail: `${runtimeWidget.props?.title || runtimeWidget.name} · ${nextLabel || nextValue || "全部"}`,
        });
        return;
    }

    if (
        payload.command === "select-region" &&
        runtimeWidget.type === "chinaRegionMap"
    ) {
        const nextValue = String(payload.value ?? "").trim();
        const nextLabel = String(payload.label ?? nextValue).trim();

        applyRuntimeFilterWidget(runtimeWidget, nextValue, nextLabel);
        statusMessage.value = nextValue
            ? `Map focus: ${runtimeWidget.props?.title || runtimeWidget.name} / ${nextValue}`
            : `Map focus cleared: ${runtimeWidget.props?.title || runtimeWidget.name}`;
        pushRuntimeDebugEvent({
            level: nextValue ? "success" : "info",
            category: "filter",
            title: nextValue ? "地图区域已选中" : "地图区域已清空",
            detail: `${runtimeWidget.props?.title || runtimeWidget.name} · ${nextLabel || nextValue || "全部"}`,
        });
        return;
    }

    if (
        payload.command === "select-category" &&
        ["barChart", "lineChart", "pieChart", "heatmapChart"].includes(
            runtimeWidget.type,
        )
    ) {
        const nextValue = String(payload.value ?? "").trim();
        const nextLabel = String(payload.label ?? nextValue).trim();

        applyRuntimeFilterWidget(runtimeWidget, nextValue, nextLabel);
        statusMessage.value = nextValue
            ? `Chart filter: ${runtimeWidget.props?.title || runtimeWidget.name} / ${nextLabel || nextValue}`
            : `Chart filter cleared: ${runtimeWidget.props?.title || runtimeWidget.name}`;
        pushRuntimeDebugEvent({
            level: nextValue ? "success" : "info",
            category: "filter",
            title: nextValue ? "图表筛选已选中" : "图表筛选已清空",
            detail: `${runtimeWidget.props?.title || runtimeWidget.name} · ${nextLabel || nextValue || "全部"}`,
        });
    }
}

function handleKeydown(event) {
    if (dialogMode.value) {
        if (event.key === "Escape") {
            closeDialog();
        }
        return;
    }

    const target = event.target;

    if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    ) {
        return;
    }

    if (isRuntimeMode.value) {
        if (event.key === "Escape") {
            exitRuntimeMode();
        }
        return;
    }

    if (previewMode.value) {
        if (event.key === "Escape") {
            previewMode.value = false;
        }
        return;
    }

    if (event.key === "Escape") {
        sanitizeSelection([], null);
        return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
        return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelected();
        return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteClipboard();
        return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAllWidgets();
        return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();

        if (event.shiftKey) {
            void redoProject();
        } else {
            void undoProject();
        }
        return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        void redoProject();
        return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();

        if (event.shiftKey) {
            ungroupSelected();
        } else {
            groupSelected();
        }
        return;
    }

    if (!selectedWidgets.value.length) {
        return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
        return;
    }

    const step = event.shiftKey ? 10 : 1;

    if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveSelectionBy(-step, 0);
    }

    if (event.key === "ArrowRight") {
        event.preventDefault();
        moveSelectionBy(step, 0);
    }

    if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelectionBy(0, -step);
    }

    if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelectionBy(0, step);
    }
}

watch(currentPageId, (pageId) => {
    if (isRuntimeMode.value && pageId && runtimePageId.value !== pageId) {
        runtimePageId.value = pageId;
    }
});

watch([appMode, currentPageId], () => {
    syncRoute();
});

watch(
    project,
    () => {
        scheduleProjectSync(activeHistoryLabel.value ? 32 : PROJECT_SYNC_DELAY);
    },
    { deep: true },
);

watch(
    () => project.value.dataSources,
    () => {
        syncDataSourceRuntime();
        syncSourceRefreshTimers();
    },
    { deep: true, immediate: true },
);

watch(
    templates,
    (nextTemplates) => {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(
                TEMPLATE_STORAGE_KEY,
                JSON.stringify(nextTemplates),
            );
        }
    },
    { deep: true, immediate: true },
);

watch(previewMode, (enabled) => {
    if (isRuntimeMode.value) {
        return;
    }

    cancelInteractionRuns();
    cancelInteractivePageInitialization();
    clearConditionMatchState();
    resetWidgetRuntimeState();
    if (enabled) {
        startRuntimeVariableSession({
            sourceLabel: "预览会话",
        });
    } else {
        clearRuntimeVariableHistory({ silent: true });
        clearRuntimePerformanceHistory({ silent: true });
        resetRuntimeVariables();
    }
    resetRuntimeFilters();
    clearLinkedWidgetState();
    syncSourceRefreshTimers();

    if (enabled) {
        sanitizeSelection([], null);
        void initializeInteractivePage(currentPageId.value);
        statusMessage.value = "已进入预览模式";
    } else {
        selectDefaultWidget(currentPage.value);
        statusMessage.value = "已退出预览模式";
    }
});

onMounted(() => {
    if (
        initialRoute.mode === "runtime" &&
        initialRoute.publishId &&
        !shouldUsePublishedRuntime
    ) {
        statusMessage.value = "发布快照不存在，已返回编辑器";
        syncRoute();
    }

    if (isRuntimeMode.value) {
        runtimePageId.value = currentPageId.value;
        clearConditionMatchState();
        resetWidgetRuntimeState();
        startRuntimeVariableSession({
            sourceLabel: "运行页会话",
        });
        resetRuntimeFilters();
        syncSourceRefreshTimers();
        void initializeInteractivePage(runtimePageId.value);
    }

    window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
    cancelInteractionRuns();
    cancelInteractivePageInitialization();
    clearConditionMatchState();
    flushProjectSync();
    window.removeEventListener("keydown", handleKeydown);
    clearSourceRefreshTimers();
    clearLinkedWidgetState();
});
</script>

<template>
    <div class="app-shell" :class="{ 'app-shell--preview': previewMode }">
        <TopToolbar
            v-if="!isRuntimeMode"
            :preview-mode="previewMode"
            :pages="project.pages"
            :project-name="currentProjectName"
            :active-page-id="project.activePageId"
            :can-operate="canOperate"
            :selection-count="selectedIds.length"
            :can-group="canGroup"
            :can-ungroup="canUngroup"
            :can-undo="canUndo"
            :can-redo="canRedo"
            :can-copy="canCopy"
            :can-paste="canPaste"
            :can-save-template="canSaveTemplate"
            :has-data-sources="hasDataSources"
            :runtime-mode="isRuntimeMode"
            @toggle-preview="togglePreviewMode"
            @open-runtime="openRuntimeWorkspace"
            @copy-runtime-link="copyRuntimeLink"
            @open-publish-manager="openPublishManagerDialog"
            @open-project-manager="openProjectManagerDialog"
            @save-project-copy="openProjectSaveDialog"
            @select-page="navigateToPage"
            @reset-project="resetProject"
            @export-project="openExportDialog"
            @import-project="openImportDialog"
            @duplicate-selected="duplicateSelected"
            @copy-selected="copySelected"
            @paste-selected="pasteClipboard"
            @delete-selected="deleteSelected"
            @bring-to-front="bringToFront"
            @send-to-back="sendToBack"
            @group-selected="groupSelected"
            @ungroup-selected="ungroupSelected"
            @save-selection-template="openTemplateDialog"
            @refresh-data-sources="refreshAllDataSources"
            @undo="undoProject"
            @redo="redoProject"
        />

        <RuntimeShell
            v-if="isRuntimeMode"
            :project="currentCanvas"
            :page="currentPage"
            :pages="project.pages"
            :active-page-id="currentPageId"
            :linked-widget-ids="linkedWidgetIds"
            :data-source-runtime="dataSourceRuntime"
            :runtime-variables="runtimeVariables"
            :runtime-filters="runtimeFilters"
            :debug-summary="runtimeDebugSummary"
            :debug-filters="runtimeDebugFilters"
            :debug-variables="runtimeDebugVariables"
            :debug-variable-history="runtimeDebugVariableHistory"
            :debug-performance="runtimeDebugPerformance"
            :debug-sources="runtimeDebugSources"
            :debug-events="runtimeDebugEvents"
            @select-page="navigateToPage"
            @exit-runtime="exitRuntimeMode"
            @copy-runtime-link="copyRuntimeLink"
            @copy-debug-snapshot="copyRuntimeDebugSnapshot"
            @clear-debug-events="clearRuntimeDebugEvents"
            @reset-runtime-variables="resetRuntimeVariablesToPresets"
            @clear-runtime-variables="clearRuntimeVariablesForSession"
            @clear-runtime-variable-history="clearRuntimeVariableHistoryForSession"
            @clear-runtime-performance-history="clearRuntimePerformanceHistoryForSession"
            @trigger-widget-action="handleWidgetAction"
            @widget-command="handleWidgetCommand"
        />

        <section v-else class="workspace">
            <MaterialPanel
                v-if="!previewMode"
                :pages="project.pages"
                :active-page-id="project.activePageId"
                :can-delete-page="canDeletePage"
                :materials="materials"
                :templates="templates"
                @select-page="navigateToPage"
                @create-page="createPage"
                @duplicate-page="duplicatePage"
                @delete-page="deletePage"
                @add-widget="addWidget"
                @add-template="addTemplate"
                @remove-template="removeTemplate"
            />

            <StageCanvas
                :project="currentCanvas"
                :selected-ids="selectedIds"
                :primary-selected-id="primarySelectedId"
                :preview-mode="previewMode"
                :linked-widget-ids="linkedWidgetIds"
                :data-source-runtime="dataSourceRuntime"
                :runtime-variables="runtimeVariables"
                :runtime-filters="runtimeFilters"
                @selection-change="updateSelection"
                @add-widget="addWidget"
                @add-template="addTemplate"
                @history-session-start="startHistorySession"
                @history-session-end="endHistorySession"
                @trigger-widget-action="handleWidgetAction"
                @widget-command="handleWidgetCommand"
            />

            <InspectorPanel
                v-if="!previewMode"
                :page="currentPage"
                :project="currentCanvas"
                :pages="project.pages"
                :current-page-id="project.activePageId"
                :selected-widget="selectedWidget"
                :selected-widgets="selectedWidgets"
                :selected-bounds="selectedBounds"
                :selected-ids="selectedIds"
                :primary-selected-id="primarySelectedId"
                :current-history-label="currentHistoryLabel"
                :undo-entries="undoStack"
                :redo-entries="redoStack"
                :can-undo="canUndo"
                :can-redo="canRedo"
                :data-source-runtime="dataSourceRuntime"
                :source-usage-map="sourceUsageMap"
                :source-binding-counts="sourceBindingCounts"
                @select-layer="handleLayerSelection"
                @toggle-layer-hidden="toggleLayerHidden"
                @toggle-layer-locked="toggleLayerLocked"
                @reorder-layer="reorderLayers"
                @set-selected-hidden="setSelectedHidden"
                @set-selected-locked="setSelectedLocked"
                @align-selected="alignSelected"
                @distribute-selected="distributeSelected"
                @create-source="createSource"
                @copy-all-sources-config="copyAllSourcesConfig"
                @clear-all-source-runtime="clearAllSourceRuntime"
                @remove-unused-sources="removeUnusedSources"
                @locate-source-usage="locateSourceUsage"
                @duplicate-source="duplicateSource"
                @export-source="openSourceExportDialog"
                @import-source="openSourceImportDialog"
                @import-source-as-new="openSourceCreateDialog"
                @apply-source-runtime-payload="applySourceRuntimePayload"
                @copy-source-runtime-payload="copySourceRuntimePayload"
                @delete-source="deleteSource"
                @clear-source-runtime="clearSourceRuntime"
                @refresh-source="refreshDataSource"
                @refresh-all-sources="refreshAllDataSources"
                @change-source-type="changeSourceType"
                @update-source-payload="updateSourcePayload"
                @copy-source-debug="copySourceDebug"
                @locate-interaction-node="locateInteractionNode"
                @undo="undoProject"
                @redo="redoProject"
            />
        </section>

        <footer v-if="!isRuntimeMode" class="status-bar">
            <span>{{ statusMessage }}</span>
            <span
                >当前页面：{{
                    currentPage?.name || "未命名页面"
                }}，预览模式下可点击组件触发联动。</span
            >
        </footer>

        <div v-if="dialogMode" class="dialog-mask" @click.self="closeDialog">
            <div class="dialog-card">
                <template v-if="dialogMode === 'template'">
                    <div class="dialog-card__header">
                        <div>
                            <p>模板保存</p>
                            <h3>将当前选区保存为可复用模板</h3>
                        </div>
                        <button class="ghost" @click="closeDialog">关闭</button>
                    </div>

                    <label class="dialog-card__field">
                        <span>模板名称</span>
                        <input
                            v-model="templateDraftName"
                            type="text"
                            placeholder="请输入模板名称"
                        />
                    </label>

                    <div class="dialog-card__summary">
                        <span>已选组件</span>
                        <strong>{{ selectedWidgets.length }} 项</strong>
                    </div>

                    <div class="inspector-tag-list">
                        <span
                            v-for="widget in selectedWidgets"
                            :key="widget.id"
                            class="inspector-tag"
                        >
                            {{ widget.name }}
                        </span>
                    </div>

                    <div class="dialog-card__actions">
                        <button
                            class="primary"
                            @click="saveSelectionAsTemplate"
                        >
                            保存模板
                        </button>
                    </div>
                </template>

                <template v-else-if="dialogMode === 'project-save'">
                    <div class="dialog-card__header">
                        <div>
                            <p>项目另存</p>
                            <h3>将当前画布另存为新的本地项目</h3>
                        </div>
                        <button class="ghost" @click="closeDialog">关闭</button>
                    </div>

                    <label class="dialog-card__field">
                        <span>项目名称</span>
                        <input
                            v-model="projectDraftName"
                            type="text"
                            placeholder="请输入项目名称"
                        />
                    </label>

                    <div class="dialog-card__summary">
                        <span>当前内容</span>
                        <strong
                            >{{ project.pages.length }} 个页面 ·
                            {{ project.dataSources.length }} 个数据源</strong
                        >
                    </div>

                    <div class="dialog-card__actions">
                        <button class="primary" @click="saveProjectAsNewRecord">
                            确认另存
                        </button>
                    </div>
                </template>

                <template v-else-if="dialogMode === 'project-create-import'">
                    <div class="dialog-card__header">
                        <div>
                            <p>项目导入</p>
                            <h3>将外部 JSON 导入为新的本地项目记录</h3>
                        </div>
                        <button class="ghost" @click="closeDialog">关闭</button>
                    </div>

                    <label class="dialog-card__field">
                        <span>项目名称</span>
                        <input
                            v-model="projectDraftName"
                            type="text"
                            placeholder="请输入项目名称"
                        />
                    </label>

                    <textarea
                        v-model="dialogText"
                        class="dialog-card__textarea"
                        spellcheck="false"
                        placeholder="请粘贴项目 JSON"
                    />

                    <div class="dialog-card__actions">
                        <button
                            class="primary"
                            @click="createProjectFromImport"
                        >
                            确认导入
                        </button>
                    </div>
                </template>

                <template v-else-if="dialogMode === 'project-publish'">
                    <div class="dialog-card__header">
                        <div>
                            <p>发布中心</p>
                            <h3>生成冻结快照并复制独立运行链接</h3>
                        </div>
                        <button class="ghost" @click="closeDialog">关闭</button>
                    </div>

                    <label class="dialog-card__field">
                        <span>发布名称</span>
                        <input
                            v-model="publishedSnapshotDraftName"
                            type="text"
                            placeholder="请输入发布版本名称"
                        />
                    </label>

                    <div class="dialog-card__summary">
                        <span>当前发布入口</span>
                        <strong>
                            {{ currentPage?.name || "未命名页面" }} ·
                            {{ project.pages.length }} 个页面 /
                            {{ project.dataSources.length }} 个数据源
                        </strong>
                    </div>

                    <p class="inspector-tip">
                        发布快照会冻结当前画布结构与默认数据源配置，后续编辑不会影响已发布版本；
                        鉴权密钥不会写入发布内容。
                    </p>

                    <div
                        class="dialog-card__actions dialog-card__actions--split"
                    >
                        <button
                            class="ghost"
                            @click="
                                publishedSnapshotDraftName =
                                    buildPublishedSnapshotDraftName()
                            "
                        >
                            重置名称
                        </button>
                        <button class="primary" @click="publishCurrentProjectSnapshot">
                            生成发布快照
                        </button>
                    </div>

                    <div v-if="currentProjectPublishedSnapshots.length" class="project-library">
                        <article
                            v-for="snapshot in currentProjectPublishedSnapshots"
                            :key="snapshot.id"
                            class="project-library__item"
                        >
                            <div class="project-library__meta">
                                <strong>{{ snapshot.name }}</strong>
                                <span>
                                    {{ snapshot.pageName }} ·
                                    {{
                                        new Date(snapshot.updatedAt).toLocaleString(
                                            "zh-CN",
                                            { hour12: false },
                                        )
                                    }}
                                </span>
                            </div>

                            <div class="project-library__actions">
                                <button
                                    class="ghost"
                                    @click="copyPublishedSnapshotLink(snapshot.id)"
                                >
                                    复制链接
                                </button>
                                <button
                                    class="ghost"
                                    @click="activatePublishedRuntime(snapshot.id)"
                                >
                                    打开运行态
                                </button>
                                <button
                                    class="ghost danger"
                                    @click="deletePublishedSnapshot(snapshot.id)"
                                >
                                    删除
                                </button>
                            </div>
                        </article>
                    </div>

                    <p v-else class="inspector-tip">
                        当前项目还没有发布快照，先生成一个版本即可。
                    </p>
                </template>

                <template v-else-if="dialogMode === 'project-library'">
                    <div class="dialog-card__header">
                        <div>
                            <p>项目中心</p>
                            <h3>管理本地项目、快速切换和新建空白项目</h3>
                        </div>
                        <button class="ghost" @click="closeDialog">关闭</button>
                    </div>

                    <div
                        class="dialog-card__actions dialog-card__actions--split"
                    >
                        <button class="ghost" @click="openProjectCreateDialog">
                            导入为新项目
                        </button>
                        <button class="ghost" @click="createBlankProjectRecord">
                            新建空白项目
                        </button>
                        <button class="ghost" @click="openProjectSaveDialog">
                            另存当前项目
                        </button>
                    </div>

                    <div class="project-library">
                        <article
                            v-for="record in projectLibrary"
                            :key="record.id"
                            class="project-library__item"
                            :class="{
                                'is-active':
                                    record.id === activeProjectRecordId,
                            }"
                        >
                            <div class="project-library__meta">
                                <input
                                    class="project-library__name"
                                    :value="record.name"
                                    type="text"
                                    @change="
                                        updateProjectRecordName(
                                            record.id,
                                            $event.target.value,
                                        )
                                    "
                                />
                                <span>{{
                                    new Date(record.updatedAt).toLocaleString(
                                        "zh-CN",
                                        { hour12: false },
                                    )
                                }}</span>
                            </div>

                            <div class="project-library__actions">
                                <button
                                    class="ghost"
                                    @click="duplicateProjectRecord(record.id)"
                                >
                                    复制
                                </button>
                                <button
                                    class="ghost"
                                    @click="openProjectRecord(record.id)"
                                >
                                    打开
                                </button>
                                <button
                                    class="ghost danger"
                                    @click="deleteProjectRecord(record.id)"
                                >
                                    删除
                                </button>
                            </div>
                        </article>
                    </div>
                </template>

                <template
                    v-else-if="
                        dialogMode === 'source-export' ||
                        dialogMode === 'source-import' ||
                        dialogMode === 'source-create-import'
                    "
                >
                    <div class="dialog-card__header">
                        <div>
                            <p>{{ getJsonDialogEyebrowLabel() }}</p>
                            <h3>{{ getJsonDialogTitleLabel() }}</h3>
                        </div>
                        <button class="ghost" @click="closeDialog">关闭</button>
                    </div>

                    <p v-if="getJsonDialogHintText()" class="inspector-tip">
                        {{ getJsonDialogHintText() }}
                    </p>

                    <textarea
                        v-model="dialogText"
                        class="dialog-card__textarea"
                        :readonly="isJsonDialogReadonlyState()"
                        spellcheck="false"
                    />

                    <div class="dialog-card__actions">
                        <button
                            class="primary"
                            @click="handleJsonDialogAction()"
                        >
                            {{ getJsonDialogActionLabelText() }}
                        </button>
                    </div>
                </template>

                <template v-else>
                    <div class="dialog-card__header">
                        <div>
                            <p>{{ getJsonDialogEyebrowLabel() }}</p>
                            <h3>{{ getJsonDialogTitleLabel() }}</h3>
                        </div>
                        <button class="ghost" @click="closeDialog">关闭</button>
                    </div>

                    <textarea
                        v-model="dialogText"
                        class="dialog-card__textarea"
                        :readonly="isJsonDialogReadonlyState()"
                        spellcheck="false"
                    />

                    <div class="dialog-card__actions">
                        <button
                            class="primary"
                            @click="handleJsonDialogAction()"
                        >
                            {{ getJsonDialogActionLabelText() }}
                        </button>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>
