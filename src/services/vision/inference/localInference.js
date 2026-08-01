/* Model-agnostic on-device inference helpers — pure and dependency-free.

   These do everything an on-device classifier needs EXCEPT run the model:
     preprocessImage  base64 image -> normalized Float32 tensor (NCHW or NHWC)
     softmax          raw logits   -> probabilities
     topK             probabilities -> ranked { label, prob }

   The model runtime itself (ONNX Runtime Web / TF.js / WASM) is supplied by the
   caller via localProvider.registerModel — see localProvider.js. Keeping the
   runtime out of here means no heavy dependency ships until a model actually exists. */

export async function loadImage(base64) {
  const src = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
  const img = new Image();
  img.src = src;
  if (img.decode) { await img.decode(); }
  else { await new Promise((res, rej) => { img.onload = res; img.onerror = rej; }); }
  return img;
}

/* Resize to inputSize² and normalize to the mean/std the model was trained with.
   layout "nchw" → [1,3,H,W] (PyTorch/ONNX default); "nhwc" → [1,H,W,3] (TF). */
export async function preprocessImage(base64, {
  inputSize = 224,
  mean      = [0.485, 0.456, 0.406],
  std       = [0.229, 0.224, 0.225],
  layout    = "nchw",
} = {}) {
  const img = await loadImage(base64);

  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(inputSize, inputSize)
    : Object.assign(document.createElement("canvas"), { width: inputSize, height: inputSize });
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, inputSize, inputSize);
  const { data } = ctx.getImageData(0, 0, inputSize, inputSize); // RGBA bytes 0..255

  const n = inputSize * inputSize;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    const r = (data[i * 4]     / 255 - mean[0]) / std[0];
    const g = (data[i * 4 + 1] / 255 - mean[1]) / std[1];
    const b = (data[i * 4 + 2] / 255 - mean[2]) / std[2];
    if (layout === "nchw") { out[i] = r; out[n + i] = g; out[2 * n + i] = b; }
    else                   { out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b; }
  }

  const dims = layout === "nchw" ? [1, 3, inputSize, inputSize] : [1, inputSize, inputSize, 3];
  return { tensor: out, dims };
}

export function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

export function topK(probs, labels, k = 3) {
  return probs
    .map((p, i) => ({ label: labels[i] ?? `class_${i}`, prob: p }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, k);
}
