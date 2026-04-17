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


def _check_error(data: dict) -> None:
    code = data.get("ErrorNumber", 0)
    if code != 0:
        msg = data.get("ErrorMessage", f"Alpaca error {code}")
        raise HTTPException(status_code=502, detail=msg)


async def alpaca_get(attribute: str) -> object:
    url = f"{_BASE}/{attribute}"
    try:
        r = await get_client().get(url, params=_common_params())
        r.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail=f"Timeout fetching {attribute}")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    data = r.json()
    _check_error(data)
    return data["Value"]


async def alpaca_put(action: str, **params) -> None:
    url = f"{_BASE}/{action}"
    body = {**_common_params(), **{k: v for k, v in params.items()}}
    try:
        r = await get_client().put(url, data=body)
        r.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail=f"Timeout calling {action}")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    _check_error(r.json())


async def alpaca_get_safe(attribute: str, default=None):
    """Like alpaca_get but returns default on error — used in status batch."""
    try:
        return await alpaca_get(attribute)
    except Exception:
        return default
