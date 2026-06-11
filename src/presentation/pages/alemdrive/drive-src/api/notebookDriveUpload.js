import { uploadFile } from './files';
import { NOTEBOOK_DRIVE_FOLDER_ID } from '../constants/notebookDrive';

function guessMimeFromName(filename) {
    const n = (filename || '').toLowerCase();
    if (n.endsWith('.pptx')) {
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    if (n.endsWith('.xlsx')) {
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    return 'application/octet-stream';
}

/**
 * Загрузка сгенерированного файла в блокноте на диск (как curl: multipart + folder_id).
 * @param {Blob} blob
 * @param {string} filename
 */
export async function uploadNotebookExportBlob(blob, filename) {
    const safe = String(filename || 'export.bin').replace(/[/\\?%*:|"<>]/g, '-');
    const type =
        blob && typeof blob.type === 'string' && blob.type && blob.type !== 'application/octet-stream'
            ? blob.type
            : guessMimeFromName(safe);
    const file = new File([blob], safe, { type });
    return uploadFile(file, NOTEBOOK_DRIVE_FOLDER_ID);
}
