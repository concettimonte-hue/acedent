'use client';

import { useState } from 'react';
import { getVehicleBrandLogo, getVehicleBrandLogoClassName, type VehicleBrand } from '@/lib/vehicle-brands';

/** Decorative only: the adjacent brand text is always the accessible label. */
export default function VehicleBrandLogo({ brand }: { brand?: VehicleBrand }) {
  const logo = getVehicleBrandLogo(brand);
  const [failedSrc, setFailedSrc] = useState('');
  if (!logo || failedSrc === logo.src) return null;
  return <img className={getVehicleBrandLogoClassName(logo)} src={logo.src} alt="" aria-hidden="true"
    width={logo.width ?? 20} height={20} decoding="async" onError={() => setFailedSrc(logo.src)} />;
}
