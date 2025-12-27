"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, FormEvent } from "react";
import GeneratingAnimation from "./GeneratingAnimation";

export default function SessionFormWithLoading({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGenerating(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const params = new URLSearchParams();

    // Build query params from form
    formData.forEach((value, key) => {
      if (value && value !== "false") {
        params.append(key, value.toString());
      }
    });

    // Navigate to the new URL with params
    router.push(`/demo/session?${params.toString()}`);
    
    // The loading state will persist until the page reloads
    // If navigation fails, reset after a timeout
    setTimeout(() => {
      setIsGenerating(false);
    }, 180000); // 3 minute timeout for sessions (longer than drills)
  };

  return (
    <>
      {isGenerating && <GeneratingAnimation />}
      <form onSubmit={handleSubmit} method="GET">
        {children}
      </form>
    </>
  );
}

