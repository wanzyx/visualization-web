<script setup>
import { computed } from "vue";

const props = defineProps({
    widget: {
        type: Object,
        required: true,
    },
});

const columns = computed(() => {
    const source = Array.isArray(props.widget.props.columns)
        ? props.widget.props.columns
        : [];

    return source
        .map((column, index) => ({
            key: String(column?.key ?? `column${index + 1}`).trim(),
            label: String(
                column?.label ?? column?.key ?? `列${index + 1}`,
            ).trim(),
        }))
        .filter((column) => column.key);
});

const rows = computed(() => {
    const source = Array.isArray(props.widget.props.rows)
        ? props.widget.props.rows
        : [];
    return source.map((row) =>
        row && typeof row === "object" && !Array.isArray(row) ? row : {},
    );
});

function getCellValue(row, key) {
    const value = row?.[key];
    return value === undefined || value === null || value === ""
        ? "--"
        : String(value);
}

function getLevelClass(value) {
    const text = String(value ?? "").toLowerCase();

    if (text.includes("高") || text.includes("high")) {
        return "is-high";
    }

    if (text.includes("中") || text.includes("medium")) {
        return "is-medium";
    }

    return "is-low";
}
</script>

<template>
    <div class="widget-table">
        <div class="widget-chart__header">
            <h3>{{ widget.props.title }}</h3>
        </div>

        <div class="widget-table__shell">
            <div
                class="widget-table__head"
                :style="{
                    gridTemplateColumns: `repeat(${columns.length || 1}, minmax(0, 1fr))`,
                }"
            >
                <span v-for="column in columns" :key="column.key">{{
                    column.label
                }}</span>
            </div>

            <div class="widget-table__body">
                <article
                    v-for="(row, rowIndex) in rows"
                    :key="row.id || `${rowIndex}`"
                    class="widget-table__row"
                    :style="{
                        gridTemplateColumns: `repeat(${columns.length || 1}, minmax(0, 1fr))`,
                    }"
                >
                    <span
                        v-for="column in columns"
                        :key="column.key"
                        :class="
                            column.key === 'level'
                                ? [
                                      'widget-table__level',
                                      getLevelClass(row[column.key]),
                                  ]
                                : ''
                        "
                    >
                        {{ getCellValue(row, column.key) }}
                    </span>
                </article>
            </div>
        </div>
    </div>
</template>
