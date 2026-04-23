from __future__ import annotations

from enum import Enum


class UploadKind(str, Enum):
    supplier = "supplier"
    target = "target"
