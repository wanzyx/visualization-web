function normalizeText(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase();
}

function hasField(item, field) {
    return (
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        field in item
    );
}

function matchesFilterValue(actualValue, expectedValue) {
    const normalizedExpected = normalizeText(expectedValue);

    if (!normalizedExpected) {
        return true;
    }

    if (Array.isArray(actualValue)) {
        return actualValue.some(
            (item) => normalizeText(item) === normalizedExpected,
        );
    }

    if (actualValue === undefined || actualValue === null) {
        return false;
    }

    return normalizeText(actualValue) === normalizedExpected;
}

function toObjectList(source) {
    return Array.isArray(source)
        ? source.filter(
              (item) =>
                  item && typeof item === "object" && !Array.isArray(item),
          )
        : [];
}

function getApplicableFilters(collection, filters) {
    const list = toObjectList(collection);

    if (!list.length) {
        return [];
    }

    return filters.filter((filter) =>
        list.some((item) => hasField(item, filter.field)),
    );
}

function filterObjectCollection(collection, filters) {
    const list = toObjectList(collection);
    const applicableFilters = getApplicableFilters(list, filters);

    if (!applicableFilters.length) {
        return Array.isArray(collection) ? collection : [];
    }

    return list.filter((item) =>
        applicableFilters.every((filter) =>
            matchesFilterValue(item?.[filter.field], filter.value),
        ),
    );
}

function toStringList(source) {
    return Array.isArray(source)
        ? source.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [];
}

function toNumberList(source, length) {
    const list = Array.isArray(source) ? source : [];
    return Array.from({ length }, (_, index) => Number(list[index] ?? 0));
}

function buildCategoryRecords(labels, values) {
    const categories = toStringList(labels);
    const numbers = toNumberList(values, categories.length);

    return categories.map((label, index) => ({
        name: label,
        category: label,
        label,
        region: label,
        province: label,
        value: numbers[index],
    }));
}

function applyCategorySeriesFilters(labels, values, filters) {
    const records = buildCategoryRecords(labels, values);
    const applicable = getApplicableFilters(records, filters);

    if (!applicable.length) {
        return {
            labels: toStringList(labels),
            values: toNumberList(values, toStringList(labels).length),
            changed: false,
        };
    }

    const filtered = filterObjectCollection(records, filters);

    return {
        labels: filtered.map((item) => item.name),
        values: filtered.map((item) => Number(item.value ?? 0)),
        changed: true,
    };
}

function applyPieFilters(props, filters) {
    const items = toObjectList(props.items);

    if (items.length) {
        const normalizedItems = items.map((item, index) => {
            const name = String(
                item?.name ?? item?.label ?? item?.category ?? `项目 ${index + 1}`,
            ).trim();

            return {
                ...item,
                name,
                label: String(item?.label ?? name).trim(),
                category: String(item?.category ?? name).trim(),
                region: String(item?.region ?? item?.province ?? name).trim(),
                province: String(item?.province ?? item?.region ?? name).trim(),
                value: Number(item?.value ?? 0),
            };
        });
        const filteredItems = filterObjectCollection(normalizedItems, filters);
        const applicable = getApplicableFilters(normalizedItems, filters);

        if (!applicable.length) {
            return props;
        }

        return {
            ...props,
            items: filteredItems,
            categories: filteredItems.map((item) => item.name),
            values: filteredItems.map((item) => Number(item.value ?? 0)),
        };
    }

    const series = applyCategorySeriesFilters(
        props.categories,
        props.values,
        filters,
    );

    if (!series.changed) {
        return props;
    }

    return {
        ...props,
        categories: series.labels,
        values: series.values,
    };
}

function applyHeatmapFilters(props, filters) {
    const xLabels = toStringList(props.xLabels);
    const yLabels = toStringList(props.yLabels);
    const matrix = Array.isArray(props.values) ? props.values : [];

    if (!xLabels.length || !yLabels.length) {
        return props;
    }

    const cells = yLabels.flatMap((yLabel, rowIndex) => {
        const row = Array.isArray(matrix[rowIndex]) ? matrix[rowIndex] : [];
        return xLabels.map((xLabel, columnIndex) => ({
            name: xLabel,
            category: xLabel,
            label: xLabel,
            region: xLabel,
            province: xLabel,
            xLabel,
            yLabel,
            value: Number(row[columnIndex] ?? 0),
        }));
    });

    const applicable = getApplicableFilters(cells, filters);

    if (!applicable.length) {
        return props;
    }

    const filteredCells = filterObjectCollection(cells, filters);
    const nextXLabels = [
        ...new Set(filteredCells.map((item) => item.xLabel).filter(Boolean)),
    ];
    const nextYLabels = [
        ...new Set(filteredCells.map((item) => item.yLabel).filter(Boolean)),
    ];
    const cellMap = new Map(
        filteredCells.map((item) => [
            `${item.yLabel}::${item.xLabel}`,
            Number(item.value ?? 0),
        ]),
    );
    const nextValues = nextYLabels.map((yLabel) =>
        nextXLabels.map(
            (xLabel) => cellMap.get(`${yLabel}::${xLabel}`) ?? 0,
        ),
    );

    return {
        ...props,
        xLabels: nextXLabels,
        yLabels: nextYLabels,
        values: nextValues,
    };
}

