export const interactionActionOptions = [
    { value: "none", label: "无动作" },
    { value: "highlight-widgets", label: "高亮组件" },
    { value: "refresh-sources", label: "刷新数据源" },
    { value: "switch-page", label: "切换页面" },
    { value: "show-widgets", label: "显示组件" },
    { value: "hide-widgets", label: "隐藏组件" },
    { value: "toggle-widgets-visibility", label: "切换显隐" },
    { value: "patch-widget-props", label: "更新组件属性" },
    { value: "set-runtime-variable", label: "设置运行时变量" },
];

export const alignOptions = [
    { value: "left", label: "left" },
    { value: "center", label: "center" },
    { value: "right", label: "right" },
];

export const mediaFitOptions = [
    { value: "cover", label: "cover" },
    { value: "contain", label: "contain" },
    { value: "fill", label: "fill" },
    { value: "scale-down", label: "scale-down" },
];

export const tickerDirectionOptions = [
    { value: "left", label: "left" },
    { value: "right", label: "right" },
];

export const baseFields = [
    {
        path: "name",
        label: "名称",
        type: "text",
        placeholder: "请输入组件名称",
    },
    {
        path: "x",
        label: "X",
        type: "number",
        span: "half",
    },
    {
        path: "y",
        label: "Y",
        type: "number",
        span: "half",
    },
    {
        path: "w",
        label: "宽度",
        type: "number",
        min: 120,
        span: "half",
    },
    {
        path: "h",
        label: "高度",
        type: "number",
        min: 80,
        span: "half",
    },
    {
        path: "zIndex",
        label: "层级",
        type: "number",
        span: "half",
    },
    {
        path: "style.rotate",
        label: "旋转",
        type: "number",
        span: "half",
    },
    {
        path: "hidden",
        label: "隐藏当前组件",
        type: "checkbox",
    },
    {
        path: "locked",
        label: "锁定当前组件",
        type: "checkbox",
    },
];

export const styleFields = [
    {
        path: "style.background",
        label: "背景",
        type: "text",
        placeholder: "支持颜色或渐变",
    },
    {
        path: "style.borderColor",
        label: "边框颜色",
        type: "text",
    },
    {
        path: "style.radius",
        label: "圆角",
        type: "number",
        min: 0,
        span: "half",
    },
    {
        path: "style.padding",
        label: "内边距",
        type: "number",
        min: 0,
        span: "half",
    },
    {
        path: "style.opacity",
        label: "透明度",
        type: "number",
        min: 0,
        max: 1,
        step: 0.1,
        span: "half",
    },
];

export function createPageFields({ page, project }) {
    return [
        {
            key: "page-name",
            label: "页面名称",
            type: "text",
            get: () => page?.name ?? "",
            set: (value) => {
                if (page) {
                    page.name = value;
                }
            },
        },
        {
            key: "page-title",
            label: "画布标题",
            type: "text",
            get: () => project.meta.title,
            set: (value) => {
                project.meta.title = value;
            },
        },
        {
            key: "page-width",
            label: "宽度",
            type: "number",
            min: 1280,
            span: "half",
            get: () => project.meta.screenWidth,
            set: (value) => {
                project.meta.screenWidth = value;
            },
        },
        {
            key: "page-height",
            label: "高度",
            type: "number",
            min: 720,
            span: "half",
            get: () => project.meta.screenHeight,
            set: (value) => {
                project.meta.screenHeight = value;
            },
        },
        {
            key: "page-background",
            label: "背景",
            type: "textarea",
            rows: 4,
            get: () => project.meta.background,
            set: (value) => {
                project.meta.background = value;
            },
        },
        {
            key: "page-grid-color",
            label: "网格颜色",
            type: "text",
            get: () => project.meta.gridColor,
            set: (value) => {
                project.meta.gridColor = value;
            },
        },
        {
            key: "page-grid-visible",
            label: "显示网格辅助线",
            type: "checkbox",
            get: () => project.meta.showGrid,
            set: (value) => {
                project.meta.showGrid = value;
            },
        },
        {
            key: "page-ruler-visible",
            label: "显示标尺",
            type: "checkbox",
            get: () => project.meta.showRulers,
            set: (value) => {
                project.meta.showRulers = value;
            },
        },
        {
            key: "page-guide-visible",
            label: "启用参考线",
            type: "checkbox",
            get: () => project.meta.showGuides,
            set: (value) => {
                project.meta.showGuides = value;
            },
        },
        {
            key: "page-guide-color",
            label: "参考线颜色",
            type: "text",
            get: () => project.meta.guideColor,
            set: (value) => {
                project.meta.guideColor = value;
            },
        },
    ];
}

