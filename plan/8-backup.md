# Plan 8: Cosify 後台管理系統與點數制度

> **專案目標**：建立完整的點數制商業模式後台管理系統  
> **開始日期**：2025年9月7日  
> **預估工期**：3週  
> **負責人**：開發團隊  

---

### 目標與價值
- **商業目標**：建立可持續的點數制收費模式
- **技術目標**：完整的後台管理系統與 API 架構
- **用戶目標**：直觀的點數管理與 API Key 設定體驗

### 核心功能
1. **後台管理系統**：用戶管理、點數調整、邀請碼生成
2. **點數制度**：購買、消耗、有效期管理
3. **用戶分級**：免費/付費用戶自動切換
4. **前端整合**：Navbar 即時顯示與 API Key 管理

---

## � 部署與維運

### TDD 驗證部署流程

#### 預部署測試檢查表
```bash
# 1. 完整測試套件執行
bun test               # 單元測試
bun test:integration   # 整合測試  
bun test:e2e          # E2E 測試

# 2. 覆蓋率檢查
bun test:coverage     # 確保 > 95% 覆蓋率

# 3. 型別檢查
bun type-check

# 4. 代碼品質檢查
bun lint
bun format:check

# 5. 建置驗證
bun build
```

#### TDD 驗證部署腳本
```bash
#!/bin/bash
# deploy-with-tdd-validation.sh

set -e

echo "🔴 Red: Running all tests..."
bun test --coverage

echo "🟢 Green: All tests passed!"
bun build

echo "🔵 Refactor: Deploying to staging..."
# staging deployment logic

echo "✅ Production deployment ready!"
```

### 環境設定

#### 點數獲取方式
| 方式 | 數量 | 說明 | 有效期 |
|------|------|------|--------|
| **註冊獎勵** | 100點 | 新用戶一次性獎勵 | 可設定 |
| **購買點數** | 1點/1元 | 手動發邀請碼 | 可設定 |
| **邀請碼兌換** | 可變 | 管理員生成 | 可設定 |

#### 用戶分級與消耗
| 用戶類型 | 消耗/圖 | API Key | 說明 |
|----------|---------|---------|------|
| **免費用戶** | 2點 | 平台提供 | 使用平台 Google API |
| **付費用戶** | 1點 | 自己提供 | 本地儲存，不上傳 |

#### 使用限制
- **每日限制**：100點/天（台北時間 00:00 重設）
- **個別調整**：管理員可調整特定用戶限制
- **FIFO 原則**：優先消耗即將過期的點數

---

## 🔄 TDD 開發策略

### Test-Driven Development 核心理念

採用 **Red-Green-Refactor** 循環，確保代碼品質與設計的同時提高開發效率：

1. **🔴 Red**: 先寫失敗的測試（定義期望行為）
2. **🟢 Green**: 寫最小可行的實作讓測試通過
3. **🔵 Refactor**: 重構代碼保持測試通過，提升代碼品質

### TDD 實作原則

- **測試先行**：每個功能都先寫測試案例，明確定義期望行為
- **小步迭代**：每次只實作最少的程式碼讓測試通過
- **持續重構**：在保持測試通過的前提下，不斷改善程式碼品質
- **快速反饋**：測試執行時間要短，提供即時的反饋循環

---

---

## 🚀 TDD 實作計畫

### TDD 開發原則
此計畫採用 **Test-Driven Development (TDD)** 方法論，遵循以下開發循環：

1. **🔴 Red**: 先寫測試案例（失敗狀態）
2. **🟢 Green**: 寫最少的程式碼讓測試通過
3. **🔵 Refactor**: 重構程式碼提升品質

每個功能都會先定義期望行為，再實作滿足測試的程式碼。

### Phase 1: 基礎架構 (第1週) - TDD 驅動開發

#### 開始前準備
```bash
# 1. 建立基礎分支
git checkout main
git pull origin main
git checkout -b feature/plan8-foundation

# 2. 設定 TDD 環境
bun install
bun test  # 確認測試環境正常
bun run dev  # 確認專案正常運作
```

#### Day 1-2: TDD 資料庫設計與遷移
- [x] 設計完整的資料庫 Schema
- [ ] **🔴 Red**: 寫資料庫模型測試案例
- [ ] **🟢 Green**: 建立 Drizzle migration 檔案和 ORM 模型
- [ ] **🔵 Refactor**: 優化 Schema 設計和索引
- [ ] 執行資料庫遷移
- [ ] **Git**: `git commit -m "test(database): add schema validation tests"`
- [ ] **Git**: `git commit -m "feat(database): implement credit system schema"`

