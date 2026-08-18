<script setup>
import { ref } from "vue";
import {
    authModeOptions,
    dataSourceTypeOptions,
    getGeneratorOptions,
    getRemoteFieldMappingTemplate,
    requestMethodOptions,
} from "../editor/dataSources";
import InspectorSection from "./inspector/InspectorSection.vue";

const props = defineProps({
    dataSources: {
        type: Array,
        default: () => [],
    },
    bindingCounts: {
        type: Object,
        default: () => ({}),
    },
    sourceUsages: {
        type: Object,
        default: () => ({}),
    },
    dataSourceRuntime: {
        type: Object,
        default: () => ({}),
    },
});

const emit = defineEmits([
    "create-source",
    "copy-all-sources-config",
    "clear-all-source-runtime",
    "remove-unused-sources",
    "locate-source-usage",
    "delete-source",
    "duplicate-source",
    "export-source",
    "import-source",
    "import-source-as-new",
    "apply-source-runtime-payload",
    "copy-source-runtime-payload",
    "refresh-source",
    "refresh-all-sources",
    "change-source-type",
    "update-source-payload",
    "copy-source-debug",
    "clear-source-runtime",
]);

const draftType = ref("stat");
const SOURCE_USAGE_LIMIT = 6;

function formatPayload(payload) {
    return JSON.stringify(payload, null, 2);
}

function commitPayload(sourceId, event) {
    emit("update-source-payload", {
        sourceId,
        value: event.target.value,
    });
}

function formatRuntimeTime(timestamp) {
    if (!timestamp) {
        return "未刷新";
    }

    return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date(timestamp));
}

function isRemoteSource(source) {
    return source.generator === "remote";
}

function supportsRequestBody(source) {
    return !["GET", "HEAD"].includes(
        String(source.request?.method || "GET").toUpperCase(),
    );
}

function needsBearerAuth(source) {
    return source.request?.authMode === "bearer";
}

function needsBasicAuth(source) {
    return source.request?.authMode === "basic";
}

function needsCustomHeaderAuth(source) {
    return source.request?.authMode === "custom-header";
}

function getRuntimeEntry(sourceId) {
    return props.dataSourceRuntime[sourceId] ?? {};
}

function getRuntimeError(sourceId) {
    return getRuntimeEntry(sourceId).error ?? "";
}

function getRuntimeStatusLabel(sourceId) {
    const status = getRuntimeEntry(sourceId).responseStatus;
    const statusText = getRuntimeEntry(sourceId).responseStatusText ?? "";

    if (!status) {
        return "未返回";
    }

    return statusText ? `${status} ${statusText}` : String(status);
}

function getMappedFieldCount(sourceId) {
    return getRuntimeEntry(sourceId).mappedFieldCount ?? 0;
}

function getRefreshCount(sourceId) {
    return getRuntimeEntry(sourceId).refreshCount ?? 0;
}

function getRetryAttempts(sourceId) {
    return getRuntimeEntry(sourceId).retryAttempts ?? 0;
}

function getAttemptCount(sourceId) {
    return getRuntimeEntry(sourceId).attemptCount ?? 0;
}

