<script setup>
import { computed, inject } from "vue";
import { parseAssetReference } from "../../editor/assets";

const props = defineProps({
    widget: {
        type: Object,
        required: true,
    },
});

const resolveAssetReference = inject(
    "resolveAssetReference",
    (value) => String(value || "").trim(),
);
const rawVideoSrc = computed(() => String(props.widget.props.src || "").trim());
const videoSrc = computed(() => resolveAssetReference(rawVideoSrc.value));
const posterSrc = computed(() =>
    resolveAssetReference(String(props.widget.props.poster || "").trim()),
);
const isAssetReference = computed(() =>
    Boolean(parseAssetReference(rawVideoSrc.value)),
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
            {{
                isAssetReference
                    ? "本地视频资源不存在、已删除或尚未完成加载。"
                    : "请先配置视频地址，或绑定视频数据源。"
            }}
        </div>
    </div>
</template>
