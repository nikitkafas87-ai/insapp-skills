#!/usr/bin/env python3
"""Extract replay-ready PublicApiLogs request bodies through the Insapp DB MCP.

The script avoids copying large request bodies through the chat/UI. It calls the
remote MCP directly, asks SQL Server to return UTF-16LE base64 in bounded chunks,
reassembles the chunks locally, and validates the decoded JSON bodies.
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


DEFAULT_ENDPOINT = "https://db-mcp.insapp.pro/mcp"
DEFAULT_PROTOCOL_VERSION = "2025-06-18"
CHUNK_SIZE = 30000


def parse_sse_or_json(payload: bytes) -> dict[str, Any]:
    text = payload.decode("utf-8-sig")
    if text.lstrip().startswith("{"):
        return json.loads(text)

    data_lines: list[str] = []
    for line in text.splitlines():
        if line.startswith("data:"):
            data_lines.append(line[5:].strip())
    if not data_lines:
        raise ValueError("MCP response did not contain JSON or SSE data")
    return json.loads("\n".join(data_lines))


class McpClient:
    def __init__(self, endpoint: str, api_key: str) -> None:
        self.endpoint = endpoint
        self.api_key = api_key
        self.session_id: str | None = None
        self.next_id = 1

    def _headers(self) -> dict[str, str]:
        headers = {
            "x-api-key": self.api_key,
            "content-type": "application/json",
            "accept": "application/json, text/event-stream",
        }
        if self.session_id:
            headers["mcp-session-id"] = self.session_id
        return headers

    def _post(self, body: dict[str, Any], timeout: int = 120) -> dict[str, Any] | None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            self.endpoint,
            data=data,
            headers=self._headers(),
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                session = response.headers.get("mcp-session-id")
                if session:
                    self.session_id = session
                payload = response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"MCP HTTP {exc.code}: {detail}") from exc

        if not payload:
            return None
        parsed = parse_sse_or_json(payload)
        if "error" in parsed:
            raise RuntimeError(f"MCP error: {parsed['error']}")
        return parsed

    def initialize(self) -> None:
        request_id = self.next_id
        self.next_id += 1
        self._post(
            {
                "jsonrpc": "2.0",
                "id": request_id,
                "method": "initialize",
                "params": {
                    "protocolVersion": DEFAULT_PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": {
                        "name": "pool-reinsurance-public-api-flow-extractor",
                        "version": "1.0.0",
                    },
                },
            },
            timeout=30,
        )
        self._post(
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {},
            },
            timeout=30,
        )

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        request_id = self.next_id
        self.next_id += 1
        response = self._post(
            {
                "jsonrpc": "2.0",
                "id": request_id,
                "method": "tools/call",
                "params": {
                    "name": name,
                    "arguments": arguments,
                },
            }
        )
        if response is None:
            raise RuntimeError(f"MCP tool {name} returned an empty response")

        result = response.get("result", {})
        if result.get("isError"):
            raise RuntimeError(f"MCP tool {name} failed: {result}")
        content = result.get("content") or []
        if not content or content[0].get("type") != "text":
            raise RuntimeError(f"MCP tool {name} returned unexpected content: {result}")
        text = content[0].get("text", "")
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"MCP tool {name} text is not JSON") from exc


def build_extract_sql(application_id: str, from_date: str, chunk_size: int) -> str:
    return f"""