#### Day 3-4: TDD 核心服務開發
- [ ] **🔴 Red**: 寫 CreditService 測試案例
  ```typescript
  // 先定義期望行為
  test('should consume credits with FIFO logic')
  test('should check daily limits correctly')
  test('should handle expired credits')
  ```
- [ ] **🟢 Green**: 實作 CreditService 核心邏輯
- [ ] **🔵 Refactor**: 優化 FIFO 算法效能
- [ ] **🔴 Red**: 寫 AuthService 測試案例
- [ ] **🟢 Green**: 實作 AuthService 權限檢查
- [ ] **🔵 Refactor**: 抽取共用權限邏輯
- [ ] **Git**: `git commit -m "test(services): add credit and auth service tests"`
- [ ] **Git**: `git commit -m "feat(services): implement services to pass tests"`

#### Day 5: TDD API 端點開發
- [ ] **🔴 Red**: 寫 API 端點測試案例
- [ ] **🟢 Green**: 建立 API 端點基礎架構
- [ ] **🔵 Refactor**: 優化錯誤處理和驗證
- [ ] **🔴 Red**: 寫 Admin Layout 組件測試
- [ ] **🟢 Green**: 實作 AdminLayout 組件
- [ ] **🔵 Refactor**: 優化組件結構和樣式
- [ ] **Git**: `git commit -m "test(api): add endpoint validation tests"`
- [ ] **Git**: `git commit -m "feat(admin): setup admin layout and routing"`
- [ ] **PR**: 建立 Pull Request 合併到 mainpt
// 1. 先定義測試案例
describe('CreditService', () => {
  test('should consume credits with FIFO logic', async () => {
    // Given: 建立測試數據
    const userId = 'test-user';
    const oldCredits = createCreditTransaction(userId, 50, new Date('2024-01-01'));
    const newCredits = createCreditTransaction(userId, 30, new Date('2024-02-01'));
    
    // When: 執行消耗邏輯
    await creditService.consumeCredits(userId, 40);
    
    // Then: 驗證 FIFO 邏輯
    expect(await getTransaction(oldCredits.id)).toHaveConsumedAmount(40);
    expect(await getTransaction(newCredits.id)).toHaveConsumedAmount(10);
  });
});

// 2. 執行測試（應該失敗）
// 3. 實作最小可行代碼
// 4. 重構優化
```

#### 快速反饋循環
- **測試執行時間**: < 100ms (單元測試)
- **測試覆蓋率目標**: > 95%
- **每次 commit 都要通過所有測試**
- **持續重構保持代碼整潔**

#### 測試分層策略

```typescript
// 單元測試 (70%) - 快速、隔離
describe('CreditService Unit Tests', () => {
  // 測試純函數邏輯
  // 模擬外部依賴
});

// 整合測試 (20%) - 組件間協作
describe('Credit API Integration Tests', () => {
  // 測試 API 端點與服務層
  // 使用測試資料庫
});

// E2E 測試 (10%) - 完整流程
describe('Credit Management E2E Tests', () => {
  // 測試完整用戶流程
  // 真實環境模擬
});
```

### TDD 開發工具配置

#### Jest 配置優化
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // 快速執行配置
  maxWorkers: '50%',
  cache: true,
  watchMode: true
};
```

#### 測試輔助工具
```typescript
// 測試資料工廠
export const TestDataFactory = {
  createUser: (overrides?: Partial<User>) => ({
    id: nanoid(),
    email: 'test@example.com',
    credits: 100,
    ...overrides
  }),
  
  createCreditTransaction: (userId: string, amount: number, expiresAt?: Date) => ({
    id: nanoid(),
    userId,
    amount,
    type: 'purchase' as const,
    expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date()
  })
};

// 測試資料庫清理
export const setupTestDatabase = async () => {
  await db.delete(creditTransactions);
  await db.delete(users);
};
```

---

## 🔄 開發流程規範

### GitHub Flow + TDD 策略

結合 TDD 開發流程，採用 GitHub Flow 來確保開發過程的穩定性和可追蹤性。

#### 分支策略
```bash
# 主要分支
main                 # 生產環境分支，隨時可部署
├── feature/plan8-foundation    # 基礎架構分支
├── feature/plan8-backend      # 後台功能分支
├── feature/plan8-frontend     # 前端整合分支
└── feature/plan8-optimization # 優化功能分支
```

#### TDD 工作流程
```bash
# 1. 創建功能分支
git checkout -b feature/plan8-credit-service

# 2. TDD 循環
# Red: 寫測試
git add . && git commit -m "test(credit): add FIFO consumption test"

# Green: 實作功能
git add . && git commit -m "feat(credit): implement FIFO logic to pass test"

# Refactor: 重構優化
git add . && git commit -m "refactor(credit): optimize FIFO performance"

# 3. 整合測試
npm test
npm run test:integration

# 4. 提交 PR
git push origin feature/plan8-credit-service
```