function formatDebugValue(value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function getRequestPreview(sourceId) {
    return formatDebugValue(getRuntimeEntry(sourceId).requestPreview);
}

function getResponsePreview(sourceId) {
    return formatDebugValue(getRuntimeEntry(sourceId).responsePreview);
}

function getExtractedPreview(sourceId) {
    return formatDebugValue(getRuntimeEntry(sourceId).extractedPreview);
}

function getRuntimePayloadPreview(sourceId) {
    return formatDebugValue(getRuntimeEntry(sourceId).payload);
}

function hasRequestPreview(sourceId) {
    return Boolean(getRequestPreview(sourceId));
}

function hasResponsePreview(sourceId) {
    return Boolean(getResponsePreview(sourceId));
}

function hasExtractedPreview(sourceId) {
    return Boolean(getExtractedPreview(sourceId));
}

function hasRuntimePayloadPreview(sourceId) {
    return Boolean(getRuntimePayloadPreview(sourceId));
}

function shouldShowRuntimePreview(source) {
    const runtime = getRuntimeEntry(source.id);

    return (
        source.generator !== "static" ||
        Boolean(runtime.updatedAt) ||
        Boolean(runtime.error)
    );
}

function canClearRuntime(sourceId) {
    const runtime = getRuntimeEntry(sourceId);

    return Boolean(
        runtime.updatedAt ||
        runtime.refreshCount ||
        runtime.error ||
        runtime.requestPreview ||
        runtime.responsePreview ||
        runtime.extractedPreview,
    );
}

function getPayloadTitle(source) {
    return isRemoteSource(source) ? "默认 payload" : "JSON 数据";
}

function getPayloadHint(source) {
    return isRemoteSource(source)
        ? "接口结果会先按响应路径提取，再执行字段映射，最后和默认 payload 合并。接口未返回的字段会继续保留默认值。"
        : "静态和模拟数据会直接读取这里的 JSON 内容。";
}

function fillFieldMappings(source) {
    source.request.fieldMappingsText = getRemoteFieldMappingTemplate(
        source.type,
    );
}

function getRefreshButtonLabel(source) {
    return isRemoteSource(source) ? "测试接口" : "刷新";
}

function emitCopyDebug(sourceId, target) {
    emit("copy-source-debug", {
        sourceId,
        target,
    });
}

function getBindingCount(sourceId) {
    return props.bindingCounts[sourceId] ?? 0;
}

function isUnusedSource(sourceId) {
    return getBindingCount(sourceId) <= 0;
}

function getUnusedSourceCount() {
    return props.dataSources.filter((source) => isUnusedSource(source.id))
        .length;
}

function getSourceUsages(sourceId) {
    return props.sourceUsages[sourceId] ?? [];
}

function getVisibleSourceUsages(sourceId) {
    return getSourceUsages(sourceId).slice(0, SOURCE_USAGE_LIMIT);
}

function hasMoreSourceUsages(sourceId) {
    return getSourceUsages(sourceId).length > SOURCE_USAGE_LIMIT;
}
</script>

<template>
    <InspectorSection
        title="数据源中心"
        caption="统一维护组件数据源、接口映射与调试结果。"
        storage-key="panel-data-source"
        :default-open="false"
    >
        <template #actions>
            <div class="data-source-panel__header-actions">
                <button
                    class="ghost inspector-inline-button"
                    type="button"
                    @click="$emit('copy-all-sources-config')"
                >
                    复制配置
                </button>
                <button
                    class="ghost inspector-inline-button"
                    type="button"
                    @click="$emit('clear-all-source-runtime')"
                >
                    清空调试
                </button>
                <button
                    v-if="getUnusedSourceCount() > 0"
                    class="ghost inspector-inline-button"
                    type="button"
                    @click="$emit('remove-unused-sources')"
                >
                    清理未用
                </button>
                <button
                    class="ghost inspector-inline-button"
                    type="button"
                    @click="$emit('refresh-all-sources')"
                >
                    全部刷新
                </button>
            </div>
        </template>

        <div class="data-source-panel__toolbar">
            <select v-model="draftType">
                <option
                    v-for="option in dataSourceTypeOptions"
                    :key="option.value"
                    :value="option.value"
                >
                    {{ option.label }}
                </option>
            </select>

            <div class="data-source-panel__toolbar-actions">
                <button
                    class="ghost data-source-panel__action-button"
                    type="button"
                    @click="$emit('create-source', draftType)"
                >
                    新增数据源
                </button>
                <button
                    class="ghost data-source-panel__action-button"
                    type="button"
                    @click="$emit('import-source-as-new')"
                >
                    导入配置
                </button>
            </div>
        </div>

        <div v-if="dataSources.length" class="data-source-panel__list">
            <article
                v-for="source in dataSources"
                :key="source.id"
                class="data-source-panel__card"
                :class="{
                    'data-source-panel__card--unused': isUnusedSource(
                        source.id,
                    ),
                }"
            >
                <label>
                    <span>名称</span>
                    <input v-model="source.name" type="text" />
                </label>

                <div class="inspector-grid">
                    <label>
                        <span>类型</span>
                        <select
                            :value="source.type"
                            @change="
                                $emit('change-source-type', {
                                    sourceId: source.id,
                                    type: $event.target.value,
                                })
                            "
                        >
                            <option
                                v-for="option in dataSourceTypeOptions"
                                :key="option.value"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </option>
                        </select>
                    </label>

                    <label>
                        <span>刷新间隔</span>
                        <select v-model.number="source.refreshInterval">
                            <option :value="0">手动</option>
                            <option :value="10">10 秒</option>
                            <option :value="30">30 秒</option>
                            <option :value="60">60 秒</option>
                        </select>
                    </label>
                </div>

                <label>
                    <span>生成策略</span>
                    <select v-model="source.generator">
                        <option
                            v-for="option in getGeneratorOptions(source.type)"
                            :key="option.value"
                            :value="option.value"
                        >
                            {{ option.label }}
                        </option>
                    </select>
                </label>

                <div class="data-source-panel__meta">
                    <span
                        v-if="isUnusedSource(source.id)"
                        class="data-source-panel__meta-badge data-source-panel__meta-badge--warning"
                    >
                        未使用
                    </span>
                    <span
                        >绑定组件：{{ bindingCounts[source.id] ?? 0 }} 个</span
                    >
                    <span
                        >最近刷新：{{
                            formatRuntimeTime(
                                getRuntimeEntry(source.id).updatedAt,
                            )
                        }}</span
                    >
                </div>

                <div
                    v-if="getSourceUsages(source.id).length"
                    class="data-source-panel__usage"
                >
                    <div class="data-source-panel__usage-head">
                        <span>引用位置</span>
                        <span>{{ getSourceUsages(source.id).length }} 处</span>
                    </div>

                    <div class="data-source-panel__usage-list">
                        <button
                            v-for="usage in getVisibleSourceUsages(source.id)"
                            :key="usage.id"
                            class="ghost data-source-panel__usage-item"
                            type="button"
                            @click="$emit('locate-source-usage', usage)"
                        >
                            <strong>{{ usage.pageName }}</strong>
                            <span>{{ usage.widgetName }}</span>
                            <em>{{ usage.label }}</em>
                        </button>
                    </div>

                    <p
                        v-if="hasMoreSourceUsages(source.id)"
                        class="inspector-tip"
                    >
                        仅显示前 {{ SOURCE_USAGE_LIMIT }} 条引用
                    </p>
                </div>

                <div
                    v-if="isRemoteSource(source)"
                    class="data-source-panel__request"
                >
                    <p class="inspector-tip">
                        远程数据源会在预览态和运行态直接请求接口。你可以用
                        <code>&#123;&#123; timestamp &#125;&#125;</code>、
                        <code>&#123;&#123; today &#125;&#125;</code>、
                        <code>&#123;&#123; pageId &#125;&#125;</code>、
                        <code>&#123;&#123; projectTitle &#125;&#125;</code>
                        和
                        <code>&#123;&#123; env.VITE_XXX &#125;&#125;</code>
                        这类占位变量拼接请求；请求超时、429 和 5xx
                        失败可以按下方策略自动重试。鉴权凭据只保存在当前浏览器，
                        项目导出和数据源复制配置会自动脱敏。
                    </p>

                    <div class="inspector-grid">
                        <label>
                            <span>接口地址</span>
                            <input
                                v-model.trim="source.request.url"
                                type="text"
                                placeholder="https://api.example.com/dashboard"
                            />
                        </label>

                        <label>
                            <span>请求方法</span>
                            <select v-model="source.request.method">
                                <option
                                    v-for="method in requestMethodOptions"
                                    :key="method"
                                    :value="method"
                                >
                                    {{ method }}
                                </option>
                            </select>
                        </label>
                    </div>

                    <div class="inspector-grid">
                        <label>
                            <span>响应路径</span>
                            <input
                                v-model.trim="source.request.dataPath"
                                type="text"
                                placeholder="例如 data.result 或 data.list[0]"
                            />
                        </label>

                        <label>
                            <span>超时（ms）</span>
                            <input
                                v-model.number="source.request.timeout"
                                type="number"
                                min="500"
                                step="500"
                            />
                        </label>

                        <label>
                            <span>重试次数</span>
                            <input
                                v-model.number="source.request.retryCount"
                                type="number"
                                min="0"
                                max="5"
                                step="1"
                            />
                        </label>

                        <label>
                            <span>重试间隔（ms）</span>
                            <input
                                v-model.number="source.request.retryDelay"
                                type="number"
                                min="200"
                                step="100"
                            />
                        </label>
                    </div>

                    <label class="data-source-panel__checkbox">
                        <input
                            v-model="source.request.withCredentials"
                            type="checkbox"
                        />
                        <span>携带凭证（Cookie / Session）</span>
                    </label>

                    <label>
                        <span>Query 参数 JSON</span>
                        <textarea
                            v-model="source.request.queryText"
                            class="data-source-panel__textarea data-source-panel__textarea--compact"
                            rows="4"
                            spellcheck="false"
                            placeholder='例如 { "date": "{{ today }}", "page": "{{ pageId }}" }'
                        />
                    </label>

                    <label>
                        <span>鉴权方式</span>
                        <select v-model="source.request.authMode">
                            <option
                                v-for="option in authModeOptions"
                                :key="option.value"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </option>
                        </select>
                    </label>

                    <label v-if="needsBearerAuth(source)">
                        <span>Bearer Token</span>
                        <input
                            v-model.trim="source.request.authToken"
                            type="text"
                            placeholder="例如 {{ env.VITE_API_TOKEN }}"
                        />
                    </label>

                    <div
                        v-else-if="needsBasicAuth(source)"
                        class="inspector-grid"
                    >
                        <label>
                            <span>用户名</span>
                            <input
                                v-model="source.request.authUsername"
                                type="text"
                                placeholder="例如 {{ env.VITE_API_USER }}"
                            />
                        </label>

                        <label>
                            <span>密码</span>
                            <input
                                v-model="source.request.authPassword"
                                type="password"
                                placeholder="例如 {{ env.VITE_API_PASSWORD }}"
                            />
                        </label>
                    </div>

                    <div
                        v-else-if="needsCustomHeaderAuth(source)"
                        class="inspector-grid"
                    >
                        <label>
                            <span>请求头名称</span>
                            <input
                                v-model.trim="source.request.authHeaderName"
                                type="text"
                                placeholder="例如 X-API-Key"
                            />
                        </label>

                        <label>
                            <span>请求头值</span>
                            <input
                                v-model.trim="source.request.authToken"
                                type="text"
                                placeholder="例如 {{ env.VITE_API_KEY }}"
                            />
                        </label>
                    </div>

                    <label>
                        <span>请求头 JSON</span>
                        <textarea
                            v-model="source.request.headersText"
                            class="data-source-panel__textarea data-source-panel__textarea--compact"
                            rows="4"
                            spellcheck="false"
                            placeholder='例如 { "X-Trace-Id": "{{ timestamp }}" }'
                        />
                    </label>

                    <div class="data-source-panel__request-actions">
                        <button
                            class="ghost"
                            type="button"
                            @click="fillFieldMappings(source)"
                        >
                            填充字段模板
                        </button>
                    </div>

                    <label>
                        <span>字段映射 JSON</span>
                        <textarea
                            v-model="source.request.fieldMappingsText"
                            class="data-source-panel__textarea data-source-panel__textarea--compact"
                            rows="5"
                            spellcheck="false"
                            placeholder='例如 { "value": "total", "title": "meta.name" }'
                        />
                    </label>

                    <label v-if="supportsRequestBody(source)">
                        <span>请求体</span>
                        <textarea
                            v-model="source.request.bodyText"
                            class="data-source-panel__textarea data-source-panel__textarea--compact"
                            rows="4"
                            spellcheck="false"
                            placeholder="支持 JSON；如果不是合法 JSON，会按纯文本原样发送"
                        />
                    </label>
                </div>

                <label>
                    <span>{{ getPayloadTitle(source) }}</span>
                    <textarea
                        class="data-source-panel__textarea"
                        :value="formatPayload(source.payload)"
                        rows="8"
                        spellcheck="false"
                        @change="commitPayload(source.id, $event)"
                    />
                </label>

                <p class="inspector-tip">{{ getPayloadHint(source) }}</p>
                <p v-if="isRemoteSource(source)" class="inspector-tip">
                    字段映射左边写组件 payload
                    字段，右边写接口返回路径；请求预览会展示占位变量替换后的最终请求。
                </p>

                <div
                    v-if="getRuntimeError(source.id)"
                    class="data-source-panel__status data-source-panel__status--error"
                >
                    {{ getRuntimeError(source.id) }}
                </div>

                <div
                    v-if="shouldShowRuntimePreview(source)"
                    class="data-source-panel__preview"
                >
                    <div class="data-source-panel__preview-meta">
                        <span v-if="isRemoteSource(source)"
                            >最近状态：{{
                                getRuntimeStatusLabel(source.id)
                            }}</span
                        >
                        <span v-else
                            >最近刷新：{{
                                formatRuntimeTime(
                                    getRuntimeEntry(source.id).updatedAt,
                                )
                            }}</span
                        >
                        <span v-if="isRemoteSource(source)"
                            >映射字段：{{
                                getMappedFieldCount(source.id)
                            }}</span
                        >
                        <span
                            v-if="
                                isRemoteSource(source) &&
                                getAttemptCount(source.id)
                            "
                        >
                            {{
                                getRetryAttempts(source.id)
                                    ? `重试 ${getRetryAttempts(source.id)} 次`
                                    : "首轮成功"
                            }}
                        </span>
                        <span v-if="!isRemoteSource(source)"
                            >刷新次数：{{ getRefreshCount(source.id) }}</span
                        >
                        <div
                            v-if="canClearRuntime(source.id)"
                            class="data-source-panel__preview-actions"
                        >
                            <button
                                class="ghost data-source-panel__mini-button"
                                type="button"
                                @click="
                                    $emit('clear-source-runtime', source.id)
                                "
                            >
                                清空调试
                            </button>
                        </div>
                    </div>

                    <div
                        v-if="hasRuntimePayloadPreview(source.id)"
                        class="data-source-panel__preview-block"
                    >
                        <div class="data-source-panel__preview-head">
                            <span>运行值预览</span>
                            <div class="data-source-panel__preview-buttons">
                                <button
                                    class="ghost data-source-panel__mini-button"
                                    type="button"
                                    @click="
                                        $emit(
                                            'apply-source-runtime-payload',
                                            source.id,
                                        )
                                    "
                                >
                                    设为默认值
                                </button>
                                <button
                                    class="ghost data-source-panel__mini-button"
                                    type="button"
                                    @click="
                                        $emit(
                                            'copy-source-runtime-payload',
                                            source.id,
                                        )
                                    "
                                >
                                    复制
                                </button>
                            </div>
                        </div>
                        <textarea
                            class="data-source-panel__textarea data-source-panel__textarea--preview"
                            :value="getRuntimePayloadPreview(source.id)"
                            rows="6"
                            readonly
                            spellcheck="false"
                        />
                    </div>

                    <div
                        v-if="hasRequestPreview(source.id)"
                        class="data-source-panel__preview-block"
                    >
                        <div class="data-source-panel__preview-head">
                            <span>最终请求预览</span>
                            <button
                                class="ghost data-source-panel__mini-button"
                                type="button"
                                @click="emitCopyDebug(source.id, 'request')"
                            >
                                复制
                            </button>
                        </div>
                        <textarea
                            class="data-source-panel__textarea data-source-panel__textarea--preview"
                            :value="getRequestPreview(source.id)"
                            rows="5"
                            readonly
                            spellcheck="false"
                        />
                    </div>

                    <div
                        v-if="hasExtractedPreview(source.id)"
                        class="data-source-panel__preview-block"
                    >
                        <div class="data-source-panel__preview-head">
                            <span>提取结果预览</span>
                            <button
                                class="ghost data-source-panel__mini-button"
                                type="button"
                                @click="emitCopyDebug(source.id, 'extracted')"
                            >
                                复制
                            </button>
                        </div>
                        <textarea
                            class="data-source-panel__textarea data-source-panel__textarea--preview"
                            :value="getExtractedPreview(source.id)"
                            rows="5"
                            readonly
                            spellcheck="false"
                        />
                    </div>

                    <div
                        v-if="hasResponsePreview(source.id)"
                        class="data-source-panel__preview-block"
                    >
                        <div class="data-source-panel__preview-head">
                            <span>原始响应预览</span>
                            <button
                                class="ghost data-source-panel__mini-button"
                                type="button"
                                @click="emitCopyDebug(source.id, 'response')"
                            >
                                复制
                            </button>
                        </div>
                        <textarea
                            class="data-source-panel__textarea data-source-panel__textarea--preview"
                            :value="getResponsePreview(source.id)"
                            rows="6"
                            readonly
                            spellcheck="false"
                        />
                    </div>
                </div>

                <div class="data-source-panel__actions">
                    <button
                        class="ghost data-source-panel__action-button"
                        type="button"
                        @click="$emit('export-source', source.id)"
                    >
                        导出
                    </button>
                    <button
                        class="ghost data-source-panel__action-button"
                        type="button"
                        @click="$emit('import-source', source.id)"
                    >
                        导入
                    </button>
                    <button
                        class="ghost data-source-panel__action-button"
                        type="button"
                        @click="$emit('duplicate-source', source.id)"
                    >
                        复制
                    </button>
                    <button
                        class="ghost data-source-panel__action-button"
                        type="button"
                        @click="$emit('refresh-source', source.id)"
                    >
                        {{ getRefreshButtonLabel(source) }}
                    </button>
                    <button
                        class="ghost danger data-source-panel__action-button"
                        type="button"
                        @click="$emit('delete-source', source.id)"
                    >
                        删除
                    </button>
                </div>
            </article>
        </div>

        <div v-else class="material-empty">
            <span
                >这里可以统一维护文本、图表和指标类数据源，再到组件属性中完成绑定。</span
            >
        </div>
    </InspectorSection>
</template>
