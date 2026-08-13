const cloneDeep = (value) => JSON.parse(JSON.stringify(value));

const createId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `source-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const randomBetween = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round1 = (value) => Math.round(value * 10) / 10;

export const requestMethodOptions = ["GET", "POST", "PUT", "PATCH", "DELETE"];
export const authModeOptions = [
    { value: "none", label: "无鉴权" },
    { value: "bearer", label: "Bearer Token" },
    { value: "basic", label: "Basic Auth" },
    { value: "custom-header", label: "自定义请求头" },
];

function formatClock(date = new Date()) {
    return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);
}

function formatClockText(date = new Date(), options = {}) {
    const locale = String(options.locale || "zh-CN").trim() || "zh-CN";
    const timeZone = String(options.timeZone || "").trim();
    const showSeconds = options.showSeconds !== false;
    const use24Hour = options.use24Hour !== false;

    try {
        return new Intl.DateTimeFormat(locale, {
            hour: "2-digit",
            minute: "2-digit",
            second: showSeconds ? "2-digit" : undefined,
            hour12: !use24Hour,
            timeZone: timeZone || undefined,
        }).format(date);
    } catch (error) {
        console.warn(error);
        return formatClock(date);
    }
}

function formatDateText(date = new Date(), options = {}) {
    const locale = String(options.locale || "zh-CN").trim() || "zh-CN";
    const timeZone = String(options.timeZone || "").trim();
    const showWeekday = options.showWeekday !== false;

    try {
        return new Intl.DateTimeFormat(locale, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            weekday: showWeekday ? "long" : undefined,
            timeZone: timeZone || undefined,
        }).format(date);
    } catch (error) {
        console.warn(error);
        return new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            weekday: showWeekday ? "long" : undefined,
        }).format(date);
    }
}

function serializeTextValue(value, fallback = "") {
    if (typeof value === "string") {
        return value;
    }

    if (value && typeof value === "object") {
        try {
            return JSON.stringify(value, null, 2);
        } catch (error) {
            console.warn(error);
        }
    }

    return fallback;
}

export function createDataSourceRequestConfig(overrides = {}) {
    const method = String(overrides.method || "GET").toUpperCase();
    const timeout = Number(overrides.timeout);
    const authMode = authModeOptions.some(
        (option) => option.value === overrides.authMode,
    )
        ? overrides.authMode
        : "none";

    return {
        url: typeof overrides.url === "string" ? overrides.url : "",
        method: requestMethodOptions.includes(method) ? method : "GET",
        dataPath:
            typeof overrides.dataPath === "string" ? overrides.dataPath : "",
        queryText: serializeTextValue(
            overrides.queryText ?? overrides.query,
            "",
        ),
        headersText: serializeTextValue(
            overrides.headersText ?? overrides.headers,
            "",
        ),
        bodyText: serializeTextValue(overrides.bodyText ?? overrides.body, ""),
        fieldMappingsText: serializeTextValue(
            overrides.fieldMappingsText ?? overrides.fieldMappings,
            "",
        ),
        authMode,
        authToken:
            typeof overrides.authToken === "string" ? overrides.authToken : "",
        authHeaderName:
            typeof overrides.authHeaderName === "string" &&
            overrides.authHeaderName.trim()
                ? overrides.authHeaderName
                : "Authorization",
        authUsername:
            typeof overrides.authUsername === "string"
                ? overrides.authUsername
                : "",
        authPassword:
            typeof overrides.authPassword === "string"
                ? overrides.authPassword
                : "",
        timeout: Number.isFinite(timeout) ? Math.max(500, timeout) : 10000,
        withCredentials: Boolean(overrides.withCredentials),
    };
}

const sourceSpecs = {
    text: {
        label: "文本",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "headlineFlash", label: "标题轮播" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            text: "城市运行智能指挥中心",
        }),
    },
    stat: {
        label: "指标",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "statPulse", label: "动态波动" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "活跃设备",
            value: 28640,
            unit: "台",
            trend: 8.2,
            trendLabel: "较昨日",
            color: "#44e6ff",
            accent: "#84ffbf",
        }),
    },
    digitStat: {
        label: "数字翻牌",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "digitPulse", label: "数字跳动" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "今日交易额",
            value: 1284068,
            unit: "元",
            tag: "REALTIME",
            prefix: "¥",
            suffix: "",
            decimals: 0,
            groupSeparator: true,
            color: "#ecf7ff",
            accent: "#46eeff",
            unitColor: "rgba(235, 247, 255, 0.72)",
        }),
    },
    barChart: {
        label: "柱状图",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "barPulse", label: "柱状浮动" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "渠道流量",
            categories: ["App", "小程序", "官网", "门店", "其他"],
            values: [92, 76, 54, 39, 22],
            color: "#46eeff",
            enableFilterLinkage: false,
            filterField: "name",
            activeCategory: "",
            targetWidgetIds: [],
        }),
    },
    pieChart: {
        label: "饼图",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "piePulse", label: "占比变化" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "业务构成",
            categories: ["零售", "服务", "供应链", "其他"],
            values: [38, 26, 21, 15],
            colors: ["#46eeff", "#7bfecb", "#ffd66b", "#6d8bff"],
            enableFilterLinkage: false,
            filterField: "name",
            activeCategory: "",
            targetWidgetIds: [],
        }),
    },
    heatmapChart: {
        label: "区域热力图",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "heatmapPulse", label: "热力波动" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "区域活跃热力",
            xLabels: ["东区", "西区", "南区", "北区", "中枢"],
            yLabels: ["00:00", "06:00", "12:00", "18:00"],
            values: [
                [12, 18, 9, 6, 22],
                [22, 31, 16, 12, 35],
                [30, 42, 28, 20, 48],
                [18, 26, 19, 14, 29],
            ],
            lowColor: "rgba(70, 238, 255, 0.08)",
            highColor: "#46eeff",
            showValues: true,
            enableFilterLinkage: false,
            filterField: "name",
            activeCategory: "",
            targetWidgetIds: [],
        }),
    },
    chinaRegionMap: {
        label: "\u4e2d\u56fd\u5730\u56fe",
        generators: [
            { value: "static", label: "\u9759\u6001\u6570\u636e" },
            { value: "regionPulse", label: "\u533a\u57df\u6ce2\u52a8" },
            { value: "remote", label: "HTTP \u63a5\u53e3" },
        ],
        createPayload: () => ({
            title: "\u5168\u56fd\u4e1a\u52a1\u5206\u5e03",
            unit: "\u70b9",
            lowColor: "rgba(70, 238, 255, 0.08)",
            highColor: "#46eeff",
            accent: "#7bfecb",
            showLegend: true,
            enableDrilldown: true,
            enableFilterLinkage: true,
            filterField: "name",
            targetWidgetIds: [],
            showScatter: true,
            showFlightLines: true,
            activeProvince: "",
            items: [
                { name: "\u5e7f\u4e1c", value: 96 },
                { name: "\u6c5f\u82cf", value: 88 },
                { name: "\u6d59\u6c5f", value: 84 },
                { name: "\u5c71\u4e1c", value: 76 },
                { name: "\u56db\u5ddd", value: 69 },
                { name: "\u6e56\u5317", value: 63 },
                { name: "\u5317\u4eac", value: 58 },
                { name: "\u4e0a\u6d77", value: 55 },
                { name: "\u798f\u5efa", value: 49 },
                { name: "\u6cb3\u5357", value: 45 },
            ],
            points: [
                {
                    name: "\u5317\u4eac",
                    value: 82,
                    category: "\u67a2\u7ebd",
                    color: "#46eeff",
                    size: 18,
                },
                {
                    name: "\u4e0a\u6d77",
                    value: 76,
                    category: "\u95e8\u6237",
                    color: "#7bfecb",
                    size: 16,
                },
                {
                    name: "\u5e7f\u4e1c",
                    value: 91,
                    category: "\u4ea4\u6613",
                    color: "#ffd66b",
                    size: 18,
                },
                {
                    name: "\u56db\u5ddd",
                    value: 63,
                    category: "\u4e2d\u8f6c",
                    color: "#6d8bff",
                    size: 15,
                },
            ],
            links: [
                {
                    from: "\u5317\u4eac",
                    to: "\u4e0a\u6d77",
                    value: 128,
                    color: "rgba(70, 238, 255, 0.75)",
                },
                {
                    from: "\u5e7f\u4e1c",
                    to: "\u56db\u5ddd",
                    value: 96,
                    color: "rgba(123, 254, 203, 0.7)",
                },
                {
                    from: "\u6e56\u5317",
                    to: "\u6d59\u6c5f",
                    value: 74,
                    color: "rgba(255, 214, 107, 0.72)",
                },
            ],
        }),
    },
    rankingList: {
        label: "排行列表",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "rankPulse", label: "排行波动" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "区域排名",
            unit: "分",
            accent: "#46eeff",
            items: [
                { name: "浦东新区", value: 98 },
                { name: "黄浦区", value: 92 },
                { name: "徐汇区", value: 88 },
                { name: "长宁区", value: 81 },
                { name: "静安区", value: 76 },
            ],
        }),
    },
    image: {
        label: "图片",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            src: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
            alt: "智慧园区示意图",
            caption: "园区运营总览",
            objectFit: "cover",
            showCaption: true,
        }),
    },
    video: {
        label: "视频",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
            poster: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80",
            title: "园区宣传视频",
            objectFit: "cover",
            autoplay: true,
            loop: true,
            muted: true,
            controls: true,
        }),
    },
    iframe: {
        label: "网页嵌入",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            src: "https://www.openstreetmap.org/export/embed.html?bbox=121.441%2C31.205%2C121.503%2C31.255&layer=mapnik",
            title: "园区地图总览",
            showToolbar: true,
            allowFullscreen: true,
            sandbox: "",
        }),
    },
    clock: {
        label: "时钟",
        generators: [
            { value: "clockTick", label: "实时时钟" },
            { value: "static", label: "静态数据" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "北京时间",
            timeZone: "Asia/Shanghai",
            locale: "zh-CN",
            zoneLabel: "",
            showSeconds: true,
            showDate: true,
            showWeekday: true,
            use24Hour: true,
            color: "#ecf7ff",
            accent: "#46eeff",
            dateColor: "rgba(235, 247, 255, 0.72)",
            timeText: "",
            dateText: "",
        }),
    },
    noticeTicker: {
        label: "公告跑马灯",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "tickerPulse", label: "公告轮播" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "实时播报",
            tag: "NOTICE",
            items: [
                "北区停车场余位低于 15%，建议引导车辆分流",
                "园区主链路抖动已恢复，当前延迟回落至 18ms",
                "A 栋会议中心 10:30 将开始访客高峰预警",
            ],
            direction: "left",
            duration: 18,
            showDot: true,
            pauseOnHover: true,
            accent: "#46eeff",
        }),
    },
    tabPanel: {
        label: "Tabs 分区切换",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "tabPulse", label: "分区轮播" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "运行分区",
            activeIndex: 0,
            showTitle: true,
            accent: "#46eeff",
            secondaryColor: "rgba(235, 247, 255, 0.16)",
            items: [
                {
                    label: "园区总览",
                    value: "128",
                    unit: "项",
                    description:
                        "在线任务总体平稳，停车与能耗两个区域需要持续关注。",
                    meta: "综合态势",
                },
                {
                    label: "安防态势",
                    value: "18",
                    unit: "条",
                    description: "重点告警主要集中在北区出入口和会议中心周边。",
                    meta: "重点告警",
                },
                {
                    label: "设备运维",
                    value: "96",
                    unit: "%",
                    description:
                        "主设备在线率维持高位，建议继续跟进两台边缘节点。",
                    meta: "在线率",
                },
            ],
        }),
    },
    filterBar: {
        label: "联动筛选条",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "状态筛选",
            field: "status",
            activeValue: "",
            showTitle: true,
            allowClear: true,
            accent: "#46eeff",
            secondaryColor: "rgba(123, 254, 203, 0.16)",
            targetWidgetIds: [],
            options: [
                { label: "已完成", value: "done", count: 12 },
                { label: "进行中", value: "active", count: 5 },
                { label: "待处理", value: "pending", count: 9 },
                { label: "预警", value: "warning", count: 2 },
            ],
        }),
    },
    timelinePanel: {
        label: "时间轴",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "timelinePulse", label: "时间轴轮播" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "事件处理时间轴",
            subtitle: "Timeline Overview",
            activeIndex: 1,
            accent: "#46eeff",
            secondaryColor: "rgba(123, 254, 203, 0.16)",
            showPulse: true,
            showConnector: true,
            items: [
                {
                    time: "08:30",
                    title: "异常发现",
                    description:
                        "北区入口客流连续 5 分钟高于阈值，系统自动生成预警。",
                    tag: "告警触发",
                    status: "done",
                },
                {
                    time: "08:42",
                    title: "联动研判",
                    description:
                        "值班人员调取现场视频与历史波峰，确认属于短时集中入场。",
                    tag: "处理中",
                    status: "active",
                },
                {
                    time: "08:55",
                    title: "现场分流",
                    description:
                        "引导屏切换绕行提示，并通知安保执行双通道放行。",
                    tag: "待执行",
                    status: "pending",
                },
                {
                    time: "09:10",
                    title: "结果复盘",
                    description:
                        "预计 09:10 完成现场恢复，并同步更新今日峰值记录。",
                    tag: "待完成",
                    status: "pending",
                },
            ],
        }),
    },
    titleBar: {
        label: "标题条",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "园区安防态势",
            subtitle: "Security Overview",
            tag: "SECTION 01",
            align: "left",
            accent: "#46eeff",
            showLine: true,
            showGlow: true,
        }),
    },
    borderFrame: {
        label: "装饰边框",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "重点监控区",
            subtitle: "Support Zone",
            badge: "LIVE",
            accent: "#46eeff",
            secondaryColor: "#7bfecb",
            showHeader: true,
            showGrid: true,
            showGlow: true,
        }),
    },
    dataTable: {
        label: "数据表格",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "tablePulse", label: "表格轮播" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "实时告警列表",
            accent: "#46eeff",
            columns: [
                { key: "name", label: "事件" },
                { key: "level", label: "等级" },
                { key: "owner", label: "负责人" },
                { key: "time", label: "时间" },
            ],
            rows: [
                {
                    name: "北区客流异常",
                    level: "高",
                    owner: "张峰",
                    time: "09:42:18",
                },
                {
                    name: "园区网络波动",
                    level: "中",
                    owner: "李欣",
                    time: "09:39:07",
                },
                {
                    name: "停车场余位预警",
                    level: "低",
                    owner: "王宁",
                    time: "09:32:44",
                },
                {
                    name: "能耗峰值提醒",
                    level: "中",
                    owner: "陈曦",
                    time: "09:28:13",
                },
            ],
        }),
    },
    lineChart: {
        label: "折线图",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "linePulse", label: "趋势变化" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "近七日告警趋势",
            labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            values: [14, 28, 19, 33, 48, 30, 22],
            color: "#7bfecb",
            areaColor: "rgba(123, 254, 203, 0.18)",
            enableFilterLinkage: false,
            filterField: "name",
            activeCategory: "",
            targetWidgetIds: [],
        }),
    },
    gauge: {
        label: "仪表盘",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "gaugePulse", label: "百分比波动" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "设备在线率",
            value: 86,
            color: "#5affbd",
            trackColor: "rgba(255, 255, 255, 0.12)",
        }),
    },
    panel: {
        label: "面板",
        generators: [
            { value: "static", label: "静态数据" },
            { value: "panelDigest", label: "摘要轮播" },
            { value: "remote", label: "HTTP 接口" },
        ],
        createPayload: () => ({
            title: "业务分区",
            subtitle: "支持作为信息容器使用",
            content:
                "你可以把这类面板当作版心区块，搭配图表和指标卡片组成完整大屏。",
        }),
    },
};

const sourceTypeKeys = Object.keys(sourceSpecs);

export const dataSourceTypeOptions = sourceTypeKeys.map((value) => ({
    value,
    label: sourceSpecs[value].label,
}));

export function getDataSourceSpec(type) {
    return sourceSpecs[type] ?? sourceSpecs.text;
}

export function getGeneratorOptions(type) {
    return getDataSourceSpec(type).generators;
}

export function getDefaultDataSourcePayload(type) {
    return cloneDeep(getDataSourceSpec(type).createPayload());
}

export function getRemoteFieldMappingTemplate(type) {
    const templates = {
        text: {
            text: "text",
        },
        stat: {
            title: "title",
            value: "value",
            unit: "unit",
            trend: "trend",
            trendLabel: "trendLabel",
        },
        digitStat: {
            title: "title",
            value: "value",
            unit: "unit",
            tag: "tag",
            prefix: "prefix",
            suffix: "suffix",
            decimals: "decimals",
            groupSeparator: "groupSeparator",
            color: "color",
            accent: "accent",
            unitColor: "unitColor",
        },
        barChart: {
            title: "title",
            categories: "categories",
            values: "values",
            color: "color",
        },
        pieChart: {
            title: "title",
            categories: "categories",
            values: "values",
            colors: "colors",
        },
        heatmapChart: {
            title: "title",
            xLabels: "xLabels",
            yLabels: "yLabels",
            values: "values",
            lowColor: "lowColor",
            highColor: "highColor",
            showValues: "showValues",
        },
        chinaRegionMap: {
            title: "title",
            unit: "unit",
            lowColor: "lowColor",
            highColor: "highColor",
            accent: "accent",
            showLegend: "showLegend",
            items: "items",
        },
        rankingList: {
            title: "title",
            unit: "unit",
            accent: "accent",
            items: "items",
        },
        image: {
            src: "src",
            alt: "alt",
            caption: "caption",
            objectFit: "objectFit",
        },
        video: {
            src: "src",
            poster: "poster",
            title: "title",
            objectFit: "objectFit",
        },
        iframe: {
            src: "src",
            title: "title",
            showToolbar: "showToolbar",
            allowFullscreen: "allowFullscreen",
            sandbox: "sandbox",
        },
        clock: {
            title: "title",
            timeZone: "timeZone",
            locale: "locale",
            zoneLabel: "zoneLabel",
            showSeconds: "showSeconds",
            showDate: "showDate",
            showWeekday: "showWeekday",
            use24Hour: "use24Hour",
            color: "color",
            accent: "accent",
            dateColor: "dateColor",
            timeText: "timeText",
            dateText: "dateText",
        },
        noticeTicker: {
            title: "title",
            tag: "tag",
            items: "items",
            direction: "direction",
            duration: "duration",
            showDot: "showDot",
            pauseOnHover: "pauseOnHover",
            accent: "accent",
        },
        tabPanel: {
            title: "title",
            activeIndex: "activeIndex",
            showTitle: "showTitle",
            accent: "accent",
            secondaryColor: "secondaryColor",
            items: "items",
        },
        filterBar: {
            title: "title",
            field: "field",
            activeValue: "activeValue",
            showTitle: "showTitle",
            allowClear: "allowClear",
            accent: "accent",
            secondaryColor: "secondaryColor",
            targetWidgetIds: "targetWidgetIds",
            options: "options",
        },
        timelinePanel: {
            title: "title",
            subtitle: "subtitle",
            activeIndex: "activeIndex",
            accent: "accent",
            secondaryColor: "secondaryColor",
            showPulse: "showPulse",
            showConnector: "showConnector",
            items: "items",
        },
        titleBar: {
            title: "title",
            subtitle: "subtitle",
            tag: "tag",
            align: "align",
            accent: "accent",
            showLine: "showLine",
            showGlow: "showGlow",
        },
        borderFrame: {
            title: "title",
            subtitle: "subtitle",
            badge: "badge",
            accent: "accent",
            secondaryColor: "secondaryColor",
            showHeader: "showHeader",
            showGrid: "showGrid",
            showGlow: "showGlow",
        },
        dataTable: {
            title: "title",
            accent: "accent",
            columns: "columns",
            rows: "rows",
        },
        lineChart: {
            title: "title",
            labels: "labels",
            values: "values",
            color: "color",
            areaColor: "areaColor",
        },
        gauge: {
            title: "title",
            value: "value",
            color: "color",
        },
        panel: {
            title: "title",
            subtitle: "subtitle",
            content: "content",
        },
    };

    return JSON.stringify(templates[type] ?? templates.text, null, 2);
}

export function createDataSource(type, overrides = {}) {
    const safeType = sourceSpecs[type] ? type : "text";
    const generatorOptions = getGeneratorOptions(safeType);
    const fallbackGenerator = generatorOptions[0]?.value ?? "static";
    const generator = generatorOptions.some(
        (item) => item.value === overrides.generator,
    )
        ? overrides.generator
        : fallbackGenerator;
    const defaultRefreshInterval =
        safeType === "clock" &&
        generator === "clockTick" &&
        overrides.refreshInterval == null
            ? 1
            : 0;

    return {
        id: overrides.id ?? createId(),
        name: overrides.name ?? `${getDataSourceSpec(safeType).label}数据源`,
        type: safeType,
        generator,
        refreshInterval: Number.isFinite(Number(overrides.refreshInterval))
            ? Math.max(0, Number(overrides.refreshInterval))
            : defaultRefreshInterval,
        request: createDataSourceRequestConfig(overrides.request ?? {}),
        payload: {
            ...getDefaultDataSourcePayload(safeType),
            ...cloneDeep(overrides.payload ?? {}),
        },
    };
}

export function normalizeDataSource(rawSource, index = 0) {
    const type = sourceSpecs[rawSource?.type] ? rawSource.type : "text";

    return createDataSource(type, {
        id: rawSource?.id || `source-${index + 1}`,
        name:
            rawSource?.name ||
            `${getDataSourceSpec(type).label}数据源 ${index + 1}`,
        generator: rawSource?.generator,
        refreshInterval: rawSource?.refreshInterval,
        request: rawSource?.request,
        payload:
            rawSource?.payload &&
            typeof rawSource.payload === "object" &&
            !Array.isArray(rawSource.payload)
                ? rawSource.payload
                : {},
    });
}

function createStatPayload(basePayload) {
    const baseValue = Number(basePayload.value ?? 0);
    const nextValue = Math.max(
        0,
        Math.round(baseValue + randomBetween(-900, 1200)),
    );

    return {
        ...basePayload,
        value: nextValue,
        trend: round1(randomBetween(-9.8, 13.2)),
    };
}

function createBarPayload(basePayload) {
    const categories = Array.isArray(basePayload.categories)
        ? basePayload.categories.filter(Boolean)
        : [];
    const values = Array.isArray(basePayload.values) ? basePayload.values : [];

    return {
        ...basePayload,
        values: categories.map((_, index) => {
            const current = Number(values[index] ?? 0);
            const seed = current || 20;
            return Math.max(0, Math.round(seed + randomBetween(-12, 14)));
        }),
    };
}

function createLinePayload(basePayload) {
    const labels = Array.isArray(basePayload.labels)
        ? basePayload.labels.filter(Boolean)
        : [];
    const values = Array.isArray(basePayload.values) ? basePayload.values : [];

    return {
        ...basePayload,
        values: labels.map((_, index) => {
            const current = Number(values[index] ?? 0);
            const seed = current || 16 + index * 3;
            return Math.max(0, Math.round(seed + randomBetween(-10, 11)));
        }),
    };
}

function createHeatmapPayload(basePayload) {
    const yLabels = Array.isArray(basePayload.yLabels)
        ? basePayload.yLabels.filter(Boolean)
        : [];
    const xLabels = Array.isArray(basePayload.xLabels)
        ? basePayload.xLabels.filter(Boolean)
        : [];
    const rows = Array.isArray(basePayload.values) ? basePayload.values : [];

    return {
        ...basePayload,
        values: yLabels.map((_, rowIndex) =>
            xLabels.map((__, columnIndex) => {
                const currentRow = Array.isArray(rows[rowIndex])
                    ? rows[rowIndex]
                    : [];
                const current = Number(currentRow[columnIndex] ?? 0);
                const seed = current || 12 + rowIndex * 6 + columnIndex * 3;
                return Math.max(0, Math.round(seed + randomBetween(-8, 10)));
            }),
        ),
    };
}

function createChinaRegionMapPayload(basePayload) {
    const items = Array.isArray(basePayload.items) ? basePayload.items : [];
    const points = Array.isArray(basePayload.points) ? basePayload.points : [];
    const links = Array.isArray(basePayload.links) ? basePayload.links : [];

    return {
        ...basePayload,
        items: items
            .map((item, index) => {
                const seed = Number(item?.value ?? 18 + index * 4);

                return {
                    name: String(item?.name ?? "").trim(),
                    value: Math.max(
                        0,
                        Math.round(
                            (Number.isFinite(seed) ? seed : 18 + index * 4) +
                                randomBetween(-6, 9),
                        ),
                    ),
                };
            })
            .filter((item) => item.name)
            .sort((left, right) => right.value - left.value),
        points: points
            .map((item, index) => {
                const seed = Number(item?.value ?? 24 + index * 5);

                return {
                    ...item,
                    name: String(item?.name ?? "").trim(),
                    value: Math.max(
                        0,
                        Math.round(
                            (Number.isFinite(seed) ? seed : 24 + index * 5) +
                                randomBetween(-7, 10),
                        ),
                    ),
                };
            })
            .filter((item) => item.name),
        links: links
            .map((item, index) => {
                const seed = Number(item?.value ?? 36 + index * 8);

                return {
                    ...item,
                    from: String(item?.from ?? "").trim(),
                    to: String(item?.to ?? "").trim(),
                    value: Math.max(
                        0,
                        Math.round(
                            (Number.isFinite(seed) ? seed : 36 + index * 8) +
                                randomBetween(-9, 12),
                        ),
                    ),
                };
            })
            .filter((item) => item.from && item.to),
    };
}

function createPiePayload(basePayload) {
    const categories = Array.isArray(basePayload.categories)
        ? basePayload.categories.filter(Boolean)
        : [];
    const values = Array.isArray(basePayload.values) ? basePayload.values : [];

    return {
        ...basePayload,
        values: categories.map((_, index) => {
            const current = Number(values[index] ?? 0);
            const seed = current || 12 + index * 6;
            return Math.max(0, Math.round(seed + randomBetween(-8, 10)));
        }),
    };
}

function createRankingPayload(basePayload) {
    const items = Array.isArray(basePayload.items) ? basePayload.items : [];

    return {
        ...basePayload,
        items: items
            .map((item, index) => {
                const seed = Number(item?.value ?? 24 + index * 7);

                return {
                    name: String(item?.name ?? "").trim(),
                    value: Math.max(
                        0,
                        Math.round(
                            (Number.isFinite(seed) ? seed : 24 + index * 7) +
                                randomBetween(-8, 11),
                        ),
                    ),
                };
            })
            .filter((item) => item.name)
            .sort((left, right) => right.value - left.value),
    };
}

function createTablePayload(basePayload) {
    const columns = Array.isArray(basePayload.columns)
        ? basePayload.columns
        : [];
    const rows = Array.isArray(basePayload.rows) ? basePayload.rows : [];
    const levelOptions = ["高", "中", "低"];

    return {
        ...basePayload,
        rows: rows.map((row, index) => {
            const currentLevel = String(row?.level ?? "");
            const currentTime = String(row?.time ?? formatClock());
            return {
                ...row,
                level:
                    levelOptions[
                        (index +
                            Math.floor(randomBetween(0, levelOptions.length))) %
                            levelOptions.length
                    ] || currentLevel,
                time: index === 0 ? formatClock() : currentTime,
            };
        }),
        columns,
    };
}

function createGaugePayload(basePayload) {
    return {
        ...basePayload,
        value: Math.round(
            clamp(
                Number(basePayload.value ?? 0) + randomBetween(-8, 9),
                0,
                100,
            ),
        ),
    };
}

function createTextPayload(basePayload) {
    const baseText = String(basePayload.text || "城市运行智能指挥中心").split(
        " 路 ",
    )[0];

    return {
        ...basePayload,
        text: `${baseText} 路 ${formatClock()}`,
    };
}

function createNoticeTickerPayload(basePayload) {
    const items = Array.isArray(basePayload.items)
        ? basePayload.items
              .map((item) => String(item ?? "").trim())
              .filter(Boolean)
        : [];

    if (!items.length) {
        return cloneDeep(basePayload);
    }

    const [firstItem, ...restItems] = items;
    const headline = firstItem.replace(/\s·\s\d{2}:\d{2}:\d{2}$/, "");

    return {
        ...basePayload,
        items: [...restItems, `${headline} · ${formatClock()}`],
    };
}

function createTabPanelPayload(basePayload) {
    const items = Array.isArray(basePayload.items)
        ? basePayload.items.map((item) => {
              const nextItem =
                  item && typeof item === "object" && !Array.isArray(item)
                      ? cloneDeep(item)
                      : {};
              const numericValue = Number(nextItem.value);

              if (Number.isFinite(numericValue)) {
                  nextItem.value = String(
                      Math.max(
                          0,
                          Math.round(numericValue + randomBetween(-6, 8)),
                      ),
                  );
              }

              return nextItem;
          })
        : [];

    const baseIndex = Number(basePayload.activeIndex ?? 0);

    return {
        ...basePayload,
        items,
        activeIndex: items.length
            ? (Math.max(0, Math.trunc(baseIndex)) + 1) % items.length
            : 0,
    };
}

function normalizeTimelineStatus(value, fallback = "pending") {
    const status = String(value || "")
        .trim()
        .toLowerCase();

    if (["done", "active", "pending", "warning"].includes(status)) {
        return status;
    }

    return fallback;
}

function createTimelinePanelPayload(basePayload) {
    const items = Array.isArray(basePayload.items)
        ? basePayload.items.map((item, index) => ({
              time: String(item?.time ?? "").trim() || `${8 + index}:00`,
              title:
                  String(item?.title ?? `节点 ${index + 1}`).trim() ||
                  `节点 ${index + 1}`,
              description: String(item?.description ?? "").trim(),
              tag: String(item?.tag ?? "").trim(),
              status: normalizeTimelineStatus(item?.status),
          }))
        : [];
    const total = items.length;
    const baseIndex = Math.max(
        0,
        Math.trunc(Number(basePayload.activeIndex ?? 0)),
    );
    const nextIndex = total ? (baseIndex + 1) % total : 0;

    return {
        ...basePayload,
        subtitle: `最近刷新 ${formatClock()}`,
        activeIndex: nextIndex,
        items: items.map((item, index) => ({
            ...item,
            status:
                index < nextIndex
                    ? "done"
                    : index === nextIndex
                      ? "active"
                      : "pending",
        })),
    };
}

function createPanelPayload(basePayload) {
    const notes = [
        "今日高优先级事件保持可控，建议关注告警波动区间。",
        "当前数据已自动刷新，建议对重点区域进行二次钻取。",
        "本时段趋势整体平稳，可继续结合图表进行联动分析。",
    ];

    return {
        ...basePayload,
        subtitle: `最近同步 ${formatClock()}`,
        content: notes[Math.floor(Math.random() * notes.length)],
    };
}

function createClockPayload(basePayload) {
    const now = new Date();
    const timeText = formatClockText(now, {
        locale: basePayload.locale,
        timeZone: basePayload.timeZone,
        showSeconds: basePayload.showSeconds,
        use24Hour: basePayload.use24Hour,
    });
    const dateText =
        basePayload.showDate === false
            ? ""
            : formatDateText(now, {
                  locale: basePayload.locale,
                  timeZone: basePayload.timeZone,
                  showWeekday: basePayload.showWeekday,
              });

    return {
        ...basePayload,
        zoneLabel: String(
            basePayload.zoneLabel || basePayload.timeZone || "本地时间",
        ).trim(),
        timeText,
        dateText,
    };
}

function buildBasePayload(source) {
    return {
        ...getDefaultDataSourcePayload(source.type),
        ...cloneDeep(source.payload ?? {}),
    };
}

function buildTemplateContext(source, context = {}) {
    const now = new Date();
    const isoNow = context.isoNow ?? now.toISOString();

    return {
        timestamp: context.timestamp ?? now.getTime(),
        isoNow,
        today: context.today ?? isoNow.slice(0, 10),
        pageId: context.pageId ?? "",
        pageName: context.pageName ?? "",
        projectTitle: context.projectTitle ?? "",
        sourceId: context.sourceId ?? source.id ?? "",
        sourceName: context.sourceName ?? source.name ?? "",
        env: import.meta.env ?? {},
    };
}

function toPathSegments(path) {
    return String(path || "")
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .map((item) => item.trim())
        .filter(Boolean);
}

function getValueByPath(target, path) {
    const segments = toPathSegments(path);

    if (!segments.length) {
        return target;
    }

    return segments.reduce((current, key) => current?.[key], target);
}

function setValueByPath(target, path, value) {
    const segments = toPathSegments(path);

    if (!segments.length) {
        return;
    }

    let current = target;

    while (segments.length > 1) {
        const key = segments.shift();

        if (
            !current[key] ||
            typeof current[key] !== "object" ||
            Array.isArray(current[key])
        ) {
            current[key] = {};
        }

        current = current[key];
    }

    current[segments[0]] = value;
}

function formatTemplateValue(value) {
    if (value === undefined || value === null) {
        return "";
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    try {
        return JSON.stringify(value);
    } catch (error) {
        console.warn(error);
        return String(value);
    }
}

function interpolateTemplateString(input, context) {
    return String(input || "").replace(
        /\{\{\s*([^}]+?)\s*\}\}/g,
        (_, expression) => {
            const value = getValueByPath(context, expression);
            return formatTemplateValue(value);
        },
    );
}

function parseHeadersText(headersText) {
    if (!headersText?.trim()) {
        return {};
    }

    const parsed = JSON.parse(headersText);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("请求头必须是 JSON 对象");
    }

    return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [
            key,
            value == null ? "" : String(value),
        ]),
    );
}

function parseQueryText(queryText) {
    if (!queryText?.trim()) {
        return {};
    }

    const parsed = JSON.parse(queryText);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("请求参数必须是 JSON 对象");
    }

    return parsed;
}

function parseBodyValue(bodyText) {
    if (!bodyText?.trim()) {
        return undefined;
    }

    try {
        return JSON.parse(bodyText);
    } catch (error) {
        return bodyText;
    }
}

function appendQueryParams(urlValue, query) {
    const entries = Object.entries(query);

    if (!entries.length) {
        return urlValue;
    }

    const base = globalThis.location?.origin ?? "http://localhost";
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(urlValue);
    const isRootRelative = urlValue.startsWith("/");
    const url = new URL(urlValue, base);

    entries.forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((item) => {
                if (item !== undefined && item !== null && item !== "") {
                    url.searchParams.append(key, String(item));
                }
            });
            return;
        }

        url.searchParams.set(key, String(value));
    });

    if (hasProtocol) {
        return url.toString();
    }

    if (isRootRelative) {
        return `${url.pathname}${url.search}${url.hash}`;
    }

    return `${url.pathname.replace(/^\//, "")}${url.search}${url.hash}`;
}

function parseFieldMappingsText(fieldMappingsText) {
    if (!fieldMappingsText?.trim()) {
        return {};
    }

    const parsed = JSON.parse(fieldMappingsText);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("字段映射必须是 JSON 对象");
    }

    return parsed;
}

