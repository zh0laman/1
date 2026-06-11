# E2EE Backend Resolution Plan

Актуально по состоянию на `2026-04-05`.

Этот документ фиксирует canonical backend-модель для web E2EE flow и убирает двусмысленность между password login, cloud backup и history access.

## Короткий вывод

Backend уже нормализует `kdf_algorithm`, `kdf_params` и делает legacy backfill для `pbkdf2-sha256` version `1`.

Дополнительно backend теперь фиксирует explicit backup contract:

- `backup_key_type = x25519`
- `backup_key_format = pkcs8-der-base64`
- `backup_key_scope = device_identity`
- `backup_format_version = 1`
- `cipher_algorithm = aes-256-gcm`
- `cipher_tag_embedded = true`
- `aad_mode = none`
- `password_processing = utf8-raw`

И backend валидирует device `public_key` как Base64 encoded `X25519` public key (`32 bytes` после decode).

## Canonical identity model

Для проекта нужно считать canonical следующую схему:

- `web = отдельное устройство`
- у каждого browser slot свой `device_id`
- у каждого browser slot свой `X25519 key pair`
- backup полезен для recovery, но не заменяет history sync
- password login с fresh web key не гарантирует доступ к старой истории
- password login с restored identity key тоже может дать доступ к старой истории
- старая история для нового `web_device_id` с fresh key открывается через `QR + history sync / re-wrap`

## Почему одного backup недостаточно

Исторические сообщения уже привязаны к `encrypted_keys[device_id]`.

Если новый web device зарегистрирован с новым `device_id`, то наличие cloud backup само по себе не добавляет `encrypted_keys[current_web_device_id]` в старые сообщения.

Поэтому canonical old-history flow:

1. web регистрируется как новое устройство
2. mobile подтверждает pairing
3. mobile делает re-wrap старых message keys на `web_device_id`
4. backend сохраняет новые `encrypted_keys[web_device_id]`

## Legacy policy

- legacy `pbkdf2` backup остается читаемым только через explicit `kdf_params`
- если клиент не понимает `backup_key_format` или `backup_key_scope`, такой backup должен считаться `unsupported`
- frontend не должен угадывать параметры KDF, cipher или key format

## Документы, которые должны оставаться синхронными

- `docs/E2EE_WEB_LOGIN_GUIDE.md`
- `docs/e2ee_mobile_web_client_guide.md`
- `docs/e2ee_web_pairing_architecture.md`
- `docs/e2ee_web_pairing_contract.md`

## Acceptance criteria

- `GET /api/v1/e2ee/backup` возвращает explicit metadata; current canonical backup детерминирован, а legacy inferred rows явно документированы как compatibility contract
- `POST /api/v1/e2ee/keys` и `POST /api/v1/e2ee/device/register` валидируют canonical `X25519` public key
- docs не обещают old history restore через один только password login
- QR linked-device flow остается canonical путем для old history на новом web device
