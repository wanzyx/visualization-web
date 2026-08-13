<script setup>
import { computed } from "vue";
import BaseEChart from "./BaseEChart.vue";

const props = defineProps({
    widget: {
        type: Object,
        required: true,
    },
    previewMode: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["widget-command"]);

const xLabels = computed(() => {
    const source = Array.isArray(props.widget.props.xLabels)
        ? props.widget.props.xLabels
        : [];
    return source.filter(Boolean);
});

const yLabels = computed(() => {
    const source = Array.isArray(props.widget.props.yLabels)
        ? props.widget.props.yLabels
        : [];
    return source.filter(Boolean);
});

const matrix = computed(() => {
    const source = Array.isArray(props.widget.props.values)
        ? props.widget.props.values
        : [];

    return yLabels.value.map((_, rowIndex) =>
        xLabels.value.map((__, columnIndex) => {
            const row = Array.isArray(source[rowIndex]) ? source[rowIndex] : [];
            return Number(row[columnIndex] ?? 0);
        }),
    );
});

const activeCategory = computed(() =>
    String(props.widget.props.activeCategory ?? "").trim(),
);

const flattenedValues = computed(() =>
    matrix.value.flatMap((row, rowIndex) =>
        row.map((value, columnIndex) => {
            const xLabel = String(xLabels.value[columnIndex] ?? "");
            const isActive =
                activeCategory.value && activeCategory.value === xLabel;

            return {
                value: [columnIndex, rowIndex, value],
                itemStyle: isActive
                    ? {
                          borderColor: "#eff8ff",
                          borderWidth: 1,
                          shadowBlur: 14,
                          shadowColor: "rgba(72, 220, 255, 0.35)",
                      }
                    : activeCategory.value
                      ? { opacity: 0.28 }
                      : undefined,
            };
        }),
    ),
);

const maxValue = computed(() =>
    Math.max(
        0,
        ...flattenedValues.value.map((item) => Number(item.value?.[2] ?? 0)),
    ),
);

const option = computed(() => ({
    animationDuration: 650,
    tooltip: {
        position: "top",
        backgroundColor: "rgba(4, 11, 22, 0.94)",
        borderColor: "rgba(72, 220, 255, 0.16)",
        textStyle: {
            color: "#eff8ff",
        },
        formatter: (params) => {
            const data = Array.isArray(params.data) ? params.data : params.data?.value;
            const [columnIndex, rowIndex, value] = Array.isArray(data)
                ? data
                : [];
            const columnLabel =
                xLabels.value[columnIndex] ?? `列 ${columnIndex + 1}`;
            const rowLabel = yLabels.value[rowIndex] ?? `行 ${rowIndex + 1}`;

            return `${rowLabel}<br/>${columnLabel}: ${value}`;
        },
    },
    grid: {
        top: 18,
        right: 8,
        bottom: 22,
        left: 8,
        containLabel: true,
    },
    xAxis: {
        type: "category",
        data: xLabels.value,
        splitArea: {
            show: true,
            areaStyle: {
                color: [
                    "rgba(255, 255, 255, 0.015)",
                    "rgba(255, 255, 255, 0.03)",
                ],
            },
        },
        axisTick: {
            show: false,
        },
        axisLine: {
            lineStyle: {
                color: "rgba(255, 255, 255, 0.08)",
            },
        },
        axisLabel: {
            color: "rgba(235, 247, 255, 0.68)",
            fontSize: 11,
        },
    },
    yAxis: {
        type: "category",
        data: yLabels.value,
        splitArea: {
            show: true,
            areaStyle: {
                color: [
                    "rgba(255, 255, 255, 0.015)",
                    "rgba(255, 255, 255, 0.03)",
                ],
            },
        },
        axisTick: {
            show: false,
        },
        axisLine: {
            lineStyle: {
                color: "rgba(255, 255, 255, 0.08)",
            },
        },
        axisLabel: {
            color: "rgba(235, 247, 255, 0.68)",
            fontSize: 11,
        },
    },
    visualMap: {
        min: 0,
        max: Math.max(10, maxValue.value),
        show: false,
        calculable: false,
        inRange: {
            color: [props.widget.props.lowColor, props.widget.props.highColor],
        },
    },
    series: [
        {
            type: "heatmap",
            data: flattenedValues.value,
            label: {
                show: props.widget.props.showValues !== false,
                color: "#eff8ff",
                fontSize: 10,
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 18,
                    shadowColor: "rgba(72, 220, 255, 0.24)",
                },
            },
        },
    ],
}));

function handleChartClick(params) {
    if (!props.previewMode || props.widget.props.enableFilterLinkage === false) {
        return;
    }

    const raw = Array.isArray(params?.data)
        ? params.data
        : Array.isArray(params?.data?.value)
          ? params.data.value
          : [];
    const columnIndex = Number(raw[0]);
    const nextValue = String(
        xLabels.value[columnIndex] ?? params?.name ?? "",
    ).trim();

    if (!nextValue) {
        return;
    }

    const cleared = activeCategory.value === nextValue;
    emit("widget-command", {
        command: "select-category",
        value: cleared ? "" : nextValue,
        label: cleared ? "" : nextValue,
    });
}
</script>

<template>
    <div class="widget-chart">
        <div class="widget-chart__header">
            <h3>{{ widget.props.title }}</h3>
        </div>

        <div class="widget-chart__body">
            <BaseEChart :option="option" @chart-click="handleChartClick" />
        </div>
    </div>
</template>
