import { getValueByPath } from "./dataSources";

export function formatRuntimeTemplateValuePreview(value, maxLength = 120) {
    const serialized =
        value == null
            ? "null"
            : typeof value === "string"
              ? value
              : (() => {
                    try {
                        return JSON.stringify(value);
                    } catch (error) {
                        console.warn(error);
                        return String(value);
                    }
                })();

    if (serialized.length <= maxLength) {
        return serialized;
    }

    return `${serialized.slice(0, Math.max(maxLength - 1, 0))}…`;
}

export function createRuntimeTemplateScope({
    widgetProps = {},
    sourcePayload = null,
    runtimeVariables = {},
    page = null,
} = {}) {
    return {
        widget:
            widgetProps &&
            typeof widgetProps === "object" &&
            !Array.isArray(widgetProps)
                ? widgetProps
                : {},
        source: sourcePayload,
        runtime:
            runtimeVariables &&
            typeof runtimeVariables === "object" &&
            !Array.isArray(runtimeVariables)
                ? runtimeVariables
                : {},
        page: {
            id: String(page?.id ?? "").trim(),
            name: String(page?.name ?? "").trim(),
            title: String(page?.title ?? page?.meta?.title ?? "").trim(),
        },
    };
}

function readRuntimeTemplateValue(scope, expression) {
    const trimmed = String(expression ?? "").trim();
    const matched = trimmed.match(/^(widget|source|runtime|page)(?:\.(.+))?$/);

    if (!matched) {
        return undefined;
    }

    const rootValue = scope[matched[1]];

    return matched[2] ? getValueByPath(rootValue, matched[2]) : rootValue;
}

function formatRuntimeTemplateInlineValue(value) {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    return formatRuntimeTemplateValuePreview(value, 120);
}

export function resolveRuntimeTemplateString(template, scope) {
    if (typeof template !== "string" || !template.includes("{{")) {
        return template;
    }

    const exactMatch = template.match(/^\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/);

    if (exactMatch) {
        const resolved = readRuntimeTemplateValue(scope, exactMatch[1]);
        return resolved === undefined ? "" : resolved;
    }

    return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, expression) =>
        formatRuntimeTemplateInlineValue(
            readRuntimeTemplateValue(scope, expression),
        ),
    );
}

export function resolveRuntimeTemplateValue(value, scope) {
    if (Array.isArray(value)) {
        return value.map((item) => resolveRuntimeTemplateValue(item, scope));
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, entryValue]) => [
                key,
                resolveRuntimeTemplateValue(entryValue, scope),
            ]),
        );
    }

    return resolveRuntimeTemplateString(value, scope);
}
