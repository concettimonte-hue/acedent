'use client';

import VehicleBrandLogo from '@/components/VehicleBrandLogo';
import { findVehicleBrand } from '@/lib/vehicle-brands';

interface WorkVehicleTagProps {
  maker: string;
  model?: string;
  showLogo?: boolean;
}

export default function WorkVehicleTag({ maker, model, showLogo = false }: WorkVehicleTagProps) {
  const normalizedMaker = maker.trim();
  const normalizedModel = model?.trim();

  if (!normalizedMaker && !normalizedModel) {
    return null;
  }

  return (
    <span className="work-vehicle-tag">
      {normalizedMaker && (
        <span className="work-vehicle-tag-maker">{showLogo && <VehicleBrandLogo brand={findVehicleBrand(maker)} />}{normalizedMaker}</span>
      )}
      {normalizedModel && (
        <span className="work-vehicle-tag-model">{normalizedModel}</span>
      )}
    </span>
  );
}
