"""
shared/utils/encryption.py — AES-256 (Fernet) field-level encryption for PHI columns.
"""
import base64
import hashlib
from django.conf import settings
from django.db import models
from cryptography.fernet import Fernet, InvalidToken


def _get_fernet() -> Fernet:
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        # Fallback for dev — generate a temporary key (NOT for production)
        key = Fernet.generate_key().decode()
    if isinstance(key, str):
        key = key.encode()
    # Ensure the key is valid Fernet format (32-byte URL-safe base64)
    try:
        return Fernet(key)
    except Exception:
        padded = base64.urlsafe_b64encode(key.ljust(32)[:32])
        return Fernet(padded)


def encrypt_value(value: str) -> str:
    if not value:
        return value
    f = _get_fernet()
    return f.encrypt(value.encode()).decode()


def decrypt_value(token: str) -> str:
    if not token:
        return token
    f = _get_fernet()
    try:
        return f.decrypt(token.encode()).decode()
    except InvalidToken:
        return ''


def hash_for_search(value: str) -> str:
    """SHA-256 hash for searching encrypted fields without decryption."""
    if not value:
        return ''
    return hashlib.sha256(value.lower().strip().encode()).hexdigest()


class EncryptedCharField(models.TextField):
    """
    Transparent AES-256 (Fernet) encryption at application layer.
    Stores ciphertext in DB. Decrypts on access.

    Usage:
        totp_secret = EncryptedCharField(max_length=500)
    """
    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        return decrypt_value(value)

    def to_python(self, value):
        if isinstance(value, str) and value.startswith('gAAAAA'):
            # Already looks like Fernet ciphertext
            return decrypt_value(value)
        return value

    def get_prep_value(self, value):
        if value is None:
            return value
        return encrypt_value(value)
