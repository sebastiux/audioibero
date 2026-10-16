"use client";

import { useEffect, useState } from "react";

/** true sólo en el navegador después del primer render (para lo que depende de la hora o del DOM). */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
