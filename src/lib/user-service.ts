// 🔵 TDD Refactor: 用戶管理服務層
import { db } from '@/server/db/index';
import { users, creditTransactions } from '@/server/db/schema';
import { eq, like, or, desc, sql, and, gt } from 'drizzle-orm';

export interface UserListParams {
  page: number;
  limit: number;
  role?: 'super_admin' | 'admin' | 'free_user';
  search?: string;
}

export interface UserWithCredits {
  id: string;
  name: string | null;
  email: string;
  role: 'super_admin' | 'admin' | 'free_user';
  createdAt: Date;
  updatedAt: Date;
  hasGoogleApiKey: boolean;
  dailyLimit: number;
  signupBonusClaimed: boolean;
  credits: number;
  totalCredits: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  totalItems: number;
}

/**
 * 🔵 Refactor: 用戶服務類 - 提取重複的用戶操作邏輯
 */
export class UserService {
  /**
   * 獲取用戶列表（帶分頁和篩選）
   */
  static async getUserList(params: UserListParams): Promise<{
    users: UserWithCredits[];
    pagination: PaginationInfo;
  }> {
    const { page, limit, role, search } = params;
    
    // 構建查詢條件
    const conditions = [];
    
    if (role) {
      conditions.push(eq(users.role, role));
    }
    
    if (search) {
      conditions.push(
        or(
          like(users.email, `%${search}%`),
          like(users.name, `%${search}%`)
        )
      );
    }

    // 計算偏移量
    const offset = (page - 1) * limit;
    
    // 執行用戶查詢
    const userList = conditions.length > 0 
      ? await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
            hasGoogleApiKey: users.hasGoogleApiKey,
            dailyLimit: users.dailyLimit,
            signupBonusClaimed: users.signupBonusClaimed,
          })
          .from(users)
          .where(and(...conditions))
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset(offset)
      : await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
            hasGoogleApiKey: users.hasGoogleApiKey,
            dailyLimit: users.dailyLimit,
            signupBonusClaimed: users.signupBonusClaimed,
          })
          .from(users)
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset(offset);

    // 計算總數
    const totalResult = conditions.length > 0
      ? await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(and(...conditions))
      : await db
          .select({ count: sql<number>`count(*)` })
          .from(users);
    
    const total = totalResult[0]?.count || 0;
    
    // 🔵 Refactor: 整合真實的積分計算
    const usersWithCredits = await Promise.all(
      userList.map(async (user) => {
        const credits = await this.getUserTotalCredits(user.id);
        return {
          ...user,
          credits,
          totalCredits: credits,
        };
      })
    );
    
    return {
      users: usersWithCredits,
      pagination: {
        page,
        limit,
        total: Math.ceil(total / limit),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    };
  }

  /**
   * 🔵 Refactor: 計算用戶的總有效積分
   */
  static async getUserTotalCredits(userId: string): Promise<number> {
    try {
      const result = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.userId, userId),
            or(
              sql`expires_at IS NULL`,
              gt(creditTransactions.expiresAt, new Date())
            )
          )
        );
      
      return result[0]?.total || 0;
    } catch (error) {
      console.error('Error calculating user credits:', error);
      return 0;
    }
  }

  /**
   * 根據 ID 獲取用戶
   */
  static async getUserById(userId: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * 創建新用戶
   */
  static async createUser(userData: {
    id: string;
    name: string;
    email: string;
    role?: 'super_admin' | 'admin' | 'free_user';
    dailyLimit?: number;
  }) {
    await db.insert(users).values({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role || 'free_user',
      dailyLimit: userData.dailyLimit || 100,
      emailVerified: false,
      credits: 0,
      hasGoogleApiKey: false,
      signupBonusClaimed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * 更新用戶資料
   */
  static async updateUser(userId: string, updateData: {
    name?: string;
    email?: string;
    role?: 'super_admin' | 'admin' | 'free_user';
    dailyLimit?: number;
  }) {
    const cleanUpdateData = {
      ...updateData,
      updatedAt: new Date(),
    };

    await db
      .update(users)
      .set(cleanUpdateData)
      .where(eq(users.id, userId));
  }

  /**
   * 獲取用戶完整資料（包含積分）
   */
  static async getUserWithCredits(userId: string): Promise<UserWithCredits | null> {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const credits = await this.getUserTotalCredits(userId);
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      hasGoogleApiKey: user.hasGoogleApiKey,
      dailyLimit: user.dailyLimit,
      signupBonusClaimed: user.signupBonusClaimed,
      credits,
      totalCredits: credits,
    };
  }
}