---

## 🏗️ 技術架構

### 資料庫設計

#### 現有表格擴展
```sql
-- users 表新增欄位
ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN has_google_api_key BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN daily_limit INTEGER DEFAULT 100;
ALTER TABLE users ADD COLUMN signup_bonus_claimed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'free_user' 
  CHECK (role IN ('super_admin', 'admin', 'free_user'));
```

#### 新增資料表
```sql
-- 點數交易記錄
CREATE TABLE credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'signup_bonus', 'invite_code', 'consumption', 'admin_adjustment')),
  description TEXT,
  metadata JSON,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 每日使用追蹤
CREATE TABLE daily_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  usage_date DATE NOT NULL,
  credits_consumed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, usage_date)
);

-- 邀請碼管理
CREATE TABLE invite_codes (
  code TEXT PRIMARY KEY,
  created_by_admin_id TEXT NOT NULL REFERENCES users(id),
  credits_value INTEGER NOT NULL,
  credits_expires_at TIMESTAMP,
  used_by_user_id TEXT REFERENCES users(id),
  used_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引
CREATE INDEX idx_credit_transactions_user_expires ON credit_transactions(user_id, expires_at);
CREATE INDEX idx_daily_usage_user_date ON daily_usage(user_id, usage_date);
CREATE INDEX idx_invite_codes_expires ON invite_codes(expires_at);
```

### API 端點設計

#### 用戶點數相關
```typescript
// 獲取用戶點數狀態
GET /api/me/credits
Response: {
  totalCredits: number;
  validCredits: number;
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  expiringCredits: Array<{amount: number, expiresAt: string}>;
  hasApiKey: boolean;
}

// 更新 API Key 狀態
POST /api/me/api-key-status
Body: { hasApiKey: boolean }

// 兌換邀請碼
POST /api/me/redeem-invite
Body: { code: string }
```

#### 後台管理相關
```typescript
// 用戶管理
GET /api/admin/users?page=1&limit=20&search=email&role=free_user
POST /api/admin/users/:id/adjust-credits
POST /api/admin/users/:id/update-limits

// 邀請碼管理
GET /api/admin/invite-codes?status=active&page=1
POST /api/admin/invite-codes/generate
DELETE /api/admin/invite-codes/:code

// 統計分析
GET /api/admin/analytics/credits-usage?period=7d
GET /api/admin/analytics/user-activity?period=30d
```

### 核心服務模組

#### 點數服務 (CreditService)
```typescript
class CreditService {
  // 檢查有效餘額（排除過期）
  async getValidCredits(userId: string): Promise<number>
  
  // FIFO 消耗點數
  async consumeCredits(userId: string, amount: number): Promise<boolean>
  
  // 添加點數記錄
  async addCredits(userId: string, amount: number, type: string, expiresAt?: Date): Promise<void>
  
  // 檢查每日限制
  async checkDailyLimit(userId: string, amount: number): Promise<boolean>
  
  // 清理過期點數
  async cleanupExpiredCredits(): Promise<void>
}
```

#### 權限服務 (AuthService)
```typescript
class AuthService {
  // 檢查管理員權限
  async isAdmin(userId: string): Promise<boolean>
  
  // 檢查超級管理員權限
  async isSuperAdmin(userId: string): Promise<boolean>
  
  // 權限中間件
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void
}
```

---

## 🎨 前端設計規格

### Navbar 整合設計

#### 點數顯示組件
```typescript
const CreditDisplay = () => {
  const { data: credits } = useSWR('/api/me/credits');
  
  const statusColor = useMemo(() => {
    const percentage = credits?.dailyRemaining / credits?.dailyLimit * 100;
    if (percentage > 20) return 'text-green-600';
    if (percentage > 5) return 'text-yellow-600';
    return 'text-red-600';
  }, [credits]);
  
  return (
    <div className="flex items-center gap-2">
      <Coins className="w-4 h-4" />
      <span className={`font-medium ${statusColor}`}>
        {credits?.dailyRemaining}/{credits?.validCredits}
      </span>
      {credits?.expiringCredits?.length > 0 && (
        <AlertTriangle className="w-4 h-4 text-amber-500" />
      )}
    </div>
  );
};
```

#### API Key 管理組件
```typescript
const ApiKeyManager = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const { data: user } = useSWR('/api/me');
  
  const handleSave = async () => {
    localStorage.setItem('google_api_key', apiKey);
    await fetch('/api/me/api-key-status', {
      method: 'POST',
      body: JSON.stringify({ hasApiKey: true })
    });
    mutate('/api/me/credits');
  };
  
  return (
    <>
      <Button
        variant={user?.hasApiKey ? "default" : "outline"}
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        <Key className="w-4 h-4 mr-1" />
        {user?.hasApiKey ? '付費用戶' : '設定 API Key'}
        <Badge variant={user?.hasApiKey ? "default" : "secondary"} className="ml-2">
          {user?.hasApiKey ? '1點/圖' : '2點/圖'}
        </Badge>
      </Button>
      
      <ApiKeyModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
        onSave={handleSave}
      />
    </>
  );
};
```

