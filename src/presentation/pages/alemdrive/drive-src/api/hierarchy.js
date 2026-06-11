import client from './client';

export const getHierarchyTree = async () => {
    const response = await client.get('/hierarchy/public/tree');
    return response.data;
};
