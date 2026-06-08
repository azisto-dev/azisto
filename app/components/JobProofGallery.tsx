"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { JobProofPhoto } from "@/lib/jobProofPhotos";

type ProofSource = {
  beforePhotos?: JobProofPhoto[];
  afterPhotos?: JobProofPhoto[];
};

export default function JobProofGallery({
  beforePhotos = [],
  afterPhotos = [],
  tasks = [],
}: ProofSource & { tasks?: ProofSource[] }) {
  const [previewPhoto, setPreviewPhoto] = useState<JobProofPhoto | null>(null);
  const allBeforePhotos = [
    ...beforePhotos,
    ...tasks.flatMap((task) => task.beforePhotos ?? []),
  ];
  const allAfterPhotos = [
    ...afterPhotos,
    ...tasks.flatMap((task) => task.afterPhotos ?? []),
  ];

  if (allBeforePhotos.length === 0 && allAfterPhotos.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        {[
          { label: "Before Photos", photos: allBeforePhotos },
          { label: "After Photos", photos: allAfterPhotos },
        ].map(({ label, photos }) =>
          photos.length > 0 ? (
            <section key={label}>
              <p className="text-xs font-bold text-[#0F172A]">{label}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <button
                    key={photo.storagePath}
                    type="button"
                    onClick={() => setPreviewPhoto(photo)}
                    className="overflow-hidden rounded-xl border border-blue-100 bg-slate-50 text-left shadow-sm"
                  >
                    <img
                      src={photo.url}
                      alt={label}
                      className="aspect-square w-full object-cover"
                    />
                    <span className="block truncate px-1.5 py-1 text-[9px] font-bold text-azisto-accent">
                      Verified photo
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null,
        )}
      </div>

      {previewPhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Job photo preview"
        >
          <div className="relative w-full max-w-[520px] overflow-hidden rounded-2xl bg-white p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0F172A] shadow"
              aria-label="Close photo preview"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
            <img
              src={previewPhoto.url}
              alt="Verified job proof"
              className="max-h-[75vh] w-full rounded-xl object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
