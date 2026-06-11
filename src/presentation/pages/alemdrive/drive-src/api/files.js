import client from './client';

export const listFiles = async (folderId = 'root', params = {}) => {
    const response = await client.get(`/drive/folders/${folderId}/children`, { params });
    const data = response.data;
    console.log(`Raw files API data (folder: ${folderId}):`, data);

    let rawItems = [];

    if (Array.isArray(data)) {
        rawItems = data;
    } else if (data && typeof data === 'object') {
        // Try to find the array in common properties
        if (Array.isArray(data.children)) {
            rawItems = data.children;
        } else if (Array.isArray(data.items)) {
            rawItems = data.items;
        } else if (Array.isArray(data.files) || Array.isArray(data.folders)) {
            // Merge files and folders if separate
            const f = data.files || [];
            const d = data.folders || [];
            rawItems = [...d, ...f];
        } else {
            // Fallback: check if data itself is a paginated response with data property
            if (Array.isArray(data.data)) {
                rawItems = data.data;
            }
        }
    }

    return rawItems.map(item => {
        const actualItem = item.file || item.folder || item;

        let type = actualItem.type || 'file';
        // Improved type detection
        if (item.folder) type = 'dir';
        if (item.type === 'folder' || item.type === 'dir') type = 'dir';
        if (actualItem.mime_type === 'application/x-directory') type = 'dir';
        if (actualItem.is_folder) type = 'dir'; // Common flag

        return {
            ...actualItem,
            id: actualItem.id || item.id, // Ensure ID is captured
            name: actualItem.name || actualItem.real_name || 'Untitled',
            type: type
        };
    });
};

export const getFile = async (fileId) => {
    const response = await client.get(`/drive/files/${fileId}`);
    const actualItem = response.data;
    let type = actualItem.type || 'file';

    // Improved type detection logic (reused)
    if (actualItem.folder) type = 'dir';
    if (actualItem.type === 'folder' || actualItem.type === 'dir') type = 'dir';
    if (actualItem.mime_type === 'application/x-directory') type = 'dir';
    if (actualItem.is_folder) type = 'dir';

    return {
        ...actualItem,
        id: actualItem.id || fileId,
        name: actualItem.name || actualItem.real_name || 'Untitled',
        type: type
    };
};

export const uploadFile = async (file, folderId = 'root') => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId !== 'root') {
        formData.append('folder_id', folderId);
    }

    const response = await client.post('/drive/files', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    const newItem = response.data;
    return {
        ...newItem,
        name: newItem.name || newItem.real_name || 'Untitled'
    };
};

export const deleteFile = async (fileId) => {
    const response = await client.delete(`/drive/files/${fileId}`);
    return response.data;
};

export const deleteFolder = async (folderId) => {
    // Add recursive=true to allow deleting non-empty folders
    const response = await client.delete(`/drive/folders/${folderId}?recursive=true`);
    return response.data;
};

export const getDownloadUrl = (fileId) => {
    // OnlyOffice fetches the document from the backend directly, so this URL must be absolute.
    const baseUrl = `${client.defaults.baseURL}/drive/files/${fileId}/download`;
    return baseUrl;
};

export const createFolder = async (name, parentId = 'root') => {
    const response = await client.post('/drive/folders', {
        name,
        parent_id: parentId === 'root' ? null : parentId
    });
    return response.data;
};

export const updateFolder = async (folderId, name) => {
    const response = await client.put(`/drive/folders/${folderId}`, { name });
    return response.data;
};

export const updateFile = async (fileId, name) => {
    const response = await client.put(`/drive/files/${fileId}`, { name });
    return response.data;
};

export const fetchDownloadUrl = async (objectName) => {
    const response = await client.get('/files/url', { params: { object_name: objectName } });
    return response.data;
};

// Helper to normalize item structure
const normalizeItems = (items) => {
    if (!Array.isArray(items)) return [];
    return items.map(item => {
        const actualItem = item.file || item.folder || item;
        let type = actualItem.type || 'file';

        // Use the wrapper type if available to determine directory vs file
        if (item.type === 'folder') {
            type = 'dir';
        } else if (item.folder) {
            type = 'dir';
        } else if (actualItem.mime_type === 'application/x-directory') {
            type = 'dir';
        }

        return {
            ...actualItem,
            name: actualItem.name || actualItem.real_name || 'Untitled',
            type: type
        };
    });
};

