from __future__ import annotations

import hashlib


def hash_password(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def verify_password(plain_password: str, stored_hash: str) -> bool:
    return hash_password(plain_password) == stored_hash
