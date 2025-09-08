// 測試信號量機制的簡單調試腳本
const { createTransactionManager } = require('./src/server/services/transaction-manager');

// 模擬數據庫
const mockDatabase = {
    begin: () => Promise.resolve({ transactionId: 'tx_123' }),
    commit: () => Promise.resolve(),
    rollback: () => Promise.resolve(),
    query: async (sql) => {
        const id = sql.match(/id = (\d+)/)?.[1] || 'unknown';
        console.log(`[${new Date().toISOString()}] Query ${id} started`);
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 延遲
        console.log(`[${new Date().toISOString()}] Query ${id} finished`);
        return { affectedRows: 1 };
    }
};

const transactionManager = createTransactionManager(mockDatabase, { maxConcurrentTransactions: 2 });

async function test() {
    console.log('Starting 5 concurrent transactions with pool size 2...');

    const promises = Array.from({ length: 5 }, (_, i) =>
        transactionManager.withTransaction(async (tx) => {
            console.log(`[${new Date().toISOString()}] Transaction ${i + 1} callback started`);
            const result = await tx.query(`SELECT * FROM users WHERE id = ${i + 1}`);
            console.log(`[${new Date().toISOString()}] Transaction ${i + 1} callback finished`);
            return result;
        }).then(result => {
            console.log(`[${new Date().toISOString()}] Transaction ${i + 1} completed`);
            return result;
        })
    );

    await Promise.all(promises);
    console.log('All transactions completed');
}

test().catch(console.error);
