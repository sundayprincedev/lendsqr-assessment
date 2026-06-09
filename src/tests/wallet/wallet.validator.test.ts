import { fundSchema, transferSchema, withdrawSchema } from '../../modules/wallet/wallet.validator';

describe('wallet validators', () => {
  it('rejects zero amount on fund', () => {
    const { error } = fundSchema.validate({
      amount: 0,
      reference: 'ref-001',
    });

    expect(error).toBeDefined();
  });

  it('rejects negative amount on fund', () => {
    const { error } = fundSchema.validate({
      amount: -100,
      reference: 'ref-001',
    });

    expect(error).toBeDefined();
  });

  it('rejects zero amount on withdraw', () => {
    const { error } = withdrawSchema.validate({
      amount: 0,
      reference: 'ref-002',
    });

    expect(error).toBeDefined();
  });

  it('rejects negative amount on transfer', () => {
    const { error } = transferSchema.validate({
      recipient_email: 'jane@example.com',
      amount: -50,
      reference: 'ref-003',
    });

    expect(error).toBeDefined();
  });

  it('accepts valid fund payload', () => {
    const { error, value } = fundSchema.validate({
      amount: 5000,
      reference: 'ref-004',
    });

    expect(error).toBeUndefined();
    expect(value.amount).toBe(5000);
  });
});
