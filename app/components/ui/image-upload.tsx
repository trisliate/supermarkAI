import { useState, useRef } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

interface ImageUploadProps {
  /** Existing image URL (e.g. /api/product-image?productId=1) */
  existingImageUrl?: string | null;
  /** Callback with base64 data URL of compressed image */
  onUpload: (base64: string) => void;
  /** Callback to remove image */
  onRemove?: () => void;
  /** Whether a save operation is in progress */
  isSaving?: boolean;
  /** Max image dimension in pixels */
  maxSize?: number;
  /** Compression quality 0-1 */
  quality?: number;
  /** Display size class for the container */
  size?: "sm" | "md" | "lg";
  /** Placeholder text */
  placeholder?: string;
}

async function compressImage(file: File, maxSize: number, quality: number): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise((resolve) => { img.onload = resolve; img.src = url; });
  URL.revokeObjectURL(url);

  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", quality));
}

const sizeClasses = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
};

export function ImageUpload({
  existingImageUrl,
  onUpload,
  onRemove,
  isSaving,
  maxSize = 512,
  quality = 0.8,
  size = "md",
  placeholder = "上传图片",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const compressed = await compressImage(file, maxSize, quality);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
      onUpload(result);
    };
    reader.readAsDataURL(compressed);
  };

  const imageSrc = preview || existingImageUrl;

  return (
    <div className="relative group">
      <div
        className={`${sizeClasses[size]} rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center transition-colors hover:border-primary/50 cursor-pointer`}
        onClick={() => inputRef.current?.click()}
      >
        {imageSrc ? (
          <img src={imageSrc} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400">
            <ImagePlus className="w-5 h-5" />
            <span className="text-[10px]">{placeholder}</span>
          </div>
        )}
        {isSaving && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
      </div>
      {imageSrc && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setPreview(null); onRemove?.(); }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
