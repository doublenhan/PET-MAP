import { describe, it, expect } from 'vitest';
import {
  normalizeSearchText,
  evaluateOpeningStatus,
  evaluatePetCompatibility,
  calculateDistanceKm,
  getCategoryFallbackImage,
} from './petCompatibility';
import type { Place, PetProfile } from '../types/place';

describe('normalizeSearchText (tìm kiếm Tiếng Việt không dấu)', () => {
  it('bỏ dấu và chuẩn hóa chuỗi', () => {
    expect(normalizeSearchText('Quận 1, Thảo Điền - Cà Phê Đẹp')).toBe(
      'quan 1 thao dien ca phe dep'
    );
    expect(normalizeSearchText('Đường Nguyễn Huệ')).toBe('duong nguyen hue');
  });
  it('xử lý chuỗi rỗng', () => {
    expect(normalizeSearchText('')).toBe('');
  });
});

describe('evaluateOpeningStatus (trạng thái mở cửa theo giờ)', () => {
  it('nhận diện 24/7', () => {
    const s = evaluateOpeningStatus('24/24 (Cấp cứu Thú Y)');
    expect(s?.isOpen).toBe(true);
    expect(s?.is24h).toBe(true);
  });
  it('đang mở cửa', () => {
    const s = evaluateOpeningStatus('07:30 - 22:00', new Date('2026-10-26T10:00:00'));
    expect(s?.isOpen).toBe(true);
    expect(s?.shortLabel).toBe('Đang mở cửa');
  });
  it('sắp đóng cửa', () => {
    const s = evaluateOpeningStatus('07:30 - 22:00', new Date('2026-10-26T21:30:00'));
    expect(s?.shortLabel).toBe('Sắp đóng cửa');
  });
  it('đã đóng cửa', () => {
    const s = evaluateOpeningStatus('07:30 - 22:00', new Date('2026-10-26T23:15:00'));
    expect(s?.isOpen).toBe(false);
    expect(s?.shortLabel).toBe('Đã đóng cửa');
  });
  it('trả null khi không có giờ', () => {
    expect(evaluateOpeningStatus('')).toBeNull();
  });
});

const samplePlace: Place = {
  id: 'p1',
  name: 'Test Cafe',
  category: 'cafe',
  address: '123 Lê Lợi',
  district: 'Quận 1',
  lat: 10.77,
  lng: 106.7,
  petPolicy: 'conditional',
  petConditions: ['vaccinated', 'diaper_required'],
  petPolicyNotes: '',
  allowedPetTypes: ['dog', 'cat'],
  maxWeightKg: 15,
};

const mochi: PetProfile = {
  name: 'Mochi',
  type: 'dog',
  breed: 'Corgi',
  weightKg: 11,
  vaccinated: true,
  hasCarrier: false,
  hasMuzzle: false,
  hasDiaper: true,
};

describe('evaluatePetCompatibility (độ phù hợp Boss)', () => {
  it('phù hợp hoàn hảo', () => {
    const r = evaluatePetCompatibility(samplePlace, mochi);
    expect(r?.compatible).toBe(true);
    expect(r?.status).toBe('perfect');
  });
  it('vượt giới hạn cân nặng', () => {
    const r = evaluatePetCompatibility(samplePlace, { ...mochi, weightKg: 22 });
    expect(r?.compatible).toBe(false);
    expect(r?.status).toBe('warning');
  });
  it('trả null khi không có pet', () => {
    expect(evaluatePetCompatibility(samplePlace, null)).toBeNull();
  });
});

describe('getCategoryFallbackImage & calculateDistanceKm', () => {
  it('ảnh fallback là URL https', () => {
    expect(getCategoryFallbackImage('cafe').startsWith('https://')).toBe(true);
    expect(getCategoryFallbackImage('vet_spa').startsWith('https://')).toBe(true);
  });
  it('khoảng cách Haversine hợp lý', () => {
    const d = calculateDistanceKm(10.7769, 106.7009, 10.78, 106.705);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(2);
  });
});
