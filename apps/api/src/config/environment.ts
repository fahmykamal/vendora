export function validateEnvironment(input: Record<string, unknown>) {
  const nodeEnv = input.NODE_ENV ?? 'development';
  if (
    typeof nodeEnv !== 'string' ||
    !['development', 'test', 'production'].includes(nodeEnv)
  ) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  const port = Number(input.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const databaseUrl = input.DATABASE_URL;
  try {
    if (typeof databaseUrl !== 'string')
      throw new Error('Missing database URL');
    const url = new URL(databaseUrl);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      !url.password ||
      url.pathname.length < 2
    ) {
      throw new Error('Invalid database URL');
    }
  } catch {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL with host, credentials, and database',
    );
  }
  return {
    ...input,
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: String(databaseUrl),
  };
}
