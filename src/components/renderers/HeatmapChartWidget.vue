<script setup>
import { computed } from "vue";
import BaseEChart from "./BaseEChart.vue";

const props = defineProps({
    widget: {
        type: Object,
        required: true,
    },
});

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

const flattenedValues = computed(() =>
    matrix.value.flatMap((row, rowIndex) =>
        row.map((value, columnIndex) => [columnIndex, rowIndex, value]),
    ),
);

const maxValue = computed(() =>
    Math.max(0, ...flattenedValues.value.map((item) => Number(item[2] ?? 0))),
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
            const [columnIndex, rowIndex, value] = params.data;
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
</script>

<template>
    <div class="widget-chart">
        <div class="widget-chart__header">
            <h3>{{ widget.props.title }}</h3>
        </div>

        <div class="widget-chart__body">
            <BaseEChart :option="option" />
        </div>
    </div>
</template>