function encodeBase64(value) {
    if (typeof Buffer !== "undefined") {
        return Buffer.from(value, "utf8").toString("base64");
    }

    if (typeof globalThis.btoa === "function") {
        const bytes = new TextEncoder().encode(value);
        let binary = "";
        bytes.forEach((byte) => {
            binary += String.fromCharCode(byte);
        });
        return globalThis.btoa(binary);
    }

    throw new Error("当前环境不支持 Base64 编码");
}

function applyAuthHeaders(headers, request) {
    switch (request.authMode) {
        case "bearer":
            if (request.authToken.trim()) {
                headers.Authorization = `Bearer ${request.authToken.trim()}`;
            }
            break;
        case "basic":
            if (request.authUsername || request.authPassword) {
                headers.Authorization = `Basic ${encodeBase64(
                    `${request.authUsername}:${request.authPassword}`,
                )}`;
            }
            break;
        case "custom-header":
            if (request.authHeaderName.trim() && request.authToken.trim()) {
                headers[request.authHeaderName.trim()] =
                    request.authToken.trim();
            }
            break;
        default:
            break;
    }
}

function toPreviewValue(value) {
    if (typeof value === "string") {
        return value.length > 1800 ? `${value.slice(0, 1800)}...` : value;
    }

    if (value === undefined) {
        return "";
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        console.warn(error);
        return String(value);
    }
}

