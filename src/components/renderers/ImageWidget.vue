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
const rawImageSrc = computed(() => String(props.widget.props.src || "").trim());
const isAssetReference = computed(() =>
    Boolean(parseAssetReference(rawImageSrc.value)),
);
const imageSrc = computed(() => resolveAssetReference(rawImageSrc.value));
const altText = computed(() =>
    String(props.widget.props.alt || props.widget.name || "").trim(),
);
const caption = computed(() => String(props.widget.props.caption || "").trim());
const objectFit = computed(
    () => String(props.widget.props.objectFit || "cover").trim() || "cover",
);
const showCaption = computed(
    () => Boolean(props.widget.props.showCaption) && Boolean(caption.value),
);
const mediaStyle = computed(() => ({
    "--media-fit": objectFit.value,
}));
</script>

<template>
    <div class="widget-media widget-image" :style="mediaStyle">
        <div v-if="imageSrc" class="widget-media__frame">
            <img
                class="widget-image__asset"
                :src="imageSrc"
                :alt="altText"
                decoding="async"
                loading="lazy"
            />

            <div v-if="showCaption" class="widget-image__caption">
                <strong>{{ caption }}</strong>
                <span v-if="altText && altText !== caption">{{ altText }}</span>
            </div>
        </div>

        <div v-else class="widget-media__empty">
            {{
                isAssetReference
                    ? "本地图片资源不存在、已删除或尚未完成加载。"
                    : "请先配置图片地址，或绑定图片数据源。"
            }}
        </div>
    </div>
</template>
