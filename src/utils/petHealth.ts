import { PetProfile } from '../types/place';

export interface PetHealthReminder {
  level: 'warn' | 'info';
  emoji: string;
  text: string;
}

/** Tính tuổi (tháng) từ ngày sinh. */
export function getPetAgeMonths(birthDate?: string): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

/** Nhắc nhở sức khỏe/tiêm phòng dựa trên dữ liệu hồ sơ hiện có. */
export function getPetHealthReminder(pet: PetProfile): PetHealthReminder | null {
  if (!pet.vaccinated) {
    return {
      level: 'warn',
      emoji: '💉',
      text: `Chưa tiêm phòng — nên đưa ${pet.name} đi tiêm để an toàn khi tới quán.`,
    };
  }
  const months = getPetAgeMonths(pet.birthDate);
  if (months !== null && months >= 12) {
    return {
      level: 'info',
      emoji: '🗓️',
      text: `${pet.name} đã trên 1 tuổi — nhớ tiêm nhắc lại định kỳ hằng năm.`,
    };
  }
  return null;
}
