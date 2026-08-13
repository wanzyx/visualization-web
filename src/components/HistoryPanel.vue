<script setup>
import { computed } from "vue";
import InspectorSection from "./inspector/InspectorSection.vue";

const props = defineProps({
    currentLabel: {
        type: String,
        default: "当前项目",
    },
    undoEntries: {
        type: Array,
        default: () => [],
    },
    redoEntries: {
        type: Array,
        default: () => [],
    },
    canUndo: {
        type: Boolean,
        default: false,
    },
    canRedo: {
        type: Boolean,
        default: false,
    },
});

defineEmits(["undo", "redo"]);

const visibleUndoEntries = computed(() =>
    [...props.undoEntries].slice(-6).reverse(),
);
const visibleRedoEntries = computed(() =>
    [...props.redoEntries].slice(-6).reverse(),
);
</script>

<template>
    <InspectorSection
        title="历史记录"
        caption="查看最近编辑轨迹，并随时撤销或重做。"
        storage-key="panel-history"
        :default-open="false"
    >
        <template #actions>
            <button
                class="ghost history-panel__button"
                :disabled="!canUndo"
                @click="$emit('undo')"
            >
                撤销
            </button>
            <button
                class="ghost history-panel__button"
                :disabled="!canRedo"
                @click="$emit('redo')"
            >
                重做
            </button>
        </template>

        <div class="history-panel__current">
            <span>当前状态</span>
            <strong>{{ currentLabel }}</strong>
        </div>

        <div class="history-panel__columns">
            <div class="history-panel__column">
                <span class="history-panel__title">可撤销</span>
                <div class="history-panel__list">
                    <span
                        v-for="(entry, index) in visibleUndoEntries"
                        :key="`${entry.label}-${index}`"
                        class="history-panel__item"
                    >
                        {{ entry.label }}
                    </span>
                    <span
                        v-if="!visibleUndoEntries.length"
                        class="history-panel__empty"
                        >暂无</span
                    >
                </div>
            </div>

            <div class="history-panel__column">
                <span class="history-panel__title">可重做</span>
                <div class="history-panel__list">
                    <span
                        v-for="(entry, index) in visibleRedoEntries"
                        :key="`${entry.label}-${index}`"
                        class="history-panel__item"
                    >
                        {{ entry.label }}
                    </span>
                    <span
                        v-if="!visibleRedoEntries.length"
                        class="history-panel__empty"
                        >暂无</span
                    >
                </div>
            </div>
        </div>
    </InspectorSection>
</template>
