export async function processImage(serverUrl, asset, tool, params = {}) {
  const endpoint = `${serverUrl.replace(/\/$/, '')}/v1/process`;
  const form = new FormData();
  form.append('tool', tool);
  form.append('params_json', JSON.stringify(params));
  form.append('image', {
    uri: asset.uri,
    type: asset.mimeType || 'image/jpeg',
    name: asset.fileName || `photo-${Date.now()}.jpg`
  });

  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  const blob = await res.blob();
  return blob;
}
