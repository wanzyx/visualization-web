<script setup>
defineProps({
    pages: {
        type: Array,
        default: () => [],
    },
    activePageId: {
        type: String,
        default: "",
    },
    canDeletePage: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits([
    "select-page",
    "create-page",
    "duplicate-page",
    "delete-page",
]);
</script>

<template>
    <section class="material-section">
        <div class="material-section__header">
            <h3>页面管理</h3>
            <button
                class="ghost page-panel__create"
                @click="emit('create-page')"
            >
                新建
            </button>
        </div>

        <div class="page-list">
            <article
                v-for="page in pages"
                :key="page.id"
                class="page-card"
                :class="{ 'is-active': activePageId === page.id }"
            >
                <button
                    class="page-card__select"
                    @click="emit('select-page', page.id)"
                >
                    <div class="page-card__meta">
                        <strong class="page-card__name">{{ page.name }}</strong>
                        <span class="page-card__subline"
                            >{{ page.meta.title }} ·
                            {{ page.widgets.length }} 个组件</span
                        >
                    </div>
                </button>

                <div class="page-card__actions">
                    <button
                        class="page-card__action"
                        @click="emit('duplicate-page', page.id)"
                    >
                        复制
                    </button>
                    <button
                        class="page-card__action"
                        :disabled="!canDeletePage"
                        @click="emit('delete-page', page.id)"
                    >
                        删除
                    </button>
                </div>
            </article>
        </div>
    </section>
</template>
