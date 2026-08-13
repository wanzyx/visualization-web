<script setup>
import { computed } from "vue";

const props = defineProps({
    widget: {
        type: Object,
        required: true,
    },
});

const videoSrc = computed(() => String(props.widget.props.src || "").trim());
const posterSrc = computed(() =>
    String(props.widget.props.poster || "").trim(),
);
const title = computed(() => String(props.widget.props.title || "").trim());
const objectFit = computed(
    () => String(props.widget.props.objectFit || "cover").trim() || "cover",
);
const autoplay = computed(() => Boolean(props.widget.props.autoplay));
const loop = computed(() => Boolean(props.widget.props.loop));
const muted = computed(() => Boolean(props.widget.props.muted));
const controls = computed(() => Boolean(props.widget.props.controls));
const mediaStyle = computed(() => ({
    "--media-fit": objectFit.value,
}));
</script>

<template>
    <div class="widget-media widget-video" :style="mediaStyle">
        <div v-if="videoSrc" class="widget-media__frame">
            <video
                class="widget-video__player"
                :src="videoSrc"
                :poster="posterSrc || undefined"
                :autoplay="autoplay"
                :loop="loop"
                :muted="muted"
                :controls="controls"
                playsinline
                preload="metadata"
            />

            <div v-if="title" class="widget-video__title">{{ title }}</div>
        </div>

        <div v-else class="widget-media__empty">
            请先配置视频地址，或绑定视频数据源。
        </div>
    </div>
</template>
