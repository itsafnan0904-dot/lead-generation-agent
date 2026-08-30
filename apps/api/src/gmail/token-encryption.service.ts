import * as crypto from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class TokenEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12; // Standard 96-bit IV for AES-GCM
  private readonly authTagLength = 16; // Standard 128-bit auth tag
  private readonly key: Buffer;

  constructor() {
    const rawKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    
    // Check if key is a 64-char hex string (32 bytes) or fallback to hashing raw key
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      this.key = Buffer.from(rawKey, 'hex');
    } else {
      this.key = crypto.createHash('sha256').update(rawKey).digest();
    }
  }

  /**
   * Encrypts plaintext string using AES-256-GCM.
   * Returns format: iv:authTag:ciphertext (base64 encoded)
   */
  encrypt(plaintext: string): string {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      const authTag = cipher.getAuthTag();

      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (err: any) {
      throw new InternalServerErrorException('Failed to securely encrypt token');
    }
  }

  /**
   * Decrypts an AES-256-GCM encrypted string.
   */
  decrypt(encryptedPayload: string): string {
    try {
      const parts = encryptedPayload.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted payload format');
      }

      const [ivB64, authTagB64, ciphertextB64] = parts;
      const iv = Buffer.from(ivB64, 'base64');
      const authTag = Buffer.from(authTagB64, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertextB64, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err: any) {
      throw new InternalServerErrorException('Failed to securely decrypt token');
    }
  }
}
