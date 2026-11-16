'use client';

import { useCallback, useState } from 'react';
import { getVehicleBrandLogo, getVehicleBrandLogoClassName, type VehicleBrand } from '@/lib/vehicle-brands';

/** Decorative only: the adjacent brand text is always the accessible label. */
export default function VehicleBrandLogo({ brand }: { brand?: VehicleBrand }) {
  const logo = getVehicleBrandLogo(brand);
  const [failedSrc, setFailedSrc] = useState('');
  const checkLoadedLogo = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && !image.naturalWidth && logo) setFailedSrc(logo.src);
  }, [logo]);
  if (!logo || failedSrc === logo.src) return null;
  return <img ref={checkLoadedLogo} className={getVehicleBrandLogoClassName(logo)} src={logo.src} alt="" aria-hidden="true"
    width={logo.width ?? 20} height={20} decoding="async" onError={() => setFailedSrc(logo.src)} />;
}
