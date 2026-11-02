import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { setBackendProxyEnabled } from '../api/github';

beforeEach(() => {
  setBackendProxyEnabled(false);
});

afterEach(() => {
  cleanup();
});
