"use client";

export const CLIENT_IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const RAW_INPUT_MAX_BYTES = 25 * 1024 * 1024;
const HARD_OUTPUT_MAX_BYTES = 4.8 * 1024 * 1024;
const DEFAULT_TARGET_BYTES = 1.6 * 1024 * 1024;
const DEFAULT_MAX_EDGE = 1600;
const MIN_EDGE = 960;
const QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5];

function replaceExtension(filename: string, extension: string) {
  const basename = filename.replace(/\.[^.]+$/, "") || "stiz-photo";
  return `${basename}.${extension}`;
}

function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽지 못했습니다."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("이미지 압축에 실패했습니다."));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function renderJpegBlob(image: HTMLImageElement, maxEdge: number, quality: number) {
  const ratio = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("이미지 변환을 준비하지 못했습니다.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvasToBlob(canvas, quality);
}

export async function compressImageForUpload(
  file: File,
  options?: {
    maxEdge?: number;
    targetBytes?: number;
  },
) {
  if (!CLIENT_IMAGE_ALLOWED_TYPES.includes(file.type)) {
    throw new Error("이미지 파일만 올릴 수 있어요. JPG, PNG, WebP, GIF를 지원합니다.");
  }

  if (file.size > RAW_INPUT_MAX_BYTES) {
    throw new Error("원본 사진이 너무 큽니다. 25MB 이하 사진을 선택해주세요.");
  }

  if (file.type === "image/gif") {
    if (file.size > HARD_OUTPUT_MAX_BYTES) {
      throw new Error("GIF는 압축하지 않고 보존합니다. 5MB 이하 GIF만 올릴 수 있어요.");
    }
    return file;
  }

  const image = await loadImage(file);
  const targetBytes = options?.targetBytes ?? DEFAULT_TARGET_BYTES;
  const requestedMaxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;
  const maxEdges = Array.from(
    new Set([requestedMaxEdge, 1440, 1280, 1080, MIN_EDGE].filter((edge) => edge <= requestedMaxEdge)),
  );

  let smallest: Blob | null = null;

  for (const edge of maxEdges) {
    for (const quality of QUALITY_STEPS) {
      const blob = await renderJpegBlob(image, edge, quality);
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= targetBytes) {
        return new File([blob], replaceExtension(file.name, "jpg"), {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }
    }
  }

  if (!smallest) {
    throw new Error("이미지를 압축하지 못했습니다.");
  }

  if (smallest.size > HARD_OUTPUT_MAX_BYTES) {
    throw new Error("압축 후에도 사진이 너무 큽니다. 더 작은 사진을 선택해주세요.");
  }

  return new File([smallest], replaceExtension(file.name, "jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
