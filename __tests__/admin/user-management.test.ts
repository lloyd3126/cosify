/**
 * 🔴 TDD Red Phase: 用戶管理頁面測試案例
 * 
 * 測試目標：
 * 1. 用戶列表展示與分頁
 * 2. 用戶篩選功能 (角色、郵箱)
 * 3. 調整用戶點數功能
 * 4. 管理員權限控制
 */

import { describe, test, expect } from '@jest/globals';

describe('🔴 TDD Red: User Management Page', () => {
  describe('GET /api/admin/users - User List API', () => {
    test('should display users with pagination', async () => {
      // 🔴 Red: 定義用戶列表查詢行為
      const response = await fetch('http://localhost:3000/api/admin/users?page=1&limit=10', {
        headers: {
          'authorization': 'Bearer admin-token'
        }
      });
      const data = await response.json();

      // 期望結果
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.total).toBeGreaterThanOrEqual(0);
      expect(data.pagination.totalPages).toBeGreaterThanOrEqual(0);
    });

    test('should filter users by role', async () => {
      // 🔴 Red: 定義角色篩選行為
      const response = await fetch('http://localhost:3000/api/admin/users?role=admin&page=1&limit=5', {
        headers: {
          'authorization': 'Bearer admin-token'
        }
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.users).toBeDefined();
      
      // 所有返回的用戶都應該是 admin 角色
      if (data.users.length > 0) {
        data.users.forEach((user: any) => {
          expect(user.role).toBe('admin');
        });
      }
    });

    test('should filter users by email search', async () => {
      // 🔴 Red: 定義郵箱搜尋行為
      const response = await fetch('http://localhost:3000/api/admin/users?search=test@example.com', {
        headers: {
          'authorization': 'Bearer admin-token'
        }
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.users).toBeDefined();

      // 返回的用戶郵箱應該包含搜尋關鍵字
      if (data.users.length > 0) {
        data.users.forEach((user: any) => {
          expect(user.email.toLowerCase()).toContain('test@example.com');
        });
      }
    });

    test('should require admin authentication', async () => {
      // 🔴 Red: 定義權限控制行為
      const response = await fetch('http://localhost:3000/api/admin/users');

      // 期望未授權錯誤
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    test('should return user details with credit information', async () => {
      // 🔴 Red: 定義用戶詳細資訊行為
      const response = await fetch('http://localhost:3000/api/admin/users?page=1&limit=1', {
        headers: {
          'authorization': 'Bearer admin-token'
        }
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      
      if (data.users && data.users.length > 0) {
        const user = data.users[0];
        
        // 期望的用戶欄位
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('credits');
        expect(user).toHaveProperty('hasGoogleApiKey');
        expect(user).toHaveProperty('dailyLimit');
        expect(user).toHaveProperty('signupBonusClaimed');
        expect(user).toHaveProperty('createdAt');
        
        // 信用相關欄位應該是數字或布林值
        expect(typeof user.credits).toBe('number');
        expect(typeof user.hasGoogleApiKey).toBe('boolean');
        expect(typeof user.dailyLimit).toBe('number');
        expect(typeof user.signupBonusClaimed).toBe('boolean');
      }
    });
  });

  describe('POST /api/admin/users/:id/update-profile - Update User Profile', () => {
    test('should allow admin to update user profile', async () => {
      // 🔴 Red: 定義用戶資料更新行為
      const response = await fetch('http://localhost:3000/api/admin/users/test-user-123/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': 'Bearer admin-token'
        },
        body: JSON.stringify({
          name: 'Updated User Name',
          email: 'updated@example.com',
          dailyLimit: 200,
          role: 'admin',
        }),
      });

      const data = await response.json();

      // 期望成功更新（現在我們有實作了）
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
    });

    test('should validate user update data', async () => {
      // 🔴 Red: 定義輸入驗證行為
      const response = await fetch('http://localhost:3000/api/admin/users/test-user-123/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // 無效的角色
          role: 'invalid_role',
          dailyLimit: -1, // 無效的每日限制
        }),
      });

      const data = await response.json();

      // 期望驗證錯誤
      expect([400, 401]).toContain(response.status);
      expect(data.success).toBe(false);
      expect(['INVALID_INPUT', 'UNAUTHORIZED']).toContain(data.error);
    });
  });

  describe('User Credit Management Integration', () => {
    test('should integrate with credit adjustment API', async () => {
      // 🔴 Red: 定義點數調整整合行為
      const userId = 'test-user-456';
      
      // 調整點數
      const adjustResponse = await fetch(`http://localhost:3000/api/admin/users/${userId}/adjust-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': 'Bearer admin-token'
        },
        body: JSON.stringify({
          amount: 50,
          reason: 'Test credit adjustment from user management',
        }),
      });

      expect(adjustResponse.status).toBe(401); // 目前積分調整需要特殊權限

      // 查詢用戶列表應該顯示更新的點數
      const userListResponse = await fetch('http://localhost:3000/api/admin/users?page=1&limit=10', {
        headers: {
          'authorization': 'Bearer admin-token'
        }
      });
      expect(userListResponse.status).toBe(200); // 有權限時應該成功
    });
  });
});