### 後台管理介面

#### 用戶管理頁面
```typescript
// /admin/users 頁面結構
const UsersPage = () => {
  return (
    <AdminLayout>
      <PageHeader title="用戶管理" />
      
      <UserFilters />
      
      <UserTable 
        columns={[
          'name', 'email', 'role', 'credits', 'validCredits', 
          'dailyLimit', 'hasApiKey', 'createdAt', 'actions'
        ]}
      />
      
      <UserEditModal />
      <CreditAdjustModal />
    </AdminLayout>
  );
};
```

#### 邀請碼管理頁面
```typescript
// /admin/invite-codes 頁面結構
const InviteCodesPage = () => {
  return (
    <AdminLayout>
      <PageHeader 
        title="邀請碼管理"
        action={<GenerateInviteCodeButton />}
      />
      
      <InviteCodeTable 
        columns={[
          'code', 'creditsValue', 'creditsExpiresAt', 'usedBy', 
          'usedAt', 'expiresAt', 'status', 'actions'
        ]}
      />
      
      <GenerateInviteCodeModal />
    </AdminLayout>
  );
};
```

---

## 🔄 業務邏輯實作

### 註冊獎勵流程
```typescript
// 新用戶註冊後自動觸發
export async function grantSignupBonus(userId: string) {
  const user = await getUserById(userId);
  
  // 檢查是否已領取
  if (user.signup_bonus_claimed) {
    throw new Error('Signup bonus already claimed');
  }
  
  // 發放獎勵（可設定有效期）
  await creditService.addCredits(
    userId, 
    100, 
    'signup_bonus',
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1年後過期
  );
  
  // 更新狀態
  await updateUser(userId, { signup_bonus_claimed: true });
  
  // 記錄操作
  await logUserAction(userId, 'signup_bonus_granted', { amount: 100 });
}
```

### 點數消耗流程
```typescript
// 生成圖片前的點數檢查與扣除
export async function consumeCreditsForGeneration(userId: string) {
  const user = await getUserById(userId);
  const costPerImage = user.has_google_api_key ? 1 : 2;
  
  // 檢查有效餘額
  const validCredits = await creditService.getValidCredits(userId);
  if (validCredits < costPerImage) {
    throw new Error('Insufficient credits');
  }
  
  // 檢查每日限制
  const canConsume = await creditService.checkDailyLimit(userId, costPerImage);
  if (!canConsume) {
    throw new Error('Daily limit exceeded');
  }
  
  // FIFO 消耗點數
  await creditService.consumeCredits(userId, costPerImage);
  
  // 更新每日使用記錄
  await updateDailyUsage(userId, costPerImage);
  
  return { consumed: costPerImage, remaining: validCredits - costPerImage };
}
```

### 點數過期清理
```typescript
// 定期清理過期點數的 Cron Job
export async function cleanupExpiredCredits() {
  const expiredTransactions = await db.select()
    .from(creditTransactions)
    .where(
      and(
        lt(creditTransactions.expires_at, new Date()),
        eq(creditTransactions.type, 'purchase'),
        isNull(creditTransactions.consumed_at)
      )
    );
  
  for (const transaction of expiredTransactions) {
    // 標記為已消耗（過期）
    await db.update(creditTransactions)
      .set({ consumed_at: new Date(), description: 'Expired' })
      .where(eq(creditTransactions.id, transaction.id));
    
    // 記錄過期日誌
    await logSystemAction('credits_expired', {
      userId: transaction.user_id,
      amount: transaction.amount,
      originalExpiry: transaction.expires_at
    });
  }
  
  console.log(`Cleaned up ${expiredTransactions.length} expired credit transactions`);
}
```

---

## � 開發流程規範

### GitHub Flow 策略

由於此專案涉及多個系統的複雜變更（資料庫 Schema、API 端點、後台介面、前端整合），我們採用 GitHub Flow 來確保開發過程的穩定性和可追蹤性。

#### 分支策略
```bash
# 主要分支
main                 # 生產環境分支，隨時可部署
├── feature/plan8-foundation    # 基礎架構分支
├── feature/plan8-backend      # 後台功能分支
├── feature/plan8-frontend     # 前端整合分支
└── feature/plan8-optimization # 優化功能分支
```

#### 開發工作流程

