<script setup>
import { computed } from "vue";

const props = defineProps({
    widget: {
        type: Object,
        required: true,
    },
});

const trendText = computed(() => {
    const trend = Number(props.widget.props.trend ?? 0);
    const symbol = trend >= 0 ? "+" : "";
    return `${symbol}${trend}%`;
});

const trendClass = computed(() =>
    Number(props.widget.props.trend ?? 0) >= 0 ? "is-positive" : "is-negative",
);
</script>

<template>
    <div class="widget-stat">
        <p class="widget-stat__title">{{ widget.props.title }}</p>
        <div class="widget-stat__value-row">
            <strong :style="{ color: widget.props.color }">{{
                widget.props.value
            }}</strong>
            <span>{{ widget.props.unit }}</span>
        </div>
        <div class="widget-stat__meta">
            <span>{{ widget.props.trendLabel }}</span>
            <b :class="trendClass" :style="{ color: widget.props.accent }">{{
                trendText
            }}</b>
        </div>
    </div>
</template>