function maskSensitiveHeaderValue(headerName, value, request) {
    const normalizedName = String(headerName).toLowerCase();
    const customHeaderName = String(request.authHeaderName || "").toLowerCase();
    const shouldMask =
        normalizedName === "authorization" ||
        normalizedName === "cookie" ||
        normalizedName === customHeaderName ||
        normalizedName.includes("token") ||
        normalizedName.includes("secret") ||
        normalizedName.includes("key");

    if (!shouldMask) {
        return value;
    }

    if (typeof value !== "string") {
        return "***";
    }

    return value.length > 8
        ? `${value.slice(0, 4)}***${value.slice(-2)}`
        : "***";
}

function buildRequestPreview(url, method, headers, body, request) {
    return {
        url,
        method,
        headers: Object.fromEntries(
            Object.entries(headers).map(([key, value]) => [
                key,
                maskSensitiveHeaderValue(key, value, request),
            ]),
        ),
        body: toPreviewValue(body ?? ""),
    };
}

function resolveMappedFieldValue(responseData, mapping) {
    if (typeof mapping === "string") {
        return getValueByPath(responseData, mapping);
    }

    if (mapping && typeof mapping === "object" && !Array.isArray(mapping)) {
        let nextValue;

        if (typeof mapping.path === "string" && mapping.path.trim()) {
            nextValue = getValueByPath(responseData, mapping.path);
        } else if ("value" in mapping) {
            nextValue = cloneDeep(mapping.value);
        }

        if (nextValue === undefined && "default" in mapping) {
            nextValue = cloneDeep(mapping.default);
        }

        return nextValue;
    }

    return cloneDeep(mapping);
}

