<script setup>
import { computed } from "vue";
import BaseEChart from "./BaseEChart.vue";

const props = defineProps({
    widget: {
        type: Object,
        required: true,
    },
});

const categories = computed(() => {
    const source = Array.isArray(props.widget.props.categories)
        ? props.widget.props.categories
        : [];
    return source.filter(Boolean);
});

const values = computed(() => {
    const source = Array.isArray(props.widget.props.values)
        ? props.widget.props.values
        : [];
    return categories.value.map((_, index) => Number(source[index] ?? 0));
});

const colors = computed(() => {
    const source = Array.isArray(props.widget.props.colors)
        ? props.widget.props.colors
        : [];
    return source.length
        ? source
        : ["#46eeff", "#7bfecb", "#ffd66b", "#6d8bff"];
});

const seriesData = computed(() => {
    const items = Array.isArray(props.widget.props.items)
        ? props.widget.props.items
        : [];

    if (items.length) {
        return items
            .map((item, index) => ({
                name: String(
                    item?.name ?? item?.label ?? `项目 ${index + 1}`,
                ).trim(),
                value: Number(item?.value ?? 0),
            }))
            .filter((item) => item.name);
    }

    return categories.value.map((name, index) => ({
        name,
        value: values.value[index] ?? 0,
    }));
});

const hasData = computed(() =>
    seriesData.value.some(
        (item) => Number.isFinite(item.value) && item.value > 0,
    ),
);

const option = computed(() => ({
    animationDuration: 650,
    color: colors.value,
    tooltip: {
        trigger: "item",
        backgroundColor: "rgba(4, 11, 22, 0.94)",
        borderColor: "rgba(72, 220, 255, 0.16)",
        textStyle: {
            color: "#eff8ff",
        },
    },
    legend: {
        bottom: 0,
        icon: "circle",
        itemWidth: 10,
        itemHeight: 10,
        data: seriesData.value.map((item) => item.name),
        textStyle: {
            color: "rgba(235, 247, 255, 0.72)",
            fontSize: 11,
        },
    },
    series: [
        {
            type: "pie",
            radius: ["42%", "70%"],
            center: ["50%", "42%"],
            avoidLabelOverlap: true,
            itemStyle: {
                borderColor: "rgba(4, 11, 22, 0.86)",
                borderWidth: 3,
            },
            label: {
                color: "#eff8ff",
                formatter: "{b}\n{d}%",
            },
            labelLine: {
                lineStyle: {
                    color: "rgba(235, 247, 255, 0.32)",
                },
            },
            emphasis: {
                scale: true,
                itemStyle: {
                    shadowBlur: 20,
                    shadowColor: "rgba(72, 220, 255, 0.24)",
                },
            },
            data: seriesData.value,
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
            <BaseEChart v-if="hasData" :option="option" />
            <div v-else class="widget-chart__empty">暂无饼图数据</div>
        </div>
    </div>
</template>
