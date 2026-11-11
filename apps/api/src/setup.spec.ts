import { ValidationPipe } from '@nestjs/common';
import { IsString } from 'class-validator';

class Input {
  @IsString()
  name!: string;
}

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const metadata = { type: 'body' as const, metatype: Input };
it('transforms valid input to its DTO', async () => {
  expect(await pipe.transform({ name: 'valid' }, metadata)).toBeInstanceOf(
    Input,
  );
});
it('rejects a wrong property type', async () => {
  await expect(pipe.transform({ name: 42 }, metadata)).rejects.toThrow();
});
it('rejects unknown properties', async () => {
  await expect(
    pipe.transform({ name: 'valid', vendorId: 'untrusted' }, metadata),
  ).rejects.toThrow();
});
