import { describe, it, expect } from 'vitest';
import {
  isValidLat,
  isValidLng,
  clampWeightKg,
  isValidPhone,
  isValidUrl,
  sanitizeText,
  validatePlaceForm,
} from './validation';

describe('validation helpers', () => {
  it('toạ độ hợp lệ', () => {
    expect(isValidLat(10.77)).toBe(true);
    expect(isValidLat(200)).toBe(false);
    expect(isValidLng(106.7)).toBe(true);
    expect(isValidLng(0)).toBe(false);
  });

  it('clamp cân nặng', () => {
    expect(clampWeightKg('7.5')).toBe(7.5);
    expect(clampWeightKg(999)).toBe(120);
    expect(clampWeightKg(0)).toBe(0.1);
    expect(clampWeightKg('abc', 5)).toBe(5);
  });

  it('SĐT', () => {
    expect(isValidPhone('')).toBe(true);
    expect(isValidPhone('0799181741')).toBe(true);
    expect(isValidPhone('+84 909 123 456')).toBe(true);
    expect(isValidPhone('abc')).toBe(false);
    expect(isValidPhone('123')).toBe(false);
  });

  it('URL', () => {
    expect(isValidUrl('')).toBe(true);
    expect(isValidUrl('https://maps.google.com')).toBe(true);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('not a url')).toBe(false);
  });

  it('sanitizeText cắt khoảng trắng & giới hạn độ dài', () => {
    expect(sanitizeText('  a   b  ')).toBe('a b');
    expect(sanitizeText('x'.repeat(600)).length).toBe(500);
  });

  it('validatePlaceForm', () => {
    const ok = validatePlaceForm({
      name: 'Cafe',
      address: '123 Lê Lợi',
      lat: 10.77,
      lng: 106.7,
      phone: '0909123456',
      googleMapsUrl: 'https://maps.google.com',
    });
    expect(ok).toBeNull();

    expect(
      validatePlaceForm({ name: '', address: 'x', lat: 10, lng: 106 })
    ).toMatch(/tên/);
    expect(
      validatePlaceForm({ name: 'x', address: 'y', lat: 999, lng: 106 })
    ).toMatch(/Vĩ độ/);
    expect(
      validatePlaceForm({
        name: 'x',
        address: 'y',
        lat: 10,
        lng: 106,
        websiteUrl: 'javascript:alert(1)',
      })
    ).toMatch(/website/);
  });
});
