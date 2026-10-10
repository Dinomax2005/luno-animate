import { encodeLam } from './lam';
import type { Project } from './types';
export const safeName = (name: string) => name.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 80) || 'Luno animation';
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function saveProject(project: Project): Promise<boolean> {
  const data = encodeLam(project);
  if (window.luno) return window.luno.saveProject(data, safeName(project.name));
  downloadBlob(new Blob([data], { type: 'application/vnd.luno.lam' }), `${safeName(project.name)}.lam`);
  return true;
}
export async function saveExport(blob: Blob, name: string, extension: string): Promise<boolean> {
  if (window.luno) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return window.luno.saveExport(bytes, safeName(name), extension);
  }
  downloadBlob(blob, `${safeName(name)}.${extension}`); return true;
}
export async function imageFromFile(file: File): Promise<{ data: string; width: number; height: number }> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) throw new Error('Please choose a PNG, JPEG, WebP, or SVG image.');
  if (file.size > 15_000_000) throw new Error('Please choose an image smaller than 15 MB.');
  const input = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = input; await img.decode();
    const max = 2048;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } finally { URL.revokeObjectURL(input); }
}
