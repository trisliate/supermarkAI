import { useState, useRef } from "react";
import { Camera, Loader2, X } from "lucide-react";

interface AvatarUploadProps {
  user: { name: string; hasAvatar?: boolean; id?: number };
  onUpload: (base64: string) => void;
  onRemove?: () => void;
  isSaving?: boolean;
}

async function compressImage(file: File, maxSize = 256, quality = 0.8): Promise<Blob> {
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

export function AvatarUpload({ user, onUpload, onRemove, isSaving }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const compressed = await compressImage(file);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
      onUpload(result);
    };
    reader.readAsDataURL(compressed);
  };

  const avatarSrc = preview || (user.hasAvatar && user.id ? `/api/avatar?userId=${user.id}` : null);

  return (
    <div className="relative group">
      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-500/20">
        {avatarSrc ? (
          <img src={avatarSrc} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          user.name.charAt(0)
        )}
        {isSaving && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 rounded-2xl transition-colors cursor-pointer"
      >
        <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      {user.hasAvatar && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
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