export const listSharedItems = async (params = {}) => {
    const response = await client.get('/drive/items/shared', { params });
    const data = response.data;
    // Expected structure: array of items under 'shared' key or usage of specific endpoint returning array
    // Based on user request "http://.../get_drive_items_shared", assuming it returns string or list directly or wrapped.
    // If it returns { shared: [...] } or just [...]?
    // User showed JSON { own: [...], shared: [...] } for /drive/items.
    // Assuming /drive/items/shared returns just the array or { shared: [...] }.
    // Let's assume it returns { shared: [...] } or just array based on standard swaggers, but let's be safe.
    // Actually, usually specific endpoints return the list. Let's try to handle both.

    let items = [];
    if (Array.isArray(data)) items = data;
    else if (data.shared && Array.isArray(data.shared)) items = data.shared;
    // Fallback if the user meant filtering the main endpoint:
    // But they linked specific endpoints. Let's trust the endpoint returns data.

    return normalizeItems(items);
};

export const listOwnItems = async (params = {}) => {
    const response = await client.get('/drive/items/own', { params });
    const data = response.data;

    let items = [];
    if (Array.isArray(data)) items = data;
    else if (data.own && Array.isArray(data.own)) items = data.own;

    return normalizeItems(items);
};

export const listRecentFiles = async (limit = 10, offset = 0, extraParams = {}) => {
    const response = await client.get('/drive/recent', {
        params: { limit, offset, ...extraParams }
    });
    const data = response.data;

    let items = [];
    if (Array.isArray(data)) items = data;
    // Handle potential wrapper if needed, similar to logic above

    return normalizeItems(items);
};

export const grantPermission = async (fileId, userIdOrIds, role = 'viewer', resourceType = 'file') => {
    const userIds = Array.isArray(userIdOrIds) ? userIdOrIds : [userIdOrIds];
    const response = await client.post('/drive/permissions', {
        resource_id: fileId,
        user_id: userIds,
        role: role,
        resource_type: resourceType
    });
    return response.data;
    return response.data;
};

export const updatePermission = async (fileId, userId, role, resourceType = 'file') => {
    // The API expects user_id as an array for PUT as well? The example showed user_id: [0].
    // Let's assume it wants an array or single ID. The example used an array [0].
    // But logically updating usually targets one user or multiple.
    // I will wrap userId in array if it's not one, to match the example structure.
    const userIds = Array.isArray(userId) ? userId : [userId];

    const response = await client.put('/drive/permissions', {
        resource_id: fileId,
        user_id: userIds,
        role: role,
        resource_type: resourceType
    });
    return response.data;
};

export const revokePermission = async (fileId, userId, resourceType = 'file') => {
    const response = await client.delete('/drive/permissions', {
        data: {
            resource_id: fileId,
            user_id: [userId],
            resource_type: resourceType
        }
    });
    return response.data;
};

export const getUsersWithAccess = async (resourceId, resourceType = 'file') => {
    const response = await client.get('/drive/permissions/users-with-access', {
        params: { resource_id: resourceId, resource_type: resourceType }
    });
    return response.data;
};

export const getUsersWithoutAccess = async (resourceId, resourceType = 'file') => {
    const response = await client.get('/drive/permissions/users-without-access', {
        params: { resource_id: resourceId, resource_type: resourceType }
    });
    return response.data;
};

export const getFileTypes = async () => {
    const response = await client.get('/drive/file-types');
    return response.data;
};

export const getMyPermission = async (resourceId, resourceType = 'file') => {
    const response = await client.get('/drive/permissions/my', {
        params: { resource_id: resourceId, resource_type: resourceType }
    });
    return response.data;
};

export const createShareLink = async (resourceId, resourceType = 'file', role = 'viewer', expiresInSec = 0) => {
    const response = await client.post('/drive/share/link', {
        resource_id: resourceId,
        resource_type: resourceType,
        role: role,
        expires_in_sec: expiresInSec
    });
    return response.data;
};

export const getSharedUsers = async () => {
    const response = await client.get('/drive/shared/users');
    return response.data;
};

export const getPublicItem = async (token) => {
    const response = await client.get(`/public/drive/items/${token}`);
    return response.data;
};

export const acceptPublicLink = async (token) => {
    const response = await client.post(`/drive/share/link/${token}/accept`);
    return response.data;
};
