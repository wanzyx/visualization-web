<script setup>
import { computed } from "vue";

const props = defineProps({
    widget: {
        type: Object,
        required: true,
    },
});

function clampDuration(value) {
    const duration = Number(value);
    return Number.isFinite(duration) ? Math.min(Math.max(duration, 6), 60) : 18;
}

const items = computed(() =>
    (Array.isArray(props.widget.props.items) ? props.widget.props.items : [])
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
);

const shouldLoop = computed(() => items.value.length > 1);
const loopGroups = computed(() => (shouldLoop.value ? [0, 1] : [0]));
const directionClass = computed(() =>
    props.widget.props.direction === "right" ? "is-right" : "is-left",
);

const themeStyle = computed(() => ({
    "--notice-ticker-accent": props.widget.props.accent || "#46eeff",
    "--notice-ticker-duration": `${clampDuration(props.widget.props.duration)}s`,
}));
</script>

<template>
    <div class="widget-notice-ticker" :style="themeStyle">
        <div class="widget-notice-ticker__label">
            <span v-if="widget.props.tag" class="widget-notice-ticker__tag">{{
                widget.props.tag
            }}</span>
            <strong>{{ widget.props.title }}</strong>
        </div>

        <div class="widget-notice-ticker__viewport">
            <div
                class="widget-notice-ticker__track"
                :class="[
                    directionClass,
                    {
                        'is-looping': shouldLoop,
                        'is-pausable': widget.props.pauseOnHover !== false,
                    },
                ]"
            >
                <div
                    v-for="group in loopGroups"
                    :key="group"
                    class="widget-notice-ticker__group"
                    :aria-hidden="group > 0 ? 'true' : undefined"
                >
                    <span
                        v-for="(item, index) in items"
                        :key="`${group}-${index}`"
                        class="widget-notice-ticker__item"
                    >
                        <i v-if="widget.props.showDot !== false" />
                        <span>{{ item }}</span>
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
