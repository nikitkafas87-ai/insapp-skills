#!/usr/bin/env python3
"""Replay an extracted Public API flow with a fresh ApplicationId."""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


def decode_body(item: dict[str, Any]) -> dict[str, Any]:
    raw = base64.b64decode(item["requestBodyBase64Utf16Le"], validate=True)
    return json.loads(raw.decode("utf-16le"))


def replace_application_id(value: Any, old_id: str, new_id: str) -> Any:
    if isinstance(value, str):
        return new_id if value.lower() == old_id.lower() else value
    if isinstance(value, list):
        return [replace_application_id(item, old_id, new_id) for item in value]
    if isinstance(value, dict):
        return {key: replace_application_id(item, old_id, new_id) for key, item in value.items()}
    return value


def parse_ru_date(value: str) -> dt.date | None:
    try:
        return dt.datetime.strptime(value, "%d.%m.%Y").date()
    except (TypeError, ValueError):
        return None


def ensure_future_policy_start(body: dict[str, Any], min_date: dt.date) -> str | None:
    policy = body.get("policyParameters")
    if not isinstance(policy, dict):
        return None
    current = parse_ru_date(policy.get("policyStartDate"))
    if current is None or current < min_date:
        new_value = min_date.strftime("%d.%m.%Y")
        policy["policyStartDate"] = new_value
        return new_value
    return None


def call_api(api_base: str, source_url: str, body: dict[str, Any], timeout: int) -> tuple[int, str, dict[str, Any] | None]:
    source_path = urllib.parse.urlparse(source_url).path
    url = api_base.rstrip("/") + source_path
    payload = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"content-type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            text = response.read().decode("utf-8", errors="replace")
            status = response.status
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        status = exc.code

    parsed = None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        pass
    return status, text, parsed


def json_result_ok(parsed: dict[str, Any] | None) -> bool:
    if not isinstance(parsed, dict):
        return False
    result = parsed.get("result")
    if isinstance(result, bool):
        return result
    value = parsed.get("value")
    if isinstance(value, dict) and value.get("applicationId"):
        return True
    return False


def compact_error(parsed: dict[str, Any] | None, text: str) -> str | None:
    if isinstance(parsed, dict):
        errors = parsed.get("errors")
        if errors:
            return json.dumps(errors, ensure_ascii=False)[:500]
        message = parsed.get("message") or parsed.get("error") or parsed.get("errorMessage")
        if message:
            return str(message)[:500]
    return text[:500] if text else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--flow", required=True)
    parser.add_argument("--api-base", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--allow-optional-transition-failure", action="store_true")
    args = parser.parse_args()

    flow_path = Path(args.flow)
    extracted = json.loads(flow_path.read_text(encoding="utf-8"))
    source_application_id = extracted["sourceApplicationId"]
    min_policy_date = dt.date.today() + dt.timedelta(days=1)

    new_application_id: str | None = None
    steps: list[dict[str, Any]] = []

    for item in sorted(extracted["flow"], key=lambda row: int(row["order"])):
        method = item["method"]
        body = decode_body(item)
        if new_application_id:
            body = replace_application_id(body, source_application_id, new_application_id)
            changed_policy_start = ensure_future_policy_start(body, min_policy_date)
        else:
            changed_policy_start = None

        status, text, parsed = call_api(args.api_base, item["url"], body, args.timeout)

        if method.lower() == "new" and isinstance(parsed, dict):
            value = parsed.get("value")
            if isinstance(value, dict) and value.get("applicationId"):
                new_application_id = value["applicationId"]

        ok = json_result_ok(parsed)
        optional_transition_failed = (
            method.lower() == "setstatuswidgetdisplayed"
            and args.allow_optional_transition_failure
            and not ok
        )

        step = {
            "order": item["order"],
            "method": method,
            "statusCode": status,
            "ok": ok,
            "optionalTransitionFailed": optional_transition_failed,
            "changedPolicyStartDate": changed_policy_start,
            "newApplicationId": new_application_id,
            "error": None if ok else compact_error(parsed, text),
        }
        steps.append(step)

        if method.lower() == "new" and not new_application_id:
            break
        if not ok and not optional_transition_failed:
            break

    output = {
        "sourceApplicationId": source_application_id,
        "apiBase": args.api_base,
        "newApplicationId": new_application_id,
        "replayedAtUtc": dt.datetime.now(dt.UTC).isoformat(),
        "steps": steps,
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"newApplicationId={new_application_id}")
    for step in steps:
        status_text = "ok" if step["ok"] else "optional-failed" if step["optionalTransitionFailed"] else "failed"
        print(f"order={step['order']} method={step['method']} status={step['statusCode']} result={status_text}")
        if step["error"] and not step["optionalTransitionFailed"]:
            print(f"error={step['error']}")
    print(f"output={output_path}")

    if not steps or not steps[-1]["ok"]:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
