import { validateEnvironment } from './environment.js';
const valid = { DATABASE_URL: 'postgresql://user:password@db:5432/vendora' };
it('defaults the port', () => {
  expect(validateEnvironment(valid).PORT).toBe(3000);
});
it.each(['', 'https://db/name', 'postgresql://db/name'])(
  'rejects invalid database URL %s',
  (DATABASE_URL) => {
    expect(() => validateEnvironment({ DATABASE_URL })).toThrow('DATABASE_URL');
  },
);
it.each(['abc', 0, 65536, 1.5])('rejects invalid port %s', (PORT) => {
  expect(() => validateEnvironment({ ...valid, PORT })).toThrow('PORT');
});
