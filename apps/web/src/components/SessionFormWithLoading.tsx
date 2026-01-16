"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent } from "react";

export default function SessionFormWithLoading({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData(form);
    const params = new URLSearchParams();

    const sessionModeInputs = form.querySelectorAll('input[name="sessionMode"]') as NodeListOf<HTMLInputElement>;
    const selectedMode = Array.from(sessionModeInputs).find(input => input.checked)?.value || "single";

    formData.forEach((value, key) => {
      if (value && value !== "false" && key !== "sessionMode") {
        params.append(key, value.toString());
      }
    });

    if (selectedMode === "series") {
      params.append("series", "true");
      const numberOfSessions = formData.get("numberOfSessions") || "3";
      params.append("numberOfSessions", numberOfSessions.toString());
    } else {
      params.append("series", "false");
    }

    router.push(`/demo/session?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} method="GET">
      {children}
    </form>
  );
}

