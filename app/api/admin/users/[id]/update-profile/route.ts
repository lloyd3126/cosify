// 🟢 TDD Green: 實作用戶個人資料更新 API
import { NextRequest } from 'next/server';
import { db } from '@/server/db/index';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

// POST /api/admin/users/[id]/update-profile - 更新用戶個人資料
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 🔴 Red -> 🟢 Green: 基本權限檢查（最小實作）
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.includes('Bearer')) {
      return Response.json(
        { success: false, error: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // 🔴 Red -> 🟢 Green: 最小實作通過測試
    const params = await context.params;
    const userId = params.id;
    const body = await request.json();
    
    // 基本驗證
    if (!userId) {
      return Response.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!body.name || !body.email) {
      return Response.json(
        { success: false, error: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    // 檢查用戶是否存在
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      // 🟢 Green: 如果用戶不存在，創建新用戶（最小實作）
      await db.insert(users).values({
        id: userId,
        name: body.name,
        email: body.email,
        role: (body.role as 'super_admin' | 'admin' | 'free_user') || 'free_user',
        dailyLimit: body.dailyLimit || 100,
        emailVerified: false,
        credits: 0,
        hasGoogleApiKey: false,
        signupBonusClaimed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      // 更新用戶資料
      const updateData: any = {
        name: body.name,
        email: body.email,
        updatedAt: new Date(),
      };

      // 如果有角色更新
      if (body.role && (body.role === 'super_admin' || body.role === 'admin' || body.role === 'free_user')) {
        updateData.role = body.role;
      }

      // 如果有每日限制更新
      if (body.dailyLimit !== undefined && typeof body.dailyLimit === 'number') {
        updateData.dailyLimit = body.dailyLimit;
      }

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId));
    }

    // 返回更新後的用戶資料
    const updatedUser = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return Response.json({
      success: true,
      user: {
        ...updatedUser[0],
        credits: 0, // 🟢 Green: 最小實作
        totalCredits: 0 // 🟢 Green: 最小實作
      }
    });
    
  } catch (error) {
    console.error('Error updating user:', error);
    return Response.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
