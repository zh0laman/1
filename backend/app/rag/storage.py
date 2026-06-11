"""
Работа с MinIO: загрузка, скачивание, удаление файлов.
Интегрировано из rag.zip в основной проект alem-ai-backend.
"""
import io
import hashlib
import logging
from datetime import timedelta
from pathlib import Path
from typing import Optional, Union

from minio import Minio
from minio.error import S3Error

from app.core.config import settings

logger = logging.getLogger(__name__)

BUCKET_DOCUMENTS = "rag-documents"
BUCKET_UPLOADS = "rag-uploads"


def get_minio_client() -> Minio:
    return Minio(
        endpoint=settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )


def ensure_bucket(client: Minio, bucket: str) -> None:
    try:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
            logger.info("Created MinIO bucket: %s", bucket)
    except S3Error as e:
        logger.error("MinIO bucket error: %s", e)
        raise


def upload_file(
    data: Union[bytes, io.IOBase],
    object_name: str,
    content_type: str = "application/octet-stream",
    bucket: Optional[str] = None,
) -> str:
    bucket = bucket or BUCKET_DOCUMENTS
    client = get_minio_client()
    ensure_bucket(client, bucket)
    if isinstance(data, bytes):
        data_stream = io.BytesIO(data)
        length = len(data)
    else:
        data_stream = data
        length = -1
    client.put_object(
        bucket_name=bucket,
        object_name=object_name,
        data=data_stream,
        length=length,
        content_type=content_type,
    )
    logger.info("Uploaded %s → %s/%s", object_name, bucket, object_name)
    return object_name


def download_file(object_name: str, bucket: Optional[str] = None) -> bytes:
    bucket = bucket or BUCKET_DOCUMENTS
    client = get_minio_client()
    response = client.get_object(bucket_name=bucket, object_name=object_name)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def delete_file(object_name: str, bucket: Optional[str] = None) -> None:
    bucket = bucket or BUCKET_DOCUMENTS
    client = get_minio_client()
    try:
        client.remove_object(bucket_name=bucket, object_name=object_name)
        logger.info("Deleted %s from %s", object_name, bucket)
    except S3Error as e:
        logger.warning("MinIO delete error (non-fatal): %s", e)


def get_presigned_url(
    object_name: str,
    bucket: Optional[str] = None,
    expires_seconds: int = 3600,
) -> str:
    bucket = bucket or BUCKET_DOCUMENTS
    client = get_minio_client()
    return client.presigned_get_object(
        bucket_name=bucket,
        object_name=object_name,
        expires=timedelta(seconds=expires_seconds),
    )


def build_storage_key(tenant_id: str, bot_id: str, filename: str) -> str:
    """Формирует уникальный путь: {tenant_id}/{bot_id}/{hash8}_{filename}"""
    name_hash = hashlib.md5(filename.encode()).hexdigest()[:8]
    safe_name = Path(filename).name
    return f"{tenant_id}/{bot_id}/{name_hash}_{safe_name}"
