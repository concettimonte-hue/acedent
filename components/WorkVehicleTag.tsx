'use client';

interface WorkVehicleTagProps {
  maker: string;
  model?: string;
}

export default function WorkVehicleTag({ maker, model }: WorkVehicleTagProps) {
  const normalizedMaker = maker.trim();
  const normalizedModel = model?.trim();

  if (!normalizedMaker && !normalizedModel) {
    return null;
  }

  return (
    <span className="work-vehicle-tag">
      {normalizedMaker && (
        <span className="work-vehicle-tag-maker">{normalizedMaker}</span>
      )}
      {normalizedModel && (
        <span className="work-vehicle-tag-model">{normalizedModel}</span>
      )}
    </span>
  );
}
