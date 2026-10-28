import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPlace,
  updatePlacePolicy,
  updatePlaceFull,
  approvePlaceById,
  deletePlaceById,
  addPlaceReview,
  deleteReviewById,
  fetchReviewsByPlace,
  getSavedPlaceIds,
  toggleSavedPlaceId,
  createPlaceReport,
  updatePlaceReportStatus,
  deletePlaceReport,
  fetchPlaceReports,
} from './placeService';
import type { Place } from '../types/place';

const newPlaceInput: Omit<Place, 'id' | 'createdAt'> = {
  name: 'Quán Test',
  category: 'cafe',
  address: '1 Lê Lợi',
  district: 'Quận 1',
  lat: 10.77,
  lng: 106.7,
  petPolicy: 'allowed',
  petConditions: ['leash_required'],
  petPolicyNotes: 'OK',
  allowedPetTypes: ['dog', 'cat'],
  maxWeightKg: 15,
  rating: 5,
  reviewCount: 1,
  verified: false,
};

describe('placeService — chế độ local', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('createPlace tạo id local-* và lưu được', async () => {
    const { place, source } = await createPlace(newPlaceInput);
    expect(source).toBe('local');
    expect(place.id.startsWith('local-')).toBe(true);
    expect(place.name).toBe('Quán Test');
  });

  it('updatePlacePolicy cập nhật đúng chính sách', async () => {
    const { place } = await createPlace(newPlaceInput);
    const updated = await updatePlacePolicy(place.id, {
      petPolicy: 'conditional',
      petConditions: ['diaper_required'],
      petPolicyNotes: 'Cần bỉm',
      allowedPetTypes: ['dog'],
      maxWeightKg: 10,
      googleMapsUrl: '',
      websiteUrl: '',
      imageUrl: '',
    });
    expect(updated?.petPolicy).toBe('conditional');
    expect(updated?.maxWeightKg).toBe(10);
  });

  it('updatePlaceFull + approve + delete', async () => {
    const { place } = await createPlace(newPlaceInput);
    const full = await updatePlaceFull(place.id, { name: 'Đổi tên' });
    expect(full?.name).toBe('Đổi tên');
    const approved = await approvePlaceById(place.id);
    expect(approved?.verified).toBe(true);
    const ok = await deletePlaceById(place.id);
    expect(ok).toBe(true);
  });

  it('addPlaceReview tính lại rating & reviewCount, deleteReviewById tính lại', async () => {
    const { place } = await createPlace({ ...newPlaceInput, rating: 5, reviewCount: 1 });
    const { review, updatedPlace } = await addPlaceReview({
      placeId: place.id,
      authorName: 'Minh',
      petInfo: 'Corgi',
      rating: 3,
      comment: 'Ổn',
      policyAccurate: true,
      visitedAt: '2026-10-26',
    });
    expect(review.id.startsWith('rev-')).toBe(true);
    expect(updatedPlace?.reviewCount).toBe(2);

    const reviews = await fetchReviewsByPlace(place.id);
    expect(reviews.some((r) => r.id === review.id)).toBe(true);

    const del = await deleteReviewById(review.id);
    expect(del.deleted).toBe(true);
  });

  it('bookmark toggle', () => {
    expect(getSavedPlaceIds()).toEqual([]);
    const a = toggleSavedPlaceId('p1');
    expect(a).toContain('p1');
    const b = toggleSavedPlaceId('p1');
    expect(b).not.toContain('p1');
  });

  it('place report: tạo, đổi trạng thái, xoá', async () => {
    const { place } = await createPlace(newPlaceInput);
    await createPlaceReport({
      placeId: place.id,
      placeName: place.name,
      reason: 'policy_changed',
      details: 'Đổi quy định',
      reporterName: 'Lan',
    });
    let reports = await fetchPlaceReports();
    expect(reports.length).toBeGreaterThan(0);
    const rid = reports[0].id;
    await updatePlaceReportStatus(rid, 'resolved');
    reports = await fetchPlaceReports();
    expect(reports.find((r) => r.id === rid)?.status).toBe('resolved');
    await deletePlaceReport(rid);
    reports = await fetchPlaceReports();
    expect(reports.find((r) => r.id === rid)).toBeUndefined();
  });
});
