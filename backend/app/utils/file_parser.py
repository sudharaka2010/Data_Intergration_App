from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from io import BytesIO
from pathlib import Path

import pandas as pd
from pandas.errors import EmptyDataError, ParserError


SUPPORTED_EXTENSIONS = {".csv", ".xlsx"}


@dataclass(slots=True)
class ParsedFile:
    file_type: str
    columns: list[str]
    preview_rows: list[list[str]]
    total_rows: int
    total_columns: int


def parse_tabular_file(filename: str, raw_bytes: bytes) -> ParsedFile:
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError("Only .csv and .xlsx files are supported.")

    if extension == ".csv":
        frame = _read_csv(raw_bytes)
        file_type = "csv"
    else:
        frame = pd.read_excel(BytesIO(raw_bytes))
        file_type = "xlsx"

    if frame.empty and len(frame.columns) == 0:
        raise ValueError("The uploaded file is empty.")

    columns = [_build_column_name(name, index) for index, name in enumerate(frame.columns.tolist())]
    frame.columns = columns
    frame = frame.fillna("")

    preview_rows: list[list[str]] = []
    for row in frame.head(20).itertuples(index=False, name=None):
        preview_rows.append([_to_display_value(value) for value in row])

    return ParsedFile(
        file_type=file_type,
        columns=columns,
        preview_rows=preview_rows,
        total_rows=int(frame.shape[0]),
        total_columns=int(frame.shape[1]),
    )


def _read_csv(raw_bytes: bytes) -> pd.DataFrame:
    buffer = BytesIO(raw_bytes)
    try:
        return pd.read_csv(buffer)
    except UnicodeDecodeError:
        buffer.seek(0)
        return pd.read_csv(buffer, encoding="latin-1")
    except (EmptyDataError, ParserError) as exc:
        raise ValueError("The uploaded CSV could not be parsed.") from exc


def _build_column_name(value, index: int) -> str:
    text = str(value).strip()
    return text or f"column_{index + 1}"


def _to_display_value(value) -> str:
    if value is None:
        return ""

    if isinstance(value, datetime):
        return value.isoformat(sep=" ", timespec="seconds")

    if isinstance(value, date):
        return value.isoformat()

    if pd.isna(value):
        return ""

    return str(value).strip()
