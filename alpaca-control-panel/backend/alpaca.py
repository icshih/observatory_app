import os
import httpx
from fastapi import HTTPException

ALPACA_HOST = os.getenv("ALPACA_HOST", "localhost")
ALPACA_PORT = int(os.getenv("ALPACA_PORT", "32323"))
DEVICE_NUMBER = int(os.getenv("DEVICE_NUMBER", "0"))

_BASE = f"http://{ALPACA_HOST}:{ALPACA_PORT}/api/v1/telescope/{DEVICE_NUMBER}"

_client: httpx.AsyncClient | None = None
_transaction_id = 0


class AlpacaError(HTTPException):
    """The Alpaca device answered, but with an error (Alpaca ErrorNumber,
    HTTP 4xx/5xx, or an unparseable body). Returned to API clients as 502."""

    def __init__(self, detail: str, status_code: int = 502):
        super().__init__(status_code=status_code, detail=detail)


class AlpacaUnreachableError(AlpacaError):
    """The Alpaca device could not be reached at all (connection refused,
    DNS failure, timeout). 504 for timeouts, 502 otherwise."""


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


def _http_error(exc: httpx.HTTPError, what: str) -> AlpacaError:
    """Map an httpx error to an AlpacaError with a useful message.

    Alpaca devices return HTTP 400/500 with a plain-text explanation for
    invalid values or driver failures, so include the body when present.
    """
    if isinstance(exc, httpx.TimeoutException):
        return AlpacaUnreachableError(f"Timeout calling {what}", status_code=504)
    if isinstance(exc, httpx.HTTPStatusError):
        body = exc.response.text.strip()
        msg = f"{what}: HTTP {exc.response.status_code}" + (f" \u2013 {body}" if body else "")
        return AlpacaError(msg)
    if isinstance(exc, httpx.TransportError):
        return AlpacaUnreachableError(f"{what}: device unreachable ({exc or type(exc).__name__})")
    return AlpacaError(f"{what}: {exc}")


def _parse_json(r: httpx.Response, what: str) -> dict:
    try:
        data = r.json()
    except ValueError:
        raise AlpacaError(f"{what}: invalid JSON from Alpaca device")
    if not isinstance(data, dict):
        raise AlpacaError(f"{what}: unexpected Alpaca response")
    return data


# Standard ASCOM/Alpaca error numbers. Devices often send only the method
# name as ErrorMessage (e.g. "SlewToCoordinatesAsync" for 1032), so the
# meaning must come from the code.
ASCOM_ERRORS = {
    0x400: "not implemented by this mount",
    0x401: "invalid value",
    0x402: "value not set",
    0x407: "mount not connected",
    0x408: "not allowed while the mount is parked",
    0x409: "not allowed while the mount is slaved",
    0x40B: "invalid operation",
    0x40C: "action not implemented",
    0x40E: "operation cancelled",
}


def _format_alpaca_error(code: int, message: str | None) -> str:
    meaning = ASCOM_ERRORS.get(code)
    if 0x500 <= code <= 0xFFF and not meaning:
        meaning = "driver error"
    message = (message or "").strip()
    if message and meaning:
        return f"{message}: {meaning} (Alpaca error {code})"
    if message:
        return message
    if meaning:
        return f"{meaning[0].upper()}{meaning[1:]} (Alpaca error {code})"
    return f"Alpaca error {code}"


def _check_error(data: dict) -> None:
    code = data.get("ErrorNumber", 0)
    if code != 0:
        raise AlpacaError(_format_alpaca_error(code, data.get("ErrorMessage")))


async def alpaca_get(attribute: str) -> object:
    url = f"{_BASE}/{attribute}"
    try:
        r = await get_client().get(url, params=_common_params())
        r.raise_for_status()
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
    except httpx.HTTPError as exc:
        raise _http_error(exc, action)
    _check_error(_parse_json(r, action))


async def alpaca_get_safe(attribute: str, default=None):
    """Like alpaca_get but returns default on error — used in status batch."""
    try:
        return await alpaca_get(attribute)
    except Exception:
        return default