1. **分支建立**
   ```bash
   # 從 main 建立功能分支
   git checkout main
   git pull origin main
   git checkout -b feature/plan8-foundation
   ```

2. **開發流程**
   - 每個 Phase 對應一個主要 feature 分支
   - 小功能可從 feature 分支再建立子分支
   - 頻繁 commit，清楚的 commit message
   - 定期從 main 同步最新變更

3. **Pull Request 流程**
   - 完成一個完整功能後建立 PR
   - 必須通過所有自動化測試
   - 需要 Code Review 審核
   - 測試環境驗證無誤後合併

4. **合併策略**
   - 使用 "Squash and merge" 保持歷史清潔
   - 合併後立即刪除 feature 分支
   - main 分支保護，禁止直接推送

#### 分支對應實作階段

| 分支名稱 | 對應階段 | 主要變更 | 預估時間 |
|----------|----------|----------|----------|
| `feature/plan8-foundation` | Phase 1 | 資料庫 Schema、核心服務 | 1週 |
| `feature/plan8-backend` | Phase 2 | 後台管理頁面、API 端點 | 1週 |
| `feature/plan8-frontend` | Phase 3 | Navbar 整合、前端功能 | 1週 |

#### Commit Message 規範
```bash
# TDD 格式：<type>(<scope>): <description>
test(credit): add FIFO consumption test case
feat(credit): implement FIFO consumption logic to pass tests
refactor(credit): optimize FIFO algorithm performance
test(api): add admin permission test cases
feat(api): implement admin middleware to pass tests
fix(auth): resolve permission check bug in tests
docs(plan): update TDD implementation timeline
```

#### TDD 工作流程
```bash
# 1. 創建功能分支
git checkout -b feature/plan8-credit-service

# 2. TDD 循環
# Red: 寫測試
git add . && git commit -m "test(credit): add FIFO consumption test"

# Green: 實作功能
git add . && git commit -m "feat(credit): implement FIFO logic to pass test"

# Refactor: 重構優化
git add . && git commit -m "refactor(credit): optimize FIFO performance"

# 3. 整合測試
npm test
npm run test:integration

# 4. 提交 PR
git push origin feature/plan8-credit-service
```

#### 風險控制措施
- **資料庫變更**：先在開發環境測試，再透過 migration 腳本部署
- **API 向後相容**：確保新 API 不破壞現有功能
- **功能開關**：重要功能使用 feature flag 控制
- **回滾計畫**：每次部署前準備快速回滾方案

---

## �🚀 實作計畫

### Phase 1: 基礎架構 (第1週)

#### 開始前準備
```bash
# 1. 建立基礎分支
git checkout main
git pull origin main
git checkout -b feature/plan8-foundation

# 2. 確認開發環境
bun install
bun run dev  # 確認專案正常運作
```

#### Day 1-2: 資料庫設計與遷移
- [x] 設計完整的資料庫 Schema
- [ ] 建立 Drizzle migration 檔案
- [ ] 執行資料庫遷移
- [ ] 建立基礎的 ORM 模型
- [ ] **Git**: `git commit -m "feat(database): implement credit system schema"`

#### Day 3-4: 核心服務開發
- [ ] 實作 CreditService 核心邏輯
- [ ] 實作 AuthService 權限檢查
- [ ] 建立 API 端點基礎架構
- [ ] 單元測試覆蓋核心邏輯
- [ ] **Git**: `git commit -m "feat(services): implement credit and auth core services"`

#### Day 5: 後台基礎架構
- [ ] 建立 `/admin` 路由保護
- [ ] 實作 AdminLayout 組件
- [ ] 設定 shadcn/ui 商務主題
- [ ] 建立基礎導航結構
- [ ] **Git**: `git commit -m "feat(admin): setup admin layout and routing"`
- [ ] **PR**: 建立 Pull Request 合併到 main

### Phase 2: 核心功能開發 (第2週) - TDD 驅動開發

#### 開始前準備
```bash
# 建立後台功能分支
git checkout main
git pull origin main
git checkout -b feature/plan8-backend
```

#### Day 1-2: TDD 點數管理系統
- [ ] **🔴 Red**: 寫點數 CRUD API 測試
  ```typescript
  test('should create credit transaction with expiry')
  test('should get valid credits excluding expired')
  test('should enforce daily consumption limits')
  ```
- [ ] **🟢 Green**: 實作點數 CRUD API
- [ ] **🔵 Refactor**: 優化資料庫查詢效能
- [ ] **🔴 Red**: 寫註冊獎勵邏輯測試
- [ ] **🟢 Green**: 建立註冊獎勵邏輯
- [ ] **🔵 Refactor**: 抽取獎勵配置
- [ ] **Git**: `git commit -m "test(api): add credit management tests"`
- [ ] **Git**: `git commit -m "feat(api): implement credit management system"`

