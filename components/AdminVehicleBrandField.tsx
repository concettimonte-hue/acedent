'use client';

import { useId, useState } from 'react';
import VehicleBrandLogo from '@/components/VehicleBrandLogo';
import { findVehicleBrand, VEHICLE_BRANDS } from '@/lib/vehicle-brands';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function AdminVehicleBrandField({ value, onChange }: Props) {
  const id = useId();
  const [directInput, setDirectInput] = useState(false);
  const brand = findVehicleBrand(value);
  const custom = directInput || (Boolean(value) && !brand);
  const hasAlias = !custom && brand && value !== brand.label;

  return <div className="admin-brand-field">
    <label htmlFor={`${id}-select`}>차량 제조사</label>
    <div className="admin-brand-selection">
      <VehicleBrandLogo brand={brand} />
      <select id={`${id}-select`} required value={custom ? 'custom' : brand?.id || ''}
        aria-describedby={hasAlias ? `${id}-hint` : undefined}
        onChange={(event) => {
          const selected = event.target.value;
          setDirectInput(selected === 'custom');
          if (selected === 'custom') return; // Keep the raw value available for editing.
          const next = VEHICLE_BRANDS.find((item) => item.id === selected);
          if (next) onChange(next.label); // Only an explicit selection changes the stored text.
        }}>
        <option value="" disabled>제조사 선택</option>
        {VEHICLE_BRANDS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        <option value="custom">목록에 없음 · 직접 입력</option>
      </select>
    </div>
    {custom && <label className="admin-brand-custom" htmlFor={`${id}-custom`}>
      제조사 직접 입력
      <input id={`${id}-custom`} required value={value} onChange={(event) => {
        // Keep direct editing active even when an intermediate value matches a brand.
        setDirectInput(true);
        onChange(event.target.value);
      }}
        placeholder="제조사 이름" autoComplete="off" />
    </label>}
    {hasAlias && <p className="admin-brand-hint" id={`${id}-hint`}>
      기존 입력: {value}<br />직접 변경하지 않으면 이 표기로 저장됩니다.
    </p>}
  </div>;
}
