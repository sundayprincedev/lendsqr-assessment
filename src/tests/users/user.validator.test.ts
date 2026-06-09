import { loginSchema, registerSchema } from '../../modules/users/user.validator';

describe('registerSchema', () => {
  const validPayload = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '08012345678',
    bvn: '12345678901',
    password: 'SecurePass123!',
  };

  it('accepts valid registration payload', () => {
    const { error } = registerSchema.validate(validPayload);

    expect(error).toBeUndefined();
  });

  it('rejects invalid email', () => {
    const { error } = registerSchema.validate({
      ...validPayload,
      email: 'not-an-email',
    });

    expect(error).toBeDefined();
  });

  it('rejects invalid bvn length', () => {
    const { error } = registerSchema.validate({
      ...validPayload,
      bvn: '1234',
    });

    expect(error).toBeDefined();
  });

  it('rejects invalid phone format', () => {
    const { error } = registerSchema.validate({
      ...validPayload,
      phone: '12345',
    });

    expect(error).toBeDefined();
  });
});

describe('loginSchema', () => {
  it('accepts valid login payload', () => {
    const { error } = loginSchema.validate({
      email: 'john@example.com',
      password: 'SecurePass123!',
    });

    expect(error).toBeUndefined();
  });

  it('rejects missing password', () => {
    const { error } = loginSchema.validate({
      email: 'john@example.com',
    });

    expect(error).toBeDefined();
  });
});
