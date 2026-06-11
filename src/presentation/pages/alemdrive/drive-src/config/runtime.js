const trimTrailingSlash = (value) => value?.replace(/\/+$/, '') || '';

export const API_URL = trimTrailingSlash(
    import.meta.env?.VITE_API_URL || '/api/v1'
);

const ONLYOFFICE_BASE_URL = trimTrailingSlash(
    import.meta.env?.VITE_ONLYOFFICE_URL || 'http://92.38.49.200:9090'
);

export const ONLYOFFICE_INTERNAL_API_URL = trimTrailingSlash(
    import.meta.env?.VITE_ONLYOFFICE_CALLBACK_API_URL || API_URL
);

export const ONLYOFFICE_API_SCRIPT_URL = `${ONLYOFFICE_BASE_URL}/web-apps/apps/api/documents/api.js`;

export const getOnlyOfficeCallbackUrl = (fileId) =>
    `${ONLYOFFICE_INTERNAL_API_URL}/drive/onlyoffice/callback?file_id=${fileId}`;

export const getOnlyOfficeFileDownloadUrl = (fileId) => {
    const baseUrl = `${ONLYOFFICE_INTERNAL_API_URL}/drive/files/${fileId}/download`;
    return baseUrl;
};

export const getOnlyOfficePublicFileDownloadUrl = (token) =>
    `${ONLYOFFICE_INTERNAL_API_URL}/public/drive/files/${token}/download`;

export const getOnlyOfficeDocumentType = (fileName = '', mime = '') => {
    const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';

    if (
        mime.includes('spreadsheet') ||
        mime.includes('excel') ||
        mime.includes('sheet') ||
        ['xls', 'xlsx', 'csv', 'ods'].includes(extension)
    ) {
        return 'cell';
    }

    if (
        mime.includes('presentation') ||
        mime.includes('powerpoint') ||
        ['ppt', 'pptx', 'odp'].includes(extension)
    ) {
        return 'slide';
    }

    return 'word';
};
