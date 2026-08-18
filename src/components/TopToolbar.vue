<script setup>
import { computed } from "vue";

const props = defineProps({
    previewMode: {
        type: Boolean,
        default: false,
    },
    pages: {
        type: Array,
        default: () => [],
    },
    projectName: {
        type: String,
        default: "",
    },
    activePageId: {
        type: String,
        default: "",
    },
    canOperate: {
        type: Boolean,
        default: false,
    },
    selectionCount: {
        type: Number,
        default: 0,
    },
    canGroup: {
        type: Boolean,
        default: false,
    },
    canUngroup: {
        type: Boolean,
        default: false,
    },
    canUndo: {
        type: Boolean,
        default: false,
    },
    canRedo: {
        type: Boolean,
        default: false,
    },
    canCopy: {
        type: Boolean,
        default: false,
    },
    canPaste: {
        type: Boolean,
        default: false,
    },
    canSaveTemplate: {
        type: Boolean,
        default: false,
    },
    hasDataSources: {
        type: Boolean,
        default: false,
    },
    runtimeMode: {
        type: Boolean,
        default: false,
    },
});

defineEmits([
    "toggle-preview",
    "open-runtime",
    "copy-runtime-link",
    "open-publish-manager",
    "open-project-manager",
    "save-project-copy",
    "select-page",
    "reset-project",
    "export-project",
    "import-project",
    "duplicate-selected",
    "copy-selected",
    "paste-selected",
    "delete-selected",
    "bring-to-front",
    "send-to-back",
    "group-selected",
    "ungroup-selected",
    "save-selection-template",
    "refresh-data-sources",
    "undo",
    "redo",
]);

const activePageName = computed(
    () =>
        props.pages.find((page) => page.id === props.activePageId)?.name ??
        "未命名页面",
);

const modeLabel = computed(() => (props.previewMode ? "预览模式" : "编辑模式"));
const projectLabel = computed(() => props.projectName || "未命名项目");
const selectionLabel = computed(() =>
    props.selectionCount ? `已选 ${props.selectionCount} 个组件` : "未选中组件",
);
const pageCountLabel = computed(() => `${props.pages.length} 个页面`);
</script>

<template>
    <header class="toolbar">
        <div class="toolbar__row toolbar__row--top">
            <div class="toolbar__brand">
                <div class="toolbar__logo">DV</div>
                <div class="toolbar__brand-copy">
                    <h1>大屏低代码编辑器</h1>
                    <p>Vue 3 · 拖拽搭建 · 数据联动</p>
                </div>
            </div>

            <div class="toolbar__overview">
                <span class="toolbar__pill">
                    <b>模式</b>
                    <strong>{{ modeLabel }}</strong>
                </span>
                <span class="toolbar__pill">
                    <b>项目</b>
                    <strong>{{ projectLabel }}</strong>
                </span>
                <span class="toolbar__pill">
                    <b>页面</b>
                    <strong>{{ activePageName }}</strong>
                </span>
                <span class="toolbar__pill">
                    <b>状态</b>
                    <strong>{{ selectionLabel }}</strong>
                </span>
                <span class="toolbar__pill toolbar__pill--muted">
                    <b>总览</b>
                    <strong>{{ pageCountLabel }}</strong>
                </span>
            </div>
        </div>

        <div class="toolbar__row toolbar__row--controls">
            <div class="toolbar__control-meta">
                <label v-if="pages.length" class="toolbar__page-switch">
                    <span>当前页面</span>
                    <select
                        :value="activePageId"
                        @change="$emit('select-page', $event.target.value)"
                    >
                        <option
                            v-for="page in pages"
                            :key="page.id"
                            :value="page.id"
                        >
                            {{ page.name }}
                        </option>
                    </select>
                </label>
            </div>

            <div class="toolbar__actions">
                <div class="toolbar__action-group">
                    <button
                        class="ghost"
                        :disabled="!canUndo"
                        @click="$emit('undo')"
                    >
                        撤销
                    </button>
                    <button
                        class="ghost"
                        :disabled="!canRedo"
                        @click="$emit('redo')"
                    >
                        重做
                    </button>
                    <button
                        class="ghost"
                        :disabled="!canCopy"
                        @click="$emit('copy-selected')"
                    >
                        复制
                    </button>
                    <button
                        class="ghost"
                        :disabled="!canPaste"
                        @click="$emit('paste-selected')"
                    >
                        粘贴
                    </button>
                    <button
                        class="ghost"
                        :disabled="!canOperate"
                        @click="$emit('duplicate-selected')"
                    >
                        克隆
                    </button>
                    <button
                        class="ghost danger"
                        :disabled="!canOperate"
                        @click="$emit('delete-selected')"
                    >
                        删除
                    </button>
                </div>

                <div class="toolbar__action-group">
                    <button
                        class="ghost"
                        :disabled="!canGroup"
                        @click="$emit('group-selected')"
                    >
                        编组
                    </button>
                    <button
                        class="ghost"
                        :disabled="!canUngroup"
                        @click="$emit('ungroup-selected')"
                    >
                        解组
                    </button>
                    <button
                        class="ghost"
                        :disabled="!canOperate"
                        @click="$emit('send-to-back')"
                    >
                        下移层
                    </button>
                    <button
                        class="ghost"
                        :disabled="!canOperate"
                        @click="$emit('bring-to-front')"
                    >
                        上移层
                    </button>
                    <button
                        class="ghost"
                        :disabled="!canSaveTemplate"
                        @click="$emit('save-selection-template')"
                    >
                        存模板
                    </button>
                </div>

                <div
                    class="toolbar__action-group toolbar__action-group--utility"
                >
                    <button
                        class="ghost"
                        @click="$emit('open-publish-manager')"
                    >
                        发布中心
                    </button>
                    <button
                        class="ghost"
                        @click="$emit('open-project-manager')"
                    >
                        项目中心
                    </button>
                    <button class="ghost" @click="$emit('save-project-copy')">
                        另存项目
                    </button>
                    <button class="ghost" @click="$emit('import-project')">
                        导入
                    </button>
                    <button class="ghost" @click="$emit('export-project')">
                        导出
                    </button>
                    <button class="ghost" @click="$emit('reset-project')">
                        重置
                    </button>
                    <button
                        class="ghost"
                        :disabled="!hasDataSources"
                        @click="$emit('refresh-data-sources')"
                    >
                        刷新数据
                    </button>
                </div>

                <div
                    class="toolbar__action-group toolbar__action-group--highlight"
                >
                    <button class="ghost" @click="$emit('copy-runtime-link')">
                        运行链接
                    </button>
                    <button class="ghost" @click="$emit('open-runtime')">
                        {{ runtimeMode ? "运行页已打开" : "打开运行页" }}
                    </button>
                    <button class="primary" @click="$emit('toggle-preview')">
                        {{ previewMode ? "退出预览" : "进入预览" }}
                    </button>
                </div>
            </div>
        </div>
    </header>
</template>
