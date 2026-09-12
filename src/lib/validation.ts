import { countryCodes } from './countries';
export const interestOptions = ['yes', 'maybe', 'no'] as const;
export const useCases = [
  'coding',
  'agents',
  'api',
  'chat',
  'team',
  'other',
] as const;
export const modelOptions = [
  'glm',
  'kimi',
  'qwen',
  'community',
  'other',
] as const;
export type Commitment = {
  email: string;
  country: string;
  would_pay_59: (typeof interestOptions)[number];
  use_case: (typeof useCases)[number];
  model_vote: (typeof modelOptions)[number];
  comment: string;
  consent: true;
  turnstileToken: string;
};
export type Validation =
  | { ok: true; data: Commitment }
  | { ok: false; errors: Record<string, string> };
export function validateCommitment(input: unknown): Validation {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { ok: false, errors: { form: 'Please submit a valid form.' } };
  const value = input as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const email =
    typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(
      email,
    ) ||
    email.split('@')[0].length > 64 ||
    email.startsWith('.') ||
    email.includes('..') ||
    email.includes('.@')
  )
    errors.email = 'Enter a valid email address.';
  const country =
    typeof value.country === 'string' ? value.country.trim().toUpperCase() : '';
  if (!countryCodes.includes(country)) errors.country = 'Choose your country.';
  for (const [key, options] of [
    ['would_pay_59', interestOptions],
    ['use_case', useCases],
    ['model_vote', modelOptions],
  ] as const) {
    if (
      typeof value[key] !== 'string' ||
      !(options as readonly string[]).includes(value[key] as string)
    )
      errors[key] = 'Choose one of the available options.';
  }
  if (value.consent !== true)
    errors.consent = 'Your consent is required to register your interest.';
  const comment = typeof value.comment === 'string' ? value.comment.trim() : '';
  if (
    (value.comment !== undefined && typeof value.comment !== 'string') ||
    comment.length > 500
  )
    errors.comment = 'Use no more than 500 characters.';
  if (
    typeof value.turnstileToken !== 'string' ||
    value.turnstileToken.length < 1 ||
    value.turnstileToken.length > 2048
  )
    errors.turnstileToken = 'Complete the security check.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      email,
      country,
      would_pay_59: value.would_pay_59 as Commitment['would_pay_59'],
      use_case: value.use_case as Commitment['use_case'],
      model_vote: value.model_vote as Commitment['model_vote'],
      comment,
      consent: true,
      turnstileToken: value.turnstileToken as string,
    },
  };
}
