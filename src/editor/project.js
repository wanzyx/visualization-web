import { cloneWidget, createWidget } from "./materials";
import { createDataSource, normalizeDataSource } from "./dataSources";

export const STORAGE_KEY = "visualization-web-project-v1";
export const TEMPLATE_STORAGE_KEY = "visualization-web-templates-v1";

const cloneDeep = (value) => JSON.parse(JSON.stringify(value));

const createGroupId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `group-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createTemplateId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `template-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createPageId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createInteractionActionId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `interaction-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const createInteractionConditionRuleId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `condition-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const createRuntimeVariablePresetId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `runtime-variable-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const interactionTriggers = [
    "click",
    "double-click",
    "hover",
    "page-enter",
    "condition-match",
];
const interactionConditionSources = [
    "widget-props",
    "source-payload",
    "runtime-variables",
];
const interactionConditionLogics = ["all", "any"];
const interactionConditionOperators = [
    "truthy",
    "falsy",
    "exists",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "includes",
];

const toFiniteNumber = (value, fallback) => {
    const nextValue = Number(value);
    return Number.isFinite(nextValue) ? nextValue : fallback;
};

export const defaultPageMeta = {
    title: "Vue3 大屏低代码平台",
    screenWidth: 1920,
    screenHeight: 1080,
    background:
        "radial-gradient(circle at top, rgba(44, 126, 255, 0.32), transparent 36%), linear-gradient(135deg, #071225 0%, #08162c 45%, #03070d 100%)",
    gridColor: "rgba(72, 210, 255, 0.12)",
    showGrid: true,
    showRulers: true,
    showGuides: true,
    guideColor: "rgba(255, 173, 92, 0.92)",
    guides: {
        vertical: [],
        horizontal: [],
    },
};

function normalizeGuideValues(values, max) {
    return Array.from(
        new Set(
            (Array.isArray(values) ? values : [])
                .map((item) => Number(item))
                .filter((item) => Number.isFinite(item))
                .map((item) => Math.min(Math.max(item, 0), max)),
        ),
    ).sort((a, b) => a - b);
}

function normalizePageMeta(meta) {
    const screenWidth = Math.max(
        320,
        toFiniteNumber(meta?.screenWidth, defaultPageMeta.screenWidth),
    );
    const screenHeight = Math.max(
        180,
        toFiniteNumber(meta?.screenHeight, defaultPageMeta.screenHeight),
    );

    return {
        ...cloneDeep(defaultPageMeta),
        ...(meta ?? {}),
        screenWidth,
        screenHeight,
        showGrid:
            meta?.showGrid === undefined
                ? defaultPageMeta.showGrid
                : Boolean(meta.showGrid),
        showRulers:
            meta?.showRulers === undefined
                ? defaultPageMeta.showRulers
                : Boolean(meta.showRulers),
        showGuides:
            meta?.showGuides === undefined
                ? defaultPageMeta.showGuides
                : Boolean(meta.showGuides),
        guideColor:
            typeof meta?.guideColor === "string" && meta.guideColor.trim()
                ? meta.guideColor
                : defaultPageMeta.guideColor,
        guides: {
            vertical: normalizeGuideValues(meta?.guides?.vertical, screenWidth),
            horizontal: normalizeGuideValues(
                meta?.guides?.horizontal,
                screenHeight,
            ),
        },
    };
}

function normalizeDataBinding(binding) {
    return {
        sourceId: typeof binding?.sourceId === "string" ? binding.sourceId : "",
    };
}

function normalizeRuntimeVariablePreset(preset) {
    return {
        id:
            typeof preset?.id === "string" && preset.id
                ? preset.id
                : createRuntimeVariablePresetId(),
        key: typeof preset?.key === "string" ? preset.key.trim() : "",
        value: preset?.value == null ? "" : String(preset.value),
    };
}

function normalizeInteractionConditionRule(rule) {
    return {
        id:
            typeof rule?.id === "string" && rule.id
                ? rule.id
                : createInteractionConditionRuleId(),
        source: interactionConditionSources.includes(rule?.source)
            ? rule.source
            : "widget-props",
        field: typeof rule?.field === "string" ? rule.field.trim() : "",
        operator: interactionConditionOperators.includes(rule?.operator)
            ? rule.operator
            : "truthy",
        value: rule?.value == null ? "" : String(rule.value),
    };
}

function hasLegacyInteractionConditionRule(condition) {
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

function normalizeInteractionCondition(condition) {
    const rules = Array.isArray(condition?.rules)
        ? condition.rules.map((rule) => normalizeInteractionConditionRule(rule))
        : hasLegacyInteractionConditionRule(condition)
          ? [normalizeInteractionConditionRule(condition)]
          : [];
    const enabled = Boolean(condition?.enabled);

    return {
        enabled,
        logic: interactionConditionLogics.includes(condition?.logic)
            ? condition.logic
            : "all",
        rules:
            rules.length > 0
                ? rules
                : enabled
                  ? [normalizeInteractionConditionRule()]
                  : [],
    };
}

function normalizeInteractionAction(action) {
    return {
        id:
            typeof action?.id === "string" && action.id
                ? action.id
                : createInteractionActionId(),
        action: typeof action?.action === "string" ? action.action : "none",
        targetWidgetIds: Array.isArray(action?.targetWidgetIds)
            ? action.targetWidgetIds.filter((item) => typeof item === "string")
            : [],
        targetSourceIds: Array.isArray(action?.targetSourceIds)
            ? action.targetSourceIds.filter((item) => typeof item === "string")
            : [],
        targetPageId:
            typeof action?.targetPageId === "string" ? action.targetPageId : "",
        targetPropsPatch:
            typeof action?.targetPropsPatch === "string"
                ? action.targetPropsPatch
                : "{}",
        targetVariableKey:
            typeof action?.targetVariableKey === "string"
                ? action.targetVariableKey.trim()
                : "",
        targetVariableValue:
            action?.targetVariableValue == null
                ? ""
                : String(action.targetVariableValue),
        delay: Math.max(0, toFiniteNumber(action?.delay, 0)),
        condition: normalizeInteractionCondition(action?.condition),
    };
}

function buildLegacyInteractionActions(interaction) {
    const action = normalizeInteractionAction({
        action: interaction?.clickAction,
        targetWidgetIds: interaction?.targetWidgetIds,
        targetSourceIds: interaction?.targetSourceIds,
        targetPageId: interaction?.targetPageId,
    });

    const hasContent =
        action.action !== "none" ||
        action.targetWidgetIds.length > 0 ||
        action.targetSourceIds.length > 0 ||
        Boolean(action.targetPageId) ||
        action.delay > 0;

    return hasContent ? [action] : [];
}

function normalizeInteraction(interaction) {
    const trigger = interactionTriggers.includes(interaction?.trigger)
        ? interaction.trigger
        : "click";

    return {
        trigger,
        actions: Array.isArray(interaction?.actions)
            ? interaction.actions.map((action) =>
                  normalizeInteractionAction(action),
              )
            : buildLegacyInteractionActions(interaction),
    };
}

export function createInteractionAction(action = "none", overrides = {}) {
    return normalizeInteractionAction({
        action,
        ...overrides,
    });
}

export function createInteractionConditionRule(overrides = {}) {
    return normalizeInteractionConditionRule(overrides);
}

export function createRuntimeVariablePreset(overrides = {}) {
    return normalizeRuntimeVariablePreset(overrides);
}

export function getInteractionActions(interaction) {
    return normalizeInteraction(interaction).actions;
}

function remapInteractionTargets(interaction, widgetIdMap, options = {}) {
    const normalized = normalizeInteraction(interaction);
    const dropMissing = Boolean(options.dropMissing);
    const pageIdMap = options.pageIdMap ?? new Map();

    return {
        actions: normalized.actions.map((action) => ({
            ...action,
            targetWidgetIds: action.targetWidgetIds
                .map((targetId) => {
                    if (widgetIdMap.has(targetId)) {
                        return widgetIdMap.get(targetId);
                    }

                    return dropMissing ? null : targetId;
                })
                .filter(Boolean),
            targetPageId:
                pageIdMap.get(action.targetPageId) ?? action.targetPageId,
        })),
    };
}

function normalizeWidget(widget, index) {
    const normalized = createWidget(
        widget?.type || "panel",
        cloneDeep(widget ?? {}),
    );

    return {
        ...normalized,
        id: widget?.id || normalized.id,
        name: widget?.name || normalized.name,
        groupId: widget?.groupId || null,
        locked: Boolean(widget?.locked),
        hidden: Boolean(widget?.hidden),
        dataBinding: normalizeDataBinding(widget?.dataBinding),
        interaction: normalizeInteraction(widget?.interaction),
        x: toFiniteNumber(widget?.x, normalized.x),
        y: toFiniteNumber(widget?.y, normalized.y),
        w: Math.max(100, toFiniteNumber(widget?.w, normalized.w)),
        h: Math.max(60, toFiniteNumber(widget?.h, normalized.h)),
        zIndex: toFiniteNumber(widget?.zIndex, index + 1),
    };
}

export function createProjectPage(name = "新页面", options = {}) {
    const widgets = Array.isArray(options.widgets)
        ? options.widgets.map((widget, index) => normalizeWidget(widget, index))
        : [];

    widgets.sort((a, b) => a.zIndex - b.zIndex);

    return {
        id: options.id ?? createPageId(),
        name,
        meta: normalizePageMeta(options.meta ?? {}),
        widgets,
    };
}

export function duplicateProjectPage(page, nextName = `${page.name} 副本`) {
    const duplicatedPageId = createPageId();
    const groupMap = new Map();
    const sources = [...page.widgets].sort((a, b) => a.zIndex - b.zIndex);
    const widgets = sources.map((widget) => {
        let nextGroupId = null;

        if (widget.groupId) {
            if (!groupMap.has(widget.groupId)) {
                groupMap.set(widget.groupId, createGroupId());
            }

            nextGroupId = groupMap.get(widget.groupId);
        }

        return cloneWidget(widget, {
            groupId: nextGroupId,
        });
    });

    const widgetIdMap = new Map(
        sources.map((widget, index) => [widget.id, widgets[index].id]),
    );
    const pageIdMap = new Map([[page.id, duplicatedPageId]]);

    widgets.forEach((widget) => {
        widget.interaction = remapInteractionTargets(
            widget.interaction,
            widgetIdMap,
            {
                pageIdMap,
            },
        );
    });

    return createProjectPage(nextName, {
        id: duplicatedPageId,
        meta: cloneDeep(page.meta),
        widgets,
    });
}

function normalizePage(page, index, sourceIds) {
    const nextPage = createProjectPage(page?.name || `页面 ${index + 1}`, {
        id: page?.id,
        meta: page?.meta ?? {},
        widgets: Array.isArray(page?.widgets) ? page.widgets : [],
    });

    nextPage.widgets.forEach((widget) => {
        if (
            widget.dataBinding.sourceId &&
            !sourceIds.has(widget.dataBinding.sourceId)
        ) {
            widget.dataBinding.sourceId = "";
        }
    });

    return nextPage;
}

export function createDemoProject() {
    const titleSource = createDataSource("text", {
        name: "大屏标题",
        generator: "headlineFlash",
        refreshInterval: 30,
        payload: {
            text: "城市运行智能指挥中心",
        },
    });

    const overviewSource = createDataSource("panel", {
        name: "左侧概览",
        generator: "panelDigest",
        refreshInterval: 60,
        payload: {
            title: "左侧概览",
            subtitle: "承载业务摘要、分析结论和筛选说明",
            content: "通过拖拽或点击左侧物料，可以快速组合文本、图表和指标卡。",
        },
    });

    const activeDevicesSource = createDataSource("stat", {
        name: "活跃设备",
        generator: "statPulse",
        refreshInterval: 20,
        payload: {
            title: "活跃设备",
            value: 28640,
            unit: "台",
            trend: 8.2,
            trendLabel: "较昨日",
            color: "#44e6ff",
            accent: "#84ffbf",
        },
    });

    const alertSource = createDataSource("stat", {
        name: "今日告警",
        generator: "statPulse",
        refreshInterval: 25,
        payload: {
            title: "今日告警",
            value: 312,
            unit: "次",
            trend: -5.8,
            trendLabel: "较昨日",
            color: "#ffd66b",
            accent: "#ff8a72",
        },
    });

    const gaugeSource = createDataSource("gauge", {
        name: "在线率",
        generator: "gaugePulse",
        refreshInterval: 15,
        payload: {
            title: "设备在线率",
            value: 86,
            color: "#5affbd",
            trackColor: "rgba(255, 255, 255, 0.12)",
        },
    });

    const barSource = createDataSource("barChart", {
        name: "渠道流量",
        generator: "barPulse",
        refreshInterval: 35,
        payload: {
            title: "渠道流量",
            categories: ["App", "小程序", "官网", "门店", "其他"],
            values: [92, 76, 54, 39, 22],
            color: "#46eeff",
        },
    });

    const lineSource = createDataSource("lineChart", {
        name: "告警趋势",
        generator: "linePulse",
        refreshInterval: 20,
        payload: {
            title: "近七日告警趋势",
            labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            values: [14, 28, 19, 33, 48, 30, 22],
            color: "#7bfecb",
            areaColor: "rgba(123, 254, 203, 0.18)",
        },
    });

    const pageOne = createProjectPage("运营总览", {
        meta: {
            title: "城市运行智能指挥中心",
        },
        widgets: [
            createWidget("text", {
                x: 88,
                y: 48,
                w: 620,
                h: 86,
                zIndex: 1,
                props: {
                    text: "城市运行智能指挥中心",
                    fontSize: 46,
                },
                dataBinding: {
                    sourceId: titleSource.id,
                },
            }),
            createWidget("panel", {
                x: 72,
                y: 154,
                w: 540,
                h: 320,
                zIndex: 2,
                props: {
                    title: "左侧概览",
                    subtitle: "承载业务摘要、分析结论和筛选说明",
                    content:
                        "通过拖拽或点击左侧物料，可以快速组合文本、图表和指标卡。",
                },
                dataBinding: {
                    sourceId: overviewSource.id,
                },
            }),
            createWidget("stat", {
                x: 648,
                y: 154,
                zIndex: 3,
                dataBinding: {
                    sourceId: activeDevicesSource.id,
                },
            }),
            createWidget("stat", {
                x: 1020,
                y: 154,
                zIndex: 4,
                props: {
                    title: "今日告警",
                    value: 312,
                    unit: "次",
                    trend: -5.8,
                    color: "#ffd66b",
                    accent: "#ff8a72",
                },
                dataBinding: {
                    sourceId: alertSource.id,
                },
            }),
            createWidget("gauge", {
                x: 1418,
                y: 144,
                zIndex: 5,
                dataBinding: {
                    sourceId: gaugeSource.id,
                },
            }),
            createWidget("barChart", {
                x: 648,
                y: 386,
                zIndex: 6,
                dataBinding: {
                    sourceId: barSource.id,
                },
            }),
            createWidget("lineChart", {
                x: 1200,
                y: 386,
                zIndex: 7,
                dataBinding: {
                    sourceId: lineSource.id,
                },
            }),
        ],
    });

    const pageTwo = createProjectPage("趋势分析", {
        meta: {
            title: "趋势分析与预警总览",
            background:
                "radial-gradient(circle at 20% 20%, rgba(49, 137, 255, 0.22), transparent 32%), radial-gradient(circle at 80% 0%, rgba(90, 255, 189, 0.12), transparent 28%), linear-gradient(135deg, #06111f 0%, #07162a 46%, #02070d 100%)",
        },
        widgets: [
            createWidget("text", {
                x: 86,
                y: 54,
                w: 700,
                h: 82,
                zIndex: 1,
                props: {
                    text: "趋势分析与预警总览",
                    fontSize: 44,
                },
            }),
            createWidget("panel", {
                x: 72,
                y: 166,
                w: 420,
                h: 280,
                zIndex: 2,
                props: {
                    title: "分析摘要",
                    subtitle: "按页面维度组合不同图表布局",
                    content:
                        "同一套数据源可以被多个页面复用，用于运营总览、趋势分析和专题看板。",
                },
                dataBinding: {
                    sourceId: overviewSource.id,
                },
            }),
            createWidget("lineChart", {
                x: 530,
                y: 162,
                w: 620,
                h: 330,
                zIndex: 3,
                dataBinding: {
                    sourceId: lineSource.id,
                },
            }),
            createWidget("barChart", {
                x: 1184,
                y: 162,
                w: 610,
                h: 330,
                zIndex: 4,
                dataBinding: {
                    sourceId: barSource.id,
                },
            }),
            createWidget("stat", {
                x: 530,
                y: 530,
                zIndex: 5,
                dataBinding: {
                    sourceId: activeDevicesSource.id,
                },
            }),
            createWidget("stat", {
                x: 900,
                y: 530,
                zIndex: 6,
                dataBinding: {
                    sourceId: alertSource.id,
                },
            }),
            createWidget("gauge", {
                x: 1328,
                y: 514,
                zIndex: 7,
                dataBinding: {
                    sourceId: gaugeSource.id,
                },
            }),
        ],
    });

    pageOne.widgets[2].interaction = {
        clickAction: "refresh-sources",
        targetWidgetIds: [],
        targetSourceIds: [activeDevicesSource.id, alertSource.id],
        targetPageId: "",
    };
    pageOne.widgets[5].interaction = {
        clickAction: "highlight-widgets",
        targetWidgetIds: [pageOne.widgets[4].id, pageOne.widgets[6].id],
        targetSourceIds: [],
        targetPageId: "",
    };
    pageOne.widgets[6].interaction = {
        clickAction: "switch-page",
        targetWidgetIds: [],
        targetSourceIds: [],
        targetPageId: pageTwo.id,
    };
    pageTwo.widgets[2].interaction = {
        clickAction: "highlight-widgets",
        targetWidgetIds: [pageTwo.widgets[3].id, pageTwo.widgets[6].id],
        targetSourceIds: [],
        targetPageId: "",
    };

    return {
        dataSources: [
            titleSource,
            overviewSource,
            activeDevicesSource,
            alertSource,
            gaugeSource,
            barSource,
            lineSource,
        ],
        runtimeVariablePresets: [],
        pages: [pageOne, pageTwo],
        activePageId: pageOne.id,
    };
}

export function normalizeProjectSchema(rawProject) {
    if (!rawProject || typeof rawProject !== "object") {
        throw new Error("项目 JSON 不合法");
    }

    const dataSources = Array.isArray(rawProject.dataSources)
        ? rawProject.dataSources.map((source, index) =>
              normalizeDataSource(source, index),
          )
        : [];
    const sourceIds = new Set(dataSources.map((source) => source.id));

    const pages = Array.isArray(rawProject.pages)
        ? rawProject.pages.map((page, index) =>
              normalizePage(page, index, sourceIds),
          )
        : [
              normalizePage(
                  {
                      id: rawProject.pageId,
                      name:
                          rawProject.pageName ||
                          rawProject.meta?.title ||
                          "页面 1",
                      meta: rawProject.meta ?? {},
                      widgets: rawProject.widgets ?? [],
                  },
                  0,
                  sourceIds,
              ),
          ];

    const safePages = pages.length ? pages : [createProjectPage("页面 1")];
    const hasActivePage = safePages.some(
        (page) => page.id === rawProject.activePageId,
    );
    const runtimeVariablePresets = Array.isArray(
        rawProject.runtimeVariablePresets,
    )
        ? rawProject.runtimeVariablePresets.map((preset) =>
              normalizeRuntimeVariablePreset(preset),
          )
        : [];

    return {
        dataSources,
        runtimeVariablePresets,
        pages: safePages,
        activePageId: hasActivePage ? rawProject.activePageId : safePages[0].id,
    };
}

export function getNextZIndex(widgets) {
    return widgets.length
        ? Math.max(...widgets.map((item) => item.zIndex || 0)) + 1
        : 1;
}

export function sortWidgets(widgets) {
    widgets.sort((a, b) => a.zIndex - b.zIndex);
}

export function getSelectionBounds(widgets) {
    if (!widgets.length) {
        return null;
    }

    const left = Math.min(...widgets.map((item) => item.x));
    const top = Math.min(...widgets.map((item) => item.y));
    const right = Math.max(...widgets.map((item) => item.x + item.w));
    const bottom = Math.max(...widgets.map((item) => item.y + item.h));

    return {
        x: left,
        y: top,
        w: right - left,
        h: bottom - top,
    };
}

export function expandIdsWithGroups(ids, widgets) {
    const selection = new Set(ids.filter(Boolean));
    const activeGroups = new Set();

    widgets.forEach((widget) => {
        if (selection.has(widget.id) && widget.groupId) {
            activeGroups.add(widget.groupId);
        }
    });

    if (!activeGroups.size) {
        return Array.from(selection);
    }

    widgets.forEach((widget) => {
        if (widget.groupId && activeGroups.has(widget.groupId)) {
            selection.add(widget.id);
        }
    });

    return Array.from(selection);
}

export function duplicateWidgets(project, selectedIds) {
    const expandedIds = expandIdsWithGroups(selectedIds, project.widgets);
    const selectedSet = new Set(expandedIds);
    const sources = project.widgets
        .filter((item) => selectedSet.has(item.id))
        .sort((a, b) => a.zIndex - b.zIndex);

    if (!sources.length) {
        return [];
    }

    const nextZIndex = getNextZIndex(project.widgets);
    const groupMap = new Map();
    const duplicates = sources.map((widget, index) => {
        let nextGroupId = null;

        if (widget.groupId) {
            if (!groupMap.has(widget.groupId)) {
                groupMap.set(widget.groupId, createGroupId());
            }

            nextGroupId = groupMap.get(widget.groupId);
        }

        return cloneWidget(widget, {
            x: widget.x + 28,
            y: widget.y + 28,
            zIndex: nextZIndex + index,
            groupId: nextGroupId,
        });
    });

    const widgetIdMap = new Map(
        sources.map((widget, index) => [widget.id, duplicates[index].id]),
    );

    duplicates.forEach((widget) => {
        widget.interaction = remapInteractionTargets(
            widget.interaction,
            widgetIdMap,
        );
    });

    project.widgets.push(...duplicates);
    sortWidgets(project.widgets);
    return duplicates;
}

export function createWidgetGroup(project, selectedIds) {
    const expandedIds = expandIdsWithGroups(selectedIds, project.widgets);

    if (expandedIds.length < 2) {
        return null;
    }

    const groupId = createGroupId();
    const selectedSet = new Set(expandedIds);

    project.widgets.forEach((widget) => {
        if (selectedSet.has(widget.id)) {
            widget.groupId = groupId;
        }
    });

    return groupId;
}

export function removeWidgetGroup(project, selectedIds) {
    const expandedIds = expandIdsWithGroups(selectedIds, project.widgets);
    const selectedSet = new Set(expandedIds);

    project.widgets.forEach((widget) => {
        if (selectedSet.has(widget.id)) {
            widget.groupId = null;
        }
    });

    return expandedIds.length;
}

function buildTemplatePreview(widgets) {
    const bounds = getSelectionBounds(widgets) ?? { w: 0, h: 0 };

    return {
        width: bounds.w,
        height: bounds.h,
        count: widgets.length,
    };
}

function normalizeTemplate(rawTemplate, index) {
    if (!rawTemplate || typeof rawTemplate !== "object") {
        return null;
    }

    const widgets = Array.isArray(rawTemplate.widgets)
        ? rawTemplate.widgets.map((widget, widgetIndex) =>
              normalizeWidget(widget, widgetIndex),
          )
        : [];

    if (!widgets.length) {
        return null;
    }

    const bounds = getSelectionBounds(widgets) ?? { x: 0, y: 0 };
    const normalizedWidgets = widgets.map((widget, widgetIndex) => ({
        ...widget,
        x: widget.x - bounds.x,
        y: widget.y - bounds.y,
        zIndex: widgetIndex + 1,
    }));

    return {
        id: rawTemplate.id || `template-${index + 1}`,
        name:
            rawTemplate.name ||
            (normalizedWidgets.length === 1
                ? `${normalizedWidgets[0].name} 模板`
                : `组合模板 ${normalizedWidgets.length} 项`),
        createdAt: Number.isFinite(Number(rawTemplate.createdAt))
            ? Number(rawTemplate.createdAt)
            : Date.now(),
        widgets: normalizedWidgets,
        preview: buildTemplatePreview(normalizedWidgets),
    };
}

export function loadTemplateLibrary() {
    if (typeof localStorage === "undefined") {
        return [];
    }

    const rawValue = localStorage.getItem(TEMPLATE_STORAGE_KEY);

    if (!rawValue) {
        return [];
    }

    try {
        const templates = JSON.parse(rawValue);

        if (!Array.isArray(templates)) {
            return [];
        }

        return templates.map(normalizeTemplate).filter(Boolean);
    } catch (error) {
        console.warn(error);
        return [];
    }
}

export function createTemplateFromSelection(project, selectedIds, name = "") {
    const expandedIds = expandIdsWithGroups(selectedIds, project.widgets);
    const selectedSet = new Set(expandedIds);
    const sourceWidgets = project.widgets
        .filter((item) => selectedSet.has(item.id))
        .sort((a, b) => a.zIndex - b.zIndex);

    if (!sourceWidgets.length) {
        return null;
    }

    const bounds = getSelectionBounds(sourceWidgets);

    if (!bounds) {
        return null;
    }

    const widgets = sourceWidgets.map((widget, index) => ({
        ...cloneDeep(widget),
        x: widget.x - bounds.x,
        y: widget.y - bounds.y,
        zIndex: index + 1,
    }));

    return {
        id: createTemplateId(),
        name:
            name.trim() ||
            (widgets.length === 1
                ? `${widgets[0].name} 模板`
                : `组合模板 ${widgets.length} 项`),
        createdAt: Date.now(),
        widgets,
        preview: buildTemplatePreview(widgets),
    };
}

export function instantiateTemplate(project, template, position = {}) {
    if (!template?.widgets?.length) {
        return [];
    }

    const nextZIndex = getNextZIndex(project.widgets);
    const groupMap = new Map();
    const sourceIds = new Set(
        (project.dataSources ?? []).map((source) => source.id),
    );
    const widgets = [...template.widgets].sort((a, b) => a.zIndex - b.zIndex);
    const createdWidgets = widgets.map((widget, index) => {
        let nextGroupId = null;

        if (widget.groupId) {
            if (!groupMap.has(widget.groupId)) {
                groupMap.set(widget.groupId, createGroupId());
            }

            nextGroupId = groupMap.get(widget.groupId);
        }

        return cloneWidget(widget, {
            x: (position.x ?? 80) + widget.x,
            y: (position.y ?? 80) + widget.y,
            zIndex: nextZIndex + index,
            groupId: nextGroupId,
            dataBinding: {
                sourceId: sourceIds.has(widget.dataBinding?.sourceId)
                    ? (widget.dataBinding?.sourceId ?? "")
                    : "",
            },
            hidden: false,
            locked: false,
        });
    });

    const widgetIdMap = new Map(
        widgets.map((widget, index) => [widget.id, createdWidgets[index].id]),
    );

    createdWidgets.forEach((widget) => {
        widget.interaction = remapInteractionTargets(
            widget.interaction,
            widgetIdMap,
            {
                dropMissing: true,
            },
        );
    });

    return createdWidgets;
}
