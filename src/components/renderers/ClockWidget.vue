<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({
    widget: {
        type: Object,
        required: true,
    },
});

const now = ref(Date.now());
let timerId = 0;

const accentColor = computed(
    () => String(props.widget.props.accent || "#46eeff").trim() || "#46eeff",
);
const timeColor = computed(
    () => String(props.widget.props.color || "#ecf7ff").trim() || "#ecf7ff",
);
const dateColor = computed(
    () =>
        String(
            props.widget.props.dateColor || "rgba(235, 247, 255, 0.72)",
        ).trim() || "rgba(235, 247, 255, 0.72)",
);
const title = computed(() => String(props.widget.props.title || "").trim());
const locale = computed(
    () => String(props.widget.props.locale || "zh-CN").trim() || "zh-CN",
);
const rawTimeZone = computed(() =>
    String(props.widget.props.timeZone || "").trim(),
);
const zoneLabel = computed(
    () =>
        String(props.widget.props.zoneLabel || "").trim() ||
        rawTimeZone.value ||
        "本地时间",
);

const resolvedTimeZone = computed(() => {
    if (!rawTimeZone.value) {
        return "";
    }

    try {
        new Intl.DateTimeFormat("en-US", {
            timeZone: rawTimeZone.value,
        }).format(now.value);
        return rawTimeZone.value;
    } catch (error) {
        console.warn(error);
        return "";
    }
});

const timeText = computed(() => {
    const manualText = String(props.widget.props.timeText || "").trim();

    if (manualText) {
        return manualText;
    }

    try {
        return new Intl.DateTimeFormat(locale.value, {
            hour: "2-digit",
            minute: "2-digit",
            second:
                props.widget.props.showSeconds !== false
                    ? "2-digit"
                    : undefined,
            hour12: props.widget.props.use24Hour === false,
            timeZone: resolvedTimeZone.value || undefined,
        }).format(now.value);
    } catch (error) {
        console.warn(error);
        return new Intl.DateTimeFormat("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second:
                props.widget.props.showSeconds !== false
                    ? "2-digit"
                    : undefined,
            hour12: false,
        }).format(now.value);
    }
});

const dateText = computed(() => {
    const manualText = String(props.widget.props.dateText || "").trim();

    if (manualText) {
        return manualText;
    }

    if (props.widget.props.showDate === false) {
        return "";
    }

    try {
        return new Intl.DateTimeFormat(locale.value, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            weekday:
                props.widget.props.showWeekday !== false ? "long" : undefined,
            timeZone: resolvedTimeZone.value || undefined,
        }).format(now.value);
    } catch (error) {
        console.warn(error);
        return new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            weekday:
                props.widget.props.showWeekday !== false ? "long" : undefined,
        }).format(now.value);
    }
});

onMounted(() => {
    timerId = window.setInterval(() => {
        now.value = Date.now();
    }, 1000);
});

onBeforeUnmount(() => {
    if (timerId) {
        window.clearInterval(timerId);
        timerId = 0;
    }
});
</script>

<template>
    <div class="widget-clock">
        <div class="widget-clock__head">
            <p v-if="title" class="widget-clock__title">{{ title }}</p>
            <span class="widget-clock__zone" :style="{ color: accentColor }">{{
                zoneLabel
            }}</span>
        </div>

        <div
            class="widget-clock__time"
            :style="{
                color: timeColor,
                textShadow: `0 0 28px ${accentColor}33`,
            }"
        >
            {{ timeText }}
        </div>

        <div
            v-if="dateText"
            class="widget-clock__date"
            :style="{ color: dateColor }"
        >
            <span
                class="widget-clock__date-dot"
                :style="{ background: accentColor }"
            />
            <span>{{ dateText }}</span>
        </div>
    </div>
</template>
