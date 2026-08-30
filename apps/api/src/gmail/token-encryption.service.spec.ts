import { Test, TestingModule } from '@nestjs/testing';
import { TokenEncryptionService } from './token-encryption.service';

describe('TokenEncryptionService', () => {
  let encryptionService: TokenEncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenEncryptionService],
    }).compile();

    encryptionService = module.get<TokenEncryptionService>(TokenEncryptionService);
  });

  it('correctly performs AES-256-GCM encryption and decryption round-trip', () => {
    const rawSecret = 'ya29.a0AfH6SMDh94827498273948729384729384729384729384';
    const encrypted = encryptionService.encrypt(rawSecret);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(rawSecret);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

    const decrypted = encryptionService.decrypt(encrypted);
    expect(decrypted).toEqual(rawSecret);
  });

  it('produces different ciphertexts and IVs for the same plaintext across encryptions', () => {
    const rawSecret = 'same_secret_token_12345';
    const enc1 = encryptionService.encrypt(rawSecret);
    const enc2 = encryptionService.encrypt(rawSecret);

    expect(enc1).not.toEqual(enc2);
    expect(encryptionService.decrypt(enc1)).toEqual(rawSecret);
    expect(encryptionService.decrypt(enc2)).toEqual(rawSecret);
  });

  it('fails decryption if auth tag or ciphertext is tampered with', () => {
    const rawSecret = 'sensitive_refresh_token_xyz';
    const encrypted = encryptionService.encrypt(rawSecret);
    const [iv, authTag, ciphertext] = encrypted.split(':');

    // Tamper with ciphertext
    const tamperedCiphertext = ciphertext.substring(0, ciphertext.length - 2) + 'AA';
    const tamperedPayload = `${iv}:${authTag}:${tamperedCiphertext}`;

    expect(() => encryptionService.decrypt(tamperedPayload)).toThrow();
  });
});
