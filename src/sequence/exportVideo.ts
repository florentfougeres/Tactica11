// Export of a sequence, rendered frame by frame from the very same SVG stage
// the editor shows: static markup → <img> → canvas → encoder. Deterministic
// (no real-time capture), so the file is smooth whatever the machine speed.
import { createElement } from "react";
import type { Sequence } from "./types";
import type { ActorInfo, SeqLook } from "./SequenceStage";
import SequenceStage from "./SequenceStage";
import { frameAt, totalDuration } from "./engine";
import { frameLayout } from "./layout";
import { saveFile } from "../download";

export class ExportCancelled extends Error {}
export class ExportUnsupported extends Error {}

export const canExportVideo = () =>
  typeof window !== "undefined" && "VideoEncoder" in window;

function safeName(name: string): string {
  return name.trim().replace(/[^\p{L}\p{N}_-]+/gu, "_") || "sequence";
}


interface RenderOpts {
  seq: Sequence;
  info: Record<string, ActorInfo>;
  background: "normal" | "chroma";
  look: SeqLook;
  scale: number;
}

async function makeRenderer({ seq, info, background, look, scale }: RenderOpts) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const L = frameLayout(seq);
  // Encoders want even dimensions.
  const W = Math.round((L.W * scale) / 2) * 2;
  const H = Math.round((L.H * scale) / 2) * 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const draw = async (t: number) => {
    const frame = frameAt(seq, t);
    const markup = renderToStaticMarkup(
      createElement(SequenceStage, {
        seq,
        frame,
        layout: L,
        info,
        background,
        look,
        idPrefix: "x",
        pixelSize: { w: W, h: H },
      }),
    );
    const blob = new Blob([markup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  return { canvas, draw, W, H };
}

export async function exportStepPng(opts: RenderOpts & { time: number; suffix: string }) {
  const { canvas, draw } = await makeRenderer(opts);
  await draw(opts.time);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("PNG");
  await saveFile(blob, `${safeName(opts.seq.name)}-${safeName(opts.suffix)}.png`);
}

export async function exportVideo(
  opts: RenderOpts & {
    fps: number;
    onProgress: (p: number) => void;
    signal: AbortSignal;
  },
): Promise<boolean> {
  const mb = await import("mediabunny");
  const { canvas, draw, W, H } = await makeRenderer(opts);

  const codec = await mb.getFirstEncodableVideoCodec(["avc", "vp9", "av1"], {
    width: W,
    height: H,
  });
  if (!codec) throw new ExportUnsupported();

  const output = new mb.Output({
    format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new mb.BufferTarget(),
  });
  const source = new mb.CanvasSource(canvas, {
    codec,
    bitrate: mb.QUALITY_HIGH,
  });
  output.addVideoTrack(source, { frameRate: opts.fps });
  await output.start();

  const duration = totalDuration(opts.seq.steps);
  const frames = Math.max(1, Math.round((duration / 1000) * opts.fps)) + 1;
  try {
    for (let i = 0; i < frames; i++) {
      if (opts.signal.aborted) throw new ExportCancelled();
      await draw((i * 1000) / opts.fps);
      await source.add(i / opts.fps, 1 / opts.fps);
      opts.onProgress((i + 1) / frames);
    }
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  }
  const buf = (output.target as InstanceType<typeof mb.BufferTarget>).buffer;
  if (!buf) throw new Error("Export vide");
  return saveFile(new Blob([buf], { type: "video/mp4" }), `${safeName(opts.seq.name)}.mp4`);
}
