import { faker } from '@faker-js/faker';

export function generateUsername(): string {
  return faker.internet.userName().toLowerCase();
}
