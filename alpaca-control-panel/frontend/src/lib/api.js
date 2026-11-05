// POST to a backend command endpoint. Resolves to the parsed JSON body on
// success; throws an Error carrying the backend's `detail` message otherwise
// (FastAPI/HTTPException format), so callers can surface Alpaca failures.
export async function apiPost(path, body) {
  let res;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`Network error: ${err.message}`);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body; fall through
  }

  if (!res.ok) {
    let detail = data?.detail;
    // Pydantic validation errors come back as a list of objects.
    if (Array.isArray(detail)) detail = detail.map((d) => d.msg).join("; ");
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return data;
}
