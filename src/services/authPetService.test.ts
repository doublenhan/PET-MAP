import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveUserPetProfileItem,
  deleteUserPetProfileItem,
  fetchUserPetProfiles,
} from './authPetService';
import type { PetProfile } from '../types/place';

const basePet = (over: Partial<PetProfile>): PetProfile => ({
  name: 'Boss',
  type: 'dog',
  breed: 'Corgi',
  weightKg: 5,
  vaccinated: true,
  hasCarrier: false,
  hasMuzzle: false,
  hasDiaper: false,
  ...over,
});

describe('Multi-Pet lưu trữ (mỗi Boss 1 dòng, không mất Boss cũ)', () => {
  const userId = `user-${Math.random().toString(36).slice(2)}`;

  beforeEach(() => {
    localStorage.clear();
  });

  it('thêm Boss mới không làm mất Boss cũ & lưu đúng cột riêng', async () => {
    let list = await saveUserPetProfileItem(
      userId,
      basePet({
        name: 'Củ Cải',
        breed: 'Phóc Sóc',
        weightKg: 7.5,
        identityCode: 'D2025000001138',
        ownerPhone: '0799181741',
      })
    );
    expect(list).toHaveLength(1);
    expect(list[0].identityCode).toBe('D2025000001138');
    expect(list[0].ownerPhone).toBe('0799181741');

    list = await saveUserPetProfileItem(userId, basePet({ name: 'Mèo', type: 'cat' }));
    expect(list.map((p) => p.name)).toEqual(['Củ Cải', 'Mèo']);

    list = await saveUserPetProfileItem(userId, basePet({ name: 'Lu', weightKg: 11 }));
    expect(list.map((p) => p.name)).toEqual(['Củ Cải', 'Mèo', 'Lu']);

    // breed không chứa metadata gói chung
    expect(list[0].breed.includes('||PM:')).toBe(false);
  });

  it('sửa Boss giữ nguyên tổng số & cập nhật đúng', async () => {
    await saveUserPetProfileItem(userId, basePet({ name: 'A' }));
    let list = await saveUserPetProfileItem(userId, basePet({ name: 'B' }));
    const target = list[0];
    list = await saveUserPetProfileItem(userId, { ...target, weightKg: 9.9 });
    expect(list).toHaveLength(2);
    expect(list.find((p) => p.id === target.id)?.weightKg).toBe(9.9);
  });

  it('xóa Boss chỉ bỏ đúng con đó', async () => {
    await saveUserPetProfileItem(userId, basePet({ name: 'X' }));
    let list = await saveUserPetProfileItem(userId, basePet({ name: 'Y' }));
    list = await deleteUserPetProfileItem(userId, list[0].id!);
    expect(list.map((p) => p.name)).toEqual(['Y']);
  });

  it('fetch trả về danh sách đã lưu ở local khi offline', async () => {
    await saveUserPetProfileItem(userId, basePet({ name: 'Offline Boss' }));
    const list = await fetchUserPetProfiles(userId);
    expect(list.some((p) => p.name === 'Offline Boss')).toBe(true);
  });
});