function applyFieldMappings(basePayload, responseData, fieldMappings) {
    const entries = Object.entries(fieldMappings);

    if (!entries.length) {
        return null;
    }

    const nextPayload = cloneDeep(basePayload);
    let appliedCount = 0;

    entries.forEach(([payloadPath, mapping]) => {
        const value = resolveMappedFieldValue(responseData, mapping);

        if (value === undefined) {
            return;
        }

        setValueByPath(nextPayload, payloadPath, cloneDeep(value));
        appliedCount += 1;
    });

    return appliedCount > 0 ? nextPayload : cloneDeep(basePayload);
}

function normalizeRemotePayload(type, extracted, basePayload) {
    if (extracted === undefined || extracted === null) {
        return cloneDeep(basePayload);
    }

    if (typeof extracted === "object" && !Array.isArray(extracted)) {
        return {
            ...basePayload,
            ...cloneDeep(extracted),
        };
    }

    if (Array.isArray(extracted)) {
        switch (type) {
            case "barChart":
            case "lineChart":
                return {
                    ...basePayload,
                    values: cloneDeep(extracted),
                };
            case "heatmapChart": {
                const objectItems = extracted.filter(
                    (item) =>
                        item &&
                        typeof item === "object" &&
                        !Array.isArray(item),
                );

                if (objectItems.length === extracted.length) {
                    const xLabels = Array.from(
                        new Set(
                            objectItems
                                .map((item) =>
                                    String(
                                        item.x ??
                                            item.xLabel ??
                                            item.column ??
                                            "",
                                    ).trim(),
                                )
                                .filter(Boolean),
                        ),
                    );
                    const yLabels = Array.from(
                        new Set(
                            objectItems
                                .map((item) =>
                                    String(
                                        item.y ?? item.yLabel ?? item.row ?? "",
                                    ).trim(),
                                )
                                .filter(Boolean),
                        ),
                    );

                    if (xLabels.length && yLabels.length) {
                        const values = yLabels.map((yLabel) =>
                            xLabels.map((xLabel) => {
                                const targetItem = objectItems.find(
                                    (item) =>
                                        String(
                                            item.x ??
                                                item.xLabel ??
                                                item.column ??
                                                "",
                                        ).trim() === xLabel &&
                                        String(
                                            item.y ??
                                                item.yLabel ??
                                                item.row ??
                                                "",
                                        ).trim() === yLabel,
                                );

                                return Number(
                                    targetItem?.value ??
                                        targetItem?.count ??
                                        targetItem?.total ??
                                        0,
                                );
                            }),
                        );

                        return {
                            ...basePayload,
                            xLabels,
                            yLabels,
                            values,
                        };
                    }
                }

                return {
                    ...basePayload,
                    values: extracted.map((row) =>
                        Array.isArray(row)
                            ? row.map((item) => Number(item ?? 0))
                            : [Number(row ?? 0)],
                    ),
                };
            }
            case "pieChart": {
                const objectItems = extracted.filter(
                    (item) =>
                        item &&
                        typeof item === "object" &&
                        !Array.isArray(item),
                );

                if (objectItems.length === extracted.length) {
                    const normalizedItems = objectItems.map((item, index) => ({
                        name: String(
                            item.name ??
                                item.label ??
                                item.title ??
                                `项目 ${index + 1}`,
                        ).trim(),
                        value: Number(
                            item.value ?? item.count ?? item.total ?? 0,
                        ),
                    }));

                    return {
                        ...basePayload,
                        categories: normalizedItems.map((item) => item.name),
                        values: normalizedItems.map((item) => item.value),
                    };
                }

                return {
                    ...basePayload,
                    values: cloneDeep(extracted),
                };
            }
            case "rankingList":
                return {
                    ...basePayload,
                    items: extracted.map((item, index) => {
                        if (
                            item &&
                            typeof item === "object" &&
                            !Array.isArray(item)
                        ) {
                            return cloneDeep(item);
                        }

                        const baseItems = Array.isArray(basePayload.items)
                            ? basePayload.items
                            : [];
                        return {
                            name: String(
                                baseItems[index]?.name ?? `项目 ${index + 1}`,
                            ),
                            value: Number(item ?? 0),
                        };
                    }),
                };
            case "chinaRegionMap":
                return {
                    ...basePayload,
                    items: extracted
                        .map((item, index) => {
                            if (
                                item &&
                                typeof item === "object" &&
                                !Array.isArray(item)
                            ) {
                                return {
                                    name: String(
                                        item.name ??
                                            item.label ??
                                            item.title ??
                                            `区域 ${index + 1}`,
                                    ).trim(),
                                    value: Number(
                                        item.value ??
                                            item.count ??
                                            item.total ??
                                            0,
                                    ),
                                };
                            }

                            const baseItems = Array.isArray(basePayload.items)
                                ? basePayload.items
                                : [];
                            return {
                                name: String(
                                    baseItems[index]?.name ??
                                        `区域 ${index + 1}`,
                                ),
                                value: Number(item ?? 0),
                            };
                        })
                        .filter((item) => item.name),
                };
            case "dataTable":
                return {
                    ...basePayload,
                    rows: extracted.map((item, index) => {
                        if (
                            item &&
                            typeof item === "object" &&
                            !Array.isArray(item)
                        ) {
                            return cloneDeep(item);
                        }

                        const columns = Array.isArray(basePayload.columns)
                            ? basePayload.columns
                            : [];
                        const cells = Array.isArray(item) ? item : [item];
                        return Object.fromEntries(
                            columns.map((column, columnIndex) => [
                                column.key,
                                String(cells[columnIndex] ?? `${index + 1}`),
                            ]),
                        );
                    }),
                };
            case "text":
                return {
                    ...basePayload,
                    text: extracted.join(" / "),
                };
            case "noticeTicker":
                return {
                    ...basePayload,
                    items: extracted
                        .map((item, index) => {
                            if (
                                item &&
                                typeof item === "object" &&
                                !Array.isArray(item)
                            ) {
                                return String(
                                    item.title ??
                                        item.text ??
                                        item.message ??
                                        item.name ??
                                        `播报 ${index + 1}`,
                                ).trim();
                            }

                            return String(item ?? "").trim();
                        })
                        .filter(Boolean),
                };
            case "tabPanel":
                return {
                    ...basePayload,
                    items: extracted.map((item, index) => {
                        if (
                            item &&
                            typeof item === "object" &&
                            !Array.isArray(item)
                        ) {
                            return {
                                label: String(
                                    item.label ??
                                        item.name ??
                                        item.title ??
                                        `标签 ${index + 1}`,
                                ).trim(),
                                value: String(
                                    item.value ??
                                        item.count ??
                                        item.total ??
                                        item.metric ??
                                        "",
                                ).trim(),
                                unit: String(item.unit ?? "").trim(),
                                description: String(
                                    item.description ??
                                        item.desc ??
                                        item.summary ??
                                        "",
                                ).trim(),
                                meta: String(
                                    item.meta ?? item.tag ?? item.status ?? "",
                                ).trim(),
                            };
                        }

                        return {
                            label: `标签 ${index + 1}`,
                            value: String(item ?? "").trim(),
                            unit: "",
                            description: "",
                            meta: "",
                        };
                    }),
                };
            case "filterBar":
                return {
                    ...basePayload,
                    options: extracted.map((item, index) => {
                        if (
                            item &&
                            typeof item === "object" &&
                            !Array.isArray(item)
                        ) {
                            const rawValue =
                                item.value ??
                                item.id ??
                                item.code ??
                                item.name ??
                                item.label ??
                                `${index + 1}`;
                            return {
                                label: String(
                                    item.label ??
                                        item.name ??
                                        item.title ??
                                        rawValue,
                                ).trim(),
                                value: String(rawValue).trim(),
                                count: Number(
                                    item.count ??
                                        item.total ??
                                        item.valueCount ??
                                        0,
                                ),
                            };
                        }

                        return {
                            label:
                                String(item ?? "").trim() ||
                                `选项 ${index + 1}`,
                            value: String(item ?? "").trim() || `${index + 1}`,
                            count: 0,
                        };
                    }),
                };
            case "timelinePanel":
                return {
                    ...basePayload,
                    items: extracted.map((item, index) => {
                        if (
                            item &&
                            typeof item === "object" &&
                            !Array.isArray(item)
                        ) {
                            return {
                                time: String(
                                    item.time ??
                                        item.timestamp ??
                                        item.date ??
                                        "",
                                ).trim(),
                                title: String(
                                    item.title ??
                                        item.name ??
                                        item.label ??
                                        `节点 ${index + 1}`,
                                ).trim(),
                                description: String(
                                    item.description ??
                                        item.desc ??
                                        item.summary ??
                                        "",
                                ).trim(),
                                tag: String(
                                    item.tag ??
                                        item.meta ??
                                        item.statusLabel ??
                                        "",
                                ).trim(),
                                status: normalizeTimelineStatus(
                                    item.status ?? item.state ?? item.level,
                                ),
                            };
                        }

                        return {
                            time: "",
                            title:
                                String(item ?? "").trim() ||
                                `节点 ${index + 1}`,
                            description: "",
                            tag: "",
                            status: "pending",
                        };
                    }),
                };
            case "panel":
                return {
                    ...basePayload,
                    content: extracted.join("\n"),
                };
            default:
                return cloneDeep(basePayload);
        }
    }

    switch (type) {
        case "text":
            return {
                ...basePayload,
                text: String(extracted),
            };
        case "image":
        case "video":
        case "iframe":
            return {
                ...basePayload,
                src: String(extracted),
            };
        case "clock":
            return {
                ...basePayload,
                timeText: String(extracted),
            };
        case "heatmapChart":
            return {
                ...basePayload,
                title: String(extracted),
            };
        case "chinaRegionMap":
            return {
                ...basePayload,
                title: String(extracted),
            };
        case "noticeTicker":
            return {
                ...basePayload,
                items: [String(extracted)],
            };
        case "tabPanel":
            return {
                ...basePayload,
                title: String(extracted),
            };
        case "filterBar":
            return {
                ...basePayload,
                title: String(extracted),
            };
        case "timelinePanel":
            return {
                ...basePayload,
                title: String(extracted),
            };
        case "titleBar":
        case "borderFrame":
            return {
                ...basePayload,
                title: String(extracted),
            };
        case "panel":
            return {
                ...basePayload,
                content: String(extracted),
            };
        case "stat":
        case "digitStat":
        case "gauge": {
            const nextValue = Number(extracted);

            return Number.isFinite(nextValue)
                ? {
                      ...basePayload,
                      value: nextValue,
                  }
                : cloneDeep(basePayload);
        }
        default:
            return cloneDeep(basePayload);
    }
}

