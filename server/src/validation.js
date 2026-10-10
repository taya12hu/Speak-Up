import { HttpError } from './errors.js';

// Small, explicit request validators. Each returns the cleaned value or throws a 400 HttpError
// naming the offending field, which the central error handler sends back to the client.

const fail = (message) => {
  throw new HttpError(400, message);
};

export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireBody(body) {
  if (!isPlainObject(body)) fail('Request body must be a JSON object');
  return body;
}

export function string(value, name, { max, optional = false, allowEmpty = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return undefined;
    if (allowEmpty && value === '') return '';
    fail(`"${name}" is required`);
  }
  if (typeof value !== 'string') fail(`"${name}" must be a string`);
  const trimmed = value.trim();
  if (!trimmed && !allowEmpty) fail(`"${name}" must not be blank`);
  if (max && trimmed.length > max) fail(`"${name}" must be at most ${max} characters`);
  return trimmed;
}

export function oneOf(value, name, allowed, { fallback } = {}) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!allowed.includes(value)) fail(`"${name}" must be one of: ${allowed.join(', ')}`);
  return value;
}

export function integer(value, name, { min, max, fallback } = {}) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) fail(`"${name}" must be an integer from ${min} to ${max}`);
  return value;
}

export function number(value, name, { min = 0 } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) fail(`"${name}" must be a number >= ${min}`);
  return value;
}

export function object(value, name) {
  if (!isPlainObject(value)) fail(`"${name}" must be an object`);
  return value;
}
