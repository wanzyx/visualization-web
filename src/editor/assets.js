export const ASSET_REFERENCE_PREFIX = "asset://";
export const ASSET_KIND_OPTIONS = [
    { value: "all", label: "全部资源" },
    { value: "image", label: "图片" },
    { value: "video", label: "视频" },
];

const ASSET_DB_NAME = "visualization-web-assets-v1";
const ASSET_DB_VERSION = 1;
const ASSET_STORE_NAME = "assets";

let assetDatabasePromise = null;

export function createAssetId() {
    return `asset-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function createAssetReference(id = "") {
    const normalizedId = String(id || "").trim();
    return normalizedId ? `${ASSET_REFERENCE_PREFIX}${normalizedId}` : "";
}

export function parseAssetReference(value = "") {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue.startsWith(ASSET_REFERENCE_PREFIX)) {
        return "";
    }

    return normalizedValue.slice(ASSET_REFERENCE_PREFIX.length).trim();
}

export function inferAssetKind(input) {
    const mimeType =
        input && typeof input === "object" && !Array.isArray(input)
            ? String(input.type || "").trim().toLowerCase()
            : String(input || "").trim().toLowerCase();

    if (mimeType.startsWith("image/")) {
        return "image";
    }

    if (mimeType.startsWith("video/")) {
        return "video";
    }

    return "";
}

export function formatAssetFileSize(size) {
    const normalizedSize = Math.max(0, Number(size) || 0);

    if (normalizedSize < 1024) {
        return `${normalizedSize} B`;
    }

    if (normalizedSize < 1024 * 1024) {
        return `${(normalizedSize / 1024).toFixed(1)} KB`;
    }

    if (normalizedSize < 1024 * 1024 * 1024) {
        return `${(normalizedSize / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(normalizedSize / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function normalizeAssetTags(tags) {
    if (Array.isArray(tags)) {
        return Array.from(
            new Set(
                tags
                    .map((item) => String(item || "").trim())
                    .filter(Boolean),
            ),
        ).slice(0, 16);
    }

    if (typeof tags === "string") {
        return normalizeAssetTags(
            tags.split(/[\n,，;；|/]+/g),
        );
    }

    return [];
}

export function normalizeAssetRecord(rawRecord) {
    if (!rawRecord || typeof rawRecord !== "object") {
        return null;
    }

    const id = String(rawRecord.id || "").trim();
    const kind = inferAssetKind(rawRecord.kind || rawRecord.mimeType || rawRecord.blob);

    if (!id || !kind) {
        return null;
    }

    const name = String(rawRecord.name || "").trim() || `${kind}-${id.slice(-6)}`;
    const mimeType = String(rawRecord.mimeType || "").trim();
    const size = Math.max(0, Number(rawRecord.size) || 0);
    const createdAt = Number.isFinite(Number(rawRecord.createdAt))
        ? Number(rawRecord.createdAt)
        : Date.now();
    const updatedAt = Number.isFinite(Number(rawRecord.updatedAt))
        ? Number(rawRecord.updatedAt)
        : createdAt;
    const tags = normalizeAssetTags(rawRecord.tags);

    return {
        id,
        name,
        kind,
        mimeType,
        size,
        tags,
        createdAt,
        updatedAt,
        blob: rawRecord.blob instanceof Blob ? rawRecord.blob : null,
        reference: createAssetReference(id),
    };
}

export function createAssetPackageRecord(record, dataUrl = "") {
    const normalizedRecord = normalizeAssetRecord(record);

    if (!normalizedRecord || !dataUrl) {
        return null;
    }

    return {
        id: normalizedRecord.id,
        name: normalizedRecord.name,
        kind: normalizedRecord.kind,
        mimeType: normalizedRecord.mimeType,
        size: normalizedRecord.size,
        tags: normalizedRecord.tags,
        createdAt: normalizedRecord.createdAt,
        updatedAt: normalizedRecord.updatedAt,
        dataUrl,
    };
}

export function convertBlobToDataUrl(blob) {
    if (!(blob instanceof Blob)) {
        return Promise.resolve("");
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(typeof reader.result === "string" ? reader.result : "");
        };

        reader.onerror = () => {
            reject(reader.error || new Error("资源编码失败"));
        };

        reader.readAsDataURL(blob);
    });
}

export function convertDataUrlToBlob(dataUrl, mimeType = "") {
    const normalizedValue = String(dataUrl || "").trim();

    if (!normalizedValue.startsWith("data:")) {
        return null;
    }

    const separatorIndex = normalizedValue.indexOf(",");

    if (separatorIndex < 0) {
        return null;
    }

    const header = normalizedValue.slice(5, separatorIndex);
    const body = normalizedValue.slice(separatorIndex + 1);
    const inferredMimeType = header.split(";")[0] || mimeType || "";
    const binaryString = atob(body);
    const bytes = new Uint8Array(binaryString.length);

    for (let index = 0; index < binaryString.length; index += 1) {
        bytes[index] = binaryString.charCodeAt(index);
    }

    return new Blob([bytes], {
        type: inferredMimeType || mimeType || "application/octet-stream",
    });
}

export async function serializeAssetRecords(records = []) {
    const normalizedRecords = (Array.isArray(records) ? records : [])
        .map((item) => normalizeAssetRecord(item))
        .filter(Boolean)
        .filter((item) => item.blob instanceof Blob);

    const serialized = await Promise.all(
        normalizedRecords.map(async (record) => {
            const dataUrl = await convertBlobToDataUrl(record.blob);
            return createAssetPackageRecord(record, dataUrl);
        }),
    );

    return serialized.filter(Boolean);
}

export function deserializeAssetPackageRecords(records = []) {
    return (Array.isArray(records) ? records : [])
        .map((item) => {
            if (!item || typeof item !== "object") {
                return null;
            }

            const blob = convertDataUrlToBlob(item.dataUrl, item.mimeType);

            if (!(blob instanceof Blob)) {
                return null;
            }

            return normalizeAssetRecord({
                id:
                    typeof item.id === "string" && item.id.trim()
                        ? item.id.trim()
                        : createAssetId(),
                name: item.name,
                kind: item.kind,
                mimeType: item.mimeType || blob.type,
                size: item.size ?? blob.size,
                tags: item.tags,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                blob,
            });
        })
        .filter(Boolean);
}

export async function openAssetDatabase() {
    if (typeof indexedDB === "undefined") {
        throw new Error("当前环境不支持本地资源中心");
    }

    if (assetDatabasePromise) {
        return assetDatabasePromise;
    }

    assetDatabasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(ASSET_DB_NAME, ASSET_DB_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains(ASSET_STORE_NAME)) {
                database.createObjectStore(ASSET_STORE_NAME, {
                    keyPath: "id",
                });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error || new Error("资源库初始化失败"));
        };
    });

    return assetDatabasePromise;
}