export const FILTERABLE_COLLECTION_TYPES = [
    "rankingList",
    "chinaRegionMap",
    "timelinePanel",
    "dataTable",
];

export const FILTERABLE_CHART_TYPES = [
    "barChart",
    "lineChart",
    "pieChart",
    "heatmapChart",
];

export const FILTERABLE_WIDGET_TYPES = [
    ...FILTERABLE_COLLECTION_TYPES,
    ...FILTERABLE_CHART_TYPES,
];

export const FILTER_SOURCE_WIDGET_TYPES = [
    "filterBar",
    "chinaRegionMap",
    ...FILTERABLE_CHART_TYPES,
];

export function isFilterableWidgetType(type) {
    return FILTERABLE_WIDGET_TYPES.includes(type);
}

export function isFilterableChartType(type) {
    return FILTERABLE_CHART_TYPES.includes(type);
}

export function isFilterSourceWidgetType(type) {
    return FILTER_SOURCE_WIDGET_TYPES.includes(type);
}

export function getWidgetRuntimeFilters(
    widgetId,
    runtimeFilters,
    widgetType = "",
) {
    return Object.values(runtimeFilters ?? {}).filter((filter) => {
        if (!filter?.field || !String(filter.value ?? "").trim()) {
            return false;
        }

        // 来源组件永不筛自己，避免点选后把自己滤空
        if (filter.widgetId && filter.widgetId === widgetId) {
            return false;
        }

        const targetWidgetIds = Array.isArray(filter.targetWidgetIds)
            ? filter.targetWidgetIds
            : [];

        if (targetWidgetIds.length) {
            return targetWidgetIds.includes(widgetId);
        }

        // 未指定目标时，只广播到列表/表格/地图/时间轴；图表需显式勾选
        if (isFilterableChartType(widgetType)) {
            return false;
        }

        return true;
    });
}

export function applyWidgetRuntimeFilters(widget, runtimeFilters = []) {
    if (!widget || !runtimeFilters.length) {
        return widget?.props ?? {};
    }

    const props = widget.props ?? {};

    switch (widget.type) {
        case "rankingList":
        case "chinaRegionMap":
        case "timelinePanel":
            return {
                ...props,
                items: filterObjectCollection(props.items, runtimeFilters),
            };
        case "dataTable":
            return {
                ...props,
                rows: filterObjectCollection(props.rows, runtimeFilters),
            };
        case "barChart": {
            const series = applyCategorySeriesFilters(
                props.categories,
                props.values,
                runtimeFilters,
            );

            if (!series.changed) {
                return props;
            }

            return {
                ...props,
                categories: series.labels,
                values: series.values,
            };
        }
        case "lineChart": {
            const series = applyCategorySeriesFilters(
                props.labels,
                props.values,
                runtimeFilters,
            );

            if (!series.changed) {
                return props;
            }

            return {
                ...props,
                labels: series.labels,
                values: series.values,
            };
        }
        case "pieChart":
            return applyPieFilters(props, runtimeFilters);
        case "heatmapChart":
            return applyHeatmapFilters(props, runtimeFilters);
        default:
            return props;
    }
}

export function resolveFilterField(widget) {
    if (!widget) {
        return "";
    }

    if (widget.type === "filterBar") {
        return String(widget.props?.field ?? "").trim();
    }

    return String(widget.props?.filterField ?? "name").trim() || "name";
}

export function extractChartSelection(widgetType, params) {
    if (!params) {
        return { value: "", label: "" };
    }

    if (widgetType === "heatmapChart") {
        const data = Array.isArray(params.data) ? params.data : [];
        const xIndex = Number(data[0]);
        const yIndex = Number(data[1]);
        const xLabel = String(
            params.xLabel ??
                params.name ??
                (Number.isFinite(xIndex) ? `列 ${xIndex + 1}` : ""),
        ).trim();
        const yLabel = String(
            params.yLabel ??
                (Number.isFinite(yIndex) ? `行 ${yIndex + 1}` : ""),
        ).trim();
        const value = xLabel || yLabel;

        return {
            value,
            label: yLabel && xLabel ? `${yLabel} / ${xLabel}` : value,
            xLabel,
            yLabel,
        };
    }

    const value = String(params.name ?? params.value ?? "").trim();
    return {
        value,
        label: value,
    };
}