WITH FlowRows AS (
    SELECT
        ROW_NUMBER() OVER (ORDER BY [Date], Url) AS FlowOrder,
        Id,
        ApplicationId,
        [Date],
        ApiKeyId,
        Url,
        ResponseCode,
        LEN(RequestBody) AS RequestBodyChars,
        CAST(N'' AS XML).value(
            'xs:base64Binary(sql:column("BodyBytes"))',
            'varchar(max)'
        ) AS RequestBodyBase64Utf16Le
    FROM (
        SELECT
            Id,
            ApplicationId,
            [Date],
            ApiKeyId,
            Url,
            ResponseCode,
            RequestBody,
            CONVERT(varbinary(max), RequestBody) AS BodyBytes
        FROM PublicApiLogs
        WHERE ApplicationId = '{application_id}'
          AND [Date] >= '{from_date}'
          AND (
              Url LIKE N'%/app/new%'
              OR Url LIKE N'%/app/SetStatusWidgetDisplayed%'
              OR Url LIKE N'%/app/SendOsagoApplication%'
              OR Url LIKE N'%/app/SendToInsurers%'
          )
    ) src
), Nums AS (
    SELECT TOP (1000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS ChunkIndex
    FROM sys.all_objects
)
SELECT TOP 1000
    f.FlowOrder,
    CONVERT(nvarchar(36), f.Id) AS Id,
    CONVERT(nvarchar(36), f.ApplicationId) AS ApplicationId,
    CONVERT(nvarchar(40), f.[Date], 127) AS [Date],
    CONVERT(nvarchar(36), f.ApiKeyId) AS ApiKeyId,
    f.Url,
    f.ResponseCode,
    f.RequestBodyChars,
    LEN(f.RequestBodyBase64Utf16Le) AS RequestBodyBase64Length,
    n.ChunkIndex,
    SUBSTRING(f.RequestBodyBase64Utf16Le, ((n.ChunkIndex - 1) * {chunk_size}) + 1, {chunk_size}) AS RequestBodyBase64Chunk
FROM FlowRows f
JOIN Nums n ON n.ChunkIndex <= CEILING(LEN(f.RequestBodyBase64Utf16Le) / {chunk_size}.0)
ORDER BY f.FlowOrder, n.ChunkIndex;
""".strip()


def flow_method(url: str) -> str:
    tail = url.rstrip("/").split("/")[-1]
    return tail or url


def has_key_ci(body: dict[str, Any], key: str) -> bool:
    wanted = key.lower()
    return any(existing.lower() == wanted for existing in body)


def validate_json_body(method: str, body: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(body, dict):
        return ["decoded body is not a JSON object"]

    common = ["apiKey"]
    for key in common:
        if not has_key_ci(body, key):
            errors.append(f"missing {key}")

    lower_method = method.lower()
    if lower_method == "new":
        for key in ["productType", "channelType"]:
            if not has_key_ci(body, key):
                errors.append(f"missing {key}")
    elif lower_method == "sendosagoapplication":
        for key in ["applicationId", "carData", "owner", "drivers", "policyParameters"]:
            if not has_key_ci(body, key):
                errors.append(f"missing {key}")
        policy = body.get("policyParameters")
        if not isinstance(policy, dict) or not policy.get("policyStartDate"):
            errors.append("missing policyParameters.policyStartDate")
    elif lower_method == "sendtoinsurers":
        if not has_key_ci(body, "applicationId"):
            errors.append("missing applicationId")
    elif lower_method == "setstatuswidgetdisplayed":
        if not has_key_ci(body, "applicationId"):
            errors.append("missing applicationId")
    return errors


def reassemble_flow(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(int(row["FlowOrder"]), []).append(row)

    flow: list[dict[str, Any]] = []
    for order in sorted(grouped):
        chunks = sorted(grouped[order], key=lambda item: int(item["ChunkIndex"]))
        first = chunks[0]
        body_base64 = "".join(chunk["RequestBodyBase64Chunk"] or "" for chunk in chunks)
        expected_base64_len = int(first["RequestBodyBase64Length"])
        if len(body_base64) != expected_base64_len:
            raise ValueError(
                f"FlowOrder {order}: base64 length mismatch {len(body_base64)} != {expected_base64_len}"
            )

        body_bytes = base64.b64decode(body_base64, validate=True)
        body_text = body_bytes.decode("utf-16le")
        body_sha256 = hashlib.sha256(body_text.encode("utf-8")).hexdigest()
        body_json = json.loads(body_text)
        method = flow_method(first["Url"])
        validation_errors = validate_json_body(method, body_json)
        if validation_errors:
            raise ValueError(f"FlowOrder {order} ({method}) failed validation: {validation_errors}")

        flow.append(
            {
                "order": order,
                "logId": first["Id"],
                "date": first["Date"],
                "applicationId": first["ApplicationId"],
                "apiKeyId": first["ApiKeyId"],
                "url": first["Url"],
                "method": method,
                "responseCode": first["ResponseCode"],
                "requestBodyChars": int(first["RequestBodyChars"]),
                "requestBodyBase64Utf16Le": body_base64,
                "requestBodySha256": body_sha256,
                "jsonTopLevelKeys": sorted(body_json.keys()),
            }
        )
    return flow


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    parser.add_argument("--application-id", required=True)
    parser.add_argument("--from-date", default="2026-05-15T00:00:00+03:00")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    parser.add_argument("--output", required=True)
    parser.add_argument("--query-plan", action="store_true")
    args = parser.parse_args()

    api_key = os.environ.get("INSAPP_DB_MCP_API_KEY")
    if not api_key:
        raise SystemExit("INSAPP_DB_MCP_API_KEY is not set")

    sql = build_extract_sql(args.application_id, args.from_date, CHUNK_SIZE)
    client = McpClient(args.endpoint, api_key)
    client.initialize()

    if args.query_plan:
        plan = client.call_tool("query_plan", {"database": args.database, "sql": sql})
        if not plan.get("success"):
            raise SystemExit(f"query_plan failed: {plan}")

    result = client.call_tool(
        "query",
        {
            "database": args.database,
            "query_description": "Извлечь PublicApiLogs flow кусками base64 без ручного копирования",
            "user_prompt": "решить проблему безопасного извлечения тела анкеты из PublicApiLogs",
            "sql": sql,
        },
    )
    if not result.get("success"):
        raise SystemExit(f"query failed: {result}")

    rows = result.get("rows") or []
    if not rows:
        raise SystemExit(f"No PublicApiLogs flow rows found for {args.application_id}")

    flow = reassemble_flow(rows)
    output = {
        "database": args.database,
        "sourceApplicationId": args.application_id,
        "fromDate": args.from_date,
        "extractedAtUtc": dt.datetime.now(dt.UTC).isoformat(),
        "transport": "mcp-http-query-chunked-base64",
        "chunkSize": CHUNK_SIZE,
        "flow": flow,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"extracted_flow={len(flow)}")
    for item in flow:
        print(
            " ".join(
                [
                    f"order={item['order']}",
                    f"method={item['method']}",
                    f"chars={item['requestBodyChars']}",
                    f"sha256={item['requestBodySha256']}",
                ]
            )
        )
    print(f"output={output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
