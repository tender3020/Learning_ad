import { useState } from "react";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  name?: string | null;
  avatar?: string | null;
  className?: string;
  textClassName?: string;
};

/** 有头像显示照片，没有则用昵称首字 */
export default function UserAvatar({ name, avatar, className, textClassName }: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  const letter = (name?.[0] || "U").toUpperCase();
  const showImage = !!avatar && !broken;

  return (
    <div
      className={cn(
        "rounded-full overflow-hidden flex items-center justify-center flex-shrink-0",
        !showImage && "bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-secondary)]",
        className,
      )}
    >
      {showImage ? (
        <img
          src={avatar}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className={cn("font-semibold text-[var(--brand-foreground)]", textClassName)}>
          {letter}
        </span>
      )}
    </div>
  );
}

/** 把用户选择的图片压成适合上传的 JPEG（最长边 512） */
export function readImageAsJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("请选择图片文件"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("图片不能超过 8MB"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 512;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("无法处理图片"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败"));
    };
    img.src = url;
  });
}
