<script setup>
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    provide,
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
    ASSET_KIND_OPTIONS,
    createAssetId,
    deserializeAssetPackageRecords,
    createAssetReference,
    deleteAssetRecord,
    formatAssetFileSize,
    inferAssetKind,
    listAssetRecords,
    normalizeAssetTags,
    parseAssetReference,
    putAssetRecords,
    serializeAssetRecords,
} from "./editor/assets";
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
const PUBLISHED_ROLLBACK_LOG_LIMIT = 40;
const PUBLISHED_OPERATION_LOG_LIMIT = 120;
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
const PUBLISHED_ROLLBACK_LOG_STORAGE_KEY =
    "visualization-web-published-rollback-logs-v1";
const PUBLISHED_OPERATION_LOG_STORAGE_KEY =
    "visualization-web-published-operation-logs-v1";
const PROJECT_EXPORT_PACKAGE_TYPE = "visualization-web-project-package";
const PROJECT_EXPORT_PACKAGE_VERSION = 2;
const ASSET_BATCH_TAG_MODE_OPTIONS = [
    { value: "append", label: "追加标签" },
    { value: "replace", label: "覆盖标签" },
    { value: "clear", label: "清空标签" },
];
const ASSET_LIBRARY_VIEW_MODE_OPTIONS = [
    { value: "list", label: "列表视图" },
    { value: "grouped", label: "标签分组" },
];
const DATA_SOURCE_SECRET_FIELDS = [
    "authToken",
    "authUsername",
    "authPassword",
];
const PUBLISHED_ENVIRONMENT_OPTIONS = [
    { value: "production", label: "生产环境" },
    { value: "staging", label: "预发环境" },
    { value: "testing", label: "测试环境" },
    { value: "development", label: "开发环境" },
];
const PUBLISHED_ENVIRONMENT_LABEL_MAP = Object.fromEntries(
    PUBLISHED_ENVIRONMENT_OPTIONS.map((item) => [item.value, item.label]),
);
const DEFAULT_PUBLISHED_ENVIRONMENT = PUBLISHED_ENVIRONMENT_OPTIONS[0].value;
const PUBLISHED_APPROVAL_STATUS_OPTIONS = [
    { value: "pending", label: "待审批" },
    { value: "approved", label: "已通过" },
    { value: "rejected", label: "已驳回" },
];
const PUBLISHED_APPROVAL_STATUS_LABEL_MAP = Object.fromEntries(
    PUBLISHED_APPROVAL_STATUS_OPTIONS.map((item) => [item.value, item.label]),
);
const DEFAULT_PUBLISHED_APPROVAL_STATUS = "approved";
const PUBLISHED_APPROVAL_HISTORY_LIMIT = 20;
const PUBLISHED_APPROVAL_REVIEWER_FILTER_UNASSIGNED = "__unassigned__";
const PUBLISHED_APPROVAL_FILTER_OPTIONS = [
    { value: "all", label: "全部审批" },
    ...PUBLISHED_APPROVAL_STATUS_OPTIONS,
];
const PUBLISHED_LOCK_FILTER_OPTIONS = [
    { value: "all", label: "全部状态" },
    { value: "locked", label: "仅锁定" },
    { value: "unlocked", label: "仅未锁定" },
];
const PUBLISHED_ROLLBACK_RELATION_FILTER_OPTIONS = [
    { value: "all", label: "全部关联" },
    { value: "linked", label: "仅可定位" },
    { value: "missing", label: "仅已失效" },
];
const PUBLISHED_OPERATION_ACTION_LABEL_MAP = {
    publish: "生成发布",
    "update-meta": "更新信息",
    overwrite: "覆盖发布",
    pin: "置顶版本",
    unpin: "取消置顶",
    lock: "锁定版本",
    unlock: "解除锁定",
    rollback: "回滚编辑器",
    delete: "删除版本",
    import: "导入版本",
    "export-current": "导出当前项目",
    "export-selected": "导出所选版本",
    "export-operation-logs": "导出操作日志",
    approve: "审批通过",
    reject: "审批驳回",
    "copy-link": "复制链接",
    "open-runtime": "打开运行态",
    "batch-pin": "批量置顶",
    "batch-unpin": "批量取消置顶",
    "batch-lock": "批量锁定",
    "batch-unlock": "批量解除锁定",
    "batch-delete": "批量删除",
    "batch-copy-links": "批量复制链接",
    "batch-open-runtimes": "批量打开运行态",
    "batch-update-meta": "批量更新信息",
    "batch-approve": "批量审批通过",
    "batch-reject": "批量审批驳回",
};
const PUBLISHED_OPERATION_ACTION_FILTER_OPTIONS = [
    { value: "all", label: "全部操作" },
    ...Object.entries(PUBLISHED_OPERATION_ACTION_LABEL_MAP).map(
        ([value, label]) => ({
            value,
            label,
        }),
    ),
];
const PUBLISHED_SORT_OPTIONS = [
    { value: "pinned-latest", label: "置顶后按最近发布" },
    { value: "pinned-oldest", label: "置顶后按最早发布" },
    { value: "pinned-name", label: "置顶后按名称" },
];
const MATERIAL_LABEL_MAP = Object.fromEntries(
    materials.map((item) => [item.type, item.label]),
);

let dataSourceSecretStoreState = loadDataSourceSecretStore();

const initialRoute = getInitialRouteState();
const initialProjectState = loadProjectState();
const initialPublishedSnapshots = loadPublishedSnapshotLibrary();
const initialPublishedRollbackLogs = loadPublishedRollbackLogLibrary();
const initialPublishedOperationLogs = loadPublishedOperationLogLibrary();
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
const publishedSnapshotDraftEnvironment = ref(DEFAULT_PUBLISHED_ENVIRONMENT);
const publishedSnapshotDraftApprovalStatus = ref(
    DEFAULT_PUBLISHED_APPROVAL_STATUS,
);
const publishedSnapshotDraftApprovalReviewer = ref("");
const publishedSnapshotDraftApprovalComment = ref("");
const publishedSnapshotDraftTags = ref("");
const publishedSnapshotSearchKeyword = ref("");
const publishedSnapshotFilterEnvironment = ref("all");
const publishedSnapshotFilterApprovalStatus = ref("all");
const publishedSnapshotFilterApprovalReviewer = ref("all");
const publishedSnapshotFilterLockState = ref("all");
const publishedSnapshotSortMode = ref(PUBLISHED_SORT_OPTIONS[0].value);
const publishedSnapshotBatchApplyNote = ref(false);
const publishedSnapshotBatchApplyTags = ref(false);
const publishedSnapshotBatchApplyEnvironment = ref(false);
const publishedSnapshotBatchApplyApprovalStatus = ref(false);
const publishedRollbackSearchKeyword = ref("");
const publishedRollbackFilterEnvironment = ref("all");
const publishedRollbackFilterRelation = ref("all");
const publishedOperationSearchKeyword = ref("");
const publishedOperationFilterAction = ref("all");
const editingPublishedSnapshotId = ref("");
const publishDiffSnapshotId = ref("");
const approvalTimelineSnapshotId = ref("");
const pendingRollbackSnapshotId = ref("");
const selectedPublishedSnapshotIds = ref([]);
const dialogSourceId = ref("");
const dialogOperationLogId = ref("");
const statusMessage = ref("已启用多页面、模板库、数据源和事件联动");
const assetLibrary = ref([]);
const assetLibraryReady = ref(false);
const assetLibraryLoading = ref(false);
const assetLibrarySearchKeyword = ref("");
const assetLibraryFilterKind = ref(ASSET_KIND_OPTIONS[0].value);
const assetLibraryFilterTag = ref("all");
const assetLibraryViewMode = ref(ASSET_LIBRARY_VIEW_MODE_OPTIONS[0].value);
const assetLibraryUploadInputKey = ref(0);
const selectedAssetIds = ref([]);
const assetBatchTagMode = ref(ASSET_BATCH_TAG_MODE_OPTIONS[0].value);
const assetBatchTagDraft = ref("");
const collapsedAssetGroupKeys = ref([]);
const expandedAssetUsageIds = ref([]);
const assetEditingId = ref("");
const assetDraftName = ref("");
const assetTagEditingId = ref("");
const assetTagDraftValue = ref("");
const assetPreviewUrlMap = ref({});

const project = ref(initialProject);
const projectLibrary = ref(initialProjectState.library);
const activeProjectRecordId = ref(initialProjectState.activeProjectId);
const publishedSnapshots = ref(initialPublishedSnapshots);
const publishedRollbackLogs = ref(initialPublishedRollbackLogs);
const publishedOperationLogs = ref(initialPublishedOperationLogs);
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
const assetObjectUrlRegistry = new Map();
let linkedWidgetTimerId = 0;
let projectSyncTimerId = 0;
let interactionRunToken = 0;
let interactivePageInitToken = 0;
let interactionChainSeed = 0;
let assetLibraryLoadToken = 0;
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
function createEmptyAssetUsageDetail() {
    return {
        currentProjectUsed: 0,
        currentProjectEntries: [],
        currentProjectEntryCount: 0,
        projectRecordEntries: [],
        projectRecordCount: 0,
        projectRecordEntryCount: 0,
        publishedSnapshotEntries: [],
        publishedSnapshotCount: 0,
        publishedSnapshotEntryCount: 0,
        total: 0,
        totalEntries: 0,
        totalScopes: 0,
    };
}

function getAssetUsageScopeLabel(scopeType = "") {
    switch (String(scopeType || "").trim()) {
        case "current-project":
            return "当前项目";
        case "project-record":
            return "项目快照";
        case "published-snapshot":
            return "发布版本";
        default:
            return "引用位置";
    }
}

function getAssetUsageLocationLabel(locationType = "") {
    switch (String(locationType || "").trim()) {
        case "page":
            return "页面设置";
        case "source":
            return "数据源";
        case "variable":
            return "变量模板";
        default:
            return "组件";
    }
}

function parseProjectSnapshotForAssetUsage(snapshotText = "") {
    if (typeof snapshotText !== "string" || !snapshotText.trim()) {
        return null;
    }

    try {
        return JSON.parse(snapshotText);
    } catch (error) {
        console.warn(error);
        return null;
    }
}

function createAssetUsageEntry(assetId, scopeMeta = {}, locationMeta = {}) {
    const scopeType = String(scopeMeta.type || "").trim();
    const locationType = String(locationMeta.locationType || "").trim();
    const normalizedScopeLabel = getAssetUsageScopeLabel(scopeType);
    const primaryLabel =
        typeof locationMeta.primaryLabel === "string" &&
        locationMeta.primaryLabel.trim()
            ? locationMeta.primaryLabel.trim()
            : "未命名引用";
    const secondaryLabel =
        typeof locationMeta.secondaryLabel === "string" &&
        locationMeta.secondaryLabel.trim()
            ? locationMeta.secondaryLabel.trim()
            : normalizedScopeLabel;

    return {
        id: [
            assetId,
            scopeType || "scope",
            scopeMeta.id || scopeMeta.name || "unknown",
            locationType || "location",
            locationMeta.pageId ||
                locationMeta.widgetId ||
                locationMeta.sourceId ||
                locationMeta.variableKey ||
                primaryLabel,
        ].join(":"),
        assetId,
        scopeType,
        scopeLabel: normalizedScopeLabel,
        scopeId: String(scopeMeta.id || "").trim(),
        scopeName:
            typeof scopeMeta.name === "string" && scopeMeta.name.trim()
                ? scopeMeta.name.trim()
                : normalizedScopeLabel,
        locationType,
        locationTypeLabel: getAssetUsageLocationLabel(locationType),
        pageId: String(locationMeta.pageId || "").trim(),
        pageName:
            typeof locationMeta.pageName === "string" &&
            locationMeta.pageName.trim()
                ? locationMeta.pageName.trim()
                : "",
        widgetId: String(locationMeta.widgetId || "").trim(),
        widgetName:
            typeof locationMeta.widgetName === "string" &&
            locationMeta.widgetName.trim()
                ? locationMeta.widgetName.trim()
                : "",
        widgetType: String(locationMeta.widgetType || "").trim(),
        widgetTypeLabel:
            typeof locationMeta.widgetTypeLabel === "string" &&
            locationMeta.widgetTypeLabel.trim()
                ? locationMeta.widgetTypeLabel.trim()
                : "",
        sourceId: String(locationMeta.sourceId || "").trim(),
        sourceName:
            typeof locationMeta.sourceName === "string" &&
            locationMeta.sourceName.trim()
                ? locationMeta.sourceName.trim()
                : "",
        variableKey:
            typeof locationMeta.variableKey === "string" &&
            locationMeta.variableKey.trim()
                ? locationMeta.variableKey.trim()
                : "",
        primaryLabel,
        secondaryLabel,
    };
}

function collectAssetReferenceValueEntries(
    value,
    fieldPath = "",
    entries = [],
) {
    if (typeof value === "string") {
        const assetId = parseAssetReference(value);

        if (assetId) {
            entries.push({
                assetId,
                reference: value,
                fieldPath: fieldPath || "value",
            });
        }

        return entries;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            collectAssetReferenceValueEntries(
                item,
                `${fieldPath}[${index}]`,
                entries,
            );
        });
        return entries;
    }

    if (!value || typeof value !== "object") {
        return entries;
    }

    Object.entries(value).forEach(([key, item]) => {
        collectAssetReferenceValueEntries(
            item,
            fieldPath ? `${fieldPath}.${key}` : key,
            entries,
        );
    });

    return entries;
}

function createMissingAssetReferenceEntry(
    referenceEntry,
    scopeMeta = {},
    locationMeta = {},
) {
    const baseEntry = createAssetUsageEntry(
        referenceEntry.assetId,
        scopeMeta,
        locationMeta,
    );
    const fieldPaths = Array.from(
        new Set(
            (Array.isArray(referenceEntry.fieldPaths)
                ? referenceEntry.fieldPaths
                : []
            )
                .map((item) => String(item || "").trim())
                .filter(Boolean),
        ),
    );

    return {
        ...baseEntry,
        id: `${baseEntry.id}:missing:${referenceEntry.reference}`,
        reference: referenceEntry.reference,
        fieldPaths,
        fieldCount: fieldPaths.length,
    };
}

function collectMissingAssetReferenceEntriesFromLocation(
    locationValue,
    scopeMeta = {},
    locationMeta = {},
    existingAssetIds = new Set(),
) {
    const groupedReferences = new Map();

    collectAssetReferenceValueEntries(locationValue).forEach((entry) => {
        if (existingAssetIds.has(entry.assetId)) {
            return;
        }

        const key = `${entry.assetId}:${entry.reference}`;

        if (!groupedReferences.has(key)) {
            groupedReferences.set(key, {
                assetId: entry.assetId,
                reference: entry.reference,
                fieldPaths: [],
            });
        }

        groupedReferences.get(key).fieldPaths.push(entry.fieldPath);
    });

    return Array.from(groupedReferences.values()).map((entry) =>
        createMissingAssetReferenceEntry(entry, scopeMeta, locationMeta),
    );
}

function collectMissingAssetReferenceEntriesFromProject(
    projectData,
    scopeMeta = {},
    existingAssetIds = new Set(),
) {
    let normalizedProject = null;

    try {
        normalizedProject = normalizeProjectSchema(cloneDeep(projectData));
    } catch (error) {
        console.warn(error);
        return [];
    }

    const entries = [];

    normalizedProject.pages.forEach((page, pageIndex) => {
        const pageName =
            typeof page?.name === "string" && page.name.trim()
                ? page.name.trim()
                : `未命名页面 ${pageIndex + 1}`;

        entries.push(
            ...collectMissingAssetReferenceEntriesFromLocation(
                {
                    ...page,
                    widgets: [],
                },
                scopeMeta,
                {
                    locationType: "page",
                    pageId: page?.id ?? "",
                    pageName,
                    primaryLabel: pageName,
                    secondaryLabel: "页面设置",
                },
                existingAssetIds,
            ),
        );

        (Array.isArray(page?.widgets) ? page.widgets : []).forEach(
            (widget, widgetIndex) => {
                const widgetType = String(widget?.type || "").trim();
                const widgetTypeLabel =
                    MATERIAL_LABEL_MAP[widgetType] || widgetType || "组件";
                const widgetName =
                    typeof widget?.name === "string" && widget.name.trim()
                        ? widget.name.trim()
                        : `未命名组件 ${widgetIndex + 1}`;

                entries.push(
                    ...collectMissingAssetReferenceEntriesFromLocation(
                        widget,
                        scopeMeta,
                        {
                            locationType: "widget",
                            pageId: page?.id ?? "",
                            pageName,
                            widgetId: widget?.id ?? "",
                            widgetName,
                            widgetType,
                            widgetTypeLabel,
                            primaryLabel: widgetName,
                            secondaryLabel: `${pageName} · ${widgetTypeLabel}`,
                        },
                        existingAssetIds,
                    ),
                );
            },
        );
    });

    normalizedProject.dataSources.forEach((source, sourceIndex) => {
        const sourceName =
            typeof source?.name === "string" && source.name.trim()
                ? source.name.trim()
                : `数据源 ${sourceIndex + 1}`;

        entries.push(
            ...collectMissingAssetReferenceEntriesFromLocation(
                source,
                scopeMeta,
                {
                    locationType: "source",
                    sourceId: source?.id ?? "",
                    sourceName,
                    primaryLabel: sourceName,
                    secondaryLabel: "数据源配置",
                },
                existingAssetIds,
            ),
        );
    });

    (Array.isArray(normalizedProject.runtimeVariablePresets)
        ? normalizedProject.runtimeVariablePresets
        : []
    ).forEach((preset, presetIndex) => {
        const variableKey =
            typeof preset?.key === "string" && preset.key.trim()
                ? preset.key.trim()
                : `变量 ${presetIndex + 1}`;

        entries.push(
            ...collectMissingAssetReferenceEntriesFromLocation(
                preset,
                scopeMeta,
                {
                    locationType: "variable",
                    variableKey,
                    primaryLabel: variableKey,
                    secondaryLabel: "运行时变量模板",
                },
                existingAssetIds,
            ),
        );
    });

    return entries;
}

function collectAssetUsageEntriesFromProject(projectData, scopeMeta = {}) {
    const assetReferences = assetLibrary.value
        .map((asset) => [
            asset.id,
            String(asset.reference || createAssetReference(asset.id)).trim(),
        ])
        .filter(([, reference]) => Boolean(reference));
    const entriesByAssetId = Object.fromEntries(
        assetReferences.map(([assetId]) => [assetId, []]),
    );

    if (!assetReferences.length) {
        return entriesByAssetId;
    }

    let normalizedProject = null;

    try {
        normalizedProject = normalizeProjectSchema(cloneDeep(projectData));
    } catch (error) {
        console.warn(error);
        return entriesByAssetId;
    }

    const pushMatchedEntries = (payload, locationMeta) => {
        if (typeof payload !== "string" || !payload) {
            return;
        }

        assetReferences.forEach(([assetId, reference]) => {
            if (payload.includes(reference)) {
                entriesByAssetId[assetId].push(
                    createAssetUsageEntry(assetId, scopeMeta, locationMeta),
                );
            }
        });
    };

    normalizedProject.pages.forEach((page, pageIndex) => {
        const pageName =
            typeof page?.name === "string" && page.name.trim()
                ? page.name.trim()
                : `未命名页面 ${pageIndex + 1}`;
        const pageSettingsPayload = JSON.stringify({
            ...page,
            widgets: [],
        });

        pushMatchedEntries(pageSettingsPayload, {
            locationType: "page",
            pageId: page?.id ?? "",
            pageName,
            primaryLabel: pageName,
            secondaryLabel: "页面设置",
        });

        (Array.isArray(page?.widgets) ? page.widgets : []).forEach(
            (widget, widgetIndex) => {
                const widgetType = String(widget?.type || "").trim();
                const widgetTypeLabel =
                    MATERIAL_LABEL_MAP[widgetType] || widgetType || "组件";
                const widgetName =
                    typeof widget?.name === "string" && widget.name.trim()
                        ? widget.name.trim()
                        : `未命名组件 ${widgetIndex + 1}`;

                pushMatchedEntries(JSON.stringify(widget), {
                    locationType: "widget",
                    pageId: page?.id ?? "",
                    pageName,
                    widgetId: widget?.id ?? "",
                    widgetName,
                    widgetType,
                    widgetTypeLabel,
                    primaryLabel: widgetName,
                    secondaryLabel: `${pageName} · ${widgetTypeLabel}`,
                });
            },
        );
    });

    normalizedProject.dataSources.forEach((source, sourceIndex) => {
        const sourceName =
            typeof source?.name === "string" && source.name.trim()
                ? source.name.trim()
                : `数据源 ${sourceIndex + 1}`;

        pushMatchedEntries(JSON.stringify(source), {
            locationType: "source",
            sourceId: source?.id ?? "",
            sourceName,
            primaryLabel: sourceName,
            secondaryLabel: "数据源配置",
        });
    });

    (Array.isArray(normalizedProject.runtimeVariablePresets)
        ? normalizedProject.runtimeVariablePresets
        : []
    ).forEach((preset, presetIndex) => {
        const variableKey =
            typeof preset?.key === "string" && preset.key.trim()
                ? preset.key.trim()
                : `变量 ${presetIndex + 1}`;

        pushMatchedEntries(JSON.stringify(preset), {
            locationType: "variable",
            variableKey,
            primaryLabel: variableKey,
            secondaryLabel: "运行时变量模板",
        });
    });

    return entriesByAssetId;
}

const assetUsageDetailMap = computed(() => {
    const detailMap = Object.fromEntries(
        assetLibrary.value.map((asset) => [asset.id, createEmptyAssetUsageDetail()]),
    );

    const mergeCurrentProjectEntries = (entriesByAssetId) => {
        Object.entries(entriesByAssetId).forEach(([assetId, entries]) => {
            if (!detailMap[assetId] || !entries.length) {
                return;
            }

            detailMap[assetId].currentProjectUsed = 1;
            detailMap[assetId].currentProjectEntries.push(...entries);
            detailMap[assetId].currentProjectEntryCount += entries.length;
        });
    };

    const mergeScopedEntries = (
        sectionKey,
        scopeCountKey,
        scopeEntryCountKey,
        entriesByAssetId,
    ) => {
        Object.entries(entriesByAssetId).forEach(([assetId, entries]) => {
            if (!detailMap[assetId] || !entries.length) {
                return;
            }

            detailMap[assetId][sectionKey].push(...entries);
            detailMap[assetId][scopeCountKey] += 1;
            detailMap[assetId][scopeEntryCountKey] += entries.length;
        });
    };

    mergeCurrentProjectEntries(
        collectAssetUsageEntriesFromProject(project.value, {
            type: "current-project",
            id: activeProjectRecordId.value || "current-project",
            name: currentProjectName.value || "当前项目",
        }),
    );

    projectLibrary.value.forEach((record) => {
        const projectSnapshot = parseProjectSnapshotForAssetUsage(record?.snapshot);

        if (!projectSnapshot) {
            return;
        }

        mergeScopedEntries(
            "projectRecordEntries",
            "projectRecordCount",
            "projectRecordEntryCount",
            collectAssetUsageEntriesFromProject(projectSnapshot, {
                type: "project-record",
                id: record?.id ?? "",
                name:
                    typeof record?.name === "string" && record.name.trim()
                        ? record.name.trim()
                        : "未命名项目快照",
            }),
        );
    });

    publishedSnapshots.value.forEach((snapshot) => {
        const publishedSnapshot = parseProjectSnapshotForAssetUsage(
            snapshot?.snapshot,
        );

        if (!publishedSnapshot) {
            return;
        }

        mergeScopedEntries(
            "publishedSnapshotEntries",
            "publishedSnapshotCount",
            "publishedSnapshotEntryCount",
            collectAssetUsageEntriesFromProject(publishedSnapshot, {
                type: "published-snapshot",
                id: snapshot?.id ?? "",
                name:
                    typeof snapshot?.name === "string" && snapshot.name.trim()
                        ? snapshot.name.trim()
                        : "未命名发布版本",
            }),
        );
    });

    Object.values(detailMap).forEach((detail) => {
        detail.totalScopes =
            detail.currentProjectUsed +
            detail.projectRecordCount +
            detail.publishedSnapshotCount;
        detail.totalEntries =
            detail.currentProjectEntryCount +
            detail.projectRecordEntryCount +
            detail.publishedSnapshotEntryCount;
        detail.total = detail.totalEntries;
    });

    return detailMap;
});

