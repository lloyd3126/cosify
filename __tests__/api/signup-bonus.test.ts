/**
 * 🔴 TDD Red Phase: 註冊獎勵邏輯測試案例
 * 
 * 測試目標：
 * 1. 新用戶註冊自動獲得 100 點獎勵
 * 2. 獎勵只能領取一次
 * 3. 獎勵有適當的到期時間
 */

import { describe, test, expect } from '@jest/globals';

describe('🔴 TDD Red: Signup Bonus Logic', () => {
  describe('POST /api/auth/signup-bonus', () => {
    test('should grant 100 credits to new user on signup', async () => {
      // 🔴 Red: 定義新用戶註冊獎勵行為
      const response = await fetch('http://localhost:3000/api/auth/signup-bonus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'new-user-123',
          email: 'newuser@example.com',
        }),
      });

      const data = await response.json();

      // 期望結果
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.bonusAmount).toBe(100);
      expect(data.transactionId).toBeDefined();
      expect(data.expiresAt).toBeDefined(); // 應該有到期時間
    });

    test('should prevent duplicate bonus claims', async () => {
      // 🔴 Red: 定義防止重複領取行為
      const userId = 'existing-user-456';
      
      // 第一次領取 (假設成功)
      const firstResponse = await fetch('http://localhost:3000/api/auth/signup-bonus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          email: 'existing@example.com',
        }),
      });

      // 第二次嘗試領取
      const secondResponse = await fetch('http://localhost:3000/api/auth/signup-bonus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          email: 'existing@example.com',
        }),
      });

      const data = await secondResponse.json();

      // 期望被拒絕
      expect(secondResponse.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('BONUS_ALREADY_CLAIMED');
    });

    test('should validate required fields', async () => {
      // 🔴 Red: 定義輸入驗證行為
      const response = await fetch('http://localhost:3000/api/auth/signup-bonus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // 缺少 userId
          email: 'test@example.com',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_INPUT');
    });
  });

  describe('Bonus Configuration', () => {
    test('should have configurable bonus amount and expiry', async () => {
      // 🔴 Red: 定義獎勵配置行為
      const response = await fetch('http://localhost:3000/api/auth/signup-bonus/config');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bonusAmount).toBe(100);
      expect(data.expiryDays).toBe(365); // 1年
    });
  });
});
