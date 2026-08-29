"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@torup/ui";
import { createClient } from "@/lib/supabase-browser";

const MAX_BYTES = 5 * 1024 * 1024;

export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  businessId,
  fileKey,
  shape = "circle",
  uploadLabel = "Upload",
  changeLabel = "Change",
  removeLabel = "Remove",
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  businessId: string;
  /** Path segment under the business's storage folder, e.g. "logo" or "banner" */
  fileKey: string;
  shape?: "circle" | "wide";
  uploadLabel?: string;
  changeLabel?: string;
  removeLabel?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${businessId}/${fileKey}.${ext}`;
      const { error } = await supabase.storage
        .from("business-assets")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("business-assets").getPublicUrl(path);
      // Cache-bust: the path is stable across re-uploads, so append a version param.
      onChange(`${data.publicUrl}?t=${Date.now()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-4">
        <div
          className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted ${
            shape === "circle" ? "h-20 w-20 rounded-full" : "h-20 w-36 rounded-lg"
          }`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {value ? changeLabel : uploadLabel}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={uploading}>
              <X className="h-3.5 w-3.5 me-1" />
              {removeLabel}
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