#### Day 3-4: TDD 後台管理頁面
- [ ] **🔴 Red**: 寫用戶管理頁面測試
  ```typescript
  test('should display users with pagination')
  test('should filter users by role and email')
  test('should adjust user credits with validation')
  ```
- [ ] **🟢 Green**: 實作用戶管理頁面 (`/admin/users`)
- [ ] **🔵 Refactor**: 優化表格組件和過濾邏輯
- [ ] **🔴 Red**: 寫邀請碼管理測試
- [ ] **🟢 Green**: 實作邀請碼生成與管理
- [ ] **🔵 Refactor**: 優化邀請碼安全性
- [ ] **Git**: `git commit -m "test(admin): add user management tests"`
- [ ] **Git**: `git commit -m "feat(admin): implement user and invite code management"`

#### Day 5: TDD 整合測試
- [ ] **整合測試**: 端到端測試後台功能
- [ ] **整合測試**: 測試點數邏輯正確性
- [ ] **整合測試**: 測試權限控制
- [ ] 修復發現的問題
- [ ] **Git**: `git commit -m "test(integration): add comprehensive backend tests"`
- [ ] **PR**: 建立 Pull Request 合併到 main
- [ ] 點數調整功能
- [ ] 邀請碼生成與管理
- [ ] 操作記錄追蹤
- [ ] **Git**: `git commit -m "feat(admin): implement user and invite code management"`

#### Day 5: 整合測試
- [ ] 端到端測試後台功能
- [ ] 測試點數邏輯正確性
- [ ] 修復發現的問題
- [ ] **Git**: `git commit -m "test(admin): add comprehensive backend tests"`
- [ ] **PR**: 建立 Pull Request 合併到 main

### Phase 3: 前端整合與優化 (第3週) - TDD 驅動開發

#### 開始前準備
```bash
# 建立前端整合分支
git checkout main
git pull origin main
git checkout -b feature/plan8-frontend
```

#### Day 1-2: TDD Navbar 整合
- [ ] **🔴 Red**: 寫 CreditDisplay 組件測試
  ```typescript
  test('should display credit status with correct colors')
  test('should show expiring credits warning')
  test('should update in real-time via SWR')
  ```
- [ ] **🟢 Green**: 實作 CreditDisplay 組件
- [ ] **🔵 Refactor**: 優化狀態顏色邏輯
- [ ] **🔴 Red**: 寫 ApiKeyManager 組件測試
- [ ] **🟢 Green**: 實作 ApiKeyManager 組件
- [ ] **🔵 Refactor**: 優化本地存儲邏輯
- [ ] **Git**: `git commit -m "test(frontend): add navbar component tests"`
- [ ] **Git**: `git commit -m "feat(frontend): integrate credit display in navbar"`

#### Day 3-4: TDD 進階功能
- [ ] **🔴 Red**: 寫統計分析頁面測試
- [ ] **🟢 Green**: 實作統計分析頁面
- [ ] **🔵 Refactor**: 優化圖表渲染效能
- [ ] **🔴 Red**: 寫點數過期清理測試
- [ ] **🟢 Green**: 實作點數過期清理 Cron
- [ ] **🔵 Refactor**: 優化清理邏輯效能
- [ ] **Git**: `git commit -m "test(admin): add analytics tests"`
- [ ] **Git**: `git commit -m "feat(admin): add analytics and optimization features"`

#### Day 5: TDD 最終測試與部署
- [ ] **E2E 測試**: 完整系統測試
- [ ] **負載測試**: 效能壓力測試
- [ ] **安全測試**: 權限和數據驗證
- [ ] 生產環境部署
- [ ] 監控告警設定
- [ ] **Git**: `git commit -m "test(e2e): add comprehensive system tests"`
- [ ] **Git**: `git commit -m "feat(deploy): finalize production deployment"`
- [ ] **PR**: 建立最終 Pull Request 合併到 main
- [ ] **Tag**: `git tag v2.0.0 -m "Release: TDD-driven Credit system and admin panel"`
- [ ] 完整系統測試
- [ ] 效能壓力測試
- [ ] 生產環境部署
- [ ] 監控告警設定
- [ ] **Git**: `git commit -m "feat(deploy): finalize production deployment"`
- [ ] **PR**: 建立最終 Pull Request 合併到 main
- [ ] **Tag**: `git tag v2.0.0 -m "Release: Credit system and admin panel"`

---

## 📊 TDD 測試策略

### TDD 測試金字塔

#### 單元測試 (70%)
**專注於個別函數和類別的行為測試**

