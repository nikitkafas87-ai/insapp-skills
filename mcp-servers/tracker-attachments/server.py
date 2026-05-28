from __future__ import annotations

import mimetypes
import os
import json
from pathlib import Path
import subprocess
import tomllib
from typing import Any
from urllib.parse import urlparse

import httpx
from mcp.server.fastmcp import FastMCP

try:
    import truststore
except ImportError:
    truststore = None
else:
    truststore.inject_into_ssl()


mcp = FastMCP("tracker-attachments")


TRACKER_API_BASE = "https://api.tracker.yandex.net/v3"
MAX_UPLOAD_BYTES = int(os.getenv("TRACKER_ATTACHMENTS_MAX_BYTES", str(10 * 1024 * 1024)))
ALLOWED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".pdf",
    ".txt",
    ".md",
    ".json",
    ".csv",
    ".xlsx",
}
ALLOWED_MIME_PREFIXES = ("image/", "text/")
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/json",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/markdown",
    "text/plain",
}
SENSITIVE_NAME_PARTS = (
    ".env",
    "config.toml",
    "service-account",
    "service_account",
    "secret",
    "token",
    "password",
    "private",
    "credential",
    "credentials",
    "key.json",
)


class TrackerConfigError(RuntimeError):
    pass


def _codex_tracker_env() -> dict[str, str]:
    config_path = Path(os.getenv("CODEX_HOME") or Path.home() / ".codex") / "config.toml"
    if not config_path.exists():
        return {}
    try:
        data = tomllib.loads(config_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    env = data.get("mcp_servers", {}).get("tracker", {}).get("env", {})
    return env if isinstance(env, dict) else {}


def _env_value(name: str) -> str | None:
    return os.getenv(name) or _codex_tracker_env().get(name)


def _allowed_queues() -> set[str]:
    raw = os.getenv("TRACKER_ATTACHMENTS_ALLOWED_QUEUES", "INS")
    return {item.strip().upper() for item in raw.split(",") if item.strip()}


def _check_issue_id(issue_id: str) -> None:
    queue = issue_id.split("-", 1)[0].upper()
    allowed = _allowed_queues()
    if allowed and queue not in allowed:
        raise PermissionError(f"Queue `{queue}` is not allowed for attachment uploads")


def _check_tracker_api_base() -> None:
    parsed = urlparse(TRACKER_API_BASE)
    if parsed.scheme != "https" or parsed.netloc != "api.tracker.yandex.net":
        raise TrackerConfigError("Tracker API base must be https://api.tracker.yandex.net")


def _headers(content_type: bool = False) -> dict[str, str]:
    token = _env_value("TRACKER_TOKEN") or _env_value("TRACKER_IAM_TOKEN")
    org_id = _env_value("TRACKER_ORG_ID")
    cloud_org_id = _env_value("TRACKER_CLOUD_ORG_ID")

    if not token:
        raise TrackerConfigError("TRACKER_TOKEN or TRACKER_IAM_TOKEN is required")
    if not org_id and not cloud_org_id:
        raise TrackerConfigError("TRACKER_ORG_ID or TRACKER_CLOUD_ORG_ID is required")

    auth_scheme = "Bearer" if _env_value("TRACKER_IAM_TOKEN") and not _env_value("TRACKER_TOKEN") else "OAuth"
    headers = {"Authorization": f"{auth_scheme} {token}"}
    if org_id:
        headers["X-Org-ID"] = org_id
    else:
        headers["X-Cloud-Org-ID"] = cloud_org_id or ""
    if content_type:
        headers["Content-Type"] = "application/json"
    return headers


def _file_tuple(file_path: str, filename: str | None = None) -> tuple[str, bytes, str]:
    path = Path(file_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    if not path.is_file():
        raise ValueError(f"Path is not a file: {path}")

    name = filename or path.name
    lower_name = name.lower()
    lower_path = str(path).lower()
    if any(part in lower_name or part in lower_path for part in SENSITIVE_NAME_PARTS):
        raise PermissionError(f"Refusing to upload potentially sensitive file: {path}")
    if path.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise PermissionError(f"File extension `{path.suffix}` is not allowed for Tracker uploads")
    size = path.stat().st_size
    if size > MAX_UPLOAD_BYTES:
        raise PermissionError(f"File is too large for Tracker upload: {size} bytes")

    content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    if content_type not in ALLOWED_MIME_TYPES and not content_type.startswith(ALLOWED_MIME_PREFIXES):
        raise PermissionError(f"MIME type `{content_type}` is not allowed for Tracker uploads")
    return name, path.read_bytes(), content_type


def _raise_for_tracker_error(response: httpx.Response) -> None:
    if response.is_success:
        return
    try:
        details: Any = response.json()
    except Exception:
        details = response.text
    raise RuntimeError(f"Tracker API error {response.status_code}: {details}")


def _attachment_inline_markdown(attachment: dict[str, Any], width: int | None = None, height: int | None = None) -> str:
    attachment_id = attachment.get("id")
    name = attachment.get("name") or "attachment"
    if not attachment_id:
        raise ValueError("Tracker attachment response does not contain id")

    size = ""
    if width and height:
        size = f" ={width}x{height}"
    return f"![{name}](/ajax/v2/attachments/{attachment_id}?inline=true{size})"


def _cut_block(title: str | None, markdown: str) -> str:
    if not title:
        return markdown
    return f'{{% cut "{title}" %}}\n\n{markdown}\n\n{{% endcut %}}'


def _upload_attachment(issue_id: str, file_path: str, filename: str | None = None) -> dict[str, Any]:
    _check_tracker_api_base()
    _check_issue_id(issue_id)
    name, data, content_type = _file_tuple(file_path, filename)
    url = f"{TRACKER_API_BASE}/issues/{issue_id}/attachments/"
    if os.getenv("TRACKER_ATTACHMENTS_FORCE_CURL") == "1":
        return _upload_attachment_with_curl(issue_id, file_path, name)
    try:
        with httpx.Client(timeout=120.0) as client:
            response = client.post(
                url,
                headers=_headers(),
                files={"file": (name, data, content_type)},
            )
    except httpx.TransportError:
        return _upload_attachment_with_curl(issue_id, file_path, name)
    _raise_for_tracker_error(response)
    return response.json()


def _upload_attachment_with_curl(issue_id: str, file_path: str, filename: str) -> dict[str, Any]:
    url = f"{TRACKER_API_BASE}/issues/{issue_id}/attachments/"
    headers = _headers()
    command = [
        "curl.exe",
        "-sS",
        "--fail",
        "--max-time",
        "300",
        "-H",
        f"Authorization: {headers['Authorization']}",
        "-F",
        f"file=@{str(Path(file_path).expanduser().resolve())};filename={filename}",
        url,
    ]
    if "X-Org-ID" in headers:
        command[7:7] = ["-H", f"X-Org-ID: {headers['X-Org-ID']}"]
    else:
        command[7:7] = ["-H", f"X-Cloud-Org-ID: {headers['X-Cloud-Org-ID']}"]

    result = subprocess.run(command, capture_output=True, text=True, timeout=330, check=False)
    if result.returncode != 0:
        details = (result.stderr or result.stdout).strip()
        raise RuntimeError(f"Tracker attachment curl upload failed: {details}")
    return json.loads(result.stdout)


def _tracker_json_request(method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
    _check_tracker_api_base()
    url = f"{TRACKER_API_BASE}{path}"
    with httpx.Client(timeout=120.0) as client:
        response = client.request(
            method,
            url,
            headers=_headers(content_type=payload is not None),
            json=payload,
        )
    _raise_for_tracker_error(response)
    if not response.content:
        return None
    return response.json()


@mcp.tool()
def issue_add_attachment(issue_id: str, file_path: str, filename: str | None = None) -> dict[str, Any]:
    """Upload a local file as a Yandex Tracker issue attachment.

    Args:
        issue_id: Issue key, for example INS-3157.
        file_path: Absolute or relative path to a local file.
        filename: Optional filename to use in Tracker.
    """
    attachment = _upload_attachment(issue_id, file_path, filename)
    return {
        "attachment": attachment,
        "inline_markdown": _attachment_inline_markdown(attachment),
    }


@mcp.tool()
def issue_add_comment_with_inline_attachment(
    issue_id: str,
    file_path: str,
    text: str = "",
    filename: str | None = None,
    cut_title: str | None = "Скриншот",
    width: int | None = None,
    height: int | None = None,
) -> dict[str, Any]:
    """Upload a file and create a Tracker comment that displays it inline.

    Args:
        issue_id: Issue key, for example INS-3157.
        file_path: Absolute or relative path to a local file.
        text: Optional text before the inline attachment.
        filename: Optional filename to use in Tracker.
        cut_title: Optional YFM cut title. Pass empty/null to avoid wrapping.
        width: Optional displayed image width.
        height: Optional displayed image height.
    """
    attachment = _upload_attachment(issue_id, file_path, filename)
    image_markdown = _cut_block(cut_title, _attachment_inline_markdown(attachment, width, height))
    comment_text = f"{text.rstrip()}\n\n{image_markdown}".strip()

    url = f"{TRACKER_API_BASE}/issues/{issue_id}/comments"
    payload = {"text": comment_text, "markupType": "md"}
    with httpx.Client(timeout=120.0) as client:
        response = client.post(url, headers=_headers(content_type=True), json=payload)
    _raise_for_tracker_error(response)
    return {
        "attachment": attachment,
        "comment": response.json(),
        "inline_markdown": image_markdown,
    }


@mcp.tool()
def issue_update_comment_append_inline_attachment(
    issue_id: str,
    comment_id: int,
    current_text: str,
    file_path: str,
    filename: str | None = None,
    cut_title: str | None = "Скриншот",
    width: int | None = None,
    height: int | None = None,
) -> dict[str, Any]:
    """Upload a file and append it inline to an existing Tracker comment.

    The current_text argument is required so the tool does not need to guess
    which comment content should be preserved.

    Args:
        issue_id: Issue key, for example INS-3157.
        comment_id: Numeric comment id.
        current_text: Full current comment text to preserve.
        file_path: Absolute or relative path to a local file.
        filename: Optional filename to use in Tracker.
        cut_title: Optional YFM cut title. Pass empty/null to avoid wrapping.
        width: Optional displayed image width.
        height: Optional displayed image height.
    """
    attachment = _upload_attachment(issue_id, file_path, filename)
    image_markdown = _cut_block(cut_title, _attachment_inline_markdown(attachment, width, height))
    updated_text = f"{current_text.rstrip()}\n\n{image_markdown}".strip()

    url = f"{TRACKER_API_BASE}/issues/{issue_id}/comments/{comment_id}"
    payload = {"text": updated_text, "markupType": "md"}
    with httpx.Client(timeout=120.0) as client:
        response = client.patch(url, headers=_headers(content_type=True), json=payload)
    _raise_for_tracker_error(response)
    return {
        "attachment": attachment,
        "comment": response.json(),
        "inline_markdown": image_markdown,
    }


@mcp.tool()
def issue_get_checklist(issue_id: str) -> list[dict[str, Any]]:
    """Read Yandex Tracker issue checklist items.

    Args:
        issue_id: Issue key, for example INS-3157.
    """
    _check_issue_id(issue_id)
    return _tracker_json_request("GET", f"/issues/{issue_id}/checklistItems")


@mcp.tool()
def issue_add_checklist_item(issue_id: str, text: str, checked: bool = False) -> dict[str, Any]:
    """Add a checklist item to a Yandex Tracker issue.

    Args:
        issue_id: Issue key, for example INS-3157.
        text: Checklist item text.
        checked: Whether the item should be created as checked.
    """
    _check_issue_id(issue_id)
    payload = {"text": text, "checked": checked}
    return _tracker_json_request("POST", f"/issues/{issue_id}/checklistItems", payload)


@mcp.tool()
def issue_update_checklist_item(
    issue_id: str,
    item_id: str,
    text: str | None = None,
    checked: bool | None = None,
) -> dict[str, Any]:
    """Update a Yandex Tracker issue checklist item.

    Args:
        issue_id: Issue key, for example INS-3157.
        item_id: Checklist item id.
        text: Optional replacement text. Leave null to keep current text.
        checked: Optional checked state. Leave null to keep current state.
    """
    _check_issue_id(issue_id)
    payload: dict[str, Any] = {}
    if text is not None:
        payload["text"] = text
    if checked is not None:
        payload["checked"] = checked
    if not payload:
        raise ValueError("At least one of text or checked must be provided")
    return _tracker_json_request("PATCH", f"/issues/{issue_id}/checklistItems/{item_id}", payload)


@mcp.tool()
def issue_delete_checklist_item(issue_id: str, item_id: str) -> dict[str, Any]:
    """Delete a checklist item from a Yandex Tracker issue.

    Args:
        issue_id: Issue key, for example INS-3157.
        item_id: Checklist item id.
    """
    _check_issue_id(issue_id)
    return _tracker_json_request("DELETE", f"/issues/{issue_id}/checklistItems/{item_id}") or {"deleted": True}


if __name__ == "__main__":
    mcp.run()
