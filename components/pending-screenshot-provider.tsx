"use client";

import { createContext, useContext, useState, type Dispatch, type SetStateAction } from "react";

export type PendingScreenshot = {
  path: string;
  preview: string;
  fileName: string;
};

const emptyScreenshot: PendingScreenshot = { path: "", preview: "", fileName: "" };

type PendingScreenshotContextValue = {
  screenshot: PendingScreenshot;
  setScreenshot: Dispatch<SetStateAction<PendingScreenshot>>;
  clearScreenshot: () => void;
};

const PendingScreenshotContext = createContext<PendingScreenshotContextValue | null>(null);

export function PendingScreenshotProvider({ children }: { children: React.ReactNode }) {
  const [screenshot, setScreenshot] = useState<PendingScreenshot>(emptyScreenshot);

  return (
    <PendingScreenshotContext.Provider value={{ screenshot, setScreenshot, clearScreenshot: () => setScreenshot(emptyScreenshot) }}>
      {children}
    </PendingScreenshotContext.Provider>
  );
}

export function usePendingScreenshot() {
  const value = useContext(PendingScreenshotContext);
  if (!value) throw new Error("usePendingScreenshot muss innerhalb des PendingScreenshotProvider verwendet werden.");
  return value;
}