```typescript
// CreditService 測試範例
describe('CreditService', () => {
  describe('FIFO consumption logic', () => {
    test('should consume oldest credits first', async () => {
      // 🔴 Red: 定義期望行為
      const user = await createTestUser();
      const oldCredit = await createCredit(user.id, 100, -30); // 30天前
      const newCredit = await createCredit(user.id, 50, -1);   // 1天前
      
      // 🟢 Green: 實作功能
      const result = await creditService.consumeCredits(user.id, 75);
      
      // 驗證 FIFO 邏輯
      expect(result.consumed).toBe(75);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].amount).toBe(100); // 先消耗舊的
      expect(result.transactions[1].amount).toBe(25);  // 再消耗新的部分
    });
    
    test('should skip expired credits', async () => {
      const user = await createTestUser();
      const expiredCredit = await createCredit(user.id, 100, -91); // 過期
      const validCredit = await createCredit(user.id, 50, -1);
      
      const result = await creditService.consumeCredits(user.id, 30);
      
      expect(result.consumed).toBe(30);
      expect(result.usedCreditId).toBe(validCredit.id);
    });
  });
  
  describe('Daily limit enforcement', () => {
    test('should enforce daily consumption limits', async () => {
      const user = await createTestUser();
      await createCredit(user.id, 1000, -1);
      
      // 模擬已經消耗了 180 次（接近限制）
      await createDailyUsage(user.id, 180);
      
      const result = await creditService.consumeCredits(user.id, 30);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('DAILY_LIMIT_EXCEEDED');
    });
  });
});
```

#### 整合測試 (20%)
**測試多個組件協作的整體行為**

```typescript
// API 端點整合測試
describe('Credit API Integration', () => {
  test('complete credit flow from purchase to consumption', async () => {
    // 🔴 Red: 定義完整流程
    const admin = await createAdminUser();
    const user = await createTestUser();
    
    // 1. 管理員為用戶添加點數
    const addResponse = await request(app)
      .post('/api/admin/credits')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ userId: user.id, amount: 100, reason: 'test' });
    
    expect(addResponse.status).toBe(200);
    
    // 2. 用戶消耗點數
    const consumeResponse = await request(app)
      .post('/api/runs')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ flowId: 'test-flow', count: 5 });
    
    expect(consumeResponse.status).toBe(200);
    
    // 3. 驗證點數正確扣除
    const balance = await creditService.getUserBalance(user.id);
    expect(balance).toBe(95);
  });
});
```

#### E2E 測試 (10%)
**從用戶角度測試完整系統**

```typescript
// Playwright E2E 測試
describe('Admin Panel E2E', () => {
  test('admin can manage user credits through UI', async ({ page }) => {
    // 🔴 Red: 定義用戶操作流程
    await page.goto('/admin/users');
    await page.login(adminCredentials);
    
    // 搜尋特定用戶
    await page.fill('[data-testid="user-search"]', 'test@example.com');
    await page.click('[data-testid="search-button"]');
    
    // 調整用戶點數
    await page.click('[data-testid="edit-credits"]');
    await page.fill('[data-testid="credit-amount"]', '100');
    await page.click('[data-testid="add-credits"]');
    
    // 驗證成功訊息
    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('點數調整成功');
  });
### TDD 測試配置

#### Jest 配置優化
```javascript
// jest.config.js - TDD 專用配置
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  
  // TDD 專用設定
  watchMode: true,        // 開啟監聽模式
  verbose: true,          // 詳細輸出
  bail: 1,               // 遇到錯誤立即停止
  
  // 覆蓋率要求
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // 測試優化
  maxWorkers: '50%',
  cache: true,
  
  // TDD 友善設定
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  
  // Red-Green-Refactor 循環支援
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './test-report',
      filename: 'tdd-report.html',
      expand: true
    }]
  ]
};
```

#### TDD 測試輔助工具
```typescript
// test/helpers/test-factory.ts
export const TestDataFactory = {
  createUser: (overrides?: Partial<User>) => ({
    id: nanoid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role: 'user',
    created_at: new Date(),
    ...overrides
  }),
  
  createCredit: (userId: string, amount: number, daysOffset = 0) => ({
    id: nanoid(),
    user_id: userId,
    amount,
    expires_at: addDays(new Date(), 90 + daysOffset),
    created_at: addDays(new Date(), daysOffset),
    type: 'purchase' as const
  }),
  
  createDailyUsage: (userId: string, count: number) => ({
    user_id: userId,
    date: format(new Date(), 'yyyy-MM-dd'),
    consumption_count: count
  })
};