async function fetchRemoteDataSourcePayload(source, basePayload, context = {}) {
    const request = createDataSourceRequestConfig(source.request ?? {});
    const templateContext = buildTemplateContext(source, context);
    const resolvedRequest = {
        ...request,
        url: appendQueryParams(
            interpolateTemplateString(request.url, templateContext),
            parseQueryText(
                interpolateTemplateString(request.queryText, templateContext),
            ),
        ),
        headersText: interpolateTemplateString(
            request.headersText,
            templateContext,
        ),
        bodyText: interpolateTemplateString(request.bodyText, templateContext),
        authToken: interpolateTemplateString(
            request.authToken,
            templateContext,
        ),
        authHeaderName: interpolateTemplateString(
            request.authHeaderName,
            templateContext,
        ),
        authUsername: interpolateTemplateString(
            request.authUsername,
            templateContext,
        ),
        authPassword: interpolateTemplateString(
            request.authPassword,
            templateContext,
        ),
    };

    if (!resolvedRequest.url.trim()) {
        throw new Error("请先配置接口地址");
    }

    const headers = parseHeadersText(resolvedRequest.headersText);
    applyAuthHeaders(headers, resolvedRequest);
    const bodyValue = parseBodyValue(resolvedRequest.bodyText);
    const method = resolvedRequest.method.toUpperCase();
    const controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;
    let timerId = 0;

    if (controller && resolvedRequest.timeout > 0) {
        timerId = globalThis.setTimeout(
            () => controller.abort(),
            resolvedRequest.timeout,
        );
    }

    try {
        const shouldSendBody = !["GET", "HEAD"].includes(method);
        const requestInit = {
            method,
            headers,
            credentials: resolvedRequest.withCredentials
                ? "include"
                : "same-origin",
            signal: controller?.signal,
        };

        if (shouldSendBody && bodyValue !== undefined) {
            if (
                typeof bodyValue === "object" &&
                bodyValue !== null &&
                !Array.isArray(bodyValue) &&
                !Object.keys(headers).some(
                    (key) => key.toLowerCase() === "content-type",
                )
            ) {
                headers["Content-Type"] = "application/json";
            }

            requestInit.body =
                typeof bodyValue === "string"
                    ? bodyValue
                    : JSON.stringify(bodyValue);
        }

        const response = await fetch(resolvedRequest.url, requestInit);

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status} ${response.statusText || ""}`.trim(),
            );
        }

        const contentType = response.headers.get("content-type") || "";
        const responseData = contentType.includes("application/json")
            ? await response.json()
            : await response.text();
        const extracted = resolvedRequest.dataPath
            ? getValueByPath(responseData, resolvedRequest.dataPath)
            : responseData;
        const fieldMappings = parseFieldMappingsText(
            resolvedRequest.fieldMappingsText,
        );
        const mappedPayload = applyFieldMappings(
            basePayload,
            extracted,
            fieldMappings,
        );
        const meta = {
            requestPreview: buildRequestPreview(
                resolvedRequest.url,
                method,
                headers,
                requestInit.body ?? "",
                resolvedRequest,
            ),
            responseStatus: response.status,
            responseStatusText: response.statusText || "",
            responsePreview: toPreviewValue(responseData),
            extractedPreview: toPreviewValue(extracted),
            mappedFieldCount: Object.keys(fieldMappings).length,
        };

        if (mappedPayload) {
            return {
                payload: mappedPayload,
                meta,
            };
        }

        return {
            payload: normalizeRemotePayload(
                source.type,
                extracted,
                basePayload,
            ),
            meta,
        };
    } finally {
        if (timerId) {
            globalThis.clearTimeout(timerId);
        }
    }
}

export function generateDataSourcePayload(source) {
    const basePayload = buildBasePayload(source);

    switch (source.generator) {
        case "statPulse":
            return createStatPayload(basePayload);
        case "digitPulse":
            return createStatPayload(basePayload);
        case "barPulse":
            return createBarPayload(basePayload);
        case "piePulse":
            return createPiePayload(basePayload);
        case "heatmapPulse":
            return createHeatmapPayload(basePayload);
        case "regionPulse":
            return createChinaRegionMapPayload(basePayload);
        case "rankPulse":
            return createRankingPayload(basePayload);
        case "tablePulse":
            return createTablePayload(basePayload);
        case "linePulse":
            return createLinePayload(basePayload);
        case "gaugePulse":
            return createGaugePayload(basePayload);
        case "headlineFlash":
            return createTextPayload(basePayload);
        case "tickerPulse":
            return createNoticeTickerPayload(basePayload);
        case "tabPulse":
            return createTabPanelPayload(basePayload);
        case "timelinePulse":
            return createTimelinePanelPayload(basePayload);
        case "panelDigest":
            return createPanelPayload(basePayload);
        case "clockTick":
            return createClockPayload(basePayload);
        case "remote":
        case "static":
        default:
            return basePayload;
    }
}

export async function resolveDataSourceRuntime(source, context = {}) {
    const basePayload = buildBasePayload(source);

    if (source.generator === "remote") {
        return fetchRemoteDataSourcePayload(source, basePayload, context);
    }

    return {
        payload: generateDataSourcePayload(source),
        meta: {
            requestPreview: null,
            responseStatus: null,
            responseStatusText: "",
            responsePreview: "",
            extractedPreview: "",
            mappedFieldCount: 0,
        },
    };
}

export async function resolveDataSourcePayload(source, context = {}) {
    const result = await resolveDataSourceRuntime(source, context);
    return result.payload;
}
