import os
import asyncio
import httpx
from fastapi import HTTPException

ALPACA_HOST = os.getenv("ALPACA_HOST", "localhost")
ALPACA_PORT = int(os.getenv("ALPACA_PORT", "32323"))
DEVICE_NUMBER = int(os.getenv("DEVICE_NUMBER", "0"))

_BASE = f"http://{ALPACA_HOST}:{ALPACA_PORT}/api/v1/telescope/{DEVICE_NUMBER}"

_client: httpx.AsyncClient | None = None
_transaction_id = 0


def get_client() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("httpx client not initialised")
    return _client


def create_client() -> httpx.AsyncClient:
    global _client
    _client = httpx.AsyncClient(timeout=5.0)
    return _client


async def close_client() -> None:
    global _client
    if _client:
        await _client.aclose()
        _client = None


def _next_txid() -> int:
    global _transaction_id
    _transaction_id += 1
    return _transaction_id


def _common_params() -> dict:
    return {"ClientID": 1, "ClientTransactionID": _next_txid()}


def _http_error(exc: httpx.HTTPError, what: str) -> HTTPException:
    """Map an httpx error to an HTTPException with a useful message.

    Alpaca devices return HTTP 400/500 with a plain-text explanation for
    invalid values or driver failures, so include the body when present.
    """
    if isinstance(exc, httpx.HTTPStatusError):
        body = exc.response.text.strip()
        msg = f"{what}: HTTP {exc.response.status_code}" + (f" \u2013 {body}" if body else "")
        return HTTPException(status_code=502, detail=msg)
    return HTTPException(status_code=502, detail=f"{what}: {exc}")


def _parse_json(r: httpx.Response, what: str) -> dict:
    try:
        data = r.json()
    except ValueError:
        raise HTTPException(status_code=502, detail=f"{what}: invalid JSON from Alpaca device")
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail=f"{what}: unexpected Alpaca response")
    return data


def _check_error(data: dict) -> None:
    code = data.get("ErrorNumber", 0)
    if code != 0:
        # Devices may send ErrorMessage: "" — fall back to the code then.
        msg = data.get("ErrorMessage") or f"Alpaca error {code}"
        raise HTTPException(status_code=502, detail=msg)


async def alpaca_get(attribute: str) -> object:
    url = f"{_BASE}/{attribute}"
    try:
        r = await get_client().get(url, params=_common_params())
        r.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail=f"Timeout fetching {attribute}")
    except httpx.HTTPError as exc:
        raise _http_error(exc, attribute)
    data = _parse_json(r, attribute)
    _check_error(data)
    return data.get("Value")


async def alpaca_put(action: str, **params) -> None:
    url = f"{_BASE}/{action}"
    body = {**_common_params(), **params}
    try:
        r = await get_client().put(url, data=body)
        r.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail=f"Timeout calling {action}")
    except httpx.HTTPError as exc:
        raise _http_error(exc, action)
    _check_error(_parse_json(r, action))


async def alpaca_get_safe(attribute: str, default=None):
    """Like alpaca_get but returns default on error — used in status batch."""
    try:
        return await alpaca_get(attribute)
    except Exception:
        return default
