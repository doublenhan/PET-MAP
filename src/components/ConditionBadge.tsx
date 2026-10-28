import React from 'react';
import {
  Link,
  Sun,
  Wind,
  Scale,
  Briefcase,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Utensils,
  Trees,
} from 'lucide-react';
import { PET_CONDITIONS, PetConditionId } from '../types/place';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Link,
  Sun,
  Wind,
  Scale,
  Briefcase,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Utensils,
  Trees,
};

interface ConditionBadgeProps {
  conditionId: PetConditionId;
  size?: 'sm' | 'md';
  showDescription?: boolean;
}

export const ConditionBadge: React.FC<ConditionBadgeProps> = ({
  conditionId,
  size = 'sm',
  showDescription = false,
}) => {
  const meta = PET_CONDITIONS[conditionId];
  if (!meta) return null;

  const IconComponent = ICON_MAP[meta.iconName] || CheckCircle2;
  const isAmenity = meta.type === 'amenity';

  if (showDescription) {
    return (
      <div
        className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-colors ${
          isAmenity
            ? 'border-emerald-200/80 bg-emerald-50/60 text-emerald-950'
            : 'border-amber-200/80 bg-amber-50/60 text-amber-950'
        }`}
      >
        <div
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            isAmenity ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          <IconComponent className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold">{meta.label}</span>
            <span
              className={`rounded px-1.5 py-0.2 text-[10px] font-medium ${
                isAmenity
                  ? 'bg-emerald-200/70 text-emerald-800'
                  : 'bg-amber-200/70 text-amber-800'
              }`}
            >
              {isAmenity ? 'Tiện ích' : 'Quy định'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{meta.description}</p>
        </div>
      </div>
    );
  }

  return (
    <span
      title={meta.description}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border font-medium ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${
        isAmenity
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-100 text-slate-700'
      }`}
    >
      <IconComponent className={size === 'sm' ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0'} />
      <span>{meta.label}</span>
    </span>
  );
};