const assetUsageMap = computed(() =>
    Object.fromEntries(
        assetLibrary.value.map((asset) => {
            const detail =
                assetUsageDetailMap.value[asset.id] ?? createEmptyAssetUsageDetail();

            return [
                asset.id,
                {
                    ...detail,
                    total: detail.totalEntries,
                },
            ];
        }),
    ),
);
const missingAssetReferenceReport = computed(() => {
    const existingAssetIds = new Set(assetLibrary.value.map((asset) => asset.id));
    const currentProjectEntries = collectMissingAssetReferenceEntriesFromProject(
        project.value,
        {
            type: "current-project",
            id: activeProjectRecordId.value || "current-project",
            name: currentProjectName.value || "当前项目",
        },
        existingAssetIds,
    );
    const projectRecordEntries = [];
    const publishedSnapshotEntries = [];

    projectLibrary.value.forEach((record) => {
        const projectSnapshot = parseProjectSnapshotForAssetUsage(record?.snapshot);

        if (!projectSnapshot) {
            return;
        }

        projectRecordEntries.push(
            ...collectMissingAssetReferenceEntriesFromProject(
                projectSnapshot,
                {
                    type: "project-record",
                    id: record?.id ?? "",
                    name:
                        typeof record?.name === "string" && record.name.trim()
                            ? record.name.trim()
                            : "未命名项目快照",
                },
                existingAssetIds,
            ),
        );
    });

    publishedSnapshots.value.forEach((snapshot) => {
        const publishedSnapshot = parseProjectSnapshotForAssetUsage(
            snapshot?.snapshot,
        );

        if (!publishedSnapshot) {
            return;
        }

        publishedSnapshotEntries.push(
            ...collectMissingAssetReferenceEntriesFromProject(
                publishedSnapshot,
                {
                    type: "published-snapshot",
                    id: snapshot?.id ?? "",
                    name:
                        typeof snapshot?.name === "string" && snapshot.name.trim()
                            ? snapshot.name.trim()
                            : "未命名发布版本",
                },
                existingAssetIds,
            ),
        );
    });

    const allEntries = [
        ...currentProjectEntries,
        ...projectRecordEntries,
        ...publishedSnapshotEntries,
    ];

    return {
        currentProjectEntries,
        currentProjectCount: currentProjectEntries.length,
        projectRecordEntries,
        projectRecordCount: projectRecordEntries.length,
        publishedSnapshotEntries,
        publishedSnapshotCount: publishedSnapshotEntries.length,
        totalEntries: allEntries.length,
        uniqueAssetCount: new Set(allEntries.map((entry) => entry.assetId)).size,
        sections: [
            {
                key: "current-project",
                label: "当前项目",
                entries: currentProjectEntries,
            },
            {
                key: "project-record",
                label: "项目快照",
                entries: projectRecordEntries,
            },
            {
                key: "published-snapshot",
                label: "发布版本",
                entries: publishedSnapshotEntries,
            },
        ].filter((section) => section.entries.length > 0),
    };
});
const missingAssetReferenceEntriesByAssetId = computed(() =>
    Object.fromEntries(
        Array.from(
            missingAssetReferenceReport.value.sections.reduce(
                (groupedEntries, section) => {
                    section.entries.forEach((entry) => {
                        const assetId = String(entry?.assetId || "").trim();

                        if (!assetId) {
                            return;
                        }

                        if (!groupedEntries.has(assetId)) {
                            groupedEntries.set(assetId, []);
                        }

                        groupedEntries.get(assetId).push(entry);
                    });
                    return groupedEntries;
                },
                new Map(),
            ).entries(),
        ),
    ),
);
const assetLibrarySummary = computed(() =>
    assetLibrary.value.reduce(
        (summary, asset) => {
            summary.total += 1;

            if (asset.kind === "image") {
                summary.image += 1;
            }

            if (asset.kind === "video") {
                summary.video += 1;
            }

            return summary;
        },
        {
            total: 0,
            image: 0,
            video: 0,
        },
    ),
);
const selectedWidgetAssetTargetMode = computed(() => {
    if (selectedWidget.value?.type === "image") {
        return "image";
    }

    if (selectedWidget.value?.type === "video") {
        return "video";
    }

    return "";
});
const selectedWidgetCanReceiveAsset = computed(
    () =>
        Boolean(selectedWidgetAssetTargetMode.value) &&
        Boolean(selectedWidget.value) &&
        !selectedWidget.value?.locked &&
        !selectedWidget.value?.hidden,
);
const assetLibraryTagOptions = computed(() => [
    { value: "all", label: "全部标签" },
    ...Array.from(
        new Set(
            assetLibrary.value.flatMap((asset) =>
                Array.isArray(asset.tags) ? asset.tags : [],
            ),
        ),
    )
        .sort((left, right) => left.localeCompare(right, "zh-CN"))
        .map((tag) => ({
            value: tag,
            label: tag,
        })),
]);
const assetLibraryGroupedSections = computed(() => {
    const sections = new Map();
    const activeFilterTag = assetLibraryFilterTag.value;

    filteredAssetLibrary.value.forEach((asset) => {
        const tags = Array.isArray(asset.tags) ? asset.tags.filter(Boolean) : [];
        const groupKeys =
            activeFilterTag !== "all"
                ? [activeFilterTag]
                : tags.length
                  ? tags
                  : ["__untagged__"];

        groupKeys.forEach((groupKey) => {
            const normalizedKey = String(groupKey || "").trim() || "__untagged__";

            if (!sections.has(normalizedKey)) {
                sections.set(normalizedKey, {
                    key: normalizedKey,
                    label:
                        normalizedKey === "__untagged__"
                            ? "未分类"
                            : normalizedKey,
                    assets: [],
                });
            }

            sections.get(normalizedKey).assets.push(asset);
        });
    });

    return Array.from(sections.values()).sort((left, right) => {
        if (left.key === "__untagged__") {
            return 1;
        }

        if (right.key === "__untagged__") {
            return -1;
        }

        return left.label.localeCompare(right.label, "zh-CN");
    });
});
const filteredAssetLibrary = computed(() => {
    const keyword = assetLibrarySearchKeyword.value.trim().toLocaleLowerCase();

    return assetLibrary.value.filter((asset) => {
        if (
            assetLibraryFilterKind.value !== "all" &&
            asset.kind !== assetLibraryFilterKind.value
        ) {
            return false;
        }

        if (
            assetLibraryFilterTag.value !== "all" &&
            !(Array.isArray(asset.tags) ? asset.tags : []).includes(
                assetLibraryFilterTag.value,
            )
        ) {
            return false;
        }

        if (!keyword) {
            return true;
        }

        const searchableText = [
            asset.name,
            asset.mimeType,
            asset.kind === "image" ? "图片" : asset.kind === "video" ? "视频" : "",
            createAssetReference(asset.id),
            ...(Array.isArray(asset.tags) ? asset.tags : []),
        ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase();

        return searchableText.includes(keyword);
    });
});
const selectedAssetIdSet = computed(() => new Set(selectedAssetIds.value));
const selectedAssetLibrary = computed(() =>
    assetLibrary.value.filter((asset) => selectedAssetIdSet.value.has(asset.id)),
);
const selectedFilteredAssetLibrary = computed(() =>
    filteredAssetLibrary.value.filter((asset) =>
        selectedAssetIdSet.value.has(asset.id),
    ),
);
const selectedAssetCount = computed(() => selectedAssetLibrary.value.length);
const selectedAssetReferencedCount = computed(
    () =>
        selectedAssetLibrary.value.filter(
            (asset) => getAssetUsageInfo(asset.id).total > 0,
        ).length,
);
const selectedAssetDeletableCount = computed(() =>
    Math.max(
        selectedAssetCount.value - selectedAssetReferencedCount.value,
        0,
    ),
);
const canBatchApplyAssetTags = computed(() => {
    if (!selectedAssetCount.value) {
        return false;
    }

    if (assetBatchTagMode.value === "clear") {
        return true;
    }

    return normalizeAssetTags(assetBatchTagDraft.value).length > 0;
});
const assetLibraryGroupCount = computed(
    () => assetLibraryGroupedSections.value.length,
);
const collapsedAssetGroupKeySet = computed(
    () => new Set(collapsedAssetGroupKeys.value),
);
const isAllAssetGroupsCollapsed = computed(
    () =>
        Boolean(assetLibraryGroupedSections.value.length) &&
        assetLibraryGroupedSections.value.every((section) =>
            collapsedAssetGroupKeySet.value.has(section.key),
        ),
);
const assetLibraryRenderItems = computed(() => {
    if (assetLibraryViewMode.value !== "grouped") {
        return filteredAssetLibrary.value.map((asset) => ({
            type: "asset",
            key: `asset-${asset.id}`,
            asset,
        }));
    }

    return assetLibraryGroupedSections.value.flatMap((group) => [
        {
            type: "group",
            key: `asset-group-${group.key}`,
            group,
        },
        ...(
            collapsedAssetGroupKeySet.value.has(group.key)
                ? []
                : group.assets.map((asset) => ({
                      type: "asset",
                      key: `asset-group-${group.key}-${asset.id}`,
                      asset,
                  }))
        ),
    ]);
});
const isAllFilteredAssetsSelected = computed(
    () =>
        Boolean(filteredAssetLibrary.value.length) &&
        selectedFilteredAssetLibrary.value.length ===
            filteredAssetLibrary.value.length,
);
const hasAssetLibraryFilters = computed(
    () =>
        Boolean(assetLibrarySearchKeyword.value.trim()) ||
        assetLibraryFilterKind.value !== ASSET_KIND_OPTIONS[0].value ||
        assetLibraryFilterTag.value !== "all",
);
const currentPublishedSnapshot = computed(
    () =>
        publishedSnapshots.value.find(
            (item) => item.id === runtimePublishedSnapshotId.value,
        ) ?? null,
);
const currentProjectPublishedSnapshotLibrary = computed(() =>
    publishedSnapshots.value.filter(
        (item) => item.projectRecordId === activeProjectRecordId.value,
    ),
);
const currentProjectPublishedRollbackLibrary = computed(() =>
    publishedRollbackLogs.value
        .filter((item) => item.projectRecordId === activeProjectRecordId.value)
        .sort((left, right) => right.rolledBackAt - left.rolledBackAt),
);
const currentProjectPublishedOperationLibrary = computed(() =>
    publishedOperationLogs.value
        .filter((item) => item.projectRecordId === activeProjectRecordId.value)
        .sort((left, right) => right.createdAt - left.createdAt),
);
const currentProjectPublishedSnapshots = computed(() =>
    sortPublishedSnapshotCollection(currentProjectPublishedSnapshotLibrary.value),
);
const currentProjectPublishedSnapshotIdSet = computed(
    () => new Set(currentProjectPublishedSnapshotLibrary.value.map((item) => item.id)),
);
const currentProjectPublishedRollbackLogs = computed(() =>
    currentProjectPublishedRollbackLibrary.value,
);
const currentProjectPublishedOperationLogs = computed(() =>
    currentProjectPublishedOperationLibrary.value,
);
const currentProjectPublishedApprovalReviewers = computed(() =>
    Array.from(
        new Set(
            currentProjectPublishedSnapshots.value
                .map((snapshot) =>
                    normalizePublishedApprovalReviewer(snapshot.approvalReviewer),
                )
                .filter(Boolean),
        ),
    ).sort((left, right) => left.localeCompare(right, "zh-CN")),
);
const currentProjectPublishedApprovalReviewerOptions = computed(() => [
    { value: "all", label: "全部审批人" },
    {
        value: PUBLISHED_APPROVAL_REVIEWER_FILTER_UNASSIGNED,
        label: "未分配审批人",
    },
    ...currentProjectPublishedApprovalReviewers.value.map((reviewer) => ({
        value: reviewer,
        label: reviewer,
    })),
]);
const currentProjectPublishedApprovalStats = computed(() => {
    const snapshots = currentProjectPublishedSnapshots.value;
    const total = snapshots.length;
    const pending = snapshots.filter(
        (item) => normalizePublishedApprovalStatus(item.approvalStatus) === "pending",
    ).length;
    const approved = snapshots.filter(
        (item) =>
            normalizePublishedApprovalStatus(item.approvalStatus) === "approved",
    ).length;
    const rejected = snapshots.filter(
        (item) =>
            normalizePublishedApprovalStatus(item.approvalStatus) === "rejected",
    ).length;
    const assignedReviewerCount = snapshots.filter((item) =>
        Boolean(normalizePublishedApprovalReviewer(item.approvalReviewer)),
    ).length;
    const unassignedReviewerCount = Math.max(total - assignedReviewerCount, 0);

    return {
        total,
        pending,
        approved,
        rejected,
        assignedReviewerCount,
        unassignedReviewerCount,
        uniqueReviewerCount: currentProjectPublishedApprovalReviewers.value.length,
    };
});
const publishedSnapshotApprovalStatsCards = computed(() => [
    {
        key: "all",
        label: "全部版本",
        count: currentProjectPublishedApprovalStats.value.total,
        detail: currentProjectPublishedApprovalStats.value.uniqueReviewerCount
            ? `${currentProjectPublishedApprovalStats.value.uniqueReviewerCount} 位审批人`
            : "尚未分配审批人",
        active:
            publishedSnapshotFilterApprovalStatus.value === "all" &&
            publishedSnapshotFilterApprovalReviewer.value === "all",
    },
    {
        key: "pending",
        label: "待审批",
        count: currentProjectPublishedApprovalStats.value.pending,
        detail: "等待处理",
        active: publishedSnapshotFilterApprovalStatus.value === "pending",
    },
    {
        key: "approved",
        label: "已通过",
        count: currentProjectPublishedApprovalStats.value.approved,
        detail: "已审核通过",
        active: publishedSnapshotFilterApprovalStatus.value === "approved",
    },
    {
        key: "rejected",
        label: "已驳回",
        count: currentProjectPublishedApprovalStats.value.rejected,
        detail: "需要重新处理",
        active: publishedSnapshotFilterApprovalStatus.value === "rejected",
    },
    {
        key: PUBLISHED_APPROVAL_REVIEWER_FILTER_UNASSIGNED,
        label: "未分配审批人",
        count: currentProjectPublishedApprovalStats.value.unassignedReviewerCount,
        detail: currentProjectPublishedApprovalStats.value.assignedReviewerCount
            ? `已分配 ${currentProjectPublishedApprovalStats.value.assignedReviewerCount} 个`
            : "全部待分配",
        active:
            publishedSnapshotFilterApprovalReviewer.value ===
            PUBLISHED_APPROVAL_REVIEWER_FILTER_UNASSIGNED,
    },
]);
const latestProjectPublishedSnapshot = computed(
    () =>
        [...currentProjectPublishedSnapshotLibrary.value].sort(
            (left, right) => right.updatedAt - left.updatedAt,
        )[0] ?? null,
);
const editingPublishedSnapshot = computed(
    () =>
        publishedSnapshots.value.find(
            (item) => item.id === editingPublishedSnapshotId.value,
        ) ?? null,
);
const publishedSnapshotDiffMap = computed(() =>
    Object.fromEntries(
        currentProjectPublishedSnapshots.value.map((snapshot) => [
            snapshot.id,
            buildPublishedSnapshotDiffSummary(snapshot, project.value),
        ]),
    ),
);
const filteredProjectPublishedSnapshots = computed(() => {
    const keyword = publishedSnapshotSearchKeyword.value.trim().toLocaleLowerCase();

    const filtered = currentProjectPublishedSnapshots.value.filter((snapshot) => {
        if (
            publishedSnapshotFilterEnvironment.value !== "all" &&
            snapshot.environment !== publishedSnapshotFilterEnvironment.value
        ) {
            return false;
        }

        if (
            publishedSnapshotFilterApprovalStatus.value !== "all" &&
            snapshot.approvalStatus !== publishedSnapshotFilterApprovalStatus.value
        ) {
            return false;
        }

        if (
            publishedSnapshotFilterApprovalReviewer.value ===
                PUBLISHED_APPROVAL_REVIEWER_FILTER_UNASSIGNED &&
            normalizePublishedApprovalReviewer(snapshot.approvalReviewer)
        ) {
            return false;
        }

        if (
            publishedSnapshotFilterApprovalReviewer.value !== "all" &&
            publishedSnapshotFilterApprovalReviewer.value !==
                PUBLISHED_APPROVAL_REVIEWER_FILTER_UNASSIGNED &&
            normalizePublishedApprovalReviewer(snapshot.approvalReviewer) !==
                publishedSnapshotFilterApprovalReviewer.value
        ) {
            return false;
        }

        if (
            publishedSnapshotFilterLockState.value === "locked" &&
            !snapshot.locked
        ) {
            return false;
        }

        if (
            publishedSnapshotFilterLockState.value === "unlocked" &&
            snapshot.locked
        ) {
            return false;
        }

        if (!keyword) {
            return true;
        }

        const searchableText = [
            snapshot.name,
            snapshot.note,
            snapshot.pageName,
            snapshot.projectName,
            formatPublishedEnvironmentLabel(snapshot.environment),
            formatPublishedApprovalStatusLabel(snapshot.approvalStatus),
            snapshot.approvalReviewer,
            snapshot.approvalComment,
            ...(snapshot.tags ?? []),
        ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase();

        return searchableText.includes(keyword);
    });

    return sortPublishedSnapshotCollection(
        filtered,
        publishedSnapshotSortMode.value,
    );
});
const hasPublishedSnapshotFilters = computed(
    () =>
        Boolean(publishedSnapshotSearchKeyword.value.trim()) ||
        publishedSnapshotFilterEnvironment.value !== "all" ||
        publishedSnapshotFilterApprovalStatus.value !== "all" ||
        publishedSnapshotFilterApprovalReviewer.value !== "all" ||
        publishedSnapshotFilterLockState.value !== "all" ||
        publishedSnapshotSortMode.value !== PUBLISHED_SORT_OPTIONS[0].value,
);
const filteredProjectPublishedRollbackLogs = computed(() => {
    const keyword = publishedRollbackSearchKeyword.value.trim().toLocaleLowerCase();

    return currentProjectPublishedRollbackLogs.value.filter((log) => {
        if (
            publishedRollbackFilterEnvironment.value !== "all" &&
            log.environment !== publishedRollbackFilterEnvironment.value
        ) {
            return false;
        }

        const linked = currentProjectPublishedSnapshotIdSet.value.has(log.snapshotId);

        if (publishedRollbackFilterRelation.value === "linked" && !linked) {
            return false;
        }

        if (publishedRollbackFilterRelation.value === "missing" && linked) {
            return false;
        }

        if (!keyword) {
            return true;
        }

        const searchableText = [
            log.snapshotName,
            log.pageName,
            log.projectName,
            log.summary,
            formatPublishedEnvironmentLabel(log.environment),
            ...(log.tags ?? []),
        ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase();

        return searchableText.includes(keyword);
    });
});
const hasPublishedRollbackFilters = computed(
    () =>
        Boolean(publishedRollbackSearchKeyword.value.trim()) ||
        publishedRollbackFilterEnvironment.value !== "all" ||
        publishedRollbackFilterRelation.value !== "all",
);
const filteredProjectPublishedOperationLogs = computed(() => {
    const keyword = publishedOperationSearchKeyword.value
        .trim()
        .toLocaleLowerCase();

    return currentProjectPublishedOperationLogs.value.filter((log) => {
        if (
            publishedOperationFilterAction.value !== "all" &&
            log.action !== publishedOperationFilterAction.value
        ) {
            return false;
        }

        if (!keyword) {
            return true;
        }

        const searchableText = [
            log.actionLabel,
            log.summary,
            log.detail,
            ...(log.snapshotNames ?? []),
        ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase();

        return searchableText.includes(keyword);
    });
});
const hasPublishedOperationFilters = computed(
    () =>
        Boolean(publishedOperationSearchKeyword.value.trim()) ||
        publishedOperationFilterAction.value !== "all",
);
const activePublishedOperationLog = computed(
    () =>
        publishedOperationLogs.value.find(
            (item) => item.id === dialogOperationLogId.value,
        ) ?? null,
);
const activePublishedOperationLogDetailText = computed(() =>
    activePublishedOperationLog.value
        ? JSON.stringify(activePublishedOperationLog.value, null, 2)
        : "",
);
const selectedPublishedSnapshotSet = computed(
    () => new Set(selectedPublishedSnapshotIds.value),
);
const selectedProjectPublishedSnapshots = computed(() =>
    currentProjectPublishedSnapshots.value.filter((snapshot) =>
        selectedPublishedSnapshotSet.value.has(snapshot.id),
    ),
);
const selectedFilteredPublishedSnapshots = computed(() =>
    filteredProjectPublishedSnapshots.value.filter((snapshot) =>
        selectedPublishedSnapshotSet.value.has(snapshot.id),
    ),
);
const selectedPublishedSnapshotCount = computed(
    () => selectedProjectPublishedSnapshots.value.length,
);
const selectedPublishedSnapshotLockedCount = computed(
    () => selectedProjectPublishedSnapshots.value.filter((item) => item.locked).length,
);
const selectedPublishedSnapshotUnlockedCount = computed(() =>
    Math.max(
        selectedPublishedSnapshotCount.value -
            selectedPublishedSnapshotLockedCount.value,
        0,
    ),
);
const selectedPublishedSnapshotPinnedCount = computed(
    () => selectedProjectPublishedSnapshots.value.filter((item) => item.pinned).length,
);
const selectedPublishedSnapshotUnpinnedCount = computed(() =>
    Math.max(
        selectedPublishedSnapshotCount.value -
            selectedPublishedSnapshotPinnedCount.value,
        0,
    ),
);
const selectedPublishedSnapshotPendingCount = computed(
    () =>
        selectedProjectPublishedSnapshots.value.filter(
            (item) =>
                normalizePublishedApprovalStatus(item.approvalStatus) === "pending",
        ).length,
);
const selectedPublishedSnapshotApprovedCount = computed(
    () =>
        selectedProjectPublishedSnapshots.value.filter(
            (item) =>
                normalizePublishedApprovalStatus(item.approvalStatus) ===
                "approved",
        ).length,
);
const selectedPublishedSnapshotRejectedCount = computed(
    () =>
        selectedProjectPublishedSnapshots.value.filter(
            (item) =>
                normalizePublishedApprovalStatus(item.approvalStatus) ===
                "rejected",
        ).length,
);
const selectedPublishedSnapshotApprovableCount = computed(
    () =>
        selectedProjectPublishedSnapshots.value.filter(
            (item) =>
                !item.locked &&
                normalizePublishedApprovalStatus(item.approvalStatus) !==
                    "approved",
        ).length,
);
const selectedPublishedSnapshotRejectableCount = computed(
    () =>
        selectedProjectPublishedSnapshots.value.filter(
            (item) =>
                !item.locked &&
                normalizePublishedApprovalStatus(item.approvalStatus) !==
                    "rejected",
        ).length,
);
const isAllFilteredPublishedSnapshotsSelected = computed(
    () =>
        Boolean(filteredProjectPublishedSnapshots.value.length) &&
        selectedFilteredPublishedSnapshots.value.length ===
            filteredProjectPublishedSnapshots.value.length,
);
const canBatchApplyPublishedSnapshotMeta = computed(
    () =>
        selectedPublishedSnapshotUnlockedCount.value > 0 &&
        (
            publishedSnapshotBatchApplyNote.value ||
            publishedSnapshotBatchApplyTags.value ||
            publishedSnapshotBatchApplyEnvironment.value ||
            publishedSnapshotBatchApplyApprovalStatus.value
        ),
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

function collectReferencedAssetsFromProject(projectData) {
    const projectSnapshot =
        typeof projectData === "string"
            ? projectData
            : JSON.stringify(projectData ?? {});

    return assetLibrary.value.filter((asset) =>
        projectSnapshot.includes(asset.reference),
    );
}

async function buildProjectExportPayload(projectData) {
    if (!assetLibraryReady.value) {
        await loadAssetLibrary({ silent: true });
    }

    const sanitizedProject = sanitizeProjectSourceSecrets(projectData);
    const referencedAssets = collectReferencedAssetsFromProject(sanitizedProject);
    const serializedAssets = await serializeAssetRecords(referencedAssets);

    return JSON.stringify(
        {
            type: PROJECT_EXPORT_PACKAGE_TYPE,
            version: PROJECT_EXPORT_PACKAGE_VERSION,
            exportedAt: Date.now(),
            project: sanitizedProject,
            assets: serializedAssets,
        },
        null,
        2,
    );
}

function parseImportedProjectPayload(text) {
    const parsed = JSON.parse(text);

    if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        parsed.project
    ) {
        return {
            project: normalizeProjectSchema(parsed.project),
            assets: deserializeAssetPackageRecords(parsed.assets),
            packageType: String(parsed.type || "").trim(),
            packageVersion: Number(parsed.version) || 1,
        };
    }

    return {
        project: normalizeProjectSchema(parsed),
        assets: [],
        packageType: "",
        packageVersion: 0,
    };
}

async function importProjectEmbeddedAssets(assetRecords = []) {
    const normalizedAssets = (Array.isArray(assetRecords) ? assetRecords : []).filter(
        Boolean,
    );

    if (!normalizedAssets.length) {
        return 0;
    }

    await putAssetRecords(normalizedAssets);
    await loadAssetLibrary({ silent: true });
    return normalizedAssets.length;
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

function createPublishedRollbackLogId() {
    return (
        globalThis.crypto?.randomUUID?.() ??
        `rollback-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
}

function createUniquePublishedSnapshotId(usedIds) {
    let nextId = createPublishedSnapshotId();

    while (usedIds.has(nextId)) {
        nextId = createPublishedSnapshotId();
    }

    usedIds.add(nextId);
    return nextId;
}

function createUniquePublishedRollbackLogId(usedIds) {
    let nextId = createPublishedRollbackLogId();

    while (usedIds.has(nextId)) {
        nextId = createPublishedRollbackLogId();
    }

    usedIds.add(nextId);
    return nextId;
}

function normalizePublishedEnvironment(value) {
    return PUBLISHED_ENVIRONMENT_LABEL_MAP[value]
        ? value
        : DEFAULT_PUBLISHED_ENVIRONMENT;
}

function normalizePublishedApprovalStatus(value) {
    return PUBLISHED_APPROVAL_STATUS_LABEL_MAP[value]
        ? value
        : DEFAULT_PUBLISHED_APPROVAL_STATUS;
}

function normalizePublishedApprovalReviewer(value) {
    return String(value || "").trim().slice(0, 32);
}

function normalizePublishedApprovalComment(value) {
    return String(value || "").trim().slice(0, 240);
}

function normalizePublishedTagList(rawTags) {
    const entries = Array.isArray(rawTags)
        ? rawTags
        : typeof rawTags === "string"
          ? rawTags.split(/[,\n，、|]/)
          : [];

    return Array.from(
        new Set(
            entries
                .map((item) => String(item || "").trim())
                .filter(Boolean)
                .slice(0, 8),
        ),
    );
}

function formatPublishedTagList(tags) {
    return normalizePublishedTagList(tags).join(", ");
}

function formatPublishedEnvironmentLabel(value) {
    return (
        PUBLISHED_ENVIRONMENT_LABEL_MAP[normalizePublishedEnvironment(value)] ??
        PUBLISHED_ENVIRONMENT_LABEL_MAP[DEFAULT_PUBLISHED_ENVIRONMENT]
    );
}

function formatPublishedApprovalStatusLabel(value) {
    return (
        PUBLISHED_APPROVAL_STATUS_LABEL_MAP[
            normalizePublishedApprovalStatus(value)
        ] ?? PUBLISHED_APPROVAL_STATUS_LABEL_MAP[DEFAULT_PUBLISHED_APPROVAL_STATUS]
    );
}

function createPublishedApprovalHistoryId() {
    return `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createPublishedApprovalHistoryEntry(options = {}) {
    const status = normalizePublishedApprovalStatus(options.status);
    const reviewer = normalizePublishedApprovalReviewer(options.reviewer);
    const comment = normalizePublishedApprovalComment(options.comment);
    const changedAt = Number.isFinite(Number(options.changedAt))
        ? Number(options.changedAt)
        : Date.now();

    return {
        id:
            typeof options.id === "string" && options.id.trim()
                ? options.id.trim()
                : createPublishedApprovalHistoryId(),
        status,
        reviewer,
        comment,
        changedAt,
    };
}

function normalizePublishedApprovalHistory(rawHistory, fallback = {}) {
    const normalizedHistory = (Array.isArray(rawHistory) ? rawHistory : [])
        .map((item) => {
            if (!item || typeof item !== "object") {
                return null;
            }

            return createPublishedApprovalHistoryEntry({
                id: item.id,
                status: item.status,
                reviewer: item.reviewer,
                comment: item.comment,
                changedAt: item.changedAt,
            });
        })
        .filter(Boolean)
        .sort((left, right) => right.changedAt - left.changedAt)
        .slice(0, PUBLISHED_APPROVAL_HISTORY_LIMIT);

    if (normalizedHistory.length) {
        return normalizedHistory;
    }

    return [
        createPublishedApprovalHistoryEntry({
            status: fallback.status,
            reviewer: fallback.reviewer,
            comment: fallback.comment,
            changedAt: fallback.changedAt,
        }),
    ];
}

function applyPublishedApprovalMeta(snapshot, options = {}) {
    const nextStatus = normalizePublishedApprovalStatus(
        options.approvalStatus ?? snapshot.approvalStatus,
    );
    const nextReviewer = normalizePublishedApprovalReviewer(
        options.approvalReviewer ?? snapshot.approvalReviewer,
    );
    const nextComment = normalizePublishedApprovalComment(
        options.approvalComment ?? snapshot.approvalComment,
    );
    const previousHistory = normalizePublishedApprovalHistory(
        snapshot.approvalHistory,
        {
            status: snapshot.approvalStatus,
            reviewer: snapshot.approvalReviewer,
            comment: snapshot.approvalComment,
            changedAt: snapshot.approvalUpdatedAt ?? snapshot.updatedAt,
        },
    );
    const changed =
        nextStatus !== normalizePublishedApprovalStatus(snapshot.approvalStatus) ||
        nextReviewer !== normalizePublishedApprovalReviewer(snapshot.approvalReviewer) ||
        nextComment !== normalizePublishedApprovalComment(snapshot.approvalComment);
    const changedAt = changed
        ? Date.now()
        : Number(snapshot.approvalUpdatedAt) || Number(snapshot.updatedAt) || Date.now();

    return {
        approvalChanged: changed,
        approvalStatus: nextStatus,
        approvalReviewer: nextReviewer,
        approvalComment: nextComment,
        approvalUpdatedAt: changedAt,
        approvalHistory: changed
            ? [
                  createPublishedApprovalHistoryEntry({
                      status: nextStatus,
                      reviewer: nextReviewer,
                      comment: nextComment,
                      changedAt,
                  }),
                  ...previousHistory,
              ].slice(0, PUBLISHED_APPROVAL_HISTORY_LIMIT)
            : previousHistory,
    };
}

function buildPublishedApprovalSummary(status, reviewer = "", comment = "") {
    return [
        formatPublishedApprovalStatusLabel(status),
        reviewer ? `审批人：${reviewer}` : "",
        comment
            ? `${
                  normalizePublishedApprovalStatus(status) === "rejected"
                      ? "驳回原因"
                      : "审批说明"
              }：${comment}`
            : "",
    ]
        .filter(Boolean)
        .join(" · ");
}

function getPublishedApprovalCommentLabel(status) {
    return normalizePublishedApprovalStatus(status) === "rejected"
        ? "驳回原因"
        : "审批说明";
}

function getPublishedApprovalCommentPlaceholder(status) {
    return normalizePublishedApprovalStatus(status) === "rejected"
        ? "请输入驳回原因，便于后续回溯"
        : "可选：记录审批意见、审核说明或发布要求";
}

function sortPublishedSnapshotCollection(
    snapshots,
    sortMode = PUBLISHED_SORT_OPTIONS[0].value,
) {
    const normalizedList = Array.isArray(snapshots) ? [...snapshots] : [];

    return normalizedList.sort((left, right) => {
        if (Boolean(left.pinned) !== Boolean(right.pinned)) {
            return left.pinned ? -1 : 1;
        }

        if (left.pinned && right.pinned) {
            const leftPinnedAt = Number(left.pinnedAt) || Number(left.updatedAt) || 0;
            const rightPinnedAt =
                Number(right.pinnedAt) || Number(right.updatedAt) || 0;

            if (leftPinnedAt !== rightPinnedAt) {
                return rightPinnedAt - leftPinnedAt;
            }
        }

        if (sortMode === "pinned-oldest") {
            if (left.updatedAt !== right.updatedAt) {
                return left.updatedAt - right.updatedAt;
            }
        } else if (sortMode === "pinned-name") {
            const nameCompare = String(left.name || "").localeCompare(
                String(right.name || ""),
                "zh-CN",
            );

            if (nameCompare !== 0) {
                return nameCompare;
            }
        } else if (left.updatedAt !== right.updatedAt) {
            return right.updatedAt - left.updatedAt;
        }

        return String(left.id || "").localeCompare(String(right.id || ""), "zh-CN");
    });
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
        const createdAt = Number.isFinite(Number(rawRecord.createdAt))
            ? Number(rawRecord.createdAt)
            : Date.now();
        const updatedAt = Number.isFinite(Number(rawRecord.updatedAt))
            ? Number(rawRecord.updatedAt)
            : Date.now();
        const approvalReviewer = normalizePublishedApprovalReviewer(
            rawRecord.approvalReviewer,
        );
        const approvalComment = normalizePublishedApprovalComment(
            rawRecord.approvalComment,
        );
        const approvalStatus = normalizePublishedApprovalStatus(
            rawRecord.approvalStatus,
        );
        const approvalUpdatedAt = Number.isFinite(Number(rawRecord.approvalUpdatedAt))
            ? Number(rawRecord.approvalUpdatedAt)
            : updatedAt;

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
            note:
                typeof rawRecord.note === "string"
                    ? rawRecord.note.trim()
                    : "",
            environment: normalizePublishedEnvironment(rawRecord.environment),
            approvalStatus,
            approvalReviewer,
            approvalComment,
            approvalUpdatedAt,
            approvalHistory: normalizePublishedApprovalHistory(
                rawRecord.approvalHistory,
                {
                    status: approvalStatus,
                    reviewer: approvalReviewer,
                    comment: approvalComment,
                    changedAt: approvalUpdatedAt,
                },
            ),
            tags: normalizePublishedTagList(rawRecord.tags),
            locked: Boolean(rawRecord.locked),
            pinned: Boolean(rawRecord.pinned),
            pinnedAt:
                Boolean(rawRecord.pinned) &&
                Number.isFinite(Number(rawRecord.pinnedAt))
                    ? Number(rawRecord.pinnedAt)
                    : 0,
            createdAt,
            updatedAt,
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

        return sortPublishedSnapshotCollection(
            parsed
                .map((item, index) => normalizePublishedSnapshotRecord(item, index))
                .filter(Boolean),
        );
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

function normalizePublishedRollbackLogRecord(rawRecord, index = 0) {
    if (!rawRecord || typeof rawRecord !== "object") {
        return null;
    }

    const snapshotId =
        typeof rawRecord.snapshotId === "string" && rawRecord.snapshotId
            ? rawRecord.snapshotId
            : "";

    if (!snapshotId) {
        return null;
    }

    return {
        id:
            typeof rawRecord.id === "string" && rawRecord.id
                ? rawRecord.id
                : `rollback-${index + 1}`,
        projectRecordId:
            typeof rawRecord.projectRecordId === "string"
                ? rawRecord.projectRecordId
                : "",
        projectName:
            typeof rawRecord.projectName === "string"
                ? rawRecord.projectName.trim()
                : "",
        snapshotId,
        snapshotName:
            typeof rawRecord.snapshotName === "string"
                ? rawRecord.snapshotName.trim()
                : "未命名发布版本",
        pageId:
            typeof rawRecord.pageId === "string" ? rawRecord.pageId : "",
        pageName:
            typeof rawRecord.pageName === "string"
                ? rawRecord.pageName.trim()
                : "未命名页面",
        environment: normalizePublishedEnvironment(rawRecord.environment),
        tags: normalizePublishedTagList(rawRecord.tags),
        summary:
            typeof rawRecord.summary === "string"
                ? rawRecord.summary.trim()
                : "",
        rolledBackAt: Number.isFinite(Number(rawRecord.rolledBackAt))
            ? Number(rawRecord.rolledBackAt)
            : Date.now(),
    };
}

function loadPublishedRollbackLogLibrary() {
    if (typeof localStorage === "undefined") {
        return [];
    }

    const rawValue = localStorage.getItem(PUBLISHED_ROLLBACK_LOG_STORAGE_KEY);

    if (!rawValue) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawValue);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map((item, index) => normalizePublishedRollbackLogRecord(item, index))
            .filter(Boolean)
            .sort((left, right) => right.rolledBackAt - left.rolledBackAt)
            .slice(0, PUBLISHED_ROLLBACK_LOG_LIMIT);
    } catch (error) {
        console.warn(error);
        return [];
    }
}

function persistPublishedRollbackLogLibrary(library) {
    if (typeof localStorage === "undefined") {
        return;
    }

    localStorage.setItem(
        PUBLISHED_ROLLBACK_LOG_STORAGE_KEY,
        JSON.stringify(library.slice(0, PUBLISHED_ROLLBACK_LOG_LIMIT)),
    );
}

function createPublishedOperationLogId() {
    return (
        globalThis.crypto?.randomUUID?.() ??
        `publish-operation-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
}

function formatPublishedOperationActionLabel(action) {
    return (
        PUBLISHED_OPERATION_ACTION_LABEL_MAP[String(action || "").trim()] ??
        "发布操作"
    );
}

function normalizePublishedOperationLogRecord(rawRecord, index = 0) {
    if (!rawRecord || typeof rawRecord !== "object") {
        return null;
    }

    const action =
        typeof rawRecord.action === "string" && rawRecord.action.trim()
            ? rawRecord.action.trim()
            : "unknown";
    const snapshotIds = Array.from(
        new Set(
            (Array.isArray(rawRecord.snapshotIds) ? rawRecord.snapshotIds : [])
                .map((item) => String(item || "").trim())
                .filter(Boolean),
        ),
    ).slice(0, 12);
    const snapshotNames = Array.from(
        new Set(
            (
                Array.isArray(rawRecord.snapshotNames)
                    ? rawRecord.snapshotNames
                    : typeof rawRecord.snapshotName === "string"
                      ? [rawRecord.snapshotName]
                      : []
            )
                .map((item) => String(item || "").trim())
                .filter(Boolean),
        ),
    ).slice(0, 12);

    return {
        id:
            typeof rawRecord.id === "string" && rawRecord.id
                ? rawRecord.id
                : `publish-operation-${index + 1}`,
        projectRecordId:
            typeof rawRecord.projectRecordId === "string"
                ? rawRecord.projectRecordId
                : "",
        projectName:
            typeof rawRecord.projectName === "string"
                ? rawRecord.projectName.trim()
                : "",
        action,
        actionLabel:
            typeof rawRecord.actionLabel === "string" &&
            rawRecord.actionLabel.trim()
                ? rawRecord.actionLabel.trim()
                : formatPublishedOperationActionLabel(action),
        summary:
            typeof rawRecord.summary === "string"
                ? rawRecord.summary.trim()
                : "",
        detail:
            typeof rawRecord.detail === "string"
                ? rawRecord.detail.trim()
                : "",
        snapshotIds,
        snapshotNames,
        createdAt: Number.isFinite(Number(rawRecord.createdAt))
            ? Number(rawRecord.createdAt)
            : Date.now(),
    };
}

function loadPublishedOperationLogLibrary() {
    if (typeof localStorage === "undefined") {
        return [];
    }

    const rawValue = localStorage.getItem(PUBLISHED_OPERATION_LOG_STORAGE_KEY);

    if (!rawValue) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawValue);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map((item, index) => normalizePublishedOperationLogRecord(item, index))
            .filter(Boolean)
            .sort((left, right) => right.createdAt - left.createdAt)
            .slice(0, PUBLISHED_OPERATION_LOG_LIMIT);
    } catch (error) {
        console.warn(error);
        return [];
    }
}

function persistPublishedOperationLogLibrary(library) {
    if (typeof localStorage === "undefined") {
        return;
    }

    localStorage.setItem(
        PUBLISHED_OPERATION_LOG_STORAGE_KEY,
        JSON.stringify(library.slice(0, PUBLISHED_OPERATION_LOG_LIMIT)),
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
    const now = Date.now();
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

    const approvalStatus = normalizePublishedApprovalStatus(options.approvalStatus);
    const approvalReviewer = normalizePublishedApprovalReviewer(
        options.approvalReviewer,
    );
    const approvalComment = normalizePublishedApprovalComment(
        options.approvalComment,
    );

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
        note:
            typeof options.note === "string" ? options.note.trim() : "",
        environment: normalizePublishedEnvironment(options.environment),
        approvalStatus,
        approvalReviewer,
        approvalComment,
        approvalUpdatedAt: now,
        approvalHistory: [
            createPublishedApprovalHistoryEntry({
                status: approvalStatus,
                reviewer: approvalReviewer,
                comment: approvalComment,
                changedAt: now,
            }),
        ],
        tags: normalizePublishedTagList(options.tags),
        locked: Boolean(options.locked),
        pinned: Boolean(options.pinned),
        pinnedAt:
            Boolean(options.pinned) && Number.isFinite(Number(options.pinnedAt))
                ? Number(options.pinnedAt)
                : 0,
        createdAt: now,
        updatedAt: now,
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

    const persistedSnapshot = persistEditorProjectState(project.value);

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

function resolveAssetReference(value = "") {
    const normalizedValue = String(value || "").trim();
    const assetId = parseAssetReference(normalizedValue);

    if (!assetId) {
        return normalizedValue;
    }

    return assetPreviewUrlMap.value[assetId] ?? "";
}

provide("resolveAssetReference", resolveAssetReference);

function getAssetKindLabel(kind = "") {
    return (
        ASSET_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? "资源"
    );
}

function getAssetBaseName(name = "") {
    return String(name || "")
        .trim()
        .replace(/\.[^.]+$/, "");
}

function getAssetById(assetId = "") {
    return assetLibrary.value.find((item) => item.id === assetId) ?? null;
}

function getAssetUsageInfo(assetId = "") {
    return (
        assetUsageMap.value[assetId] ?? {
            currentProjectUsed: 0,
            currentProjectEntries: [],
            currentProjectEntryCount: 0,
            projectRecordEntries: [],
            projectRecordCount: 0,
            projectRecordEntryCount: 0,
            publishedSnapshotEntries: [],
            publishedSnapshotCount: 0,
            publishedSnapshotEntryCount: 0,
            total: 0,
            totalEntries: 0,
            totalScopes: 0,
        }
    );
}

function getAssetUsageSections(assetId = "") {
    const usage = getAssetUsageInfo(assetId);

    return [
        {
            key: "current-project",
            label: "当前项目",
            entries: usage.currentProjectEntries,
        },
        {
            key: "project-record",
            label: "项目快照",
            entries: usage.projectRecordEntries,
        },
        {
            key: "published-snapshot",
            label: "发布版本",
            entries: usage.publishedSnapshotEntries,
        },
    ].filter((section) => section.entries.length > 0);
}

function buildAssetUsageLabel(assetId = "") {
    const usage = getAssetUsageInfo(assetId);

    if (!usage.total) {
        return "未被当前项目、快照或发布版本引用";
    }

    return [
        usage.currentProjectEntryCount
            ? `当前项目 ${usage.currentProjectEntryCount} 处`
            : "",
        usage.projectRecordEntryCount
            ? `项目快照 ${usage.projectRecordCount} 版 / ${usage.projectRecordEntryCount} 处`
            : "",
        usage.publishedSnapshotEntryCount
            ? `发布版本 ${usage.publishedSnapshotCount} 版 / ${usage.publishedSnapshotEntryCount} 处`
            : "",
    ]
        .filter(Boolean)
        .join(" · ");
}

function resetExpandedAssetUsageIds() {
    expandedAssetUsageIds.value = [];
}

function isAssetUsageExpanded(assetId = "") {
    return expandedAssetUsageIds.value.includes(String(assetId || "").trim());
}

function toggleAssetUsageExpanded(assetId = "") {
    const normalizedId = String(assetId || "").trim();

    if (!normalizedId) {
        return false;
    }

    const nextIds = new Set(expandedAssetUsageIds.value);

    if (nextIds.has(normalizedId)) {
        nextIds.delete(normalizedId);
    } else {
        nextIds.add(normalizedId);
    }

    expandedAssetUsageIds.value = Array.from(nextIds);
    return true;
}

function buildAssetUsageToggleLabel(assetId = "") {
    const usage = getAssetUsageInfo(assetId);

    if (!usage.totalEntries) {
        return "查看引用";
    }

    return isAssetUsageExpanded(assetId)
        ? "收起引用"
        : `查看引用（${usage.totalEntries} 处）`;
}

function canLocateAssetUsageEntry(entry = {}) {
    const scopeType = String(entry?.scopeType || "").trim();
    const locationType = String(entry?.locationType || "").trim();

    if (scopeType === "published-snapshot") {
        return Boolean(String(entry?.scopeId || "").trim());
    }

    return (
        (scopeType === "current-project" || scopeType === "project-record") &&
        (locationType === "page" || locationType === "widget")
    );
}

function getAssetUsageEntryActionLabel(entry = {}) {
    const scopeType = String(entry?.scopeType || "").trim();
    const locationType = String(entry?.locationType || "").trim();
    const needOpenProject =
        scopeType === "project-record" &&
        String(entry?.scopeId || "").trim() !== activeProjectRecordId.value;

    if (scopeType === "published-snapshot") {
        return "查看版本";
    }

    if (locationType === "page") {
        return needOpenProject ? "打开页面" : "定位页面";
    }

    return needOpenProject ? "打开定位" : "定位组件";
}

function prepareAssetUsageEditorLocation() {
    if (isRuntimeMode.value) {
        appMode.value = "editor";
        runtimePageId.value = "";
    }

    if (previewMode.value) {
        previewMode.value = false;
    }
}

function locateAssetUsageInCurrentProject(entry = {}) {
    const locationType = String(entry?.locationType || "").trim();
    const pageId = String(entry?.pageId || "").trim();
    const targetPage = pageId
        ? project.value.pages.find((page) => page.id === pageId) ?? null
        : null;

    if (locationType === "page") {
        if (!targetPage) {
            statusMessage.value = "目标页面不存在，可能已经被删除";
            return false;
        }

        prepareAssetUsageEditorLocation();

        if (project.value.activePageId !== targetPage.id) {
            switchPage(targetPage.id);
        }

        sanitizeSelection([], null);
        statusMessage.value = `已定位到页面：${targetPage.name}`;
        return true;
    }

    if (locationType !== "widget") {
        statusMessage.value = "当前引用类型暂不支持直接定位";
        return false;
    }

    const widgetId = String(entry?.widgetId || "").trim();
    const targetWidget = targetPage?.widgets.find(
        (widget) => widget.id === widgetId,
    ) ?? null;

    if (!targetPage || !targetWidget) {
        statusMessage.value = "引用组件不存在，可能已经被删除";
        return false;
    }

    prepareAssetUsageEditorLocation();

    if (project.value.activePageId !== targetPage.id) {
        switchPage(targetPage.id);
    }

    sanitizeSelection([targetWidget.id], targetWidget.id);
    flashLinkedWidgets([targetWidget.id]);
    statusMessage.value = `已定位到 ${targetPage.name} / ${targetWidget.name}`;
    return true;
}

async function locateAssetUsageEntry(entry = {}) {
    if (!canLocateAssetUsageEntry(entry)) {
        statusMessage.value = "当前引用项暂不支持直接定位";
        return false;
    }

    const scopeType = String(entry?.scopeType || "").trim();

    if (scopeType === "published-snapshot") {
        const snapshot =
            publishedSnapshots.value.find(
                (item) => item.id === entry.scopeId,
            ) ?? null;

        if (!snapshot) {
            statusMessage.value = "关联发布版本不存在，无法定位";
            return false;
        }

        if (
            snapshot.projectRecordId &&
            snapshot.projectRecordId !== activeProjectRecordId.value
        ) {
            const targetRecord =
                projectLibrary.value.find(
                    (item) => item.id === snapshot.projectRecordId,
                ) ?? null;

            if (!targetRecord) {
                statusMessage.value = "关联项目已不存在，无法打开对应发布版本";
                return false;
            }

            openProjectRecord(snapshot.projectRecordId, {
                statusMessage: "",
            });
            await nextTick();
        }

        const visibleSnapshot =
            currentProjectPublishedSnapshotLibrary.value.find(
                (item) => item.id === snapshot.id,
            ) ?? null;

        if (!visibleSnapshot) {
            statusMessage.value = "当前发布版本不在活动项目下，暂时无法定位";
            return false;
        }

        openPublishManagerDialog();
        publishDiffSnapshotId.value = snapshot.id;
        approvalTimelineSnapshotId.value = "";
        pendingRollbackSnapshotId.value = "";
        setSelectedPublishedSnapshotIds(
            [snapshot.id],
            currentProjectPublishedSnapshotLibrary.value,
        );
        statusMessage.value = `已定位到发布版本：${snapshot.name}`;
        return true;
    }

    if (
        scopeType === "project-record" &&
        entry.scopeId &&
        entry.scopeId !== activeProjectRecordId.value
    ) {
        const targetRecord =
            projectLibrary.value.find((item) => item.id === entry.scopeId) ?? null;

        if (!targetRecord) {
            statusMessage.value = "关联项目快照不存在，无法定位";
            return false;
        }

        openProjectRecord(entry.scopeId, {
            statusMessage: "",
        });
        await nextTick();
        return locateAssetUsageInCurrentProject(entry);
    }

    closeDialog();
    await nextTick();
    return locateAssetUsageInCurrentProject(entry);
}

function getMissingAssetReferenceEntries(assetId = "") {
    const normalizedId = String(assetId || "").trim();
    return missingAssetReferenceEntriesByAssetId.value[normalizedId] ?? [];
}

function getMissingAssetReferenceRepairCount(assetId = "") {
    return getMissingAssetReferenceEntries(assetId).length;
}

function inferMissingAssetExpectedKinds(entries = []) {
    const expectedKinds = new Set();

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
        const widgetType = String(entry?.widgetType || "").trim();
        const fieldPaths = Array.isArray(entry?.fieldPaths)
            ? entry.fieldPaths
            : [];

        if (widgetType === "image") {
            expectedKinds.add("image");
            return;
        }

        if (widgetType === "video") {
            if (fieldPaths.some((path) => /poster/i.test(path))) {
                expectedKinds.add("image");
            }

            if (
                fieldPaths.some(
                    (path) => /(^|\.)(src|source|url)(\[|\]|\.|$)/i.test(path),
                )
            ) {
                expectedKinds.add("video");
            }
        }
    });

    return Array.from(expectedKinds);
}

function getMissingAssetReferenceExpectedKinds(assetId = "") {
    return inferMissingAssetExpectedKinds(
        getMissingAssetReferenceEntries(assetId),
    );
}

function getMissingAssetRepairAccept(entry = {}) {
    const expectedKinds = getMissingAssetReferenceExpectedKinds(entry?.assetId);

    if (expectedKinds.length === 1) {
        return expectedKinds[0] === "image" ? "image/*" : "video/*";
    }

    return "image/*,video/*";
}

function buildMissingAssetRepairHint(entry = {}) {
    const expectedKinds = getMissingAssetReferenceExpectedKinds(entry?.assetId);

    if (expectedKinds.length === 1) {
        return expectedKinds[0] === "image"
            ? "建议上传图片文件进行回填"
            : "建议上传视频文件进行回填";
    }

    return "支持上传图片或视频文件回填";
}

async function handleMissingAssetRepairUpload(entry = {}, event) {
    const input = event?.target ?? null;
    const file = Array.from(input?.files ?? [])[0] ?? null;
    const assetId = String(
        entry?.assetId || parseAssetReference(entry?.reference),
    ).trim();
    const relatedEntryCount = getMissingAssetReferenceRepairCount(assetId);
    const relatedExpectedKinds = getMissingAssetReferenceExpectedKinds(assetId);

    if (!assetId) {
        statusMessage.value = "缺失资源标识无效，暂时无法修复";

        if (input) {
            input.value = "";
        }

        return false;
    }

    if (!(file instanceof File)) {
        return false;
    }

    const kind = inferAssetKind(file);

    if (!kind) {
        statusMessage.value = "仅支持上传图片或视频文件修复缺失资源";

        if (input) {
            input.value = "";
        }

        return false;
    }

    if (
        relatedExpectedKinds.length === 1 &&
        !relatedExpectedKinds.includes(kind)
    ) {
        statusMessage.value =
            relatedExpectedKinds[0] === "image"
                ? "该缺失引用更像是图片资源，请上传图片文件修复"
                : "该缺失引用更像是视频资源，请上传视频文件修复";

        if (input) {
            input.value = "";
        }

        return false;
    }

    if (getAssetById(assetId)) {
        await loadAssetLibrary({ silent: true });
        statusMessage.value = "资源已经存在，异常引用列表已同步刷新";

        if (input) {
            input.value = "";
        }

        return true;
    }

    const now = Date.now();

    assetLibraryLoading.value = true;

    try {
        await putAssetRecords([
            {
                id: assetId,
                name:
                    String(file.name || "").trim() ||
                    `${kind === "image" ? "图片" : "视频"}修复-${assetId.slice(-6)}`,
                kind,
                mimeType: String(file.type || "").trim(),
                size: Math.max(0, Number(file.size) || 0),
                tags: ["缺失修复"],
                createdAt: now,
                updatedAt: now,
                blob: file,
            },
        ]);
        const records = await loadAssetLibrary({ silent: true });
        setSelectedAssetIds([assetId], records);
        statusMessage.value = relatedEntryCount
            ? `已修复缺失资源 ${entry.reference}，恢复 ${relatedEntryCount} 处引用`
            : `已修复缺失资源 ${entry.reference}`;
        return true;
    } catch (error) {
        statusMessage.value = "缺失资源修复失败，请稍后重试";
        console.warn(error);
        return false;
    } finally {
        assetLibraryLoading.value = false;

        if (input) {
            input.value = "";
        }
    }
}

function resetAssetLibraryFilters() {
    assetLibrarySearchKeyword.value = "";
    assetLibraryFilterKind.value = ASSET_KIND_OPTIONS[0].value;
    assetLibraryFilterTag.value = "all";
}

function resetAssetBatchTagDraft() {
    assetBatchTagMode.value = ASSET_BATCH_TAG_MODE_OPTIONS[0].value;
    assetBatchTagDraft.value = "";
}

function resetAssetLibraryViewState() {
    assetLibraryViewMode.value = ASSET_LIBRARY_VIEW_MODE_OPTIONS[0].value;
    collapsedAssetGroupKeys.value = [];
}

function normalizeSelectedAssetIds(
    assetIds,
    assetCollection = assetLibrary.value,
) {
    const allowedIds = new Set(
        (Array.isArray(assetCollection) ? assetCollection : []).map(
            (item) => item.id,
        ),
    );

    return Array.from(
        new Set(
            (Array.isArray(assetIds) ? assetIds : [])
                .map((item) => String(item || "").trim())
                .filter((id) => allowedIds.has(id)),
        ),
    );
}

function setSelectedAssetIds(assetIds, assetCollection = assetLibrary.value) {
    selectedAssetIds.value = normalizeSelectedAssetIds(
        assetIds,
        assetCollection,
    );
}

function clearAssetSelection() {
    selectedAssetIds.value = [];
}

function cancelAssetRename() {
    assetEditingId.value = "";
    assetDraftName.value = "";
}

function cancelAssetTagEdit() {
    assetTagEditingId.value = "";
    assetTagDraftValue.value = "";
}

function setAssetLibraryTagFilter(tag = "all") {
    const normalizedTag = String(tag || "").trim();
    assetLibraryFilterTag.value = normalizedTag || "all";
}

function setAssetLibraryViewMode(mode = ASSET_LIBRARY_VIEW_MODE_OPTIONS[0].value) {
    const normalizedMode = String(mode || "").trim();
    const nextMode = ASSET_LIBRARY_VIEW_MODE_OPTIONS.some(
        (option) => option.value === normalizedMode,
    )
        ? normalizedMode
        : ASSET_LIBRARY_VIEW_MODE_OPTIONS[0].value;

    assetLibraryViewMode.value = nextMode;

    if (nextMode !== "grouped") {
        collapsedAssetGroupKeys.value = [];
    }
}

function toggleAssetGroupCollapsed(groupKey) {
    const normalizedKey = String(groupKey || "").trim();

    if (!normalizedKey) {
        return false;
    }

    const currentKeys = new Set(collapsedAssetGroupKeys.value);

    if (currentKeys.has(normalizedKey)) {
        currentKeys.delete(normalizedKey);
    } else {
        currentKeys.add(normalizedKey);
    }

    collapsedAssetGroupKeys.value = Array.from(currentKeys);
    return true;
}

function collapseAllAssetGroups() {
    collapsedAssetGroupKeys.value = assetLibraryGroupedSections.value.map(
        (section) => section.key,
    );
    return true;
}

function expandAllAssetGroups() {
    collapsedAssetGroupKeys.value = [];
    return true;
}

function syncAssetPreviewUrlMap(records = assetLibrary.value) {
    const nextMap = {};
    const activeIds = new Set();

    records.forEach((asset) => {
        if (!asset?.id) {
            return;
        }

        activeIds.add(asset.id);

        if (!(asset.blob instanceof Blob)) {
            return;
        }

        const cached = assetObjectUrlRegistry.get(asset.id);

        if (
            !cached ||
            cached.updatedAt !== asset.updatedAt ||
            cached.size !== asset.size
        ) {
            if (cached?.objectUrl) {
                URL.revokeObjectURL(cached.objectUrl);
            }

            assetObjectUrlRegistry.set(asset.id, {
                objectUrl: URL.createObjectURL(asset.blob),
                updatedAt: asset.updatedAt,
                size: asset.size,
            });
        }

        nextMap[asset.id] = assetObjectUrlRegistry.get(asset.id)?.objectUrl ?? "";
    });

    Array.from(assetObjectUrlRegistry.keys()).forEach((assetId) => {
        if (activeIds.has(assetId)) {
            return;
        }

        const cached = assetObjectUrlRegistry.get(assetId);

        if (cached?.objectUrl) {
            URL.revokeObjectURL(cached.objectUrl);
        }

        assetObjectUrlRegistry.delete(assetId);
    });

    assetPreviewUrlMap.value = nextMap;
}

function revokeAllAssetPreviewUrls() {
    assetObjectUrlRegistry.forEach((entry) => {
        if (entry?.objectUrl) {
            URL.revokeObjectURL(entry.objectUrl);
        }
    });
    assetObjectUrlRegistry.clear();
    assetPreviewUrlMap.value = {};
}

async function loadAssetLibrary(options = {}) {
    const currentToken = ++assetLibraryLoadToken;
    assetLibraryLoading.value = true;

    try {
        const records = await listAssetRecords();

        if (currentToken !== assetLibraryLoadToken) {
            return records;
        }

        assetLibrary.value = records;
        setSelectedAssetIds(selectedAssetIds.value, records);
        syncAssetPreviewUrlMap(records);
        assetLibraryReady.value = true;
        return records;
    } catch (error) {
        if (!options.silent) {
            statusMessage.value = "本地资源中心读取失败，请稍后重试";
        }
        console.warn(error);
        return [];
    } finally {
        if (currentToken === assetLibraryLoadToken) {
            assetLibraryLoading.value = false;
        }
    }
}

function openAssetLibraryDialog() {
    clearAssetSelection();
    resetAssetBatchTagDraft();
    resetAssetLibraryViewState();
    cancelAssetRename();
    cancelAssetTagEdit();
    resetAssetLibraryFilters();
    dialogMode.value = "asset-library";
    void loadAssetLibrary();
}

async function handleAssetLibraryUpload(event) {
    const input = event?.target ?? null;
    const files = Array.from(input?.files ?? []);

    if (!files.length) {
        return false;
    }

    const now = Date.now();
    const records = [];
    const skippedFiles = [];

    files.forEach((file, index) => {
        const kind = inferAssetKind(file);

        if (!kind) {
            skippedFiles.push(file.name || `文件 ${index + 1}`);
            return;
        }

        records.push({
            id: createAssetId(),
            name: String(file.name || `${kind}-${index + 1}`).trim(),
            kind,
            mimeType: file.type || "",
            size: Number(file.size) || 0,
            createdAt: now + index,
            updatedAt: now + index,
            blob: file,
        });
    });

    if (!records.length) {
        statusMessage.value = "仅支持上传图片和视频资源";

        if (input) {
            input.value = "";
        }

        return false;
    }

    assetLibraryLoading.value = true;

    try {
        await putAssetRecords(records);
        await loadAssetLibrary({ silent: true });
        assetLibraryUploadInputKey.value += 1;
        statusMessage.value = skippedFiles.length
            ? `已导入 ${records.length} 个资源，跳过 ${skippedFiles.length} 个不支持的文件`
            : `已导入 ${records.length} 个资源`;
        return true;
    } catch (error) {
        statusMessage.value = "资源上传失败，请稍后重试";
        console.warn(error);
        return false;
    } finally {
        assetLibraryLoading.value = false;

        if (input) {
            input.value = "";
        }
    }
}

function startAssetRename(assetId) {
    const asset = getAssetById(assetId);

    if (!asset) {
        statusMessage.value = "资源不存在，无法重命名";
        return false;
    }

    cancelAssetTagEdit();
    assetEditingId.value = asset.id;
    assetDraftName.value = asset.name;

    void nextTick(() => {
        const input = document.querySelector(
            `[data-asset-rename-input="${asset.id}"]`,
        );

        if (input instanceof HTMLInputElement) {
            input.focus();
            input.select();
        }
    });

    return true;
}

function startAssetTagEdit(assetId) {
    const asset = getAssetById(assetId);

    if (!asset) {
        statusMessage.value = "资源不存在，无法编辑标签";
        return false;
    }

    cancelAssetRename();
    assetTagEditingId.value = asset.id;
    assetTagDraftValue.value = Array.isArray(asset.tags)
        ? asset.tags.join(", ")
        : "";

    void nextTick(() => {
        const input = document.querySelector(
            `[data-asset-tag-input="${asset.id}"]`,
        );

        if (input instanceof HTMLInputElement) {
            input.focus();
            input.select();
        }
    });

    return true;
}

async function renameAssetInLibrary(assetId) {
    const asset = getAssetById(assetId);

    if (!asset) {
        statusMessage.value = "资源不存在，无法重命名";
        return false;
    }

    const nextName = assetDraftName.value.trim();

    if (!nextName) {
        statusMessage.value = "资源名称不能为空";
        return false;
    }

    if (nextName === asset.name) {
        cancelAssetRename();
        return true;
    }

    assetLibraryLoading.value = true;

    try {
        await putAssetRecords([
            {
                ...asset,
                name: nextName,
                updatedAt: Date.now(),
            },
        ]);
        await loadAssetLibrary({ silent: true });
        cancelAssetRename();
        statusMessage.value = `已重命名资源：${nextName}`;
        return true;
    } catch (error) {
        statusMessage.value = "资源重命名失败，请稍后重试";
        console.warn(error);
        return false;
    } finally {
        assetLibraryLoading.value = false;
    }
}

async function saveAssetTags(assetId) {
    const asset = getAssetById(assetId);

    if (!asset) {
        statusMessage.value = "资源不存在，无法保存标签";
        return false;
    }

    const nextTags = normalizeAssetTags(assetTagDraftValue.value);
    const currentTags = Array.isArray(asset.tags) ? asset.tags : [];

    if (JSON.stringify(nextTags) === JSON.stringify(currentTags)) {
        cancelAssetTagEdit();
        return true;
    }

    assetLibraryLoading.value = true;

    try {
        await putAssetRecords([
            {
                ...asset,
                tags: nextTags,
                updatedAt: Date.now(),
            },
        ]);
        await loadAssetLibrary({ silent: true });

        if (
            assetLibraryFilterTag.value !== "all" &&
            !nextTags.includes(assetLibraryFilterTag.value)
        ) {
            assetLibraryFilterTag.value = "all";
        }

        cancelAssetTagEdit();
        statusMessage.value = nextTags.length
            ? `已更新资源标签：${asset.name}`
            : `已清空资源标签：${asset.name}`;
        return true;
    } catch (error) {
        statusMessage.value = "资源标签保存失败，请稍后重试";
        console.warn(error);
        return false;
    } finally {
        assetLibraryLoading.value = false;
    }
}

async function handleAssetReplacement(assetId, event) {
    const input = event?.target ?? null;
    const file = Array.from(input?.files ?? [])[0] ?? null;
    const asset = getAssetById(assetId);

    if (!asset) {
        statusMessage.value = "资源不存在，无法替换";

        if (input) {
            input.value = "";
        }

        return false;
    }

    if (!(file instanceof File)) {
        return false;
    }

    const nextKind = inferAssetKind(file);

    if (!nextKind) {
        statusMessage.value = "仅支持使用图片或视频文件替换资源";

        if (input) {
            input.value = "";
        }

        return false;
    }

    if (nextKind !== asset.kind) {
        statusMessage.value =
            asset.kind === "image"
                ? "图片资源只能替换为图片文件"
                : "视频资源只能替换为视频文件";

        if (input) {
            input.value = "";
        }

        return false;
    }

    assetLibraryLoading.value = true;

    try {
        await putAssetRecords([
            {
                ...asset,
                mimeType: String(file.type || "").trim() || asset.mimeType,
                size: Number(file.size) || 0,
                updatedAt: Date.now(),
                blob: file,
            },
        ]);
        await loadAssetLibrary({ silent: true });
        statusMessage.value = `已替换资源文件：${asset.name}`;
        return true;
    } catch (error) {
        statusMessage.value = "资源替换失败，请稍后重试";
        console.warn(error);
        return false;
    } finally {
        assetLibraryLoading.value = false;

        if (input) {
            input.value = "";
        }
    }
}

function toggleAssetSelection(assetId) {
    const currentSelection = new Set(
        normalizeSelectedAssetIds(selectedAssetIds.value),
    );

    if (currentSelection.has(assetId)) {
        currentSelection.delete(assetId);
    } else {
        currentSelection.add(assetId);
    }

    setSelectedAssetIds(Array.from(currentSelection));
}

function toggleAllFilteredAssetsSelection() {
    const filteredIds = filteredAssetLibrary.value.map((item) => item.id);

    if (!filteredIds.length) {
        return false;
    }

    const currentSelection = new Set(
        normalizeSelectedAssetIds(selectedAssetIds.value),
    );

    if (isAllFilteredAssetsSelected.value) {
        filteredIds.forEach((id) => currentSelection.delete(id));
    } else {
        filteredIds.forEach((id) => currentSelection.add(id));
    }

    setSelectedAssetIds(Array.from(currentSelection));
    return true;
}

async function copyAssetReference(assetId) {
    const asset = getAssetById(assetId);

    if (!asset) {
        statusMessage.value = "资源不存在，无法复制引用";
        return false;
    }

    return copyTextToClipboard(asset.reference, {
        successMessage: `已复制资源引用：${asset.name}`,
        failureMessage: "资源引用复制失败，请稍后重试",
        emptyMessage: "当前没有可复制的资源引用",
    });
}

function buildAssetReferenceClipboardText(assets) {
    const normalizedAssets = (Array.isArray(assets) ? assets : []).filter(Boolean);

    return [
        `项目：${currentProjectName.value}`,
        `生成时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
        ...normalizedAssets.map((asset, index) =>
            [
                `${index + 1}. ${asset.name} · ${getAssetKindLabel(asset.kind)}`,
                asset.reference,
            ].join("\n"),
        ),
    ].join("\n\n");
}

async function copySelectedAssetReferences() {
    if (!selectedAssetLibrary.value.length) {
        statusMessage.value = "请先选择要复制引用的资源";
        return false;
    }

    return copyTextToClipboard(
        buildAssetReferenceClipboardText(selectedAssetLibrary.value),
        {
            successMessage: `已复制 ${selectedAssetLibrary.value.length} 个资源引用`,
            failureMessage: "批量复制资源引用失败，请稍后重试",
            emptyMessage: "当前没有可复制的资源引用",
        },
    );
}

function addAssetWidgetToCanvas(assetId) {
    const asset = getAssetById(assetId);

    if (!asset || !currentPage.value) {
        statusMessage.value = "资源不存在，无法插入组件";
        return false;
    }

    const widgetType = asset.kind === "video" ? "video" : "image";
    const nextWidget = createWidget(widgetType, {
        name: `${getAssetKindLabel(asset.kind)} · ${getAssetBaseName(asset.name) || asset.name}`,
        x: clamp(
            Math.round(
                currentCanvas.value.meta.screenWidth / 2 -
                    materials[widgetType].size.w / 2,
            ),
            0,
            Math.max(
                currentCanvas.value.meta.screenWidth -
                    materials[widgetType].size.w,
                0,
            ),
        ),
        y: clamp(
            Math.round(
                currentCanvas.value.meta.screenHeight / 2 -
                    materials[widgetType].size.h / 2,
            ),
            0,
            Math.max(
                currentCanvas.value.meta.screenHeight -
                    materials[widgetType].size.h,
                0,
            ),
        ),
        zIndex: getNextZIndex(currentWidgets.value),
        props:
            widgetType === "image"
                ? {
                      src: asset.reference,
                      alt: getAssetBaseName(asset.name) || asset.name,
                      caption: getAssetBaseName(asset.name),
                      showCaption: false,
                  }
                : {
                      src: asset.reference,
                      title: getAssetBaseName(asset.name) || asset.name,
                      poster: "",
                      autoplay: false,
                      muted: true,
                  },
    });

    queueHistoryLabel("插入资源组件");
    currentWidgets.value.push(nextWidget);
    sortWidgets(currentWidgets.value);
    sanitizeSelection([nextWidget.id], nextWidget.id);
    statusMessage.value = `已插入${getAssetKindLabel(asset.kind)}组件：${asset.name}`;
    return true;
}

function canApplyAssetToSelectedWidget(asset) {
    if (!asset || !selectedWidgetCanReceiveAsset.value) {
        return false;
    }

    if (selectedWidgetAssetTargetMode.value === "image") {
        return asset.kind === "image";
    }

    if (selectedWidgetAssetTargetMode.value === "video") {
        return asset.kind === "video";
    }

    return false;
}

function canApplyAssetAsVideoPoster(asset) {
    return (
        Boolean(asset) &&
        selectedWidgetCanReceiveAsset.value &&
        selectedWidgetAssetTargetMode.value === "video" &&
        asset.kind === "image"
    );
}

function applyAssetToSelectedWidget(assetId, options = {}) {
    const asset = getAssetById(assetId);
    const widgetId = selectedWidget.value?.id ?? "";
    const widget =
        currentWidgets.value.find((item) => item.id === widgetId) ?? null;

    if (!asset || !widget) {
        statusMessage.value = "当前没有可应用的目标组件";
        return false;
    }

    if (widget.locked) {
        statusMessage.value = "当前组件已锁定，解锁后可应用资源";
        return false;
    }

    const assetBaseName = getAssetBaseName(asset.name) || asset.name;
    const applyPoster = options.mode === "poster";

    if (widget.type === "image" && asset.kind !== "image") {
        statusMessage.value = "图片组件只能应用图片资源";
        return false;
    }

    if (widget.type === "video" && applyPoster && asset.kind !== "image") {
        statusMessage.value = "视频封面只能应用图片资源";
        return false;
    }

    if (widget.type === "video" && !applyPoster && asset.kind !== "video") {
        statusMessage.value = "视频组件只能应用视频资源";
        return false;
    }

    queueHistoryLabel(applyPoster ? "应用视频封面" : "应用资源");

    if (widget.type === "image") {
        widget.props = {
            ...widget.props,
            src: asset.reference,
            alt: String(widget.props.alt || "").trim() || assetBaseName,
            caption: String(widget.props.caption || "").trim() || assetBaseName,
        };
        statusMessage.value = `已将图片资源应用到组件：${widget.name}`;
        return true;
    }

    widget.props = applyPoster
        ? {
              ...widget.props,
              poster: asset.reference,
              title: String(widget.props.title || "").trim() || assetBaseName,
          }
        : {
              ...widget.props,
              src: asset.reference,
              title: String(widget.props.title || "").trim() || assetBaseName,
          };
    statusMessage.value = applyPoster
        ? `已更新视频封面：${widget.name}`
        : `已将视频资源应用到组件：${widget.name}`;
    return true;
}

async function deleteAssetFromLibraryById(assetId) {
    const asset = getAssetById(assetId);
    const usage = getAssetUsageInfo(assetId);

    if (!asset) {
        statusMessage.value = "资源不存在，无法删除";
        return false;
    }

    if (usage.total > 0) {
        statusMessage.value = `${asset.name} 仍被项目或发布版本引用，请先替换后再删除`;
        return false;
    }

    try {
        await deleteAssetRecord(assetId);
        assetLibrary.value = assetLibrary.value.filter((item) => item.id !== assetId);
        setSelectedAssetIds(
            selectedAssetIds.value.filter((id) => id !== assetId),
            assetLibrary.value,
        );
        syncAssetPreviewUrlMap(assetLibrary.value);
        if (assetEditingId.value === assetId) {
            cancelAssetRename();
        }
        if (assetTagEditingId.value === assetId) {
            cancelAssetTagEdit();
        }
        statusMessage.value = `已删除资源：${asset.name}`;
        return true;
    } catch (error) {
        statusMessage.value = "资源删除失败，请稍后重试";
        console.warn(error);
        return false;
    }
}

async function batchDeleteSelectedAssets() {
    if (!selectedAssetLibrary.value.length) {
        statusMessage.value = "请先选择要删除的资源";
        return false;
    }

    const deletableAssets = selectedAssetLibrary.value.filter(
        (asset) => getAssetUsageInfo(asset.id).total === 0,
    );
    const skippedReferencedCount =
        selectedAssetLibrary.value.length - deletableAssets.length;

    if (!deletableAssets.length) {
        statusMessage.value = "所选资源仍被项目或发布版本引用，请先替换后再删除";
        return false;
    }

    assetLibraryLoading.value = true;

    try {
        await Promise.all(
            deletableAssets.map((asset) => deleteAssetRecord(asset.id)),
        );

        const deletedIds = new Set(deletableAssets.map((asset) => asset.id));
        const nextAssets = assetLibrary.value.filter(
            (asset) => !deletedIds.has(asset.id),
        );

        assetLibrary.value = nextAssets;
        setSelectedAssetIds(
            selectedAssetIds.value.filter((id) => !deletedIds.has(id)),
            nextAssets,
        );
        syncAssetPreviewUrlMap(nextAssets);

        if (deletedIds.has(assetEditingId.value)) {
            cancelAssetRename();
        }
        if (deletedIds.has(assetTagEditingId.value)) {
            cancelAssetTagEdit();
        }

        statusMessage.value = skippedReferencedCount
            ? `已删除 ${deletableAssets.length} 个资源，跳过 ${skippedReferencedCount} 个已引用资源`
            : `已批量删除 ${deletableAssets.length} 个资源`;
        return true;
    } catch (error) {
        statusMessage.value = "批量删除资源失败，请稍后重试";
        console.warn(error);
        return false;
    } finally {
        assetLibraryLoading.value = false;
    }
}

async function applyBatchAssetTags() {
    if (!selectedAssetLibrary.value.length) {
        statusMessage.value = "请先选择要批量处理标签的资源";
        return false;
    }

    const draftTags = normalizeAssetTags(assetBatchTagDraft.value);

    if (assetBatchTagMode.value !== "clear" && !draftTags.length) {
        statusMessage.value = "请输入至少一个标签后再批量写入";
        return false;
    }

    assetLibraryLoading.value = true;
    cancelAssetTagEdit();

    try {
        const now = Date.now();
        const nextRecords = selectedAssetLibrary.value.map((asset, index) => {
            const currentTags = Array.isArray(asset.tags) ? asset.tags : [];
            let nextTags = currentTags;

            if (assetBatchTagMode.value === "clear") {
                nextTags = [];
            } else if (assetBatchTagMode.value === "replace") {
                nextTags = draftTags;
            } else {
                nextTags = normalizeAssetTags([...currentTags, ...draftTags]);
            }

            return {
                ...asset,
                tags: nextTags,
                updatedAt: now + index,
            };
        });

        await putAssetRecords(nextRecords);
        const nextAssets = await loadAssetLibrary({ silent: true });

        if (
            assetLibraryFilterTag.value !== "all" &&
            !nextAssets.some((asset) =>
                (Array.isArray(asset.tags) ? asset.tags : []).includes(
                    assetLibraryFilterTag.value,
                ),
            )
        ) {
            assetLibraryFilterTag.value = "all";
        }

        statusMessage.value =
            assetBatchTagMode.value === "clear"
                ? `已清空 ${nextRecords.length} 个资源的标签`
                : assetBatchTagMode.value === "replace"
                  ? `已覆盖 ${nextRecords.length} 个资源的标签`
                  : `已为 ${nextRecords.length} 个资源追加标签`;
        return true;
    } catch (error) {
        statusMessage.value = "批量更新资源标签失败，请稍后重试";
        console.warn(error);
        return false;
    } finally {
        assetLibraryLoading.value = false;
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

function persistEditorProjectState(projectData = project.value) {
    const normalizedProject = normalizeProjectSchema(cloneDeep(projectData));

    rememberProjectSourceSecrets(activeProjectRecordId.value, normalizedProject);
    const persistedSnapshot = JSON.stringify(
        sanitizeProjectSourceSecrets(normalizedProject),
    );

    if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, persistedSnapshot);
    }

    syncActiveProjectRecord(persistedSnapshot);
    return persistedSnapshot;
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

function summarizeProjectStructure(projectData, preferredPageId = "") {
    const normalizedProject = normalizeProjectSchema(cloneDeep(projectData));
    const allWidgets = normalizedProject.pages.flatMap((page) =>
        Array.isArray(page.widgets) ? page.widgets : [],
    );
    const pageCount = normalizedProject.pages.length;
    const widgetCount = allWidgets.length;
    const entryPageId =
        typeof preferredPageId === "string" &&
        normalizedProject.pages.some((page) => page.id === preferredPageId)
            ? preferredPageId
            : normalizedProject.activePageId ||
              normalizedProject.pages[0]?.id ||
              "";
    const entryPage =
        normalizedProject.pages.find((page) => page.id === entryPageId) ??
        normalizedProject.pages[0] ??
        null;
    const widgetTypeMap = allWidgets.reduce((accumulator, widget) => {
        const type = String(widget?.type || "").trim() || "unknown";
        accumulator[type] = (accumulator[type] || 0) + 1;
        return accumulator;
    }, {});
    const groupCount = new Set(
        allWidgets.map((widget) => widget?.groupId).filter(Boolean),
    ).size;
    const hiddenWidgetCount = allWidgets.filter((widget) => widget?.hidden).length;

    return {
        pageCount,
        widgetCount,
        sourceCount: normalizedProject.dataSources.length,
        variableCount: Array.isArray(normalizedProject.runtimeVariablePresets)
            ? normalizedProject.runtimeVariablePresets.length
            : 0,
        hiddenWidgetCount,
        groupCount,
        entryPageId,
        entryPageName: entryPage?.name ?? "未命名页面",
        screenWidth: Number(entryPage?.meta?.screenWidth) || 0,
        screenHeight: Number(entryPage?.meta?.screenHeight) || 0,
        pageNames: normalizedProject.pages
            .map((page, index) => {
                const name = String(page?.name || "").trim();
                return name || `未命名页面 ${index + 1}`;
            })
            .filter(Boolean),
        sourceNames: normalizedProject.dataSources
            .map((source, index) => {
                const name = String(source?.name || "").trim();
                return name || `数据源 ${index + 1}`;
            })
            .filter(Boolean),
        variableNames: Array.isArray(normalizedProject.runtimeVariablePresets)
            ? normalizedProject.runtimeVariablePresets
                  .map((preset, index) => {
                      const key = String(preset?.key || "").trim();
                      return key || `变量 ${index + 1}`;
                  })
                  .filter(Boolean)
            : [],
        widgetTypeMap,
    };
}

function formatPublishedSnapshotCountDiff(label, previousValue, currentValue) {
    if (previousValue === currentValue) {
        return "";
    }

    const delta = currentValue - previousValue;
    const sign = delta > 0 ? "+" : "";
    return `${label} ${previousValue}→${currentValue} (${sign}${delta})`;
}

function formatPublishedSnapshotDiffList(values, limit = 4) {
    const normalizedValues = Array.isArray(values)
        ? values.map((item) => String(item || "").trim()).filter(Boolean)
        : [];

    if (!normalizedValues.length) {
        return "";
    }

    const visibleItems = normalizedValues.slice(0, limit);
    return normalizedValues.length > limit
        ? `${visibleItems.join("、")} 等 ${normalizedValues.length} 项`
        : visibleItems.join("、");
}

function buildPublishedSnapshotNamedDiffEntries(
    label,
    previousItems,
    currentItems,
    limit = 4,
) {
    const previousList = Array.from(
        new Set(
            (Array.isArray(previousItems) ? previousItems : [])
                .map((item) => String(item || "").trim())
                .filter(Boolean),
        ),
    ).sort((left, right) => left.localeCompare(right, "zh-CN"));
    const currentList = Array.from(
        new Set(
            (Array.isArray(currentItems) ? currentItems : [])
                .map((item) => String(item || "").trim())
                .filter(Boolean),
        ),
    ).sort((left, right) => left.localeCompare(right, "zh-CN"));
    const previousSet = new Set(previousList);
    const currentSet = new Set(currentList);
    const addedItems = currentList.filter((item) => !previousSet.has(item));
    const removedItems = previousList.filter((item) => !currentSet.has(item));
    const entries = [];

    if (addedItems.length) {
        entries.push(`${label}新增：${formatPublishedSnapshotDiffList(addedItems, limit)}`);
    }

    if (removedItems.length) {
        entries.push(
            `${label}移除：${formatPublishedSnapshotDiffList(removedItems, limit)}`,
        );
    }

    return entries;
}

function buildPublishedSnapshotMapDiffEntries(
    label,
    previousMap,
    currentMap,
    options = {},
) {
    const previousEntries =
        previousMap && typeof previousMap === "object" ? previousMap : {};
    const currentEntries =
        currentMap && typeof currentMap === "object" ? currentMap : {};
    const keys = Array.from(
        new Set([
            ...Object.keys(previousEntries),
            ...Object.keys(currentEntries),
        ]),
    ).sort((left, right) => left.localeCompare(right, "zh-CN"));
    const formatKey =
        typeof options.formatKey === "function"
            ? options.formatKey
            : (value) => String(value || "").trim();
    const limit = Math.max(1, Number(options.limit) || 6);
    const changes = keys
        .map((key) => {
            const previousValue = Number(previousEntries[key]) || 0;
            const currentValue = Number(currentEntries[key]) || 0;

            if (previousValue === currentValue) {
                return "";
            }

            const formattedKey = formatKey(key);
            return `${formattedKey} ${previousValue}→${currentValue}`;
        })
        .filter(Boolean);

    if (!changes.length) {
        return [];
    }

    const hiddenCount = Math.max(changes.length - limit, 0);
    const visibleChanges = changes.slice(0, limit);

    if (hiddenCount > 0) {
        visibleChanges.push(`${label}其余 ${hiddenCount} 项也有变化`);
    }

    return visibleChanges;
}

function buildPublishedSnapshotDiffSummary(snapshot, currentProjectData) {
    const snapshotProject = normalizeProjectSchema(JSON.parse(snapshot.snapshot));
    const snapshotSummary = summarizeProjectStructure(
        snapshotProject,
        snapshot.pageId,
    );
    const currentSummary = summarizeProjectStructure(
        currentProjectData,
        currentPageId.value || project.value.activePageId,
    );
    const structureEntries = [
        formatPublishedSnapshotCountDiff(
            "页面",
            snapshotSummary.pageCount,
            currentSummary.pageCount,
        ),
        formatPublishedSnapshotCountDiff(
            "组件",
            snapshotSummary.widgetCount,
            currentSummary.widgetCount,
        ),
        formatPublishedSnapshotCountDiff(
            "数据源",
            snapshotSummary.sourceCount,
            currentSummary.sourceCount,
        ),
        formatPublishedSnapshotCountDiff(
            "变量",
            snapshotSummary.variableCount,
            currentSummary.variableCount,
        ),
        formatPublishedSnapshotCountDiff(
            "隐藏组件",
            snapshotSummary.hiddenWidgetCount,
            currentSummary.hiddenWidgetCount,
        ),
        formatPublishedSnapshotCountDiff(
            "编组",
            snapshotSummary.groupCount,
            currentSummary.groupCount,
        ),
    ].filter(Boolean);

    if (snapshotSummary.entryPageName !== currentSummary.entryPageName) {
        structureEntries.push(
            `入口页 ${snapshotSummary.entryPageName}→${currentSummary.entryPageName}`,
        );
    }

    if (
        snapshotSummary.screenWidth !== currentSummary.screenWidth ||
        snapshotSummary.screenHeight !== currentSummary.screenHeight
    ) {
        structureEntries.push(
            `画布 ${snapshotSummary.screenWidth}×${snapshotSummary.screenHeight}→${currentSummary.screenWidth}×${currentSummary.screenHeight}`,
        );
    }

    const pageEntries = buildPublishedSnapshotNamedDiffEntries(
        "页面",
        snapshotSummary.pageNames,
        currentSummary.pageNames,
        4,
    );
    const sourceEntries = buildPublishedSnapshotNamedDiffEntries(
        "数据源",
        snapshotSummary.sourceNames,
        currentSummary.sourceNames,
        4,
    );
    const variableEntries = buildPublishedSnapshotNamedDiffEntries(
        "变量",
        snapshotSummary.variableNames,
        currentSummary.variableNames,
        4,
    );
    const widgetTypeEntries = buildPublishedSnapshotMapDiffEntries(
        "组件类型",
        snapshotSummary.widgetTypeMap,
        currentSummary.widgetTypeMap,
        {
            limit: 6,
            formatKey: (type) =>
                MATERIAL_LABEL_MAP[type] ??
                (String(type || "").trim() || "未命名组件"),
        },
    );
    const sections = [
        {
            label: "结构规模",
            entries: structureEntries,
        },
        {
            label: "页面清单",
            entries: pageEntries,
        },
        {
            label: "组件类型",
            entries: widgetTypeEntries,
        },
        {
            label: "数据与变量",
            entries: [...sourceEntries, ...variableEntries],
        },
    ].filter((section) => section.entries.length);
    const entries = sections.flatMap((section) => section.entries);

    return {
        hasChanges: entries.length > 0,
        summary: entries.length
            ? entries.slice(0, 3).join(" · ")
            : "当前项目与该发布版本结构一致",
        entries,
        sections,
        snapshotSummary,
        currentSummary,
    };
}

function buildPublishedOperationSnapshotNames(snapshotNames) {
    return Array.from(
        new Set(
            (Array.isArray(snapshotNames) ? snapshotNames : [])
                .map((item) => String(item || "").trim())
                .filter(Boolean),
        ),
    ).slice(0, 12);
}

function appendPublishedOperationLog(options = {}) {
    const action =
        typeof options.action === "string" && options.action.trim()
            ? options.action.trim()
            : "unknown";
    const snapshotIds = Array.from(
        new Set(
            (Array.isArray(options.snapshotIds) ? options.snapshotIds : [])
                .map((item) => String(item || "").trim())
                .filter(Boolean),
        ),
    ).slice(0, 12);
    const snapshotNames = buildPublishedOperationSnapshotNames(
        options.snapshotNames,
    );
    const createdAt = Number.isFinite(Number(options.createdAt))
        ? Number(options.createdAt)
        : Date.now();
    const actionLabel = formatPublishedOperationActionLabel(action);
    const nextEntry = {
        id: createPublishedOperationLogId(),
        projectRecordId: options.projectRecordId || activeProjectRecordId.value,
        projectName: options.projectName || currentProjectName.value,
        action,
        actionLabel,
        summary: String(options.summary || "").trim() || actionLabel,
        detail: String(options.detail || "").trim(),
        snapshotIds,
        snapshotNames,
        createdAt,
    };

    publishedOperationLogs.value = [nextEntry, ...publishedOperationLogs.value]
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, PUBLISHED_OPERATION_LOG_LIMIT);
    persistPublishedOperationLogLibrary(publishedOperationLogs.value);
    return nextEntry;
}

function appendPublishedRollbackLog(snapshot, summary = "") {
    const nextLog = {
        id: createPublishedRollbackLogId(),
        projectRecordId: snapshot.projectRecordId || activeProjectRecordId.value,
        projectName: snapshot.projectName || currentProjectName.value,
        snapshotId: snapshot.id,
        snapshotName: snapshot.name,
        pageId: snapshot.pageId,
        pageName: snapshot.pageName,
        environment: normalizePublishedEnvironment(snapshot.environment),
        tags: normalizePublishedTagList(snapshot.tags),
        summary: String(summary || "").trim(),
        rolledBackAt: Date.now(),
    };

    publishedRollbackLogs.value = [nextLog, ...publishedRollbackLogs.value]
        .sort((left, right) => right.rolledBackAt - left.rolledBackAt)
        .slice(0, PUBLISHED_ROLLBACK_LOG_LIMIT);
    persistPublishedRollbackLogLibrary(publishedRollbackLogs.value);
}

function hasCurrentProjectPublishedSnapshot(snapshotId) {
    return currentProjectPublishedSnapshotIdSet.value.has(snapshotId);
}

function deletePublishedRollbackLogsByProject(projectRecordId) {
    if (!projectRecordId) {
        return;
    }

    const nextLogs = publishedRollbackLogs.value.filter(
        (item) => item.projectRecordId !== projectRecordId,
    );

    if (nextLogs.length === publishedRollbackLogs.value.length) {
        return;
    }

    publishedRollbackLogs.value = nextLogs;
    persistPublishedRollbackLogLibrary(nextLogs);
}

function deletePublishedRollbackLog(logId) {
    const log =
        publishedRollbackLogs.value.find((item) => item.id === logId) ?? null;

    if (!log) {
        statusMessage.value = "回滚记录不存在，无法删除";
        return false;
    }

    const nextLogs = publishedRollbackLogs.value.filter((item) => item.id !== logId);
    publishedRollbackLogs.value = nextLogs;
    persistPublishedRollbackLogLibrary(nextLogs);
    statusMessage.value = `已删除回滚记录：${log.snapshotName}`;
    return true;
}

function clearCurrentProjectPublishedRollbackLogs() {
    if (!currentProjectPublishedRollbackLibrary.value.length) {
        statusMessage.value = "当前项目暂无回滚记录";
        return false;
    }

    const deletedCount = currentProjectPublishedRollbackLibrary.value.length;
    deletePublishedRollbackLogsByProject(activeProjectRecordId.value);
    statusMessage.value = `已清空 ${deletedCount} 条回滚记录`;
    return true;
}

function deletePublishedOperationLogsByProject(projectRecordId) {
    if (!projectRecordId) {
        return;
    }

    const nextLogs = publishedOperationLogs.value.filter(
        (item) => item.projectRecordId !== projectRecordId,
    );

    if (nextLogs.length === publishedOperationLogs.value.length) {
        return;
    }

    publishedOperationLogs.value = nextLogs;
    persistPublishedOperationLogLibrary(nextLogs);
}

function deletePublishedOperationLog(logId) {
    const log =
        publishedOperationLogs.value.find((item) => item.id === logId) ?? null;

    if (!log) {
        statusMessage.value = "操作日志不存在，无法删除";
        return false;
    }

    const nextLogs = publishedOperationLogs.value.filter((item) => item.id !== logId);
    publishedOperationLogs.value = nextLogs;
    persistPublishedOperationLogLibrary(nextLogs);

    if (dialogOperationLogId.value === logId) {
        dialogOperationLogId.value = "";
    }

    statusMessage.value = `已删除操作日志：${log.summary}`;
    return true;
}

function clearCurrentProjectPublishedOperationLogs() {
    if (!currentProjectPublishedOperationLibrary.value.length) {
        statusMessage.value = "当前项目暂无操作日志";
        return false;
    }

    const deletedCount = currentProjectPublishedOperationLibrary.value.length;
    deletePublishedOperationLogsByProject(activeProjectRecordId.value);
    statusMessage.value = `已清空 ${deletedCount} 条操作日志`;
    return true;
}

function buildPublishedSnapshotLinkClipboardText(snapshots) {
    const normalizedSnapshots = sortPublishedSnapshotCollection(
        Array.isArray(snapshots) ? snapshots : [],
        publishedSnapshotSortMode.value,
    );

    return [
        `项目：${currentProjectName.value}`,
        `生成时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
        ...normalizedSnapshots.map((snapshot, index) => {
            const link = buildPublishedRuntimeLink(snapshot.id, snapshot.pageId);
            const environment = formatPublishedEnvironmentLabel(snapshot.environment);
            return [
                `${index + 1}. ${snapshot.name} · ${environment} · ${snapshot.pageName}`,
                link,
            ].join("\n");
        }),
    ].join("\n\n");
}

function focusPublishedSnapshotFromRollbackLog(logId) {
    const log =
        publishedRollbackLogs.value.find((item) => item.id === logId) ?? null;

    if (!log) {
        statusMessage.value = "回滚记录不存在，无法定位版本";
        return false;
    }

    const snapshot =
        currentProjectPublishedSnapshotLibrary.value.find(
            (item) => item.id === log.snapshotId,
        ) ?? null;

    if (!snapshot) {
        statusMessage.value = "该回滚记录关联的发布版本已不存在";
        return false;
    }

    publishDiffSnapshotId.value = snapshot.id;
    pendingRollbackSnapshotId.value = "";
    statusMessage.value = `已定位到回滚记录对应版本：${snapshot.name}`;
    return true;
}

function buildPublishedSnapshotExportPayload(options = {}) {
    const snapshots = Array.isArray(options.snapshots)
        ? sortPublishedSnapshotCollection(options.snapshots, publishedSnapshotSortMode.value)
        : currentProjectPublishedSnapshots.value;
    const snapshotIds = new Set(snapshots.map((item) => item.id));
    const rollbackLogs = Array.isArray(options.rollbackLogs)
        ? options.rollbackLogs
        : currentProjectPublishedRollbackLibrary.value.filter((item) =>
              snapshotIds.has(item.snapshotId),
          );

    return JSON.stringify(
        {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            exportScope:
                typeof options.scope === "string" && options.scope.trim()
                    ? options.scope.trim()
                    : "current-project",
            projectRecordId: activeProjectRecordId.value,
            projectName: currentProjectName.value,
            snapshotCount: snapshots.length,
            rollbackLogCount: rollbackLogs.length,
            snapshots,
            rollbackLogs,
        },
        null,
        2,
    );
}

function buildPublishedOperationLogExportPayload(logs = currentProjectPublishedOperationLogs.value) {
    const normalizedLogs = Array.isArray(logs) ? [...logs] : [];

    return JSON.stringify(
        {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            exportScope: "published-operation-logs",
            projectRecordId: activeProjectRecordId.value,
            projectName: currentProjectName.value,
            logCount: normalizedLogs.length,
            logs: normalizedLogs,
        },
        null,
        2,
    );
}

function parseImportedPublishedSnapshotPayload(text) {
    const parsed = JSON.parse(text);
    const rawSnapshots = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.snapshots)
          ? parsed.snapshots
          : Array.isArray(parsed?.publishedSnapshots)
            ? parsed.publishedSnapshots
            : [];
    const rawRollbackLogs = Array.isArray(parsed?.rollbackLogs)
        ? parsed.rollbackLogs
        : [];

    if (!rawSnapshots.length) {
        throw new Error("No published snapshots found");
    }

    return {
        snapshots: rawSnapshots
            .map((item, index) => normalizePublishedSnapshotRecord(item, index))
            .filter(Boolean),
        rollbackLogs: rawRollbackLogs
            .map((item, index) => normalizePublishedRollbackLogRecord(item, index))
            .filter(Boolean),
    };
}

function openPublishedSnapshotExportDialog() {
    dialogMode.value = "published-snapshot-export";
    dialogText.value = buildPublishedSnapshotExportPayload();
}

function openSelectedPublishedSnapshotExportDialog() {
    if (!selectedProjectPublishedSnapshots.value.length) {
        statusMessage.value = "请先选择要导出的发布版本";
        return false;
    }

    const selectedSnapshotIds = new Set(
        selectedProjectPublishedSnapshots.value.map((item) => item.id),
    );

    dialogMode.value = "published-snapshot-export-selected";
    dialogText.value = buildPublishedSnapshotExportPayload({
        scope: "selected-snapshots",
        snapshots: selectedProjectPublishedSnapshots.value,
        rollbackLogs: currentProjectPublishedRollbackLibrary.value.filter((item) =>
            selectedSnapshotIds.has(item.snapshotId),
        ),
    });
    statusMessage.value = `已生成 ${selectedProjectPublishedSnapshots.value.length} 个所选版本导出包`;
    return true;
}

function openPublishedOperationLogExportDialog() {
    if (!currentProjectPublishedOperationLogs.value.length) {
        statusMessage.value = "当前项目暂无可导出的操作日志";
        return false;
    }

    dialogMode.value = "published-operation-export";
    dialogText.value = buildPublishedOperationLogExportPayload();
    statusMessage.value = `已生成 ${currentProjectPublishedOperationLogs.value.length} 条操作日志导出包`;
    return true;
}

function openPublishedOperationLogDetail(logId) {
    const log =
        currentProjectPublishedOperationLogs.value.find((item) => item.id === logId) ??
        null;

    if (!log) {
        statusMessage.value = "操作日志不存在，无法查看详情";
        return false;
    }

    dialogOperationLogId.value = log.id;
    dialogMode.value = "published-operation-detail";
    return true;
}

function returnToPublishManagerDialog() {
    dialogOperationLogId.value = "";
    dialogMode.value = "project-publish";
}

async function copyActivePublishedOperationLogDetail() {
    if (!activePublishedOperationLogDetailText.value) {
        statusMessage.value = "当前没有可复制的操作日志";
        return false;
    }

    return copyTextToClipboard(activePublishedOperationLogDetailText.value, {
        successMessage: "操作日志 JSON 已复制到剪贴板",
        failureMessage: "复制失败，请手动复制操作日志 JSON",
    });
}

async function copySelectedPublishedSnapshotLinks() {
    if (!selectedProjectPublishedSnapshots.value.length) {
        statusMessage.value = "请先选择要复制链接的发布版本";
        return false;
    }

    const copied = await copyTextToClipboard(
        buildPublishedSnapshotLinkClipboardText(
            selectedProjectPublishedSnapshots.value,
        ),
        {
            successMessage: `已复制 ${selectedProjectPublishedSnapshots.value.length} 个发布链接`,
            failureMessage: "批量复制发布链接失败，请稍后重试",
            emptyMessage: "当前没有可复制的发布链接",
        },
    );

    if (copied) {
        appendPublishedOperationLog({
            action: "batch-copy-links",
            summary: `批量复制 ${selectedProjectPublishedSnapshots.value.length} 个发布链接`,
            snapshotIds: selectedProjectPublishedSnapshots.value.map(
                (item) => item.id,
            ),
            snapshotNames: selectedProjectPublishedSnapshots.value.map(
                (item) => item.name,
            ),
        });
        pushRuntimeDebugEvent({
            level: "info",
            category: "runtime",
            title: "已批量复制发布地址",
            detail: `${selectedProjectPublishedSnapshots.value.length} 个版本`,
            force: true,
        });
    }

    return copied;
}

async function openSelectedPublishedSnapshotRuntimes() {
    if (!selectedProjectPublishedSnapshots.value.length) {
        statusMessage.value = "请先选择要打开运行态的发布版本";
        return false;
    }

    if (typeof window === "undefined") {
        statusMessage.value = "当前环境不支持批量打开运行态";
        return false;
    }

    const targetSnapshots = sortPublishedSnapshotCollection(
        selectedProjectPublishedSnapshots.value,
        publishedSnapshotSortMode.value,
    );
    let openedCount = 0;
    let blockedCount = 0;
    let copiedLinks = false;

    targetSnapshots.forEach((snapshot) => {
        const targetUrl = buildPublishedRuntimeLink(snapshot.id, snapshot.pageId);
        const openedWindow = targetUrl
            ? window.open(targetUrl, "_blank", "noopener,noreferrer")
            : null;

        if (openedWindow) {
            openedCount += 1;
        } else {
            blockedCount += 1;
        }
    });

    if (blockedCount > 0) {
        copiedLinks = await copyTextToClipboard(
            buildPublishedSnapshotLinkClipboardText(targetSnapshots),
            {
                successMessage: "批量链接已复制到剪贴板",
                failureMessage: "浏览器拦截了批量打开，且复制链接失败，请稍后重试",
                emptyMessage: "当前没有可复制的发布链接",
            },
        );
    }

    if (!openedCount && blockedCount) {
        statusMessage.value = copiedLinks
            ? `浏览器拦截了批量打开，已复制 ${targetSnapshots.length} 个发布链接`
            : "浏览器拦截了批量打开，且复制链接失败，请稍后重试";
        return false;
    }

    statusMessage.value = blockedCount
        ? copiedLinks
            ? `已打开 ${openedCount} 个运行态，另 ${blockedCount} 个链接已复制到剪贴板`
            : `已打开 ${openedCount} 个运行态，另 ${blockedCount} 个被浏览器拦截`
        : `已批量打开 ${openedCount} 个运行态`;
    pushRuntimeDebugEvent({
        level: "info",
        category: "runtime",
        title: "已批量打开发布运行态",
        detail: blockedCount
            ? copiedLinks
                ? `${openedCount} 个已打开，${blockedCount} 个已复制链接`
                : `${openedCount} 个已打开，${blockedCount} 个被拦截`
            : `${openedCount} 个版本`,
        force: true,
    });
    appendPublishedOperationLog({
        action: "batch-open-runtimes",
        summary: `批量打开 ${openedCount} 个发布运行态`,
        detail: blockedCount
            ? copiedLinks
                ? `${blockedCount} 个链接已复制到剪贴板`
                : `${blockedCount} 个被浏览器拦截`
            : "",
        snapshotIds: targetSnapshots.map((item) => item.id),
        snapshotNames: targetSnapshots.map((item) => item.name),
    });
    return openedCount > 0;
}

function openPublishedSnapshotImportDialog() {
    dialogMode.value = "published-snapshot-import";
    dialogText.value = "";
}

function applyPublishedSnapshotImport() {
    try {
        const { snapshots, rollbackLogs } = parseImportedPublishedSnapshotPayload(
            dialogText.value,
        );
        const usedSnapshotIds = new Set(
            publishedSnapshots.value.map((item) => item.id),
        );
        const snapshotIdMap = new Map();
        const importedSnapshots = snapshots.map((snapshot) => {
            let nextId = snapshot.id;

            if (usedSnapshotIds.has(snapshot.id)) {
                nextId = createUniquePublishedSnapshotId(usedSnapshotIds);
            } else {
                usedSnapshotIds.add(snapshot.id);
            }

            snapshotIdMap.set(snapshot.id, nextId);

            return {
                ...snapshot,
                id: nextId,
                projectRecordId: activeProjectRecordId.value,
                projectName: currentProjectName.value,
                pinned: Boolean(snapshot.pinned),
                pinnedAt: snapshot.pinned
                    ? Number(snapshot.pinnedAt) || Number(snapshot.updatedAt) || Date.now()
                    : 0,
            };
        });

        publishedSnapshots.value = sortPublishedSnapshotCollection([
            ...publishedSnapshots.value,
            ...importedSnapshots,
        ]);
        persistPublishedSnapshotLibrary(publishedSnapshots.value);

        if (rollbackLogs.length) {
            const usedLogIds = new Set(publishedRollbackLogs.value.map((item) => item.id));
            const importedRollbackLogs = rollbackLogs
                .map((log) => {
                    const mappedSnapshotId = snapshotIdMap.get(log.snapshotId);

                    if (!mappedSnapshotId) {
                        return null;
                    }

                    const linkedSnapshot =
                        importedSnapshots.find((item) => item.id === mappedSnapshotId) ??
                        null;
                    let nextLogId = log.id;

                    if (usedLogIds.has(log.id)) {
                        nextLogId = createUniquePublishedRollbackLogId(usedLogIds);
                    } else {
                        usedLogIds.add(log.id);
                    }

                    return {
                        ...log,
                        id: nextLogId,
                        projectRecordId: activeProjectRecordId.value,
                        projectName: currentProjectName.value,
                        snapshotId: mappedSnapshotId,
                        snapshotName: linkedSnapshot?.name ?? log.snapshotName,
                        environment:
                            linkedSnapshot?.environment ?? log.environment,
                        tags: linkedSnapshot?.tags ?? log.tags,
                    };
                })
                .filter(Boolean);

            publishedRollbackLogs.value = [
                ...importedRollbackLogs,
                ...publishedRollbackLogs.value,
            ]
                .sort((left, right) => right.rolledBackAt - left.rolledBackAt)
                .slice(0, PUBLISHED_ROLLBACK_LOG_LIMIT);
            persistPublishedRollbackLogLibrary(publishedRollbackLogs.value);
        }

        openPublishManagerDialog();
        publishDiffSnapshotId.value = importedSnapshots[0]?.id ?? "";
        appendPublishedOperationLog({
            action: "import",
            summary: `导入 ${importedSnapshots.length} 个发布版本`,
            detail: rollbackLogs.length
                ? `同时导入 ${rollbackLogs.length} 条回滚记录`
                : "",
            snapshotIds: importedSnapshots.map((item) => item.id),
            snapshotNames: importedSnapshots.map((item) => item.name),
        });
        statusMessage.value = `已导入 ${importedSnapshots.length} 个发布版本`;
    } catch (error) {
        statusMessage.value = "发布版本导入失败，请检查 JSON 结构";
        console.warn(error);
    }
}

function resetPublishedSnapshotFilters() {
    publishedSnapshotSearchKeyword.value = "";
    publishedSnapshotFilterEnvironment.value = "all";
    publishedSnapshotFilterApprovalStatus.value = "all";
    publishedSnapshotFilterApprovalReviewer.value = "all";
    publishedSnapshotFilterLockState.value = "all";
    publishedSnapshotSortMode.value = PUBLISHED_SORT_OPTIONS[0].value;
}

function applyPublishedSnapshotApprovalStatusFilter(status = "all") {
    publishedSnapshotFilterApprovalStatus.value =
        status === "all" ? "all" : normalizePublishedApprovalStatus(status);
}

function applyPublishedSnapshotApprovalReviewerFilter(reviewer = "all") {
    if (reviewer === "all") {
        publishedSnapshotFilterApprovalReviewer.value = "all";
        return;
    }

    if (reviewer === PUBLISHED_APPROVAL_REVIEWER_FILTER_UNASSIGNED) {
        publishedSnapshotFilterApprovalReviewer.value =
            PUBLISHED_APPROVAL_REVIEWER_FILTER_UNASSIGNED;
        return;
    }

    publishedSnapshotFilterApprovalReviewer.value =
        normalizePublishedApprovalReviewer(reviewer) || "all";
}

function handlePublishedSnapshotApprovalStatsCard(cardKey) {
    if (cardKey === "all") {
        applyPublishedSnapshotApprovalStatusFilter("all");
        applyPublishedSnapshotApprovalReviewerFilter("all");
        return;
    }

    if (cardKey === PUBLISHED_APPROVAL_REVIEWER_FILTER_UNASSIGNED) {
        applyPublishedSnapshotApprovalReviewerFilter(
            PUBLISHED_APPROVAL_REVIEWER_FILTER_UNASSIGNED,
        );
        return;
    }

    applyPublishedSnapshotApprovalStatusFilter(cardKey);
}

function resetPublishedSnapshotBatchOptions() {
    publishedSnapshotBatchApplyNote.value = false;
    publishedSnapshotBatchApplyTags.value = false;
    publishedSnapshotBatchApplyEnvironment.value = false;
    publishedSnapshotBatchApplyApprovalStatus.value = false;
}

function resetPublishedRollbackFilters() {
    publishedRollbackSearchKeyword.value = "";
    publishedRollbackFilterEnvironment.value = "all";
    publishedRollbackFilterRelation.value = "all";
}

function resetPublishedOperationFilters() {
    publishedOperationSearchKeyword.value = "";
    publishedOperationFilterAction.value = "all";
}

function normalizeSelectedPublishedSnapshotIds(
    snapshotIds,
    snapshotCollection = currentProjectPublishedSnapshotLibrary.value,
) {
    const allowedIds = new Set(
        (Array.isArray(snapshotCollection) ? snapshotCollection : []).map(
            (item) => item.id,
        ),
    );

    return Array.from(
        new Set(
            (Array.isArray(snapshotIds) ? snapshotIds : []).filter((id) =>
                allowedIds.has(id),
            ),
        ),
    );
}

function setSelectedPublishedSnapshotIds(
    snapshotIds,
    snapshotCollection = currentProjectPublishedSnapshotLibrary.value,
) {
    selectedPublishedSnapshotIds.value = normalizeSelectedPublishedSnapshotIds(
        snapshotIds,
        snapshotCollection,
    );
}

function clearPublishedSnapshotSelection() {
    selectedPublishedSnapshotIds.value = [];
}

function togglePublishedSnapshotSelection(snapshotId) {
    const currentSelection = new Set(
        normalizeSelectedPublishedSnapshotIds(selectedPublishedSnapshotIds.value),
    );

    if (currentSelection.has(snapshotId)) {
        currentSelection.delete(snapshotId);
    } else {
        currentSelection.add(snapshotId);
    }

    setSelectedPublishedSnapshotIds(Array.from(currentSelection));
}

function toggleAllFilteredPublishedSnapshotsSelection() {
    const filteredIds = filteredProjectPublishedSnapshots.value.map(
        (item) => item.id,
    );

    if (!filteredIds.length) {
        return false;
    }

    const currentSelection = new Set(
        normalizeSelectedPublishedSnapshotIds(selectedPublishedSnapshotIds.value),
    );

    if (isAllFilteredPublishedSnapshotsSelected.value) {
        filteredIds.forEach((id) => currentSelection.delete(id));
    } else {
        filteredIds.forEach((id) => currentSelection.add(id));
    }

    setSelectedPublishedSnapshotIds(Array.from(currentSelection));
    return true;
}

function batchSetPublishedSnapshotPin(nextPinned) {
    if (!selectedProjectPublishedSnapshots.value.length) {
        statusMessage.value = `请先选择要${nextPinned ? "置顶" : "取消置顶"}的发布版本`;
        return false;
    }

    const targetSnapshots = selectedProjectPublishedSnapshots.value.filter(
        (item) => item.pinned !== nextPinned,
    );

    if (!targetSnapshots.length) {
        statusMessage.value = nextPinned
            ? "所选发布版本已全部置顶"
            : "所选发布版本当前都未置顶";
        return false;
    }

    const targetIds = new Set(targetSnapshots.map((item) => item.id));
    const pinnedAt = Date.now();
    const nextSnapshots = sortPublishedSnapshotCollection(
        publishedSnapshots.value.map((item) =>
            targetIds.has(item.id)
                ? {
                      ...item,
                      pinned: nextPinned,
                      pinnedAt: nextPinned ? pinnedAt : 0,
                  }
                : item,
        ),
    );

    publishedSnapshots.value = nextSnapshots;
    persistPublishedSnapshotLibrary(nextSnapshots);
    publishDiffSnapshotId.value =
        targetSnapshots[0]?.id ?? publishDiffSnapshotId.value;
    appendPublishedOperationLog({
        action: nextPinned ? "batch-pin" : "batch-unpin",
        summary: nextPinned
            ? `批量置顶 ${targetSnapshots.length} 个发布版本`
            : `批量取消置顶 ${targetSnapshots.length} 个发布版本`,
        snapshotIds: targetSnapshots.map((item) => item.id),
        snapshotNames: targetSnapshots.map((item) => item.name),
    });
    statusMessage.value = nextPinned
        ? `已批量置顶 ${targetSnapshots.length} 个发布版本`
        : `已批量取消置顶 ${targetSnapshots.length} 个发布版本`;
    return true;
}

function batchSetPublishedSnapshotLock(nextLocked) {
    if (!selectedProjectPublishedSnapshots.value.length) {
        statusMessage.value = `请先选择要${nextLocked ? "锁定" : "解锁"}的发布版本`;
        return false;
    }

    const targetSnapshots = selectedProjectPublishedSnapshots.value.filter(
        (item) => item.locked !== nextLocked,
    );

    if (!targetSnapshots.length) {
        statusMessage.value = nextLocked
            ? "所选发布版本已全部锁定"
            : "所选发布版本当前都未锁定";
        return false;
    }

    const targetIds = new Set(targetSnapshots.map((item) => item.id));
    const nextSnapshots = sortPublishedSnapshotCollection(
        publishedSnapshots.value.map((item) =>
            targetIds.has(item.id)
                ? {
                      ...item,
                      locked: nextLocked,
                  }
                : item,
        ),
    );

    publishedSnapshots.value = nextSnapshots;
    persistPublishedSnapshotLibrary(nextSnapshots);
    publishDiffSnapshotId.value =
        targetSnapshots[0]?.id ?? publishDiffSnapshotId.value;

    if (nextLocked && targetIds.has(editingPublishedSnapshotId.value)) {
        resetPublishDraft();
        publishDiffSnapshotId.value =
            targetSnapshots[0]?.id ?? publishDiffSnapshotId.value;
    }

    appendPublishedOperationLog({
        action: nextLocked ? "batch-lock" : "batch-unlock",
        summary: nextLocked
            ? `批量锁定 ${targetSnapshots.length} 个发布版本`
            : `批量解除锁定 ${targetSnapshots.length} 个发布版本`,
        snapshotIds: targetSnapshots.map((item) => item.id),
        snapshotNames: targetSnapshots.map((item) => item.name),
    });
    statusMessage.value = nextLocked
        ? `已批量锁定 ${targetSnapshots.length} 个发布版本`
        : `已批量解除锁定 ${targetSnapshots.length} 个发布版本`;
    return true;
}

function batchDeletePublishedSnapshots() {
    if (!selectedProjectPublishedSnapshots.value.length) {
        statusMessage.value = "请先选择要删除的发布版本";
        return false;
    }

    const deletableSnapshots = selectedProjectPublishedSnapshots.value.filter(
        (item) => !item.locked,
    );
    const skippedLockedCount =
        selectedProjectPublishedSnapshots.value.length - deletableSnapshots.length;

    if (!deletableSnapshots.length) {
        statusMessage.value = "所选发布版本已锁定，解锁后可删除";
        return false;
    }

    const deletedIds = new Set(deletableSnapshots.map((item) => item.id));
    const nextSnapshots = publishedSnapshots.value.filter(
        (item) => !deletedIds.has(item.id),
    );
    const nextCurrentProjectSnapshots = sortPublishedSnapshotCollection(
        nextSnapshots.filter(
            (item) => item.projectRecordId === activeProjectRecordId.value,
        ),
    );

    publishedSnapshots.value = nextSnapshots;
    persistPublishedSnapshotLibrary(nextSnapshots);

    if (deletedIds.has(editingPublishedSnapshotId.value)) {
        resetPublishDraft();
    }

    if (deletedIds.has(publishDiffSnapshotId.value)) {
        publishDiffSnapshotId.value = nextCurrentProjectSnapshots[0]?.id ?? "";
    }

    if (deletedIds.has(approvalTimelineSnapshotId.value)) {
        approvalTimelineSnapshotId.value = "";
    }

    if (deletedIds.has(pendingRollbackSnapshotId.value)) {
        pendingRollbackSnapshotId.value = "";
    }

    setSelectedPublishedSnapshotIds(
        selectedPublishedSnapshotIds.value.filter((id) => !deletedIds.has(id)),
        nextCurrentProjectSnapshots,
    );
    appendPublishedOperationLog({
        action: "batch-delete",
        summary: `批量删除 ${deletableSnapshots.length} 个发布版本`,
        detail: skippedLockedCount
            ? `跳过 ${skippedLockedCount} 个已锁定版本`
            : "",
        snapshotIds: deletableSnapshots.map((item) => item.id),
        snapshotNames: deletableSnapshots.map((item) => item.name),
    });
    statusMessage.value = skippedLockedCount
        ? `已删除 ${deletableSnapshots.length} 个发布版本，跳过 ${skippedLockedCount} 个已锁定版本`
        : `已批量删除 ${deletableSnapshots.length} 个发布版本`;
    return true;
}

function batchApplyPublishedSnapshotMeta() {
    if (!selectedProjectPublishedSnapshots.value.length) {
        statusMessage.value = "请先选择要批量编辑的发布版本";
        return false;
    }

    if (
        !publishedSnapshotBatchApplyNote.value &&
        !publishedSnapshotBatchApplyTags.value &&
        !publishedSnapshotBatchApplyEnvironment.value &&
        !publishedSnapshotBatchApplyApprovalStatus.value
    ) {
        statusMessage.value = "请先勾选要批量应用的字段";
        return false;
    }

    const editableSnapshots = selectedProjectPublishedSnapshots.value.filter(
        (item) => !item.locked,
    );
    const skippedLockedCount =
        selectedProjectPublishedSnapshots.value.length - editableSnapshots.length;

    if (!editableSnapshots.length) {
        statusMessage.value = "所选发布版本已锁定，解锁后可批量编辑";
        return false;
    }

    const nextNote = publishedSnapshotBatchApplyNote.value
        ? String(publishedSnapshotDraftNote.value || "").trim()
        : null;
    const nextTags = publishedSnapshotBatchApplyTags.value
        ? normalizePublishedTagList(publishedSnapshotDraftTags.value)
        : null;
    const nextEnvironment = publishedSnapshotBatchApplyEnvironment.value
        ? normalizePublishedEnvironment(publishedSnapshotDraftEnvironment.value)
        : null;
    const editableIds = new Set(editableSnapshots.map((item) => item.id));
    let changedCount = 0;

    const nextSnapshots = sortPublishedSnapshotCollection(
        publishedSnapshots.value.map((item) => {
            if (!editableIds.has(item.id)) {
                return item;
            }

            const nextApprovalMeta = publishedSnapshotBatchApplyApprovalStatus.value
                ? applyPublishedApprovalMeta(item, {
                      approvalStatus: publishedSnapshotDraftApprovalStatus.value,
                      approvalReviewer: publishedSnapshotDraftApprovalReviewer.value,
                      approvalComment: publishedSnapshotDraftApprovalComment.value,
                  })
                : {
                      approvalChanged: false,
                      approvalStatus: item.approvalStatus,
                      approvalReviewer: item.approvalReviewer,
                      approvalComment: item.approvalComment,
                      approvalUpdatedAt: item.approvalUpdatedAt,
                      approvalHistory: item.approvalHistory,
                  };
            const updatedItem = {
                ...item,
                note: publishedSnapshotBatchApplyNote.value ? nextNote : item.note,
                tags: publishedSnapshotBatchApplyTags.value ? nextTags : item.tags,
                environment: publishedSnapshotBatchApplyEnvironment.value
                    ? nextEnvironment
                    : item.environment,
                approvalStatus: nextApprovalMeta.approvalStatus,
                approvalReviewer: nextApprovalMeta.approvalReviewer,
                approvalComment: nextApprovalMeta.approvalComment,
                approvalUpdatedAt: nextApprovalMeta.approvalUpdatedAt,
                approvalHistory: nextApprovalMeta.approvalHistory,
            };

            if (
                updatedItem.note !== item.note ||
                updatedItem.environment !== item.environment ||
                nextApprovalMeta.approvalChanged ||
                JSON.stringify(updatedItem.tags ?? []) !==
                    JSON.stringify(item.tags ?? [])
            ) {
                changedCount += 1;
            }

            return updatedItem;
        }),
    );

    if (!changedCount) {
        statusMessage.value = "所选发布版本的审批、环境、备注和标签没有变化";
        return false;
    }

    publishedSnapshots.value = nextSnapshots;
    persistPublishedSnapshotLibrary(nextSnapshots);
    publishDiffSnapshotId.value = editableSnapshots[0]?.id ?? publishDiffSnapshotId.value;
    pendingRollbackSnapshotId.value = "";
    appendPublishedOperationLog({
        action: "batch-update-meta",
        summary: `批量更新 ${changedCount} 个发布版本信息`,
        detail: [
            publishedSnapshotBatchApplyApprovalStatus.value
                ? buildPublishedApprovalSummary(
                      publishedSnapshotDraftApprovalStatus.value,
                      publishedSnapshotDraftApprovalReviewer.value,
                      publishedSnapshotDraftApprovalComment.value,
                  )
                : "",
            publishedSnapshotBatchApplyEnvironment.value
                ? `环境：${formatPublishedEnvironmentLabel(nextEnvironment)}`
                : "",
            publishedSnapshotBatchApplyNote.value ? "备注已更新" : "",
            publishedSnapshotBatchApplyTags.value ? "标签已更新" : "",
        ]
            .filter(Boolean)
            .join(" · "),
        snapshotIds: editableSnapshots.map((item) => item.id),
        snapshotNames: editableSnapshots.map((item) => item.name),
    });
    statusMessage.value = skippedLockedCount
        ? `已批量更新 ${changedCount} 个发布版本，跳过 ${skippedLockedCount} 个已锁定版本`
        : `已批量更新 ${changedCount} 个发布版本的审批/环境/备注/标签`;
    return true;
}

function batchSetPublishedSnapshotApprovalStatus(nextStatus) {
    const targetStatus = normalizePublishedApprovalStatus(nextStatus);
    const actionText = targetStatus === "approved" ? "通过" : "驳回";
    const actionLabel = targetStatus === "approved" ? "审批通过" : "驳回";

    if (!selectedProjectPublishedSnapshots.value.length) {
        statusMessage.value = `请先选择要批量${actionText}的发布版本`;
        return false;
    }

    const editableSnapshots = selectedProjectPublishedSnapshots.value.filter(
        (item) => !item.locked,
    );
    const skippedLockedCount =
        selectedProjectPublishedSnapshots.value.length - editableSnapshots.length;

    if (!editableSnapshots.length) {
        statusMessage.value = "所选发布版本已锁定，解锁后可批量审批";
        return false;
    }

    const eligibleSnapshots = editableSnapshots.filter(
        (item) =>
            normalizePublishedApprovalStatus(item.approvalStatus) !== targetStatus,
    );
    const skippedSameStatusCount =
        editableSnapshots.length - eligibleSnapshots.length;

    if (!eligibleSnapshots.length) {
        statusMessage.value =
            targetStatus === "approved"
                ? "所选未锁定发布版本已全部审批通过"
                : "所选未锁定发布版本已全部驳回";
        return false;
    }

    const reviewerInput = normalizePublishedApprovalReviewer(
        publishedSnapshotDraftApprovalReviewer.value,
    );
    const commentInput = normalizePublishedApprovalComment(
        publishedSnapshotDraftApprovalComment.value,
    );
    const explicitOverrides = {
        preferEditingDraft: false,
        ...(reviewerInput ? { approvalReviewer: reviewerInput } : {}),
        ...(commentInput ? { approvalComment: commentInput } : {}),
    };
    const eligibleIds = new Set(eligibleSnapshots.map((item) => item.id));
    const nextSnapshots = sortPublishedSnapshotCollection(
        publishedSnapshots.value.map((item) => {
            if (!eligibleIds.has(item.id)) {
                return item;
            }

            const nextApprovalMeta = applyPublishedApprovalMeta(
                item,
                resolvePublishedSnapshotApprovalQuickPayload(
                    item,
                    targetStatus,
                    explicitOverrides,
                ),
            );

            return {
                ...item,
                approvalStatus: nextApprovalMeta.approvalStatus,
                approvalReviewer: nextApprovalMeta.approvalReviewer,
                approvalComment: nextApprovalMeta.approvalComment,
                approvalUpdatedAt: nextApprovalMeta.approvalUpdatedAt,
                approvalHistory: nextApprovalMeta.approvalHistory,
            };
        }),
    );

    publishedSnapshots.value = nextSnapshots;
    persistPublishedSnapshotLibrary(nextSnapshots);
    publishDiffSnapshotId.value =
        eligibleSnapshots[0]?.id ?? publishDiffSnapshotId.value;
    pendingRollbackSnapshotId.value = "";

    if (eligibleIds.has(editingPublishedSnapshotId.value)) {
        const activeSnapshot =
            nextSnapshots.find(
                (item) => item.id === editingPublishedSnapshotId.value,
            ) ?? null;

        if (activeSnapshot) {
            publishedSnapshotDraftName.value = activeSnapshot.name;
            publishedSnapshotDraftNote.value = activeSnapshot.note || "";
            publishedSnapshotDraftEnvironment.value = normalizePublishedEnvironment(
                activeSnapshot.environment,
            );
            publishedSnapshotDraftApprovalStatus.value =
                normalizePublishedApprovalStatus(activeSnapshot.approvalStatus);
            publishedSnapshotDraftApprovalReviewer.value =
                normalizePublishedApprovalReviewer(
                    activeSnapshot.approvalReviewer,
                );
            publishedSnapshotDraftApprovalComment.value =
                normalizePublishedApprovalComment(activeSnapshot.approvalComment);
            publishedSnapshotDraftTags.value = formatPublishedTagList(
                activeSnapshot.tags,
            );
        }
    }

    appendPublishedOperationLog({
        action: targetStatus === "approved" ? "batch-approve" : "batch-reject",
        summary:
            targetStatus === "approved"
                ? `批量审批通过 ${eligibleSnapshots.length} 个发布版本`
                : `批量驳回 ${eligibleSnapshots.length} 个发布版本`,
        detail: [
            buildPublishedApprovalSummary(
                targetStatus,
                reviewerInput,
                commentInput,
            ),
            skippedSameStatusCount
                ? `跳过 ${skippedSameStatusCount} 个已是${actionLabel}状态的版本`
                : "",
            skippedLockedCount
                ? `跳过 ${skippedLockedCount} 个已锁定版本`
                : "",
        ]
            .filter(Boolean)
            .join(" · "),
        snapshotIds: eligibleSnapshots.map((item) => item.id),
        snapshotNames: eligibleSnapshots.map((item) => item.name),
    });
    statusMessage.value = [
        `已批量${actionText} ${eligibleSnapshots.length} 个发布版本`,
        skippedSameStatusCount
            ? `跳过 ${skippedSameStatusCount} 个重复状态`
            : "",
        skippedLockedCount ? `跳过 ${skippedLockedCount} 个锁定版本` : "",
    ]
        .filter(Boolean)
        .join("，");
    return true;
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

function resetPublishDraft(options = {}) {
    publishedSnapshotDraftName.value = buildPublishedSnapshotDraftName();
    publishedSnapshotDraftNote.value = "";
    publishedSnapshotDraftEnvironment.value =
        latestProjectPublishedSnapshot.value?.environment ??
        DEFAULT_PUBLISHED_ENVIRONMENT;
    publishedSnapshotDraftApprovalStatus.value =
        latestProjectPublishedSnapshot.value?.approvalStatus ??
        DEFAULT_PUBLISHED_APPROVAL_STATUS;
    publishedSnapshotDraftApprovalReviewer.value = "";
    publishedSnapshotDraftApprovalComment.value = "";
    publishedSnapshotDraftTags.value = "";
    approvalTimelineSnapshotId.value = "";
    pendingRollbackSnapshotId.value = "";

    if (options.keepEditing !== true) {
        editingPublishedSnapshotId.value = "";
    }

    if (options.clearDiff) {
        publishDiffSnapshotId.value = "";
    }
}

function openPublishManagerDialog() {
    resetPublishDraft({ clearDiff: true });
    resetPublishedSnapshotFilters();
    resetPublishedSnapshotBatchOptions();
    resetPublishedRollbackFilters();
    resetPublishedOperationFilters();
    clearPublishedSnapshotSelection();
    publishDiffSnapshotId.value = latestProjectPublishedSnapshot.value?.id ?? "";
    pendingRollbackSnapshotId.value = "";
    dialogMode.value = "project-publish";
}

function startPublishedSnapshotEdit(snapshotId) {
    const snapshot =
        publishedSnapshots.value.find((item) => item.id === snapshotId) ?? null;

    if (!snapshot) {
        statusMessage.value = "发布快照不存在，无法编辑";
        return false;
    }

    if (snapshot.locked) {
        statusMessage.value = "发布版本已锁定，解锁后可编辑";
        return false;
    }

    editingPublishedSnapshotId.value = snapshot.id;
    publishDiffSnapshotId.value = snapshot.id;
    publishedSnapshotDraftName.value = snapshot.name;
    publishedSnapshotDraftNote.value = snapshot.note || "";
    publishedSnapshotDraftEnvironment.value = normalizePublishedEnvironment(
        snapshot.environment,
    );
    publishedSnapshotDraftApprovalStatus.value =
        normalizePublishedApprovalStatus(snapshot.approvalStatus);
    publishedSnapshotDraftApprovalReviewer.value =
        normalizePublishedApprovalReviewer(snapshot.approvalReviewer);
    publishedSnapshotDraftApprovalComment.value =
        normalizePublishedApprovalComment(snapshot.approvalComment);
    publishedSnapshotDraftTags.value = formatPublishedTagList(snapshot.tags);
    pendingRollbackSnapshotId.value = "";
    statusMessage.value = `正在编辑发布信息：${snapshot.name}`;
    return true;
}

function cancelPublishedSnapshotEdit() {
    resetPublishDraft();
    statusMessage.value = "已取消发布信息编辑";
}

function publishCurrentProjectSnapshot() {
    const snapshot = buildPublishedSnapshotRecord(project.value, {
        name: publishedSnapshotDraftName.value,
        note: publishedSnapshotDraftNote.value,
        environment: publishedSnapshotDraftEnvironment.value,
        approvalStatus: publishedSnapshotDraftApprovalStatus.value,
        approvalReviewer: publishedSnapshotDraftApprovalReviewer.value,
        approvalComment: publishedSnapshotDraftApprovalComment.value,
        tags: publishedSnapshotDraftTags.value,
        projectRecordId: activeProjectRecordId.value,
        projectName: currentProjectName.value,
        pageId: currentPageId.value,
    });

    publishedSnapshots.value = sortPublishedSnapshotCollection([
        snapshot,
        ...publishedSnapshots.value,
    ]);
    persistPublishedSnapshotLibrary(publishedSnapshots.value);
    editingPublishedSnapshotId.value = "";
    publishDiffSnapshotId.value = snapshot.id;
    pendingRollbackSnapshotId.value = "";
    publishedSnapshotDraftName.value = snapshot.name;
    publishedSnapshotDraftNote.value = snapshot.note || "";
    publishedSnapshotDraftEnvironment.value = snapshot.environment;
    publishedSnapshotDraftApprovalStatus.value = snapshot.approvalStatus;
    publishedSnapshotDraftApprovalReviewer.value = snapshot.approvalReviewer || "";
    publishedSnapshotDraftApprovalComment.value = snapshot.approvalComment || "";
    publishedSnapshotDraftTags.value = formatPublishedTagList(snapshot.tags);
    appendPublishedOperationLog({
        action: "publish",
        summary: `生成发布快照：${snapshot.name}`,
        detail: `${snapshot.pageName} · ${formatPublishedEnvironmentLabel(snapshot.environment)} · ${buildPublishedApprovalSummary(snapshot.approvalStatus, snapshot.approvalReviewer, snapshot.approvalComment)}`,
        snapshotIds: [snapshot.id],
        snapshotNames: [snapshot.name],
    });
    statusMessage.value = `已发布快照：${snapshot.name}`;
}

function updatePublishedSnapshotMeta(snapshotId, options = {}) {
    const snapshot =
        publishedSnapshots.value.find((item) => item.id === snapshotId) ?? null;

    if (!snapshot) {
        statusMessage.value = "发布快照不存在，无法更新";
        return false;
    }

    if (snapshot.locked) {
        statusMessage.value = "发布版本已锁定，解锁后可修改信息";
        return false;
    }

    const nextName =
        typeof options.name === "string" && options.name.trim()
            ? options.name.trim()
            : snapshot.name;
    const nextNote =
        typeof options.note === "string" ? options.note.trim() : snapshot.note;
    const nextEnvironment = normalizePublishedEnvironment(
        options.environment ?? snapshot.environment,
    );
    const nextTags = normalizePublishedTagList(options.tags ?? snapshot.tags);
    const nextApprovalMeta = applyPublishedApprovalMeta(snapshot, {
        approvalStatus: options.approvalStatus,
        approvalReviewer: options.approvalReviewer,
        approvalComment: options.approvalComment,
    });
    const operationAction =
        typeof options.operationAction === "string" &&
        options.operationAction.trim()
            ? options.operationAction.trim()
            : "update-meta";

    if (
        nextName === snapshot.name &&
        nextNote === snapshot.note &&
        nextEnvironment === snapshot.environment &&
        !nextApprovalMeta.approvalChanged &&
        JSON.stringify(nextTags) === JSON.stringify(snapshot.tags ?? [])
    ) {
        statusMessage.value = "发布信息没有变化";
        return false;
    }

    publishedSnapshots.value = sortPublishedSnapshotCollection(
        publishedSnapshots.value.map((item) =>
            item.id === snapshotId
                ? {
                      ...item,
                      name: nextName,
                      note: nextNote,
                      environment: nextEnvironment,
                      approvalStatus: nextApprovalMeta.approvalStatus,
                      approvalReviewer: nextApprovalMeta.approvalReviewer,
                      approvalComment: nextApprovalMeta.approvalComment,
                      approvalUpdatedAt: nextApprovalMeta.approvalUpdatedAt,
                      approvalHistory: nextApprovalMeta.approvalHistory,
                      tags: nextTags,
                  }
                : item,
        ),
    );
    persistPublishedSnapshotLibrary(publishedSnapshots.value);
    publishedSnapshotDraftName.value = nextName;
    publishedSnapshotDraftNote.value = nextNote;
    publishedSnapshotDraftEnvironment.value = nextEnvironment;
    publishedSnapshotDraftApprovalStatus.value = nextApprovalMeta.approvalStatus;
    publishedSnapshotDraftApprovalReviewer.value =
        nextApprovalMeta.approvalReviewer;
    publishedSnapshotDraftApprovalComment.value =
        nextApprovalMeta.approvalComment;
    publishedSnapshotDraftTags.value = formatPublishedTagList(nextTags);
    publishDiffSnapshotId.value = snapshotId;
    pendingRollbackSnapshotId.value = "";
    appendPublishedOperationLog({
        action: operationAction,
        summary:
            typeof options.operationSummary === "string" &&
            options.operationSummary.trim()
                ? options.operationSummary.trim()
                : `更新发布信息：${nextName}`,
        detail: [
            nextEnvironment !== snapshot.environment
                ? `环境切换为 ${formatPublishedEnvironmentLabel(nextEnvironment)}`
                : "",
            nextApprovalMeta.approvalChanged
                ? buildPublishedApprovalSummary(
                      nextApprovalMeta.approvalStatus,
                      nextApprovalMeta.approvalReviewer,
                      nextApprovalMeta.approvalComment,
                  )
                : "",
            nextNote !== snapshot.note ? "备注已更新" : "",
            JSON.stringify(nextTags) !== JSON.stringify(snapshot.tags ?? [])
                ? "标签已更新"
                : "",
        ]
            .filter(Boolean)
            .join(" · "),
        snapshotIds: [snapshotId],
        snapshotNames: [nextName],
    });
    statusMessage.value =
        typeof options.statusMessage === "string" && options.statusMessage.trim()
            ? options.statusMessage.trim()
            : `已更新发布信息：${nextName}`;
    return true;
}

function resolvePublishedSnapshotApprovalQuickPayload(
    snapshot,
    nextStatus,
    options = {},
) {
    const targetStatus = normalizePublishedApprovalStatus(nextStatus);
    const hasApprovalReviewer = Object.prototype.hasOwnProperty.call(
        options,
        "approvalReviewer",
    );
    const hasApprovalComment = Object.prototype.hasOwnProperty.call(
        options,
        "approvalComment",
    );
    const preferEditingDraft = options.preferEditingDraft !== false;
    const isEditingTarget =
        preferEditingDraft && editingPublishedSnapshotId.value === snapshot.id;

    return {
        approvalStatus: targetStatus,
        approvalReviewer: hasApprovalReviewer
            ? options.approvalReviewer
            : isEditingTarget
              ? publishedSnapshotDraftApprovalReviewer.value
              : snapshot.approvalReviewer,
        approvalComment: hasApprovalComment
            ? options.approvalComment
            : isEditingTarget
              ? publishedSnapshotDraftApprovalComment.value
              : normalizePublishedApprovalStatus(snapshot.approvalStatus) ===
                  targetStatus
                ? snapshot.approvalComment
                : "",
    };
}

function quickApprovePublishedSnapshot(snapshotId) {
    const snapshot =
        publishedSnapshots.value.find((item) => item.id === snapshotId) ?? null;

    if (!snapshot) {
        statusMessage.value = "发布快照不存在，无法审批通过";
        return false;
    }

    return updatePublishedSnapshotMeta(snapshotId, {
        ...resolvePublishedSnapshotApprovalQuickPayload(snapshot, "approved"),
        operationAction: "approve",
        operationSummary: `审批通过：${snapshot.name}`,
        statusMessage: `已审批通过：${snapshot.name}`,
    });
}

function quickRejectPublishedSnapshot(snapshotId) {
    const snapshot =
        publishedSnapshots.value.find((item) => item.id === snapshotId) ?? null;

    if (!snapshot) {
        statusMessage.value = "发布快照不存在，无法驳回";
        return false;
    }

    return updatePublishedSnapshotMeta(snapshotId, {
        ...resolvePublishedSnapshotApprovalQuickPayload(snapshot, "rejected"),
        operationAction: "reject",
        operationSummary: `审批驳回：${snapshot.name}`,
        statusMessage: `已驳回发布版本：${snapshot.name}`,
    });
}

function applyPublishedSnapshotDraft() {
    if (editingPublishedSnapshotId.value) {
        return updatePublishedSnapshotMeta(editingPublishedSnapshotId.value, {
            name: publishedSnapshotDraftName.value,
            note: publishedSnapshotDraftNote.value,
            environment: publishedSnapshotDraftEnvironment.value,
            approvalStatus: publishedSnapshotDraftApprovalStatus.value,
            approvalReviewer: publishedSnapshotDraftApprovalReviewer.value,
            approvalComment: publishedSnapshotDraftApprovalComment.value,
            tags: publishedSnapshotDraftTags.value,
        });
    }

    publishCurrentProjectSnapshot();
    return true;
}

function overwritePublishedSnapshot(snapshotId, options = {}) {
    const targetSnapshot =
        publishedSnapshots.value.find((item) => item.id === snapshotId) ?? null;

    if (!targetSnapshot) {
        statusMessage.value = "发布快照不存在，无法覆盖";
        return false;
    }

    if (targetSnapshot.locked) {
        statusMessage.value = "发布版本已锁定，解锁后可覆盖";
        return false;
    }

    const nextApprovalMeta = applyPublishedApprovalMeta(targetSnapshot, {
        approvalStatus: options.approvalStatus,
        approvalReviewer: options.approvalReviewer,
        approvalComment: options.approvalComment,
    });
    const nextSnapshot = buildPublishedSnapshotRecord(project.value, {
        name:
            typeof options.name === "string"
                ? options.name
                : targetSnapshot.name,
        note:
            typeof options.note === "string"
                ? options.note
                : targetSnapshot.note,
        environment:
            options.environment ?? targetSnapshot.environment,
        approvalStatus: nextApprovalMeta.approvalStatus,
        approvalReviewer: nextApprovalMeta.approvalReviewer,
        approvalComment: nextApprovalMeta.approvalComment,
        tags: options.tags ?? targetSnapshot.tags,
        projectRecordId: activeProjectRecordId.value,
        projectName: currentProjectName.value,
        pageId: currentPageId.value,
    });

    const mergedSnapshot = {
        ...targetSnapshot,
        ...nextSnapshot,
        id: targetSnapshot.id,
        createdAt: targetSnapshot.createdAt,
        pinned: Boolean(targetSnapshot.pinned),
        pinnedAt: Number(targetSnapshot.pinnedAt) || 0,
        approvalUpdatedAt: nextApprovalMeta.approvalUpdatedAt,
        approvalHistory: nextApprovalMeta.approvalHistory,
    };

    publishedSnapshots.value = sortPublishedSnapshotCollection(
        publishedSnapshots.value.map((item) =>
            item.id === snapshotId ? mergedSnapshot : item,
        ),
    );
    persistPublishedSnapshotLibrary(publishedSnapshots.value);
    publishDiffSnapshotId.value = snapshotId;
    publishedSnapshotDraftName.value = mergedSnapshot.name;
    publishedSnapshotDraftNote.value = mergedSnapshot.note || "";
    publishedSnapshotDraftEnvironment.value = normalizePublishedEnvironment(
        mergedSnapshot.environment,
    );
    publishedSnapshotDraftApprovalStatus.value =
        normalizePublishedApprovalStatus(mergedSnapshot.approvalStatus);
    publishedSnapshotDraftApprovalReviewer.value =
        normalizePublishedApprovalReviewer(mergedSnapshot.approvalReviewer);
    publishedSnapshotDraftApprovalComment.value =
        normalizePublishedApprovalComment(mergedSnapshot.approvalComment);
    publishedSnapshotDraftTags.value = formatPublishedTagList(mergedSnapshot.tags);
    pendingRollbackSnapshotId.value = "";
    appendPublishedOperationLog({
        action: "overwrite",
        summary: `覆盖发布快照：${mergedSnapshot.name}`,
        detail: `${mergedSnapshot.pageName} · ${formatPublishedEnvironmentLabel(mergedSnapshot.environment)} · ${buildPublishedApprovalSummary(mergedSnapshot.approvalStatus, mergedSnapshot.approvalReviewer, mergedSnapshot.approvalComment)}`,
        snapshotIds: [snapshotId],
        snapshotNames: [mergedSnapshot.name],
    });
    statusMessage.value = `已覆盖发布快照：${mergedSnapshot.name}`;
    return true;
}

function overwriteLatestPublishedSnapshot() {
    if (!latestProjectPublishedSnapshot.value) {
        statusMessage.value = "当前项目还没有可覆盖的发布快照";
        return false;
    }

    return overwritePublishedSnapshot(latestProjectPublishedSnapshot.value.id);
}

function togglePublishedSnapshotDiff(snapshotId) {
    publishDiffSnapshotId.value =
        publishDiffSnapshotId.value === snapshotId ? "" : snapshotId;
}

function togglePublishedSnapshotApprovalTimeline(snapshotId) {
    approvalTimelineSnapshotId.value =
        approvalTimelineSnapshotId.value === snapshotId ? "" : snapshotId;
}

function togglePublishedSnapshotPin(snapshotId) {
    const snapshot =
        publishedSnapshots.value.find((item) => item.id === snapshotId) ?? null;

    if (!snapshot) {
        statusMessage.value = "发布快照不存在，无法切换置顶状态";
        return false;
    }

    const nextPinned = !snapshot.pinned;
    const nextSnapshots = sortPublishedSnapshotCollection(
        publishedSnapshots.value.map((item) =>
            item.id === snapshotId
                ? {
                      ...item,
                      pinned: nextPinned,
                      pinnedAt: nextPinned ? Date.now() : 0,
                  }
                : item,
        ),
    );

    publishedSnapshots.value = nextSnapshots;
    persistPublishedSnapshotLibrary(nextSnapshots);
    publishDiffSnapshotId.value = snapshotId;
    appendPublishedOperationLog({
        action: nextPinned ? "pin" : "unpin",
        summary: nextPinned
            ? `置顶发布版本：${snapshot.name}`
            : `取消置顶：${snapshot.name}`,
        snapshotIds: [snapshotId],
        snapshotNames: [snapshot.name],
    });
    statusMessage.value = nextPinned
        ? `已置顶发布版本：${snapshot.name}`
        : `已取消置顶：${snapshot.name}`;
    return true;
}

function togglePublishedSnapshotLock(snapshotId) {
    const snapshot =
        publishedSnapshots.value.find((item) => item.id === snapshotId) ?? null;

    if (!snapshot) {
        statusMessage.value = "发布快照不存在，无法切换锁定状态";
        return false;
    }

    const nextLocked = !snapshot.locked;
    const nextSnapshots = sortPublishedSnapshotCollection(
        publishedSnapshots.value.map((item) =>
            item.id === snapshotId
                ? {
                      ...item,
                      locked: nextLocked,
                  }
                : item,
        ),
    );

    publishedSnapshots.value = nextSnapshots;
    persistPublishedSnapshotLibrary(nextSnapshots);
    publishDiffSnapshotId.value = snapshotId;

    if (nextLocked && editingPublishedSnapshotId.value === snapshotId) {
        resetPublishDraft();
        publishDiffSnapshotId.value = snapshotId;
    }

    appendPublishedOperationLog({
        action: nextLocked ? "lock" : "unlock",
        summary: nextLocked
            ? `锁定发布版本：${snapshot.name}`
            : `解除锁定：${snapshot.name}`,
        snapshotIds: [snapshotId],
        snapshotNames: [snapshot.name],
    });
    statusMessage.value = nextLocked
        ? `已锁定发布版本：${snapshot.name}`
        : `已解除锁定：${snapshot.name}`;
    return true;
}

function requestPublishedSnapshotRollback(snapshotId) {
    const snapshot =
        publishedSnapshots.value.find((item) => item.id === snapshotId) ?? null;

    if (!snapshot) {
        statusMessage.value = "发布快照不存在，无法准备回滚";
        return false;
    }

    pendingRollbackSnapshotId.value = snapshotId;
    publishDiffSnapshotId.value = snapshotId;
    statusMessage.value = `请确认是否回滚到发布版本：${snapshot.name}`;
    return true;
}

function cancelPublishedSnapshotRollback() {
    pendingRollbackSnapshotId.value = "";
    statusMessage.value = "已取消本次回滚确认";
}

function confirmPublishedSnapshotRollback(snapshotId = pendingRollbackSnapshotId.value) {
    if (!snapshotId) {
        statusMessage.value = "当前没有待确认的回滚版本";
        return false;
    }

    const restored = restorePublishedSnapshotToEditor(snapshotId);

    if (restored) {
        pendingRollbackSnapshotId.value = "";
    }

    return restored;
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
        appendPublishedOperationLog({
            action: "copy-link",
            projectRecordId: snapshot.projectRecordId,
            projectName: snapshot.projectName,
            summary: `复制发布链接：${snapshot.name}`,
            detail: `${snapshot.pageName} · ${formatPublishedEnvironmentLabel(snapshot.environment)}`,
            snapshotIds: [snapshot.id],
            snapshotNames: [snapshot.name],
        });
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

    if (snapshot.locked) {
        statusMessage.value = "发布版本已锁定，解锁后可删除";
        return;
    }

    const nextSnapshots = publishedSnapshots.value.filter(
        (item) => item.id !== snapshotId,
    );
    const nextCurrentProjectSnapshots = sortPublishedSnapshotCollection(
        nextSnapshots.filter(
            (item) => item.projectRecordId === activeProjectRecordId.value,
        ),
    );

    publishedSnapshots.value = nextSnapshots;
    persistPublishedSnapshotLibrary(nextSnapshots);

    if (editingPublishedSnapshotId.value === snapshotId) {
        resetPublishDraft();
    }

    if (publishDiffSnapshotId.value === snapshotId) {
        publishDiffSnapshotId.value = nextCurrentProjectSnapshots[0]?.id ?? "";
    }

    if (approvalTimelineSnapshotId.value === snapshotId) {
        approvalTimelineSnapshotId.value = "";
    }

    if (pendingRollbackSnapshotId.value === snapshotId) {
        pendingRollbackSnapshotId.value = "";
    }

    setSelectedPublishedSnapshotIds(
        selectedPublishedSnapshotIds.value.filter((id) => id !== snapshotId),
        nextCurrentProjectSnapshots,
    );

    appendPublishedOperationLog({
        action: "delete",
        projectRecordId: snapshot.projectRecordId,
        projectName: snapshot.projectName,
        summary: `删除发布快照：${snapshot.name}`,
        detail: `${snapshot.pageName} · ${formatPublishedEnvironmentLabel(snapshot.environment)}`,
        snapshotIds: [snapshot.id],
        snapshotNames: [snapshot.name],
    });
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

    if (
        !nextSnapshots.some((item) => item.id === editingPublishedSnapshotId.value)
    ) {
        editingPublishedSnapshotId.value = "";
    }

    if (!nextSnapshots.some((item) => item.id === publishDiffSnapshotId.value)) {
        publishDiffSnapshotId.value = "";
    }

    if (!nextSnapshots.some((item) => item.id === approvalTimelineSnapshotId.value)) {
        approvalTimelineSnapshotId.value = "";
    }

    if (!nextSnapshots.some((item) => item.id === pendingRollbackSnapshotId.value)) {
        pendingRollbackSnapshotId.value = "";
    }

    if (projectRecordId === activeProjectRecordId.value) {
        clearPublishedSnapshotSelection();
    }
}

function restorePublishedSnapshotToEditor(snapshotId) {
    const snapshot =
        publishedSnapshots.value.find((item) => item.id === snapshotId) ?? null;

    if (!snapshot) {
        statusMessage.value = "发布快照不存在，无法回滚";
        return false;
    }

    const previousSnapshot = createProjectSnapshot();
    const previousLabel = currentHistoryLabel.value;
    const rollbackSummary =
        buildPublishedSnapshotDiffSummary(snapshot, project.value).summary;
    const restoredProject = hydrateProjectSourceSecrets(
        JSON.parse(snapshot.snapshot),
        activeProjectRecordId.value || snapshot.projectRecordId,
    );

    if (snapshot.pageId && restoredProject.pages.some((page) => page.id === snapshot.pageId)) {
        restoredProject.activePageId = snapshot.pageId;
    }

    applyProjectState(restoredProject, {
        closeDialog: false,
        statusMessage: `已回滚到发布版本：${snapshot.name}`,
    });
    persistEditorProjectState(restoredProject);
    pushUndoEntry(createHistoryEntry(previousSnapshot, previousLabel));
    currentHistoryLabel.value = `回滚至 ${snapshot.name}`;
    lastHistoryCommitAt.value = Date.now();
    lastHistoryCommitLabel.value = currentHistoryLabel.value;
    publishedSnapshotDraftName.value = snapshot.name;
    publishedSnapshotDraftNote.value = snapshot.note || "";
    publishedSnapshotDraftEnvironment.value = normalizePublishedEnvironment(
        snapshot.environment,
    );
    publishedSnapshotDraftApprovalStatus.value =
        normalizePublishedApprovalStatus(snapshot.approvalStatus);
    publishedSnapshotDraftApprovalReviewer.value =
        normalizePublishedApprovalReviewer(snapshot.approvalReviewer);
    publishedSnapshotDraftApprovalComment.value =
        normalizePublishedApprovalComment(snapshot.approvalComment);
    publishedSnapshotDraftTags.value = formatPublishedTagList(snapshot.tags);
    editingPublishedSnapshotId.value = snapshot.id;
    publishDiffSnapshotId.value = snapshot.id;
    pendingRollbackSnapshotId.value = "";
    appendPublishedRollbackLog(snapshot, rollbackSummary);
    appendPublishedOperationLog({
        action: "rollback",
        projectRecordId: snapshot.projectRecordId,
        projectName: snapshot.projectName,
        summary: `回滚到发布版本：${snapshot.name}`,
        detail: rollbackSummary,
        snapshotIds: [snapshot.id],
        snapshotNames: [snapshot.name],
    });
    return true;
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
    appendPublishedOperationLog({
        action: "open-runtime",
        projectRecordId: resolved.snapshot.projectRecordId,
        projectName: resolved.snapshot.projectName,
        summary: `打开发布运行态：${resolved.snapshot.name}`,
        detail: `${resolved.snapshot.pageName} · ${formatPublishedEnvironmentLabel(resolved.snapshot.environment)}`,
        snapshotIds: [resolved.snapshot.id],
        snapshotNames: [resolved.snapshot.name],
    });
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

async function createProjectFromImport() {
    try {
        const importedPayload = parseImportedProjectPayload(dialogText.value);
        const nextProject = importedPayload.project;
        const importedAssetCount = await importProjectEmbeddedAssets(
            importedPayload.assets,
        );
        const record = buildProjectRecord(nextProject, {
            name:
                projectDraftName.value || deriveProjectRecordName(nextProject),
        });

        projectLibrary.value = [record, ...projectLibrary.value];
        activeProjectRecordId.value = record.id;
        persistProjectLibraryState(projectLibrary.value, record.id);
        applyProjectState(nextProject, {
            statusMessage: importedAssetCount
                ? `已导入项目：${record.name}，并同步 ${importedAssetCount} 个本地资源`
                : `已导入项目：${record.name}`,
        });
    } catch (error) {
        statusMessage.value = "导入失败，请检查项目包或项目 JSON 结构";
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
    deletePublishedRollbackLogsByProject(record.id);
    deletePublishedOperationLogsByProject(record.id);

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

async function openExportDialog() {
    dialogSourceId.value = "";
    dialogMode.value = "export";
    dialogText.value = "";
    statusMessage.value = "正在生成项目导出包";

    try {
        dialogText.value = await buildProjectExportPayload(project.value);
        const referencedAssets = collectReferencedAssetsFromProject(project.value);

        statusMessage.value = referencedAssets.length
            ? `已生成项目导出包，包含 ${referencedAssets.length} 个本地资源`
            : "已生成项目导出包";
    } catch (error) {
        dialogMode.value = null;
        statusMessage.value = "项目导出包生成失败，请稍后重试";
        console.warn(error);
    }
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
    const isProjectExport = dialogMode.value === "export";

    return copyTextToClipboard(dialogText.value, {
        successMessage: isProjectExport
            ? "项目包已复制到剪贴板"
            : "JSON 已复制到剪贴板",
        failureMessage: isProjectExport
            ? "复制失败，请手动复制项目包"
            : "复制失败，请手动复制 JSON",
    });
}

function appendPublishedSnapshotExportOperationLog(mode = dialogMode.value) {
    if (mode === "published-snapshot-export") {
        appendPublishedOperationLog({
            action: "export-current",
            summary: `导出当前项目 ${currentProjectPublishedSnapshotLibrary.value.length} 个发布版本`,
            detail: currentProjectPublishedRollbackLibrary.value.length
                ? `包含 ${currentProjectPublishedRollbackLibrary.value.length} 条回滚记录`
                : "未包含回滚记录",
            snapshotIds: currentProjectPublishedSnapshotLibrary.value.map(
                (item) => item.id,
            ),
            snapshotNames: currentProjectPublishedSnapshotLibrary.value.map(
                (item) => item.name,
            ),
        });
        return true;
    }

    if (mode === "published-snapshot-export-selected") {
        const selectedSnapshotIds = new Set(
            selectedProjectPublishedSnapshots.value.map((item) => item.id),
        );
        const relatedRollbackCount = currentProjectPublishedRollbackLibrary.value.filter(
            (item) => selectedSnapshotIds.has(item.snapshotId),
        ).length;

        appendPublishedOperationLog({
            action: "export-selected",
            summary: `导出所选 ${selectedProjectPublishedSnapshots.value.length} 个发布版本`,
            detail: relatedRollbackCount
                ? `包含 ${relatedRollbackCount} 条关联回滚记录`
                : "未包含关联回滚记录",
            snapshotIds: selectedProjectPublishedSnapshots.value.map(
                (item) => item.id,
            ),
            snapshotNames: selectedProjectPublishedSnapshots.value.map(
                (item) => item.name,
            ),
        });
        return true;
    }

    return false;
}

function appendPublishedOperationLogExportRecord() {
    appendPublishedOperationLog({
        action: "export-operation-logs",
        summary: `导出当前项目 ${currentProjectPublishedOperationLogs.value.length} 条操作日志`,
        detail: currentProjectPublishedSnapshots.value.length
            ? `关联 ${currentProjectPublishedSnapshots.value.length} 个发布版本`
            : "当前项目暂无发布版本",
        snapshotIds: currentProjectPublishedSnapshots.value.map((item) => item.id),
        snapshotNames: currentProjectPublishedSnapshots.value.map(
            (item) => item.name,
        ),
    });
}

async function applyImport() {
    try {
        const importedPayload = parseImportedProjectPayload(dialogText.value);
        const nextProject = importedPayload.project;
        const importedAssetCount = await importProjectEmbeddedAssets(
            importedPayload.assets,
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
        statusMessage.value = importedAssetCount
            ? `项目包已导入，并同步 ${importedAssetCount} 个本地资源`
            : "项目 JSON 已导入";
    } catch (error) {
        statusMessage.value = "导入失败，请检查项目包或 JSON 结构";
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

    if (dialogMode.value === "published-snapshot-export") {
        return "发布版本导出";
    }

    if (dialogMode.value === "published-snapshot-export-selected") {
        return "所选版本导出";
    }

    if (dialogMode.value === "published-operation-export") {
        return "操作日志导出";
    }

    if (dialogMode.value === "published-snapshot-import") {
        return "发布版本导入";
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

    if (dialogMode.value === "published-snapshot-export") {
        return "复制当前项目的发布版本包";
    }

    if (dialogMode.value === "published-snapshot-export-selected") {
        return "复制所选发布版本包";
    }

    if (dialogMode.value === "published-operation-export") {
        return "复制当前项目的操作日志包";
    }

    if (dialogMode.value === "published-snapshot-import") {
        return "粘贴发布版本包并导入当前项目";
    }

    return dialogMode.value === "export"
        ? "复制当前项目包（含本地资源）"
        : "粘贴项目包或项目 JSON 并导入";
}

function isJsonDialogReadonlyState() {
    return (
        dialogMode.value === "export" ||
        dialogMode.value === "source-export" ||
        dialogMode.value === "published-snapshot-export" ||
        dialogMode.value === "published-snapshot-export-selected" ||
        dialogMode.value === "published-operation-export"
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

    if (dialogMode.value === "published-snapshot-export") {
        return "复制版本包";
    }

    if (dialogMode.value === "published-snapshot-export-selected") {
        return "复制所选版本包";
    }

    if (dialogMode.value === "published-operation-export") {
        return "复制日志包";
    }

    if (dialogMode.value === "published-snapshot-import") {
        return "确认导入版本";
    }

    return dialogMode.value === "export" ? "复制项目包" : "确认导入项目";
}

function getJsonDialogHintText() {
    if (dialogMode.value === "export") {
        return "导出内容包含当前项目 JSON，以及项目中引用到的本地图片/视频资源。";
    }

    if (dialogMode.value === "import") {
        return "支持新版项目包（含本地资源），也兼容旧版纯项目 JSON。";
    }

    if (dialogMode.value === "source-create-import") {
        return "支持单个配置对象、配置数组，或包含 dataSources 字段的 JSON 结构。";
    }

    if (dialogMode.value === "source-import") {
        return "覆盖当前数据源时仅支持单个配置对象。";
    }

    if (dialogMode.value === "published-snapshot-import") {
        return "支持直接粘贴版本数组，或包含 snapshots / rollbackLogs 字段的版本包 JSON。";
    }

    if (dialogMode.value === "published-operation-export") {
        return "当前导出仅包含当前项目的发布操作日志。";
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

    if (dialogMode.value === "published-snapshot-export") {
        const copied = await copyExport();

        if (copied) {
            appendPublishedSnapshotExportOperationLog("published-snapshot-export");
        }
        return;
    }

    if (dialogMode.value === "published-snapshot-export-selected") {
        const copied = await copyExport();

        if (copied) {
            appendPublishedSnapshotExportOperationLog(
                "published-snapshot-export-selected",
            );
        }
        return;
    }

    if (dialogMode.value === "published-operation-export") {
        const copied = await copyExport();

        if (copied) {
            appendPublishedOperationLogExportRecord();
        }
        return;
    }

    if (dialogMode.value === "published-snapshot-import") {
        applyPublishedSnapshotImport();
        return;
    }

    if (dialogMode.value === "export") {
        await copyExport();
        return;
    }

    await applyImport();
}

function getActiveJsonDialogEyebrow() {
    if (dialogMode.value === "source-export") {
        return "数据源导出";
    }

    if (dialogMode.value === "source-import") {
        return "数据源导入";
    }

    if (dialogMode.value === "published-snapshot-export") {
        return "发布版本导出";
    }

    if (dialogMode.value === "published-snapshot-export-selected") {
        return "所选版本导出";
    }

    if (dialogMode.value === "published-snapshot-import") {
        return "发布版本导入";
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

    if (dialogMode.value === "published-snapshot-export") {
        return "复制当前项目的发布版本包";
    }

    if (dialogMode.value === "published-snapshot-export-selected") {
        return "复制所选发布版本包";
    }

    if (dialogMode.value === "published-snapshot-import") {
        return "粘贴发布版本包并导入当前项目";
    }

    return dialogMode.value === "export"
        ? "复制当前项目 JSON"
        : "粘贴项目 JSON 并导入";
}

function isActiveJsonDialogReadonly() {
    return (
        dialogMode.value === "export" ||
        dialogMode.value === "source-export" ||
        dialogMode.value === "published-snapshot-export" ||
        dialogMode.value === "published-snapshot-export-selected"
    );
}

function getActiveJsonDialogActionLabel() {
    if (dialogMode.value === "source-export") {
        return "复制配置 JSON";
    }

    if (dialogMode.value === "source-import") {
        return "确认导入配置";
    }

    if (dialogMode.value === "published-snapshot-export") {
        return "复制版本包";
    }

    if (dialogMode.value === "published-snapshot-export-selected") {
        return "复制所选版本包";
    }

    if (dialogMode.value === "published-snapshot-import") {
        return "确认导入版本";
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

    if (dialogMode.value === "published-snapshot-export") {
        const copied = await copyExport();

        if (copied) {
            appendPublishedSnapshotExportOperationLog("published-snapshot-export");
        }
        return;
    }

    if (dialogMode.value === "published-snapshot-export-selected") {
        const copied = await copyExport();

        if (copied) {
            appendPublishedSnapshotExportOperationLog(
                "published-snapshot-export-selected",
            );
        }
        return;
    }

    if (dialogMode.value === "published-snapshot-import") {
        applyPublishedSnapshotImport();
        return;
    }

    if (dialogMode.value === "export") {
        await copyExport();
        return;
    }

    await applyImport();
}

function closeDialog() {
    dialogMode.value = null;
    dialogText.value = "";
    templateDraftName.value = "";
    projectDraftName.value = "";
    publishedSnapshotDraftName.value = "";
    publishedSnapshotDraftNote.value = "";
    publishedSnapshotDraftEnvironment.value = DEFAULT_PUBLISHED_ENVIRONMENT;
    publishedSnapshotDraftApprovalStatus.value =
        DEFAULT_PUBLISHED_APPROVAL_STATUS;
    publishedSnapshotDraftApprovalReviewer.value = "";
    publishedSnapshotDraftApprovalComment.value = "";
    publishedSnapshotDraftTags.value = "";
    resetExpandedAssetUsageIds();
    clearAssetSelection();
    resetAssetBatchTagDraft();
    resetAssetLibraryViewState();
    cancelAssetRename();
    cancelAssetTagEdit();
    resetAssetLibraryFilters();
    resetPublishedSnapshotFilters();
    resetPublishedSnapshotBatchOptions();
    resetPublishedRollbackFilters();
    resetPublishedOperationFilters();
    editingPublishedSnapshotId.value = "";
    publishDiffSnapshotId.value = "";
    approvalTimelineSnapshotId.value = "";
    pendingRollbackSnapshotId.value = "";
    clearPublishedSnapshotSelection();
    dialogSourceId.value = "";
    dialogOperationLogId.value = "";
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
    void loadAssetLibrary({ silent: true });

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
    revokeAllAssetPreviewUrls();
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
            @open-asset-library="openAssetLibraryDialog"
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
            <div
                :class="[
                    'dialog-card',
                    {
                        'dialog-card--asset-library':
                            dialogMode === 'asset-library',
                    },
                ]"
            >
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
                            <h3>将项目包或项目 JSON 导入为新的本地项目记录</h3>
                        </div>
                        <button class="ghost" @click="closeDialog">关闭</button>
                    </div>

                    <p class="inspector-tip">
                        支持新版项目包（含本地资源），也兼容旧版纯项目 JSON。
                    </p>

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
                        placeholder="请粘贴项目包或项目 JSON"
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

                <template v-else-if="dialogMode === 'asset-library'">
                    <div class="dialog-card__header">
                        <div>
                            <p>资源中心</p>
                            <h3>上传本地图片/视频，并快速插入或应用到当前组件</h3>
                        </div>
                        <button class="ghost" @click="closeDialog">关闭</button>
                    </div>

                    <div class="asset-library-summary-grid">
                        <div class="dialog-card__summary">
                            <span>资源总数</span>
                            <strong>{{ assetLibrarySummary.total }} 个</strong>
                            <span>
                                图片 {{ assetLibrarySummary.image }} 个 · 视频
                                {{ assetLibrarySummary.video }} 个
                            </span>
                        </div>
                        <div class="dialog-card__summary">
                            <span>当前筛选结果</span>
                            <strong>{{ filteredAssetLibrary.length }} 个</strong>
                            <span>
                                {{
                                    assetLibraryViewMode === 'grouped'
                                        ? assetLibraryGroupCount
                                            ? `按标签分组显示，共 ${assetLibraryGroupCount} 组，同一资源可在多个标签组中出现`
                                            : "当前分组视图下没有可展示的标签组"
                                        : hasAssetLibraryFilters
                                          ? "已按关键词、类型或标签过滤"
                                          : "显示全部本地资源"
                                }}
                            </span>
                        </div>
                        <div class="dialog-card__summary">
                            <span>当前选中组件</span>
                            <strong>{{
                                selectedWidget?.name || "未选中可应用组件"
                            }}</strong>
                            <span>
                                {{
                                    selectedWidgetCanReceiveAsset
                                        ? selectedWidgetAssetTargetMode === "image"
                                            ? "可直接应用图片资源"
                                            : "可直接应用视频资源，也支持图片封面"
                                        : "选中图片或视频组件后，可一键应用资源"
                                }}
                            </span>
                        </div>
                        <div
                            :class="[
                                'dialog-card__summary',
                                'asset-library__summary-card',
                                {
                                    'asset-library__summary-card--warning':
                                        missingAssetReferenceReport.totalEntries,
                                },
                            ]"
                        >
                            <span>异常引用</span>
                            <strong>
                                {{ missingAssetReferenceReport.totalEntries }} 处
                            </strong>
                            <span>
                                {{
                                    missingAssetReferenceReport.totalEntries
                                        ? `涉及 ${missingAssetReferenceReport.uniqueAssetCount} 个缺失资源，建议优先处理当前项目中的异常`
                                        : "当前项目、项目快照和发布版本中都没有检测到失效资源引用"
                                }}
                            </span>
                        </div>
                    </div>

                    <div class="asset-library-toolbar">
                        <label class="asset-library__upload">
                            <input
                                :key="assetLibraryUploadInputKey"
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                @change="handleAssetLibraryUpload"
                            />
                            <span>{{
                                assetLibraryLoading ? "处理中..." : "上传本地资源"
                            }}</span>
                        </label>

                        <label class="publish-filter-field">
                            <span>搜索资源</span>
                            <input
                                v-model="assetLibrarySearchKeyword"
                                type="text"
                                placeholder="搜索资源名、标签、类型、引用标识"
                            />
                        </label>

                        <label class="publish-filter-field">
                            <span>资源类型</span>
                            <select v-model="assetLibraryFilterKind">
                                <option
                                    v-for="option in ASSET_KIND_OPTIONS"
                                    :key="`asset-kind-${option.value}`"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </option>
                            </select>
                        </label>

                        <label class="publish-filter-field">
                            <span>资源标签</span>
                            <select v-model="assetLibraryFilterTag">
                                <option
                                    v-for="option in assetLibraryTagOptions"
                                    :key="`asset-tag-${option.value}`"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </option>
                            </select>
                        </label>

                        <div class="asset-library-toolbar__actions">
                            <button
                                v-for="option in ASSET_LIBRARY_VIEW_MODE_OPTIONS"
                                :key="`asset-view-mode-${option.value}`"
                                :class="[
                                    'ghost',
                                    'asset-library__view-button',
                                    {
                                        'is-active':
                                            assetLibraryViewMode ===
                                            option.value,
                                    },
                                ]"
                                @click="setAssetLibraryViewMode(option.value)"
                            >
                                {{ option.label }}
                            </button>
                            <button
                                v-if="
                                    assetLibraryViewMode === 'grouped' &&
                                    assetLibraryGroupCount
                                "
                                class="ghost"
                                @click="
                                    isAllAssetGroupsCollapsed
                                        ? expandAllAssetGroups()
                                        : collapseAllAssetGroups()
                                "
                            >
                                {{
                                    isAllAssetGroupsCollapsed
                                        ? "展开全部分组"
                                        : "折叠全部分组"
                                }}
                            </button>
                            <button
                                v-if="hasAssetLibraryFilters"
                                class="ghost"
                                @click="resetAssetLibraryFilters"
                            >
                                清空筛选
                            </button>
                        </div>
                    </div>

                    <div
                        v-if="missingAssetReferenceReport.totalEntries"
                        class="asset-library__warning-panel"
                    >
                        <div class="asset-library__warning-head">
                            <div class="asset-library__warning-copy">
                                <strong>检测到失效资源引用</strong>
                                <p>
                                    这些条目引用了本地资源中心中不存在的
                                    `asset://` 资源，常见于导入旧项目、切换环境或资源未同步完成。
                                </p>
                            </div>
                            <div class="project-library__tag-list">
                                <span class="project-library__tag asset-library__warning-tag">
                                    当前项目
                                    {{ missingAssetReferenceReport.currentProjectCount }}
                                    处
                                </span>
                                <span class="project-library__tag asset-library__warning-tag">
                                    项目快照
                                    {{ missingAssetReferenceReport.projectRecordCount }}
                                    处
                                </span>
                                <span class="project-library__tag asset-library__warning-tag">
                                    发布版本
                                    {{ missingAssetReferenceReport.publishedSnapshotCount }}
                                    处
                                </span>
                            </div>
                        </div>

                        <div class="asset-library__warning-sections">
                            <section
                                v-for="section in missingAssetReferenceReport.sections"
                                :key="`missing-asset-section-${section.key}`"
                                class="asset-library__warning-section"
                            >
                                <div class="asset-library__warning-section-title">
                                    <strong>{{ section.label }}</strong>
                                    <small>{{ section.entries.length }} 处</small>
                                </div>

                                <div class="asset-library__warning-list">
                                    <article
                                        v-for="entry in section.entries"
                                        :key="entry.id"
                                        class="asset-library__warning-item"
                                    >
                                        <div class="asset-library__usage-item-head">
                                            <div class="asset-library__usage-badges">
                                                <span class="asset-library__usage-badge">
                                                    {{ entry.scopeName }}
                                                </span>
                                                <span
                                                    class="asset-library__usage-badge asset-library__usage-badge--muted"
                                                >
                                                    {{ entry.locationTypeLabel }}
                                                </span>
                                            </div>
                                            <div class="asset-library__warning-actions">
                                                <label
                                                    class="asset-library__action-upload asset-library__action-upload--warning"
                                                    :class="{
                                                        'is-disabled':
                                                            assetLibraryLoading,
                                                    }"
                                                >
                                                    <input
                                                        type="file"
                                                        :accept="
                                                            getMissingAssetRepairAccept(
                                                                entry,
                                                            )
                                                        "
                                                        @change="
                                                            handleMissingAssetRepairUpload(
                                                                entry,
                                                                $event,
                                                            )
                                                        "
                                                    />
                                                    <span>{{
                                                        assetLibraryLoading
                                                            ? '处理中...'
                                                            : '上传修复'
                                                    }}</span>
                                                </label>
                                                <button
                                                    v-if="
                                                        canLocateAssetUsageEntry(
                                                            entry,
                                                        )
                                                    "
                                                    class="ghost asset-library__usage-action"
                                                    type="button"
                                                    @click="
                                                        locateAssetUsageEntry(
                                                            entry,
                                                        )
                                                    "
                                                >
                                                    {{
                                                        getAssetUsageEntryActionLabel(
                                                            entry,
                                                        )
                                                    }}
                                                </button>
                                            </div>
                                        </div>
                                        <strong>{{ entry.primaryLabel }}</strong>
                                        <p>{{ entry.secondaryLabel }}</p>
                                        <p
                                            class="project-library__note asset-library__warning-reference"
                                        >
                                            {{ entry.reference }}
                                        </p>
                                        <div class="project-library__tag-list">
                                            <span
                                                v-for="fieldPath in entry.fieldPaths.slice(
                                                    0,
                                                    4,
                                                )"
                                                :key="`${entry.id}-${fieldPath}`"
                                                class="project-library__tag project-library__tag--muted"
                                            >
                                                字段 {{ fieldPath }}
                                            </span>
                                            <span
                                                class="project-library__tag project-library__tag--muted"
                                            >
                                                同 ID 共
                                                {{
                                                    getMissingAssetReferenceRepairCount(
                                                        entry.assetId,
                                                    )
                                                }}
                                                处
                                            </span>
                                            <span
                                                class="project-library__tag project-library__tag--muted"
                                            >
                                                {{
                                                    buildMissingAssetRepairHint(
                                                        entry,
                                                    )
                                                }}
                                            </span>
                                            <span
                                                v-if="entry.fieldPaths.length > 4"
                                                class="project-library__tag project-library__tag--muted"
                                            >
                                                另有
                                                {{ entry.fieldPaths.length - 4 }}
                                                处字段
                                            </span>
                                        </div>
                                    </article>
                                </div>
                            </section>
                        </div>
                    </div>

                    <div
                        v-if="assetLibrarySummary.total"
                        class="publish-batch-bar asset-library__batch-bar"
                    >
                        <label class="publish-batch-bar__checkbox">
                            <input
                                :checked="isAllFilteredAssetsSelected"
                                :disabled="
                                    !filteredAssetLibrary.length ||
                                    assetLibraryLoading
                                "
                                type="checkbox"
                                @change="toggleAllFilteredAssetsSelection"
                            />
                            <span>
                                全选当前结果（{{
                                    selectedFilteredAssetLibrary.length
                                }}/{{ filteredAssetLibrary.length }}）
                            </span>
                        </label>

                        <div class="publish-batch-bar__summary">
                            <span>已选 {{ selectedAssetCount }} 个资源</span>
                            <span v-if="selectedAssetCount">
                                可删除 {{ selectedAssetDeletableCount }} 个 ·
                                已引用 {{ selectedAssetReferencedCount }} 个
                            </span>
                            <span v-if="selectedAssetReferencedCount">
                                已引用资源需要先替换组件或项目中的引用后再删除
                            </span>
                        </div>

                        <div class="publish-batch-bar__field-options">
                            <label class="publish-filter-field asset-library__batch-field">
                                <span>标签操作</span>
                                <select v-model="assetBatchTagMode">
                                    <option
                                        v-for="option in ASSET_BATCH_TAG_MODE_OPTIONS"
                                        :key="`asset-batch-tag-mode-${option.value}`"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </option>
                                </select>
                            </label>

                            <label
                                v-if="assetBatchTagMode !== 'clear'"
                                class="publish-filter-field asset-library__batch-field"
                            >
                                <span>{{
                                    assetBatchTagMode === 'append'
                                        ? '追加内容'
                                        : '覆盖内容'
                                }}</span>
                                <input
                                    v-model="assetBatchTagDraft"
                                    type="text"
                                    placeholder="多个标签请用逗号分隔"
                                />
                            </label>

                            <button
                                class="ghost"
                                :disabled="
                                    !canBatchApplyAssetTags ||
                                    assetLibraryLoading
                                "
                                @click="applyBatchAssetTags"
                            >
                                {{
                                    assetBatchTagMode === 'clear'
                                        ? '清空所选标签'
                                        : assetBatchTagMode === 'replace'
                                          ? '覆盖所选标签'
                                          : '追加到所选标签'
                                }}
                            </button>
                        </div>

                        <div class="publish-batch-bar__actions">
                            <button
                                class="ghost"
                                :disabled="!selectedAssetCount"
                                @click="copySelectedAssetReferences"
                            >
                                复制所选引用
                            </button>
                            <button
                                class="ghost"
                                :disabled="!selectedAssetCount"
                                @click="clearAssetSelection"
                            >
                                清空选择
                            </button>
                            <button
                                class="ghost danger"
                                :disabled="
                                    !selectedAssetDeletableCount ||
                                    assetLibraryLoading
                                "
                                @click="batchDeleteSelectedAssets"
                            >
                                批量删除
                            </button>
                        </div>
                    </div>

                    <div class="project-library asset-library">
                        <template
                            v-for="item in assetLibraryRenderItems"
                            :key="item.key"
                        >
                            <button
                                v-if="item.type === 'group'"
                                class="asset-library__group-header"
                                :class="{
                                    'is-collapsed': collapsedAssetGroupKeySet.has(
                                        item.group.key,
                                    ),
                                }"
                                type="button"
                                @click="
                                    toggleAssetGroupCollapsed(item.group.key)
                                "
                            >
                                <span class="asset-library__group-copy">
                                    <strong>{{
                                        item.group.label
                                    }}</strong>
                                    <small>
                                        {{ item.group.assets.length }} 个资源
                                    </small>
                                </span>
                                <span class="asset-library__group-toggle">
                                    {{
                                        collapsedAssetGroupKeySet.has(
                                            item.group.key,
                                        )
                                            ? "展开"
                                            : "收起"
                                    }}
                                </span>
                            </button>

                            <article
                                v-else
                                :class="[
                                    'project-library__item',
                                    'asset-library__item',
                                    {
                                        'is-selected': selectedAssetIdSet.has(
                                            item.asset.id,
                                        ),
                                    },
                                ]"
                            >
                            <label class="project-library__select">
                                <input
                                    :checked="selectedAssetIdSet.has(item.asset.id)"
                                    :disabled="assetLibraryLoading"
                                    type="checkbox"
                                    @change="toggleAssetSelection(item.asset.id)"
                                />
                            </label>

                            <div class="asset-library__preview">
                                <img
                                    v-if="
                                        item.asset.kind === 'image' &&
                                        assetPreviewUrlMap[item.asset.id]
                                    "
                                    :src="assetPreviewUrlMap[item.asset.id]"
                                    :alt="item.asset.name"
                                />
                                <video
                                    v-else-if="
                                        item.asset.kind === 'video' &&
                                        assetPreviewUrlMap[item.asset.id]
                                    "
                                    :src="assetPreviewUrlMap[item.asset.id]"
                                    muted
                                    preload="metadata"
                                />
                                <span v-else>{{
                                    getAssetKindLabel(item.asset.kind)
                                }}</span>
                            </div>

                            <div class="project-library__meta">
                                <div
                                    class="project-library__title-row asset-library__title-row"
                                >
                                    <div
                                        v-if="assetEditingId === item.asset.id"
                                        class="asset-library__name-editor"
                                    >
                                        <input
                                            :data-asset-rename-input="item.asset.id"
                                            v-model="assetDraftName"
                                            class="asset-library__name-input"
                                            type="text"
                                            maxlength="120"
                                            placeholder="请输入资源名称"
                                            @keydown.enter.prevent="
                                                renameAssetInLibrary(item.asset.id)
                                            "
                                            @keydown.esc.prevent="
                                                cancelAssetRename()
                                            "
                                        />
                                    </div>
                                    <strong v-else>{{ item.asset.name }}</strong>
                                    <div class="project-library__badges">
                                        <span class="project-library__badge">
                                            {{ getAssetKindLabel(item.asset.kind) }}
                                        </span>
                                        <span
                                            v-if="
                                                getAssetUsageInfo(item.asset.id)
                                                    .total
                                            "
                                            class="project-library__badge project-library__badge--action"
                                        >
                                            已引用
                                        </span>
                                    </div>
                                </div>
                                <span>
                                    {{ formatAssetFileSize(item.asset.size) }} ·
                                    {{
                                        new Date(
                                            item.asset.updatedAt,
                                        ).toLocaleString(
                                            "zh-CN",
                                            {
                                                hour12: false,
                                            },
                                        )
                                    }}
                                </span>
                                <p class="project-library__note">
                                    {{ item.asset.reference }}
                                </p>
                                <div class="project-library__tag-list">
                                    <span class="project-library__tag">
                                        {{ item.asset.mimeType || "未知类型" }}
                                    </span>
                                    <span class="project-library__tag">
                                        {{ buildAssetUsageLabel(item.asset.id) }}
                                    </span>
                                    <button
                                        v-for="tag in item.asset.tags || []"
                                        :key="`asset-tag-chip-${item.asset.id}-${tag}`"
                                        class="project-library__tag project-library__tag--interactive"
                                        type="button"
                                        @click="setAssetLibraryTagFilter(tag)"
                                    >
                                        # {{ tag }}
                                    </button>
                                    <span
                                        v-if="!(item.asset.tags || []).length"
                                        class="project-library__tag project-library__tag--muted"
                                    >
                                        未分类
                                    </span>
                                </div>
                                <div
                                    v-if="assetTagEditingId === item.asset.id"
                                    class="asset-library__tag-editor"
                                >
                                    <input
                                        :data-asset-tag-input="item.asset.id"
                                        v-model="assetTagDraftValue"
                                        class="asset-library__tag-input"
                                        type="text"
                                        maxlength="160"
                                        placeholder="输入标签，使用逗号分隔"
                                        @keydown.enter.prevent="
                                            saveAssetTags(item.asset.id)
                                        "
                                        @keydown.esc.prevent="
                                            cancelAssetTagEdit()
                                        "
                                    />
                                    <span class="asset-library__tag-hint">
                                        例如：封面图, 首页, 品牌素材
                                    </span>
                                </div>
                                <div
                                    v-if="
                                        isAssetUsageExpanded(item.asset.id) &&
                                        getAssetUsageInfo(item.asset.id).total
                                    "
                                    class="asset-library__usage"
                                >
                                    <div class="asset-library__usage-header">
                                        <strong>引用位置</strong>
                                        <span>
                                            {{
                                                getAssetUsageInfo(item.asset.id)
                                                    .totalEntries
                                            }} 处
                                        </span>
                                    </div>
                                    <section
                                        v-for="section in getAssetUsageSections(
                                            item.asset.id,
                                        )"
                                        :key="
                                            `asset-usage-${item.asset.id}-${section.key}`
                                        "
                                        class="asset-library__usage-section"
                                    >
                                        <div
                                            class="asset-library__usage-section-title"
                                        >
                                            <strong>{{ section.label }}</strong>
                                            <small>
                                                {{ section.entries.length }} 处
                                            </small>
                                        </div>
                                        <div class="asset-library__usage-list">
                                            <article
                                                v-for="entry in section.entries"
                                                :key="entry.id"
                                                class="asset-library__usage-item"
                                            >
                                                <div
                                                    class="asset-library__usage-item-head"
                                                >
                                                    <div
                                                        class="asset-library__usage-badges"
                                                    >
                                                        <span
                                                            class="asset-library__usage-badge"
                                                        >
                                                            {{ entry.scopeName }}
                                                        </span>
                                                        <span
                                                            class="asset-library__usage-badge asset-library__usage-badge--muted"
                                                        >
                                                            {{
                                                                entry.locationTypeLabel
                                                            }}
                                                        </span>
                                                    </div>
                                                    <button
                                                        v-if="
                                                            canLocateAssetUsageEntry(
                                                                entry,
                                                            )
                                                        "
                                                        class="ghost asset-library__usage-action"
                                                        type="button"
                                                        @click="
                                                            locateAssetUsageEntry(
                                                                entry,
                                                            )
                                                        "
                                                    >
                                                        {{
                                                            getAssetUsageEntryActionLabel(
                                                                entry,
                                                            )
                                                        }}
                                                    </button>
                                                </div>
                                                <strong>
                                                    {{ entry.primaryLabel }}
                                                </strong>
                                                <p>
                                                    {{ entry.secondaryLabel }}
                                                </p>
                                            </article>
                                        </div>
                                    </section>
                                </div>
                            </div>

                            <div class="project-library__actions">
                                <button
                                    v-if="assetEditingId === item.asset.id"
                                    class="ghost"
                                    :disabled="assetLibraryLoading"
                                    @click="renameAssetInLibrary(item.asset.id)"
                                >
                                    保存名称
                                </button>
                                <button
                                    v-else
                                    class="ghost"
                                    :disabled="assetLibraryLoading"
                                    @click="startAssetRename(item.asset.id)"
                                >
                                    重命名
                                </button>
                                <button
                                    v-if="assetTagEditingId === item.asset.id"
                                    class="ghost"
                                    :disabled="assetLibraryLoading"
                                    @click="saveAssetTags(item.asset.id)"
                                >
                                    保存标签
                                </button>
                                <button
                                    v-else
                                    class="ghost"
                                    :disabled="assetLibraryLoading"
                                    @click="startAssetTagEdit(item.asset.id)"
                                >
                                    编辑标签
                                </button>
                                <button
                                    v-if="assetEditingId === item.asset.id"
                                    class="ghost"
                                    :disabled="assetLibraryLoading"
                                    @click="cancelAssetRename()"
                                >
                                    取消
                                </button>
                                <button
                                    v-if="assetTagEditingId === item.asset.id"
                                    class="ghost"
                                    :disabled="assetLibraryLoading"
                                    @click="cancelAssetTagEdit()"
                                >
                                    取消标签
                                </button>
                                <label
                                    class="asset-library__action-upload"
                                    :class="{
                                        'is-disabled': assetLibraryLoading,
                                    }"
                                >
                                    <input
                                        type="file"
                                        :accept="
                                            item.asset.kind === 'image'
                                                ? 'image/*'
                                                : 'video/*'
                                        "
                                        @change="
                                            handleAssetReplacement(
                                                item.asset.id,
                                                $event,
                                            )
                                        "
                                    />
                                    <span>{{
                                        assetLibraryLoading
                                            ? '处理中...'
                                            : '替换文件'
                                    }}</span>
                                </label>
                                <button
                                    class="ghost"
                                    :disabled="assetLibraryLoading"
                                    @click="copyAssetReference(item.asset.id)"
                                >
                                    复制引用
                                </button>
                                <button
                                    v-if="getAssetUsageInfo(item.asset.id).total"
                                    class="ghost"
                                    :disabled="assetLibraryLoading"
                                    @click="
                                        toggleAssetUsageExpanded(item.asset.id)
                                    "
                                >
                                    {{
                                        buildAssetUsageToggleLabel(
                                            item.asset.id,
                                        )
                                    }}
                                </button>
                                <button
                                    class="ghost"
                                    :disabled="assetLibraryLoading"
                                    @click="addAssetWidgetToCanvas(item.asset.id)"
                                >
                                    插入组件
                                </button>
                                <button
                                    v-if="
                                        canApplyAssetToSelectedWidget(
                                            item.asset,
                                        )
                                    "
                                    class="ghost"
                                    :disabled="assetLibraryLoading"
                                    @click="
                                        applyAssetToSelectedWidget(item.asset.id)
                                    "
                                >
                                    应用到当前组件
                                </button>
                                <button
                                    v-if="canApplyAssetAsVideoPoster(item.asset)"
                                    class="ghost"
                                    :disabled="assetLibraryLoading"
                                    @click="
                                        applyAssetToSelectedWidget(item.asset.id, {
                                            mode: 'poster',
                                        })
                                    "
                                >
                                    设为视频封面
                                </button>
                                <button
                                    class="ghost danger"
                                    :disabled="
                                        assetLibraryLoading ||
                                        getAssetUsageInfo(item.asset.id)
                                            .total > 0
                                    "
                                    @click="
                                        deleteAssetFromLibraryById(
                                            item.asset.id,
                                        )
                                    "
                                >
                                    删除
                                </button>
                            </div>
                            </article>
                        </template>

                        <p v-if="assetLibraryLoading" class="project-library__empty">
                            正在加载本地资源，请稍候。
                        </p>
                        <p
                            v-else-if="assetLibraryReady && !filteredAssetLibrary.length"
                            class="project-library__empty"
                        >
                            {{
                                assetLibrarySummary.total
                                    ? "没有匹配的资源，调整搜索词或类型后再试试。"
                                    : missingAssetReferenceReport.totalEntries
                                      ? "本地资源库还是空的，但已检测到失效资源引用，建议先上传资源或回到对应页面修复。"
                                      : "资源中心还是空的，先上传几张图片或视频来复用吧。"
                            }}
                        </p>
                    </div>
                </template>

                <template v-else-if="dialogMode === 'project-publish'">
                    <div class="dialog-card__header">
                        <div>
                            <p>发布中心</p>
                            <h3>
                                {{
                                    editingPublishedSnapshot
                                        ? "编辑发布信息、比对版本差异并回滚"
                                        : "生成冻结快照并复制独立运行链接"
                                }}
                            </h3>
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

                    <label class="dialog-card__field">
                        <span>发布备注</span>
                        <textarea
                            v-model="publishedSnapshotDraftNote"
                            rows="3"
                            placeholder="可选：补充本次发布说明，例如数据版本、修复内容、联调环境等"
                        />
                    </label>

                    <label class="dialog-card__field">
                        <span>发布环境</span>
                        <select v-model="publishedSnapshotDraftEnvironment">
                            <option
                                v-for="option in PUBLISHED_ENVIRONMENT_OPTIONS"
                                :key="option.value"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </option>
                        </select>
                    </label>

                    <label class="dialog-card__field">
                        <span>审批状态</span>
                        <select v-model="publishedSnapshotDraftApprovalStatus">
                            <option
                                v-for="option in PUBLISHED_APPROVAL_STATUS_OPTIONS"
                                :key="option.value"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </option>
                        </select>
                    </label>

                    <label class="dialog-card__field">
                        <span>审批人</span>
                        <input
                            v-model="publishedSnapshotDraftApprovalReviewer"
                            type="text"
                            placeholder="可选：填写审核人或责任人，例如 张三"
                        />
                    </label>

                    <label class="dialog-card__field">
                        <span>{{
                            getPublishedApprovalCommentLabel(
                                publishedSnapshotDraftApprovalStatus,
                            )
                        }}</span>
                        <textarea
                            v-model="publishedSnapshotDraftApprovalComment"
                            rows="2"
                            :placeholder="
                                getPublishedApprovalCommentPlaceholder(
                                    publishedSnapshotDraftApprovalStatus,
                                )
                            "
                        />
                    </label>

                    <label class="dialog-card__field">
                        <span>版本标签</span>
                        <input
                            v-model="publishedSnapshotDraftTags"
                            type="text"
                            placeholder="多个标签用逗号分隔，例如 首页大屏, 周报, V2"
                        />
                    </label>

                    <div class="dialog-card__summary">
                        <span>当前发布入口</span>
                        <strong>
                            {{ currentPage?.name || "未命名页面" }} ·
                            {{ project.pages.length }} 个页面 /
                            {{ project.dataSources.length }} 个数据源
                        </strong>
                        <span>
                            目标环境：{{
                                formatPublishedEnvironmentLabel(
                                    publishedSnapshotDraftEnvironment,
                                )
                            }}
                        </span>
                        <span>
                            审批状态：{{
                                formatPublishedApprovalStatusLabel(
                                    publishedSnapshotDraftApprovalStatus,
                                )
                            }}
                        </span>
                        <span v-if="publishedSnapshotDraftApprovalReviewer">
                            审批人：{{ publishedSnapshotDraftApprovalReviewer }}
                        </span>
                    </div>

                    <div
                        v-if="editingPublishedSnapshot"
                        class="dialog-card__summary"
                    >
                        <span>当前编辑版本</span>
                        <strong>{{ editingPublishedSnapshot.name }}</strong>
                        <span>
                            {{
                                formatPublishedEnvironmentLabel(
                                    editingPublishedSnapshot.environment,
                                )
                            }}
                        </span>
                        <span>
                            {{
                                formatPublishedApprovalStatusLabel(
                                    editingPublishedSnapshot.approvalStatus,
                                )
                            }}
                        </span>
                        <span v-if="editingPublishedSnapshot.approvalReviewer">
                            审批人：{{ editingPublishedSnapshot.approvalReviewer }}
                        </span>
                        <span>仅更新发布名称、审批、环境、标签和备注，不会覆盖发布内容</span>
                    </div>

                    <div
                        v-if="latestProjectPublishedSnapshot"
                        class="dialog-card__summary"
                    >
                        <span>最近一次发布</span>
                        <strong>{{ latestProjectPublishedSnapshot.name }}</strong>
                        <span>
                            {{
                                new Date(
                                    latestProjectPublishedSnapshot.updatedAt,
                                ).toLocaleString("zh-CN", { hour12: false })
                            }}
                        </span>
                        <span>
                            {{
                                formatPublishedEnvironmentLabel(
                                    latestProjectPublishedSnapshot.environment,
                                )
                            }}
                        </span>
                        <span>
                            {{
                                formatPublishedApprovalStatusLabel(
                                    latestProjectPublishedSnapshot.approvalStatus,
                                )
                            }}
                        </span>
                        <span v-if="latestProjectPublishedSnapshot.approvalReviewer">
                            审批人：{{
                                latestProjectPublishedSnapshot.approvalReviewer
                            }}
                        </span>
                        <span v-if="latestProjectPublishedSnapshot.note">
                            {{ latestProjectPublishedSnapshot.note }}
                        </span>
                    </div>

                    <p class="inspector-tip">
                        发布快照会冻结当前画布结构与默认数据源配置，后续编辑不会影响已发布版本；
                        鉴权密钥不会写入发布内容。
                    </p>

                    <div
                        class="dialog-card__actions dialog-card__actions--split"
                    >
                        <button class="ghost" @click="resetPublishDraft">
                            重置草稿
                        </button>
                        <button
                            v-if="editingPublishedSnapshot"
                            class="ghost"
                            @click="cancelPublishedSnapshotEdit"
                        >
                            取消编辑
                        </button>
                        <button
                            v-else-if="latestProjectPublishedSnapshot"
                            class="ghost"
                            :disabled="latestProjectPublishedSnapshot.locked"
                            @click="overwriteLatestPublishedSnapshot"
                        >
                            {{
                                latestProjectPublishedSnapshot.locked
                                    ? "最近版本已锁定"
                                    : "覆盖最近发布"
                            }}
                        </button>
                        <button class="primary" @click="applyPublishedSnapshotDraft">
                            {{
                                editingPublishedSnapshot
                                    ? "保存发布信息"
                                    : "生成发布快照"
                            }}
                        </button>
                    </div>

                    <div class="publish-utility-bar">
                        <button
                            class="ghost"
                            :disabled="!currentProjectPublishedSnapshots.length"
                            @click="openPublishedSnapshotExportDialog"
                        >
                            导出当前项目版本
                        </button>
                        <button
                            class="ghost"
                            @click="openPublishedSnapshotImportDialog"
                        >
                            导入版本包
                        </button>
                        <button
                            v-if="currentProjectPublishedOperationLogs.length"
                            class="ghost"
                            @click="openPublishedOperationLogExportDialog"
                        >
                            导出操作日志
                        </button>
                    </div>

                    <div
                        v-if="currentProjectPublishedSnapshots.length"
                        class="publish-stats-grid"
                    >
                        <button
                            v-for="card in publishedSnapshotApprovalStatsCards"
                            :key="card.key"
                            :class="[
                                'publish-stat-card',
                                {
                                    'is-active': card.active,
                                    'is-all': card.key === 'all',
                                    'is-pending': card.key === 'pending',
                                    'is-approved': card.key === 'approved',
                                    'is-rejected': card.key === 'rejected',
                                    'is-unassigned':
                                        card.key ===
                                        PUBLISHED_APPROVAL_REVIEWER_FILTER_UNASSIGNED,
                                },
                            ]"
                            type="button"
                            @click="
                                handlePublishedSnapshotApprovalStatsCard(card.key)
                            "
                        >
                            <span>{{ card.label }}</span>
                            <strong>{{ card.count }}</strong>
                            <small>{{ card.detail }}</small>
                        </button>
                    </div>

                    <div
                        v-if="currentProjectPublishedSnapshots.length"
                        class="publish-filter-bar"
                    >
                        <label class="publish-filter-field">
                            <span>搜索版本</span>
                                <input
                                    v-model="publishedSnapshotSearchKeyword"
                                    type="text"
                                    placeholder="搜索名称、备注、页面、审批人、原因、标签"
                                />
                            </label>
                        <label class="publish-filter-field">
                            <span>环境筛选</span>
                            <select v-model="publishedSnapshotFilterEnvironment">
                                <option value="all">全部环境</option>
                                <option
                                    v-for="option in PUBLISHED_ENVIRONMENT_OPTIONS"
                                    :key="option.value"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </option>
                            </select>
                        </label>
                        <label class="publish-filter-field">
                            <span>审批状态</span>
                            <select v-model="publishedSnapshotFilterApprovalStatus">
                                <option
                                    v-for="option in PUBLISHED_APPROVAL_FILTER_OPTIONS"
                                    :key="`approval-${option.value}`"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </option>
                            </select>
                        </label>
                        <label class="publish-filter-field">
                            <span>审批人</span>
                            <select v-model="publishedSnapshotFilterApprovalReviewer">
                                <option
                                    v-for="option in currentProjectPublishedApprovalReviewerOptions"
                                    :key="`reviewer-${option.value}`"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </option>
                            </select>
                        </label>
                        <label class="publish-filter-field">
                            <span>锁定状态</span>
                            <select v-model="publishedSnapshotFilterLockState">
                                <option
                                    v-for="option in PUBLISHED_LOCK_FILTER_OPTIONS"
                                    :key="option.value"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </option>
                            </select>
                        </label>
                        <label class="publish-filter-field">
                            <span>排序方式</span>
                            <select v-model="publishedSnapshotSortMode">
                                <option
                                    v-for="option in PUBLISHED_SORT_OPTIONS"
                                    :key="option.value"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </option>
                            </select>
                        </label>
                        <div class="publish-filter-summary">
                            <span>
                                显示 {{ filteredProjectPublishedSnapshots.length }} /
                                {{ currentProjectPublishedSnapshots.length }} 个版本
                            </span>
                            <button
                                v-if="hasPublishedSnapshotFilters"
                                class="ghost"
                                @click="resetPublishedSnapshotFilters"
                            >
                                清空筛选
                            </button>
                        </div>
                    </div>

                    <div
                        v-if="filteredProjectPublishedSnapshots.length"
                        class="publish-batch-bar"
                    >
                        <label class="publish-batch-bar__checkbox">
                            <input
                                :checked="isAllFilteredPublishedSnapshotsSelected"
                                type="checkbox"
                                @change="toggleAllFilteredPublishedSnapshotsSelection"
                            />
                            <span>
                                全选当前结果（{{
                                    selectedFilteredPublishedSnapshots.length
                                }}/{{ filteredProjectPublishedSnapshots.length }}）
                            </span>
                        </label>

                        <div class="publish-batch-bar__summary">
                            <span>
                                已选 {{ selectedPublishedSnapshotCount }} 个版本
                            </span>
                            <span v-if="selectedPublishedSnapshotCount">
                                未锁定 {{ selectedPublishedSnapshotUnlockedCount }} 个
                                · 已置顶 {{ selectedPublishedSnapshotPinnedCount }} 个
                            </span>
                            <span v-if="selectedPublishedSnapshotCount">
                                待审批 {{ selectedPublishedSnapshotPendingCount }} 个
                                · 已通过 {{ selectedPublishedSnapshotApprovedCount }} 个
                                · 已驳回 {{ selectedPublishedSnapshotRejectedCount }} 个
                            </span>
                            <span v-if="selectedPublishedSnapshotCount">
                                批量编辑会使用上方“审批信息 / 发布环境 / 发布备注 / 版本标签”的当前内容
                            </span>
                        </div>

                        <div class="publish-batch-bar__field-options">
                            <label class="publish-batch-bar__field-toggle">
                                <input
                                    v-model="publishedSnapshotBatchApplyNote"
                                    type="checkbox"
                                />
                                <span>应用上方备注</span>
                            </label>
                            <label class="publish-batch-bar__field-toggle">
                                <input
                                    v-model="publishedSnapshotBatchApplyTags"
                                    type="checkbox"
                                />
                                <span>应用上方标签</span>
                            </label>
                            <label class="publish-batch-bar__field-toggle">
                                <input
                                    v-model="publishedSnapshotBatchApplyEnvironment"
                                    type="checkbox"
                                />
                                <span>应用上方环境</span>
                            </label>
                            <label class="publish-batch-bar__field-toggle">
                                <input
                                    v-model="publishedSnapshotBatchApplyApprovalStatus"
                                    type="checkbox"
                                />
                                <span>应用上方审批信息</span>
                            </label>
                            <button
                                class="ghost"
                                :disabled="!canBatchApplyPublishedSnapshotMeta"
                                @click="batchApplyPublishedSnapshotMeta"
                            >
                                批量写入审批/环境/备注/标签
                            </button>
                        </div>

                        <div class="publish-batch-bar__actions">
                            <button
                                class="ghost"
                                :disabled="!selectedPublishedSnapshotApprovableCount"
                                @click="
                                    batchSetPublishedSnapshotApprovalStatus(
                                        'approved',
                                    )
                                "
                            >
                                批量通过
                            </button>
                            <button
                                class="ghost danger"
                                :disabled="!selectedPublishedSnapshotRejectableCount"
                                @click="
                                    batchSetPublishedSnapshotApprovalStatus(
                                        'rejected',
                                    )
                                "
                            >
                                批量驳回
                            </button>
                            <button
                                class="ghost"
                                :disabled="!selectedPublishedSnapshotCount"
                                @click="openSelectedPublishedSnapshotRuntimes"
                            >
                                批量打开运行态
                            </button>
                            <button
                                class="ghost"
                                :disabled="!selectedPublishedSnapshotCount"
                                @click="copySelectedPublishedSnapshotLinks"
                            >
                                批量复制链接
                            </button>
                            <button
                                class="ghost"
                                :disabled="!selectedPublishedSnapshotCount"
                                @click="openSelectedPublishedSnapshotExportDialog"
                            >
                                导出所选
                            </button>
                            <button
                                class="ghost"
                                :disabled="!selectedPublishedSnapshotUnpinnedCount"
                                @click="batchSetPublishedSnapshotPin(true)"
                            >
                                批量置顶
                            </button>
                            <button
                                class="ghost"
                                :disabled="!selectedPublishedSnapshotPinnedCount"
                                @click="batchSetPublishedSnapshotPin(false)"
                            >
                                取消置顶
                            </button>
                            <button
                                class="ghost"
                                :disabled="!selectedPublishedSnapshotUnlockedCount"
                                @click="batchSetPublishedSnapshotLock(true)"
                            >
                                批量锁定
                            </button>
                            <button
                                class="ghost"
                                :disabled="!selectedPublishedSnapshotLockedCount"
                                @click="batchSetPublishedSnapshotLock(false)"
                            >
                                批量解锁
                            </button>
                            <button
                                class="ghost danger"
                                :disabled="!selectedPublishedSnapshotUnlockedCount"
                                @click="batchDeletePublishedSnapshots"
                            >
                                批量删除
                            </button>
                            <button
                                v-if="selectedPublishedSnapshotCount"
                                class="ghost"
                                @click="clearPublishedSnapshotSelection"
                            >
                                清空选择
                            </button>
                        </div>
                    </div>

                    <div
                        v-if="currentProjectPublishedSnapshots.length"
                        class="project-library"
                    >
                        <article
                            v-for="snapshot in filteredProjectPublishedSnapshots"
                            :key="snapshot.id"
                            :class="[
                                'project-library__item',
                                {
                                    'is-active':
                                        snapshot.id ===
                                        latestProjectPublishedSnapshot?.id,
                                    'is-selected':
                                        selectedPublishedSnapshotSet.has(
                                            snapshot.id,
                                        ),
                                    'is-locked': snapshot.locked,
                                },
                            ]"
                        >
                            <label class="project-library__select">
                                <input
                                    :checked="
                                        selectedPublishedSnapshotSet.has(
                                            snapshot.id,
                                        )
                                    "
                                    type="checkbox"
                                    @change="
                                        togglePublishedSnapshotSelection(
                                            snapshot.id,
                                        )
                                    "
                                />
                            </label>

                            <div class="project-library__meta">
                                <div class="project-library__title-row">
                                    <strong>{{ snapshot.name }}</strong>
                                    <div class="project-library__badges">
                                        <span
                                            v-if="
                                                snapshot.id ===
                                                latestProjectPublishedSnapshot?.id
                                            "
                                            class="project-library__badge"
                                        >
                                            最新发布
                                        </span>
                                        <span
                                            :class="[
                                                'project-library__badge',
                                                'project-library__badge--environment',
                                                `is-${snapshot.environment}`,
                                            ]"
                                        >
                                            {{
                                                formatPublishedEnvironmentLabel(
                                                    snapshot.environment,
                                                )
                                            }}
                                        </span>
                                        <span
                                            :class="[
                                                'project-library__badge',
                                                'project-library__badge--approval',
                                                `is-${snapshot.approvalStatus}`,
                                            ]"
                                        >
                                            {{
                                                formatPublishedApprovalStatusLabel(
                                                    snapshot.approvalStatus,
                                                )
                                            }}
                                        </span>
                                        <span
                                            v-if="snapshot.pinned"
                                            class="project-library__badge project-library__badge--pinned"
                                        >
                                            已置顶
                                        </span>
                                        <span
                                            v-if="snapshot.locked"
                                            class="project-library__badge project-library__badge--locked"
                                        >
                                            已锁定
                                        </span>
                                    </div>
                                </div>
                                <span>
                                    {{ snapshot.pageName }} ·
                                    {{
                                        new Date(snapshot.updatedAt).toLocaleString(
                                            "zh-CN",
                                            { hour12: false },
                                        )
                                    }}
                                </span>
                                <p
                                    v-if="snapshot.note"
                                    class="project-library__note"
                                >
                                    {{ snapshot.note }}
                                </p>
                                <div class="project-library__approval-meta">
                                    <span>
                                        审批人：{{
                                            snapshot.approvalReviewer || "未填写"
                                        }}
                                    </span>
                                    <span>
                                        审批时间：{{
                                            new Date(
                                                snapshot.approvalUpdatedAt ||
                                                    snapshot.updatedAt,
                                            ).toLocaleString("zh-CN", {
                                                hour12: false,
                                            })
                                        }}
                                    </span>
                                </div>
                                <p
                                    v-if="snapshot.approvalComment"
                                    class="project-library__note project-library__note--approval"
                                >
                                    {{
                                        getPublishedApprovalCommentLabel(
                                            snapshot.approvalStatus,
                                        )
                                    }}：{{ snapshot.approvalComment }}
                                </p>
                                <div
                                    v-if="snapshot.tags?.length"
                                    class="project-library__tag-list"
                                >
                                    <span
                                        v-for="tag in snapshot.tags"
                                        :key="tag"
                                        class="project-library__tag"
                                    >
                                        {{ tag }}
                                    </span>
                                </div>
                                <div
                                    v-if="
                                        approvalTimelineSnapshotId === snapshot.id &&
                                        snapshot.approvalHistory?.length
                                    "
                                    class="project-library__timeline"
                                >
                                    <section
                                        v-for="entry in snapshot.approvalHistory"
                                        :key="entry.id"
                                        class="project-library__timeline-item"
                                    >
                                        <div class="project-library__timeline-head">
                                            <span
                                                :class="[
                                                    'project-library__badge',
                                                    'project-library__badge--approval',
                                                    `is-${entry.status}`,
                                                ]"
                                            >
                                                {{
                                                    formatPublishedApprovalStatusLabel(
                                                        entry.status,
                                                    )
                                                }}
                                            </span>
                                            <span>
                                                {{
                                                    entry.reviewer
                                                        ? `审批人：${entry.reviewer}`
                                                        : "未填写审批人"
                                                }}
                                            </span>
                                            <span>
                                                {{
                                                    new Date(
                                                        entry.changedAt,
                                                    ).toLocaleString("zh-CN", {
                                                        hour12: false,
                                                    })
                                                }}
                                            </span>
                                        </div>
                                        <p
                                            v-if="entry.comment"
                                            class="project-library__timeline-comment"
                                        >
                                            {{
                                                getPublishedApprovalCommentLabel(
                                                    entry.status,
                                                )
                                            }}：{{ entry.comment }}
                                        </p>
                                    </section>
                                </div>
                                <div
                                    v-if="publishDiffSnapshotId === snapshot.id"
                                    class="project-library__diff"
                                >
                                    <p class="project-library__diff-summary">
                                        {{
                                            publishedSnapshotDiffMap[snapshot.id]
                                                ?.summary
                                        }}
                                    </p>
                                    <div
                                        v-if="
                                            publishedSnapshotDiffMap[snapshot.id]
                                                ?.sections.length
                                        "
                                        class="project-library__diff-sections"
                                    >
                                        <section
                                            v-for="section in publishedSnapshotDiffMap[
                                                snapshot.id
                                            ]?.sections"
                                            :key="section.label"
                                            class="project-library__diff-section"
                                        >
                                            <span
                                                class="project-library__diff-section-title"
                                            >
                                                {{ section.label }}
                                            </span>
                                            <div
                                                class="project-library__diff-section-list"
                                            >
                                                <p
                                                    v-for="entry in section.entries"
                                                    :key="`${section.label}-${entry}`"
                                                    class="project-library__diff-entry"
                                                >
                                                    {{ entry }}
                                                </p>
                                            </div>
                                        </section>
                                    </div>
                                </div>
                                <div
                                    v-if="pendingRollbackSnapshotId === snapshot.id"
                                    class="project-library__rollback"
                                >
                                    <p class="project-library__rollback-text">
                                        确认将当前编辑器回滚到
                                        <strong>{{ snapshot.name }}</strong>
                                        吗？当前未发布修改会覆盖本地项目，但仍可通过撤销恢复。
                                    </p>
                                    <div class="project-library__rollback-actions">
                                        <button
                                            class="ghost danger"
                                            @click="
                                                confirmPublishedSnapshotRollback(
                                                    snapshot.id,
                                                )
                                            "
                                        >
                                            确认回滚
                                        </button>
                                        <button
                                            class="ghost"
                                            @click="cancelPublishedSnapshotRollback"
                                        >
                                            取消
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div class="project-library__actions">
                                <button
                                    class="ghost"
                                    @click="copyPublishedSnapshotLink(snapshot.id)"
                                >
                                    复制链接
                                </button>
                                <button
                                    v-if="snapshot.approvalStatus !== 'approved'"
                                    class="ghost"
                                    :disabled="snapshot.locked"
                                    @click="quickApprovePublishedSnapshot(snapshot.id)"
                                >
                                    一键通过
                                </button>
                                <button
                                    v-if="snapshot.approvalStatus !== 'rejected'"
                                    class="ghost danger"
                                    :disabled="snapshot.locked"
                                    @click="quickRejectPublishedSnapshot(snapshot.id)"
                                >
                                    一键驳回
                                </button>
                                <button
                                    class="ghost"
                                    :disabled="snapshot.locked"
                                    @click="startPublishedSnapshotEdit(snapshot.id)"
                                >
                                    编辑信息
                                </button>
                                <button
                                    class="ghost"
                                    @click="togglePublishedSnapshotDiff(snapshot.id)"
                                >
                                    {{
                                        publishDiffSnapshotId === snapshot.id
                                            ? "收起差异"
                                            : "查看差异"
                                    }}
                                </button>
                                <button
                                    class="ghost"
                                    @click="
                                        togglePublishedSnapshotApprovalTimeline(
                                            snapshot.id,
                                        )
                                    "
                                >
                                    {{
                                        approvalTimelineSnapshotId === snapshot.id
                                            ? "收起审批线"
                                            : "审批时间线"
                                    }}
                                </button>
                                <button
                                    class="ghost"
                                    @click="togglePublishedSnapshotPin(snapshot.id)"
                                >
                                    {{ snapshot.pinned ? "取消置顶" : "置顶版本" }}
                                </button>
                                <button
                                    class="ghost"
                                    @click="togglePublishedSnapshotLock(snapshot.id)"
                                >
                                    {{ snapshot.locked ? "解除锁定" : "锁定版本" }}
                                </button>
                                <button
                                    class="ghost"
                                    @click="requestPublishedSnapshotRollback(snapshot.id)"
                                >
                                    回滚到编辑器
                                </button>
                                <button
                                    class="ghost"
                                    @click="activatePublishedRuntime(snapshot.id)"
                                >
                                    打开运行态
                                </button>
                                <button
                                    class="ghost danger"
                                    :disabled="snapshot.locked"
                                    @click="deletePublishedSnapshot(snapshot.id)"
                                >
                                    删除
                                </button>
                            </div>
                        </article>

                        <p
                            v-if="!filteredProjectPublishedSnapshots.length"
                            class="project-library__empty"
                        >
                            没有匹配的发布版本，调整搜索词或筛选条件后再试试。
                        </p>
                    </div>

                    <div
                        v-if="currentProjectPublishedRollbackLogs.length"
                        class="project-library__history"
                    >
                        <div class="project-library__history-header">
                            <div class="dialog-card__summary">
                                <span>回滚记录</span>
                                <strong>
                                    {{ currentProjectPublishedRollbackLogs.length }} 条
                                </strong>
                            </div>
                            <div class="project-library__history-actions">
                                <button
                                    class="ghost danger"
                                    @click="clearCurrentProjectPublishedRollbackLogs"
                                >
                                    清空记录
                                </button>
                            </div>
                        </div>
                        <div class="publish-filter-bar publish-filter-bar--history">
                            <label class="publish-filter-field">
                                <span>搜索记录</span>
                                <input
                                    v-model="publishedRollbackSearchKeyword"
                                    type="text"
                                    placeholder="搜索版本、页面、摘要、标签"
                                />
                            </label>
                            <label class="publish-filter-field">
                                <span>环境筛选</span>
                                <select v-model="publishedRollbackFilterEnvironment">
                                    <option value="all">全部环境</option>
                                    <option
                                        v-for="option in PUBLISHED_ENVIRONMENT_OPTIONS"
                                        :key="`rollback-${option.value}`"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </option>
                                </select>
                            </label>
                            <label class="publish-filter-field">
                                <span>关联状态</span>
                                <select v-model="publishedRollbackFilterRelation">
                                    <option
                                        v-for="option in PUBLISHED_ROLLBACK_RELATION_FILTER_OPTIONS"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </option>
                                </select>
                            </label>
                            <div class="publish-filter-summary">
                                <span>
                                    显示 {{ filteredProjectPublishedRollbackLogs.length }} /
                                    {{ currentProjectPublishedRollbackLogs.length }} 条记录
                                </span>
                                <button
                                    v-if="hasPublishedRollbackFilters"
                                    class="ghost"
                                    @click="resetPublishedRollbackFilters"
                                >
                                    清空筛选
                                </button>
                            </div>
                        </div>
                        <div class="project-library__history-list">
                            <article
                                v-for="log in filteredProjectPublishedRollbackLogs"
                                :key="log.id"
                                class="project-library__history-item"
                            >
                                <div class="project-library__meta">
                                    <div class="project-library__title-row">
                                        <strong>{{ log.snapshotName }}</strong>
                                        <span
                                            :class="[
                                                'project-library__badge',
                                                'project-library__badge--environment',
                                                `is-${log.environment}`,
                                            ]"
                                        >
                                            {{
                                                formatPublishedEnvironmentLabel(
                                                    log.environment,
                                                )
                                            }}
                                        </span>
                                    </div>
                                    <span>
                                        {{ log.pageName }} ·
                                        {{
                                            new Date(log.rolledBackAt).toLocaleString(
                                                "zh-CN",
                                                { hour12: false },
                                            )
                                        }}
                                    </span>
                                    <p
                                        v-if="log.summary"
                                        class="project-library__note"
                                    >
                                        {{ log.summary }}
                                    </p>
                                    <div
                                        v-if="log.tags?.length"
                                        class="project-library__tag-list"
                                    >
                                        <span
                                            v-for="tag in log.tags"
                                            :key="`${log.id}-${tag}`"
                                            class="project-library__tag"
                                        >
                                            {{ tag }}
                                        </span>
                                    </div>
                                </div>
                                <div class="project-library__actions">
                                    <button
                                        class="ghost"
                                        :disabled="
                                            !hasCurrentProjectPublishedSnapshot(
                                                log.snapshotId,
                                            )
                                        "
                                        @click="
                                            focusPublishedSnapshotFromRollbackLog(
                                                log.id,
                                            )
                                        "
                                    >
                                        {{
                                            hasCurrentProjectPublishedSnapshot(
                                                log.snapshotId,
                                            )
                                                ? "定位版本"
                                                : "版本已删除"
                                        }}
                                    </button>
                                    <button
                                        class="ghost danger"
                                        @click="deletePublishedRollbackLog(log.id)"
                                    >
                                        删除记录
                                    </button>
                                </div>
                            </article>
                            <p
                                v-if="!filteredProjectPublishedRollbackLogs.length"
                                class="project-library__empty"
                            >
                                没有匹配的回滚记录，调整搜索词或筛选条件后再试试。
                            </p>
                        </div>
                    </div>

                    <div
                        v-if="currentProjectPublishedOperationLogs.length"
                        class="project-library__history"
                    >
                        <div class="project-library__history-header">
                            <div class="dialog-card__summary">
                                <span>操作日志</span>
                                <strong>
                                    {{ currentProjectPublishedOperationLogs.length }} 条
                                </strong>
                            </div>
                            <div class="project-library__history-actions">
                                <button
                                    class="ghost"
                                    @click="openPublishedOperationLogExportDialog"
                                >
                                    导出日志
                                </button>
                                <button
                                    class="ghost danger"
                                    @click="clearCurrentProjectPublishedOperationLogs"
                                >
                                    清空日志
                                </button>
                            </div>
                        </div>
                        <div class="publish-filter-bar publish-filter-bar--operation">
                            <label class="publish-filter-field">
                                <span>搜索日志</span>
                                <input
                                    v-model="publishedOperationSearchKeyword"
                                    type="text"
                                    placeholder="搜索动作、摘要、详情、版本名"
                                />
                            </label>
                            <label class="publish-filter-field">
                                <span>动作筛选</span>
                                <select v-model="publishedOperationFilterAction">
                                    <option
                                        v-for="option in PUBLISHED_OPERATION_ACTION_FILTER_OPTIONS"
                                        :key="`operation-${option.value}`"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </option>
                                </select>
                            </label>
                            <div class="publish-filter-summary">
                                <span>
                                    显示 {{ filteredProjectPublishedOperationLogs.length }} /
                                    {{ currentProjectPublishedOperationLogs.length }} 条日志
                                </span>
                                <button
                                    v-if="hasPublishedOperationFilters"
                                    class="ghost"
                                    @click="resetPublishedOperationFilters"
                                >
                                    清空筛选
                                </button>
                            </div>
                        </div>
                        <div class="project-library__history-list">
                            <article
                                v-for="log in filteredProjectPublishedOperationLogs"
                                :key="log.id"
                                class="project-library__history-item"
                            >
                                <div class="project-library__meta">
                                    <div class="project-library__title-row">
                                        <strong>{{ log.summary }}</strong>
                                        <span
                                            class="project-library__badge project-library__badge--action"
                                        >
                                            {{ log.actionLabel }}
                                        </span>
                                    </div>
                                    <span>
                                        {{
                                            new Date(log.createdAt).toLocaleString(
                                                "zh-CN",
                                                { hour12: false },
                                            )
                                        }}
                                    </span>
                                    <p
                                        v-if="log.detail"
                                        class="project-library__note"
                                    >
                                        {{ log.detail }}
                                    </p>
                                    <div
                                        v-if="log.snapshotNames.length"
                                        class="project-library__tag-list"
                                    >
                                        <span
                                            v-for="snapshotName in log.snapshotNames"
                                            :key="`${log.id}-${snapshotName}`"
                                            class="project-library__tag"
                                        >
                                            {{ snapshotName }}
                                        </span>
                                    </div>
                                </div>
                                <div class="project-library__actions">
                                    <button
                                        class="ghost"
                                        @click="openPublishedOperationLogDetail(log.id)"
                                    >
                                        查看详情
                                    </button>
                                    <button
                                        class="ghost danger"
                                        @click="deletePublishedOperationLog(log.id)"
                                    >
                                        删除日志
                                    </button>
                                </div>
                            </article>
                            <p
                                v-if="!filteredProjectPublishedOperationLogs.length"
                                class="project-library__empty"
                            >
                                没有匹配的操作日志，调整搜索词或筛选条件后再试试。
                            </p>
                        </div>
                    </div>

                    <p
                        v-if="!currentProjectPublishedSnapshots.length"
                        class="inspector-tip"
                    >
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

                <template v-else-if="dialogMode === 'published-operation-detail'">
                    <div class="dialog-card__header">
                        <div>
                            <p>操作日志详情</p>
                            <h3>
                                {{
                                    activePublishedOperationLog?.summary ||
                                    "当前日志已不存在"
                                }}
                            </h3>
                        </div>
                        <div class="dialog-card__actions">
                            <button
                                class="ghost"
                                @click="returnToPublishManagerDialog"
                            >
                                返回发布中心
                            </button>
                            <button class="ghost" @click="closeDialog">关闭</button>
                        </div>
                    </div>

                    <template v-if="activePublishedOperationLog">
                        <div class="dialog-card__summary">
                            <span>操作类型</span>
                            <strong>
                                {{ activePublishedOperationLog.actionLabel }}
                            </strong>
                            <span>
                                {{
                                    new Date(
                                        activePublishedOperationLog.createdAt,
                                    ).toLocaleString("zh-CN", {
                                        hour12: false,
                                    })
                                }}
                            </span>
                            <span>
                                {{ activePublishedOperationLog.projectName }}
                            </span>
                        </div>

                        <div
                            v-if="activePublishedOperationLog.detail"
                            class="dialog-card__summary"
                        >
                            <span>操作说明</span>
                            <strong>{{ activePublishedOperationLog.detail }}</strong>
                        </div>

                        <div
                            v-if="activePublishedOperationLog.snapshotNames.length"
                            class="dialog-card__summary"
                        >
                            <span>关联版本</span>
                            <div class="project-library__tag-list">
                                <span
                                    v-for="snapshotName in activePublishedOperationLog.snapshotNames"
                                    :key="`detail-${activePublishedOperationLog.id}-${snapshotName}`"
                                    class="project-library__tag"
                                >
                                    {{ snapshotName }}
                                </span>
                            </div>
                        </div>

                        <textarea
                            :value="activePublishedOperationLogDetailText"
                            class="dialog-card__textarea dialog-card__textarea--compact"
                            readonly
                            spellcheck="false"
                        />

                        <div class="dialog-card__actions">
                            <button
                                class="primary"
                                @click="copyActivePublishedOperationLogDetail"
                            >
                                复制日志 JSON
                            </button>
                        </div>
                    </template>

                    <p v-else class="inspector-tip">
                        这条日志已被删除或不再可用，可以返回发布中心查看其他记录。
                    </p>
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
            </div>
        </div>
    </div>
</template>