// test/helpers/test-utils.ts
export const TestUtils = {
  cleanDatabase: async () => {
    // 清理測試資料庫
    await db.delete(creditTransactions);
    await db.delete(dailyUsage);
    await db.delete(users);
  },
  
  setupTestUser: async (role: 'user' | 'admin' = 'user') => {
    const user = TestDataFactory.createUser({ role });
    const [created] = await db.insert(users).values(user).returning();
    return created;
  },
  
  mockAuthContext: (user: User) => {
    // 模擬認證上下文
    jest.spyOn(authService, 'getCurrentUser').mockResolvedValue(user);
  }
};
```

---

## 🔍 TDD 風險管控

### TDD 開發風險控制
| 風險 | 機率 | 影響 | TDD 緩解策略 |
|------|------|------|-------------|
| **測試覆蓋不足** | 中 | 高 | 設定 95% 覆蓋率門檻，CI 自動檢查 |
| **測試與實作脫節** | 低 | 中 | Red-Green-Refactor 循環確保一致性 |
| **過度測試** | 中 | 低 | 專注於行為測試，避免實作細節測試 |
| **FIFO 邏輯錯誤** | 低 | 中 | 充分的單元測試覆蓋 |
| **權限繞過** | 低 | 高 | 多層權限檢查機制 |
| **API Key 洩露** | 中 | 中 | 僅本地儲存，不上傳伺服器 |

### 業務風險
| 風險 | 機率 | 影響 | 緩解策略 |
|------|------|------|----------|
| **用戶濫用** | 中 | 中 | 每日限制與監控告警 |
| **付費轉換率低** | 高 | 中 | 優化 API Key 設定流程 |
| **客服負擔** | 中 | 低 | 完善的自助服務功能 |

### 緊急應對計畫
- **點數異常**：緊急停用點數消耗，調查問題
- **大量濫用**：臨時調整每日限制
- **系統故障**：備援方案與快速回滾

---

## 📈 TDD 成功指標

### TDD 品質指標
- **測試覆蓋率**：> 95% (單元測試)
- **測試執行時間**：< 30 秒 (全套單元測試)
- **Red-Green-Refactor 循環**：每個功能完整遵循 TDD 循環
- **測試案例品質**：測試先行，確保需求理解正確

### 技術指標  
- **系統可用性**：99.9% uptime
- **API 回應時間**：< 500ms (P95)
- **資料正確性**：點數交易 100% 準確
- **代碼品質**：所有功能通過 TDD 驗證

### 業務指標
- **用戶轉換率**：免費用戶 → 付費用戶 > 15%
- **點數消耗率**：每日活躍用戶點數使用率 > 60%
- **客服工單**：點數相關問題 < 5%
- **用戶滿意度**：後台操作便利性評分 > 4.5/5

### 監控儀表板
- 即時點數交易監控
- 用戶行為分析
- 系統效能指標
- 錯誤率追蹤

---

## � 部署與維運

### 環境設定
```bash
# 環境變數
DATABASE_URL=postgresql://...
ADMIN_EMAIL=admin@cosify.com
CREDITS_CLEANUP_CRON=0 0 * * *  # 每日午夜清理
DAILY_LIMIT_RESET_TIMEZONE=Asia/Taipei
```

### 監控告警
- 點數異常消耗告警
- API 錯誤率過高告警
- 資料庫連線異常告警
- 磁碟空間不足告警

### 備份策略
- 每日完整資料庫備份
- 每小時增量備份
- 點數交易記錄永久保存
- 災難復原計畫

---

## 📚 開發資源

### 技術文檔
- [Drizzle ORM 文檔](https://orm.drizzle.team/)
- [shadcn/ui 組件庫](https://ui.shadcn.com/)
- [SWR 資料同步](https://swr.vercel.app/)
- [Next.js App Router](https://nextjs.org/docs)

### 設計資源
- Figma 設計稿：[後台管理系統](https://figma.com/...)
- UI 設計規範：[Cosify Design System](https://...)
- 圖示庫：Lucide React

### 測試工具
- 單元測試：Jest + Testing Library
- API 測試：Supertest
- E2E 測試：Playwright
- 效能測試：Artillery

---

## ✅ 檢查清單

### 開發前準備
- [ ] 確認資料庫設計無誤
- [ ] 建立開發環境
- [ ] 準備測試資料
- [ ] 設定 CI/CD 流程

### 開發過程
- [ ] 每日 Standup 追蹤進度
- [ ] Code Review 確保品質
- [ ] 持續整合測試
- [ ] 文檔同步更新

### 部署前檢查
- [ ] 所有測試通過
- [ ] 效能基準測試完成
- [ ] 安全性檢查通過
- [ ] 備份恢復測試成功

### 上線後監控
- [ ] 監控儀表板運作正常
- [ ] 告警機制測試完成
- [ ] 客服團隊培訓完成
- [ ] 用戶反饋收集機制就緒

---

**最後更新**：2025年9月7日  
**版本**：v1.0  
**負責人**：開發團隊  
**審核人**：產品負責人