export function createWidgetFields({
    widget,
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
}) {
    if (!widget) {
        return [];
    }

    switch (widget.type) {
        case "text":
            return [
                {
                    path: "props.text",
                    label: "内容",
                    type: "textarea",
                    rows: 4,
                },
                {
                    path: "props.fontSize",
                    label: "字号",
                    type: "number",
                    min: 12,
                    span: "half",
                },
                {
                    path: "props.fontWeight",
                    label: "字重",
                    type: "number",
                    min: 300,
                    max: 900,
                    step: 100,
                    span: "half",
                },
                {
                    path: "props.letterSpacing",
                    label: "字距",
                    type: "number",
                    min: 0,
                    span: "half",
                },
                {
                    path: "props.align",
                    label: "对齐",
                    type: "select",
                    options: alignOptions,
                    span: "half",
                },
                { path: "props.color", label: "颜色", type: "text" },
            ];

        case "stat":
            return [
                { path: "props.title", label: "标题", type: "text" },
                {
                    path: "props.value",
                    label: "数值",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.unit",
                    label: "单位",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.trend",
                    label: "趋势",
                    type: "number",
                    step: 0.1,
                    span: "half",
                },
                {
                    path: "props.trendLabel",
                    label: "趋势说明",
                    type: "text",
                    span: "half",
                },
                { path: "props.color", label: "主色", type: "text" },
                { path: "props.accent", label: "强调色", type: "text" },
            ];

        case "digitStat":
            return [
                { path: "props.title", label: "标题", type: "text" },
                {
                    path: "props.value",
                    label: "数值",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.unit",
                    label: "单位",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.tag",
                    label: "标签",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.decimals",
                    label: "小数位",
                    type: "number",
                    min: 0,
                    max: 4,
                    span: "half",
                },
                {
                    path: "props.prefix",
                    label: "前缀",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.suffix",
                    label: "后缀",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.groupSeparator",
                    label: "千分位分隔",
                    type: "checkbox",
                },
                { path: "props.color", label: "数字颜色", type: "text" },
                { path: "props.accent", label: "强调色", type: "text" },
                { path: "props.unitColor", label: "单位颜色", type: "text" },
            ];

        case "barChart":
            return [
                { path: "props.title", label: "标题", type: "text" },
                {
                    key: "bar-categories",
                    label: "分类（每行一个）",
                    type: "textarea",
                    rows: 5,
                    get: () => barCategories.value,
                    set: (value) => {
                        barCategories.value = value;
                    },
                },
                {
                    key: "bar-values",
                    label: "数值（逗号分隔）",
                    type: "textarea",
                    rows: 3,
                    get: () => barValues.value,
                    set: (value) => {
                        barValues.value = value;
                    },
                },
                { path: "props.color", label: "柱体颜色", type: "text" },
                {
                    path: "props.enableFilterLinkage",
                    label: "点击写入筛选",
                    type: "checkbox",
                },
                {
                    path: "props.filterField",
                    label: "联动筛选字段",
                    type: "text",
                },
            ];

        case "pieChart":
            return [
                { path: "props.title", label: "标题", type: "text" },
                {
                    key: "pie-categories",
                    label: "分类（每行一个）",
                    type: "textarea",
                    rows: 5,
                    get: () => barCategories.value,
                    set: (value) => {
                        barCategories.value = value;
                    },
                },
                {
                    key: "pie-values",
                    label: "数值（逗号分隔）",
                    type: "textarea",
                    rows: 3,
                    get: () => barValues.value,
                    set: (value) => {
                        barValues.value = value;
                    },
                },
                {
                    path: "props.colors",
                    label: "颜色数组 JSON",
                    type: "textarea",
                    rows: 3,
                },
                {
                    path: "props.enableFilterLinkage",
                    label: "点击写入筛选",
                    type: "checkbox",
                },
                {
                    path: "props.filterField",
                    label: "联动筛选字段",
                    type: "text",
                },
            ];

        case "lineChart":
            return [
                { path: "props.title", label: "标题", type: "text" },
                {
                    key: "line-labels",
                    label: "标签（每行一个）",
                    type: "textarea",
                    rows: 5,
                    get: () => lineLabels.value,
                    set: (value) => {
                        lineLabels.value = value;
                    },
                },
                {
                    key: "line-values",
                    label: "数值（逗号分隔）",
                    type: "textarea",
                    rows: 3,
                    get: () => lineValues.value,
                    set: (value) => {
                        lineValues.value = value;
                    },
                },
                {
                    path: "props.color",
                    label: "线条颜色",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.areaColor",
                    label: "面积颜色",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.enableFilterLinkage",
                    label: "点击写入筛选",
                    type: "checkbox",
                },
                {
                    path: "props.filterField",
                    label: "联动筛选字段",
                    type: "text",
                },
            ];

        case "heatmapChart":
            return [
                { path: "props.title", label: "标题", type: "text" },
                {
                    key: "heatmap-x-labels",
                    label: "横轴标签（每行一个）",
                    type: "textarea",
                    rows: 5,
                    get: () => heatmapXLabels.value,
                    set: (value) => {
                        heatmapXLabels.value = value;
                    },
                },
                {
                    key: "heatmap-y-labels",
                    label: "纵轴标签（每行一个）",
                    type: "textarea",
                    rows: 5,
                    get: () => heatmapYLabels.value,
                    set: (value) => {
                        heatmapYLabels.value = value;
                    },
                },
                {
                    key: "heatmap-matrix",
                    label: "热力矩阵（每行一组，逗号分隔）",
                    type: "textarea",
                    rows: 6,
                    get: () => heatmapMatrix.value,
                    set: (value) => {
                        heatmapMatrix.value = value;
                    },
                },
                {
                    path: "props.lowColor",
                    label: "低值颜色",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.highColor",
                    label: "高值颜色",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.showValues",
                    label: "显示数值",
                    type: "checkbox",
                },
                {
                    path: "props.enableFilterLinkage",
                    label: "点击写入筛选",
                    type: "checkbox",
                },
                {
                    path: "props.filterField",
                    label: "联动筛选字段",
                    type: "text",
                },
            ];

        case "chinaRegionMap":
            return [
                { path: "props.title", label: "\u6807\u9898", type: "text" },
                {
                    path: "props.unit",
                    label: "\u5355\u4f4d",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.accent",
                    label: "\u5f3a\u8c03\u8272",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.activeProvince",
                    label: "\u9ed8\u8ba4\u805a\u7126\u7701\u4efd",
                    type: "text",
                },
                {
                    path: "props.enableDrilldown",
                    label: "启用点击下钻",
                    type: "checkbox",
                },
                {
                    path: "props.enableFilterLinkage",
                    label: "下钻写入筛选",
                    type: "checkbox",
                },
                {
                    path: "props.filterField",
                    label: "联动筛选字段",
                    type: "text",
                },
                {
                    key: "china-map-items",
                    label: "\u7701\u4efd\u6570\u636e\uff08\u7701\u4efd|\u6570\u503c\uff0c\u6bcf\u884c\u4e00\u6761\uff09",
                    type: "textarea",
                    rows: 8,
                    get: () => chinaMapItems.value,
                    set: (value) => {
                        chinaMapItems.value = value;
                    },
                },
                {
                    key: "china-map-points",
                    label: "\u6563\u70b9\u6570\u636e\uff08\u7701\u4efd|\u6570\u503c|\u5206\u7c7b|\u989c\u8272|\u5927\u5c0f\uff0c\u6bcf\u884c\u4e00\u6761\uff09",
                    type: "textarea",
                    rows: 6,
                    get: () => chinaMapPoints.value,
                    set: (value) => {
                        chinaMapPoints.value = value;
                    },
                },
                {
                    key: "china-map-links",
                    label: "\u98de\u7ebf\u6570\u636e\uff08\u8d77\u70b9|\u7ec8\u70b9|\u6570\u503c|\u989c\u8272\uff0c\u6bcf\u884c\u4e00\u6761\uff09",
                    type: "textarea",
                    rows: 5,
                    get: () => chinaMapLinks.value,
                    set: (value) => {
                        chinaMapLinks.value = value;
                    },
                },
                {
                    path: "props.showScatter",
                    label: "\u663e\u793a\u6563\u70b9",
                    type: "checkbox",
                },
                {
                    path: "props.showFlightLines",
                    label: "\u663e\u793a\u98de\u7ebf",
                    type: "checkbox",
                },
                {
                    path: "props.lowColor",
                    label: "\u4f4e\u503c\u989c\u8272",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.highColor",
                    label: "\u9ad8\u503c\u989c\u8272",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.showLegend",
                    label: "\u663e\u793a\u56fe\u4f8b",
                    type: "checkbox",
                },
            ];

        case "rankingList":
            return [
                { path: "props.title", label: "标题", type: "text" },
                {
                    key: "ranking-names",
                    label: "榜单名称（每行一个）",
                    type: "textarea",
                    rows: 5,
                    get: () => rankingNames.value,
                    set: (value) => {
                        rankingNames.value = value;
                    },
                },
                {
                    key: "ranking-values",
                    label: "榜单数值（逗号分隔）",
                    type: "textarea",
                    rows: 3,
                    get: () => rankingValues.value,
                    set: (value) => {
                        rankingValues.value = value;
                    },
                },
                {
                    path: "props.unit",
                    label: "单位",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.accent",
                    label: "主色",
                    type: "text",
                    span: "half",
                },
            ];

        case "image":
            return [
                { path: "props.src", label: "图片地址", type: "text" },
                { path: "props.alt", label: "替代文本", type: "text" },
                { path: "props.caption", label: "图片说明", type: "text" },
                {
                    path: "props.objectFit",
                    label: "铺放方式",
                    type: "select",
                    options: mediaFitOptions,
                    span: "half",
                },
                {
                    path: "props.showCaption",
                    label: "显示说明",
                    type: "checkbox",
                },
            ];

        case "video":
            return [
                { path: "props.src", label: "视频地址", type: "text" },
                { path: "props.poster", label: "封面地址", type: "text" },
                { path: "props.title", label: "视频标题", type: "text" },
                {
                    path: "props.objectFit",
                    label: "铺放方式",
                    type: "select",
                    options: mediaFitOptions,
                    span: "half",
                },
                { path: "props.autoplay", label: "自动播放", type: "checkbox" },
                { path: "props.loop", label: "循环播放", type: "checkbox" },
                { path: "props.muted", label: "默认静音", type: "checkbox" },
                { path: "props.controls", label: "显示控件", type: "checkbox" },
            ];

        case "iframe":
            return [
                { path: "props.src", label: "网页地址", type: "text" },
                { path: "props.title", label: "标题", type: "text" },
                {
                    path: "props.showToolbar",
                    label: "显示顶部栏",
                    type: "checkbox",
                },
                {
                    path: "props.allowFullscreen",
                    label: "允许全屏",
                    type: "checkbox",
                },
                {
                    path: "props.sandbox",
                    label: "Sandbox 权限",
                    type: "text",
                    placeholder: "例如 allow-scripts allow-same-origin",
                },
            ];

        case "clock":
            return [
                { path: "props.title", label: "标题", type: "text" },
                {
                    path: "props.timeZone",
                    label: "时区",
                    type: "text",
                    placeholder: "例如 Asia/Shanghai",
                },
                {
                    path: "props.locale",
                    label: "区域语言",
                    type: "text",
                    placeholder: "例如 zh-CN / en-US",
                },
                {
                    path: "props.zoneLabel",
                    label: "时区标签",
                    type: "text",
                    placeholder: "留空则自动使用时区名",
                },
                {
                    path: "props.showSeconds",
                    label: "显示秒",
                    type: "checkbox",
                },
                { path: "props.showDate", label: "显示日期", type: "checkbox" },
                {
                    path: "props.showWeekday",
                    label: "显示星期",
                    type: "checkbox",
                },
                {
                    path: "props.use24Hour",
                    label: "24 小时制",
                    type: "checkbox",
                },
                { path: "props.color", label: "时间颜色", type: "text" },
                {
                    path: "props.accent",
                    label: "强调色",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.dateColor",
                    label: "日期颜色",
                    type: "text",
                    span: "half",
                },
            ];

        case "noticeTicker":
            return [
                { path: "props.title", label: "标题", type: "text" },
                {
                    path: "props.tag",
                    label: "标签",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.duration",
                    label: "滚动时长（秒）",
                    type: "number",
                    min: 6,
                    max: 60,
                    span: "half",
                },
                {
                    key: "notice-items",
                    label: "播报内容（每行一条）",
                    type: "textarea",
                    rows: 5,
                    get: () => noticeItems.value,
                    set: (value) => {
                        noticeItems.value = value;
                    },
                },
                {
                    path: "props.direction",
                    label: "滚动方向",
                    type: "select",
                    options: tickerDirectionOptions,
                    span: "half",
                },
                { path: "props.showDot", label: "显示圆点", type: "checkbox" },
                {
                    path: "props.pauseOnHover",
                    label: "悬停暂停",
                    type: "checkbox",
                },
                { path: "props.accent", label: "强调色", type: "text" },
            ];

        case "tabPanel":
            return [
                { path: "props.title", label: "标题", type: "text" },
                {
                    path: "props.activeIndex",
                    label: "默认激活项",
                    type: "number",
                    min: 0,
                    span: "half",
                },
                {
                    path: "props.showTitle",
                    label: "显示标题栏",
                    type: "checkbox",
                },
                {
                    key: "tab-items",
                    label: "Tabs 项（标签|数值|单位|说明|附注，每行一项）",
                    type: "textarea",
                    rows: 6,
                    get: () => tabItems.value,
                    set: (value) => {
                        tabItems.value = value;
                    },
                },
                {
                    path: "props.accent",
                    label: "主色",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.secondaryColor",
                    label: "辅助色",
                    type: "text",
                    span: "half",
                },
            ];

        case "filterBar":
            return [
                { path: "props.title", label: "标题", type: "text" },
                {
                    path: "props.field",
                    label: "筛选字段",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.activeValue",
                    label: "默认值",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.showTitle",
                    label: "显示标题",
                    type: "checkbox",
                },
                {
                    path: "props.allowClear",
                    label: "允许取消",
                    type: "checkbox",
                },
                {
                    key: "filter-options",
                    label: "筛选项（标签|值|数量，每行一条）",
                    type: "textarea",
                    rows: 6,
                    get: () => filterOptions.value,
                    set: (value) => {
                        filterOptions.value = value;
                    },
                },
                {
                    path: "props.accent",
                    label: "主色",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.secondaryColor",
                    label: "辅助色",
                    type: "text",
                    span: "half",
                },
            ];

        case "timelinePanel":
            return [
                { path: "props.title", label: "标题", type: "text" },
                { path: "props.subtitle", label: "副标题", type: "text" },
                {
                    path: "props.activeIndex",
                    label: "高亮节点",
                    type: "number",
                    min: 0,
                    span: "half",
                },
                {
                    path: "props.showPulse",
                    label: "显示脉冲",
                    type: "checkbox",
                },
                {
                    key: "timeline-items",
                    label: "时间轴节点（时间|标题|说明|标签|状态，每行一条）",
                    type: "textarea",
                    rows: 7,
                    get: () => timelineItems.value,
                    set: (value) => {
                        timelineItems.value = value;
                    },
                },
                {
                    path: "props.accent",
                    label: "主色",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.secondaryColor",
                    label: "辅助色",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.showConnector",
                    label: "显示连接线",
                    type: "checkbox",
                },
            ];

        case "titleBar":
            return [
                { path: "props.title", label: "标题", type: "text" },
                { path: "props.subtitle", label: "副标题", type: "text" },
                {
                    path: "props.tag",
                    label: "角标",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.align",
                    label: "对齐",
                    type: "select",
                    options: alignOptions,
                    span: "half",
                },
                { path: "props.accent", label: "强调色", type: "text" },
                {
                    path: "props.showLine",
                    label: "显示分割线",
                    type: "checkbox",
                },
                { path: "props.showGlow", label: "显示发光", type: "checkbox" },
            ];

        case "borderFrame":
            return [
                { path: "props.title", label: "标题", type: "text" },
                { path: "props.subtitle", label: "副标题", type: "text" },
                { path: "props.badge", label: "状态角标", type: "text" },
                {
                    path: "props.accent",
                    label: "主色",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.secondaryColor",
                    label: "辅助色",
                    type: "text",
                    span: "half",
                },
                {
                    path: "props.showHeader",
                    label: "显示头部",
                    type: "checkbox",
                },
                {
                    path: "props.showGrid",
                    label: "显示内部网格",
                    type: "checkbox",
                },
                {
                    path: "props.showGlow",
                    label: "显示边框光晕",
                    type: "checkbox",
                },
            ];

        case "dataTable":
            return [
                { path: "props.title", label: "标题", type: "text" },
                { path: "props.accent", label: "主色", type: "text" },
                {
                    key: "table-columns",
                    label: "列配置（key|标题，每行一列）",
                    type: "textarea",
                    rows: 5,
                    get: () => tableColumns.value,
                    set: (value) => {
                        tableColumns.value = value;
                    },
                },
                {
                    key: "table-rows",
                    label: "表格数据（按列顺序用 | 分隔）",
                    type: "textarea",
                    rows: 7,
                    get: () => tableRows.value,
                    set: (value) => {
                        tableRows.value = value;
                    },
                },
            ];

        case "gauge":
            return [
                { path: "props.title", label: "标题", type: "text" },
                {
                    path: "props.value",
                    label: "百分比",
                    type: "number",
                    min: 0,
                    max: 100,
                    span: "half",
                },
                {
                    path: "props.color",
                    label: "主色",
                    type: "text",
                    span: "half",
                },
                { path: "props.trackColor", label: "轨道色", type: "text" },
            ];

        case "panel":
        default:
            return [
                { path: "props.title", label: "标题", type: "text" },
                { path: "props.subtitle", label: "副标题", type: "text" },
                {
                    path: "props.content",
                    label: "正文",
                    type: "textarea",
                    rows: 4,
                },
            ];
    }
}

export function getWidgetSectionTitle(type) {
    switch (type) {
        case "text":
            return "文本内容";
        case "stat":
            return "指标卡片";
        case "digitStat":
            return "数字翻牌";
        case "barChart":
            return "柱状图数据";
        case "pieChart":
            return "饼图数据";
        case "lineChart":
            return "折线图数据";
        case "heatmapChart":
            return "区域热力图";
        case "chinaRegionMap":
            return "\u4e2d\u56fd\u5730\u56fe";
        case "rankingList":
            return "排行榜列表";
        case "image":
            return "图片内容";
        case "video":
            return "视频内容";
        case "iframe":
            return "网页嵌入";
        case "clock":
            return "时钟日期";
        case "noticeTicker":
            return "公告跑马灯";
        case "tabPanel":
            return "Tabs 分区切换";
        case "filterBar":
            return "联动筛选条";
        case "timelinePanel":
            return "时间轴";
        case "titleBar":
            return "分区标题栏";
        case "borderFrame":
            return "装饰边框";
        case "dataTable":
            return "数据表格";
        case "gauge":
            return "环形进度";
        case "panel":
        default:
            return "面板内容";
    }
}
