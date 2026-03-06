import { useState, useEffect } from 'react';

/**
 * ErEnesAl® v1 - Performans Hook'u
 * Verilen değerin belirlenen süre boyunca değişmemesini bekler.
 * Gereksiz API çağrılarını ve render işlemlerini minimize eder.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Belirlenen delay süresi kadar bekle
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Eğer value değişirse (kullanıcı yazmaya devam ederse) önceki timer'ı temizle
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}