export async function listAssetRecords() {
    const database = await openAssetDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(ASSET_STORE_NAME, "readonly");
        const store = transaction.objectStore(ASSET_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const records = Array.isArray(request.result)
                ? request.result
                      .map((item) => normalizeAssetRecord(item))
                      .filter(Boolean)
                      .sort((left, right) => right.updatedAt - left.updatedAt)
                : [];
            resolve(records);
        };

        request.onerror = () => {
            reject(request.error || new Error("资源库读取失败"));
        };
    });
}

export async function putAssetRecords(records = []) {
    const normalizedRecords = (Array.isArray(records) ? records : [])
        .map((item) => normalizeAssetRecord(item))
        .filter(Boolean);

    if (!normalizedRecords.length) {
        return [];
    }

    const database = await openAssetDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(ASSET_STORE_NAME, "readwrite");
        const store = transaction.objectStore(ASSET_STORE_NAME);

        normalizedRecords.forEach((record) => {
            store.put(record);
        });

        transaction.oncomplete = () => {
            resolve(normalizedRecords);
        };

        transaction.onerror = () => {
            reject(transaction.error || new Error("资源保存失败"));
        };

        transaction.onabort = () => {
            reject(transaction.error || new Error("资源保存失败"));
        };
    });
}

export async function deleteAssetRecord(assetId = "") {
    const normalizedId = String(assetId || "").trim();

    if (!normalizedId) {
        return false;
    }

    const database = await openAssetDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(ASSET_STORE_NAME, "readwrite");
        const store = transaction.objectStore(ASSET_STORE_NAME);

        store.delete(normalizedId);

        transaction.oncomplete = () => {
            resolve(true);
        };

        transaction.onerror = () => {
            reject(transaction.error || new Error("资源删除失败"));
        };

        transaction.onabort = () => {
            reject(transaction.error || new Error("资源删除失败"));
        };
    });
}
