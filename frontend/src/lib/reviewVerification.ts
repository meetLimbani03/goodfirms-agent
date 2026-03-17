import { IdentityVerificationResult, ReviewType } from '../types';

const API_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8000';

export const runIdentityVerification = async ({
  reviewType,
  reviewId,
  provider,
}: {
  reviewType: ReviewType;
  reviewId: string;
  provider: 'hunter' | 'contactout' | 'apollo';
}): Promise<IdentityVerificationResult> => {
  const reviewTypePath = reviewType === 'SOFTWARE' ? 'software-reviews' : 'service-reviews';
  const response = await fetch(
    `${API_BASE_URL}/api/${reviewTypePath}/${encodeURIComponent(reviewId)}/identity-verifications/${provider}`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    let message = 'Identity verification failed';
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await response.json()) as IdentityVerificationResult;
};
