/**
 * 3D抽奖系统测试用例
 * 在浏览器控制台运行: LotteryTests.runAll()
 */

const LotteryTests = {
    passed: 0,
    failed: 0,
    results: [],
    
    /**
     * 断言函数
     */
    assert(condition, message) {
        if (condition) {
            this.passed++;
            this.results.push({ status: 'PASS', message });
            console.log(`✅ PASS: ${message}`);
        } else {
            this.failed++;
            this.results.push({ status: 'FAIL', message });
            console.error(`❌ FAIL: ${message}`);
        }
    },
    
    assertEqual(actual, expected, message) {
        const condition = JSON.stringify(actual) === JSON.stringify(expected);
        this.assert(condition, `${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
    },
    
    assertThrows(fn, message) {
        try {
            fn();
            this.assert(false, `${message} - Expected error but none thrown`);
        } catch (e) {
            this.assert(true, `${message} - Error thrown as expected: ${e.message}`);
        }
    },
    
    /**
     * 重置测试环境
     */
    reset() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
        LotteryStorage.resetAll();
        console.log('🔄 Test environment reset');
    },
    
    /**
     * LotteryStorage模块测试
     */
    testStorage() {
        console.log('\n📦 Testing LotteryStorage Module...');
        
        // 测试奖品CRUD
        console.log('\n--- Prize CRUD Tests ---');
        
        // 添加奖品
        const prize1 = LotteryStorage.addPrize({ name: '一等奖', count: 3 });
        this.assert(prize1.id !== undefined, 'Prize should have an ID');
        this.assertEqual(prize1.name, '一等奖', 'Prize name should match');
        this.assertEqual(prize1.count, 3, 'Prize count should match');
        this.assertEqual(prize1.drawnCount, 0, 'Initial drawnCount should be 0');
        
        // 获取奖品列表
        let prizes = LotteryStorage.getPrizes();
        this.assertEqual(prizes.length, 1, 'Should have 1 prize');
        
        // 添加第二个奖品
        const prize2 = LotteryStorage.addPrize({ name: '二等奖', count: 5 });
        prizes = LotteryStorage.getPrizes();
        this.assertEqual(prizes.length, 2, 'Should have 2 prizes');
        
        // 更新奖品
        const updated = LotteryStorage.updatePrize(prize1.id, { drawnCount: 1 });
        this.assertEqual(updated.drawnCount, 1, 'DrawnCount should be updated');
        
        // 删除奖品
        LotteryStorage.deletePrize(prize2.id);
        prizes = LotteryStorage.getPrizes();
        this.assertEqual(prizes.length, 1, 'Should have 1 prize after deletion');
        
        // 测试重名奖品
        this.assertThrows(() => {
            LotteryStorage.addPrize({ name: '一等奖', count: 1 });
        }, 'Should throw error for duplicate prize name');
        
        // 测试无效奖品数据
        this.assertThrows(() => {
            LotteryStorage.addPrize({ name: '', count: 1 });
        }, 'Should throw error for empty prize name');
        
        this.assertThrows(() => {
            LotteryStorage.addPrize({ name: '测试', count: 0 });
        }, 'Should throw error for invalid count');
    },
    
    testParticipants() {
        console.log('\n--- Participant Tests ---');
        
        // 添加参与者
        const participants = [
            { name: '张三', phone: '13800138001', department: '技术部' },
            { name: '李四', phone: '', department: '产品部' },
            { name: '王五', department: '运营部' }
        ];
        
        LotteryStorage.addParticipants(participants);
        let allParticipants = LotteryStorage.getParticipants();
        this.assertEqual(allParticipants.length, 3, 'Should have 3 participants');
        
        // 验证参与者数据
        this.assert(allParticipants[0].id !== undefined, 'Participant should have ID');
        this.assertEqual(allParticipants[0].hasWon, false, 'Initial hasWon should be false');
        
        // 获取可用参与者
        let available = LotteryStorage.getAvailableParticipants();
        this.assertEqual(available.length, 3, 'All participants should be available');
        
        // 标记中奖
        LotteryStorage.markParticipantWon(allParticipants[0].id);
        available = LotteryStorage.getAvailableParticipants();
        this.assertEqual(available.length, 2, 'Should have 2 available after one won');
        
        // 测试重复标记
        const result = LotteryStorage.markParticipantWon(allParticipants[0].id);
        this.assertEqual(result, false, 'Should return false for already won participant');
        
        // 清空参与者
        LotteryStorage.clearParticipants();
        allParticipants = LotteryStorage.getParticipants();
        this.assertEqual(allParticipants.length, 0, 'Should have 0 participants after clear');
    },
    
    testWinners() {
        console.log('\n--- Winner Tests ---');
        
        // 准备数据
        const prize = LotteryStorage.addPrize({ name: '测试奖品', count: 2 });
        LotteryStorage.addParticipants([
            { name: '测试用户1' },
            { name: '测试用户2' }
        ]);
        const participants = LotteryStorage.getParticipants();
        
        // 添加中奖记录
        LotteryStorage.addWinner(prize.id, participants[0]);
        
        let winners = LotteryStorage.getWinners();
        this.assert(winners[prize.id] !== undefined, 'Should have winners for prize');
        this.assertEqual(winners[prize.id].length, 1, 'Should have 1 winner');
        
        // 验证奖品计数更新
        const updatedPrize = LotteryStorage.getPrizes().find(p => p.id === prize.id);
        this.assertEqual(updatedPrize.drawnCount, 1, 'Prize drawnCount should be 1');
        
        // 验证参与者状态
        const updatedParticipant = LotteryStorage.getParticipants().find(p => p.id === participants[0].id);
        this.assertEqual(updatedParticipant.hasWon, true, 'Participant should be marked as won');
        
        // 测试重复中奖
        this.assertThrows(() => {
            LotteryStorage.addWinner(prize.id, participants[0]);
        }, 'Should throw error for already won participant');
    },
    
    testSettings() {
        console.log('\n--- Settings Tests ---');
        
        // 获取默认设置
        let settings = LotteryStorage.getSettings();
        this.assertEqual(settings.lotterySpeed, 'normal', 'Default speed should be normal');
        
        // 保存设置
        settings.lotterySpeed = 'fast';
        LotteryStorage.saveSettings(settings);
        
        settings = LotteryStorage.getSettings();
        this.assertEqual(settings.lotterySpeed, 'fast', 'Speed should be updated to fast');
    },
    
    testDataIntegrity() {
        console.log('\n--- Data Integrity Tests ---');
        
        LotteryStorage.resetAll();
        
        // 创建正常数据
        const prize = LotteryStorage.addPrize({ name: '完整性测试奖品', count: 1 });
        LotteryStorage.addParticipants([{ name: '完整性测试用户' }]);
        const participant = LotteryStorage.getParticipants()[0];
        LotteryStorage.addWinner(prize.id, participant);
        
        // 验证完整性
        const integrity = LotteryStorage.validateIntegrity();
        this.assertEqual(integrity.valid, true, 'Data integrity should be valid');
        this.assertEqual(integrity.issues.length, 0, 'Should have no integrity issues');
    },
    
    /**
     * Lottery模块测试
     */
    testLottery() {
        console.log('\n🎰 Testing Lottery Module...');
        
        // 测试初始状态
        console.log('\n--- Initial State Tests ---');
        Lottery.reset();
        const state = Lottery.getState();
        this.assertEqual(state.isRunning, false, 'Initial isRunning should be false');
        this.assertEqual(state.currentPrize, null, 'Initial currentPrize should be null');
        
        // 测试空参与者启动
        console.log('\n--- Empty Participants Tests ---');
        const startResult = Lottery.start('test-prize', [], 'normal');
        this.assertEqual(startResult, false, 'Should not start with empty participants');
        
        // 测试正常启动
        console.log('\n--- Normal Start Tests ---');
        const testParticipants = [
            { id: '1', name: '测试1' },
            { id: '2', name: '测试2' },
            { id: '3', name: '测试3' }
        ];
        
        // 初始化球体
        Lottery.initSphere(testParticipants);
        this.assertEqual(Lottery.nameElements.length, 3, 'Should have 3 name elements');
        
        // 启动抽奖
        const started = Lottery.start('test-prize', testParticipants, 'fast');
        this.assertEqual(started, true, 'Should start successfully');
        this.assertEqual(Lottery.isRunning, true, 'isRunning should be true');
        
        // 测试重复启动
        const startAgain = Lottery.start('test-prize', testParticipants, 'fast');
        this.assertEqual(startAgain, false, 'Should not start when already running');
        
        // 重置
        Lottery.reset();
        this.assertEqual(Lottery.isRunning, false, 'isRunning should be false after reset');
    },
    
    /**
     * 工具函数测试
     */
    testUtils() {
        console.log('\n🔧 Testing Utility Functions...');
        
        // 测试HTML转义
        console.log('\n--- HTML Escape Tests ---');
        this.assertEqual(escapeHtml('<script>'), '&lt;script&gt;', 'Should escape HTML tags');
        this.assertEqual(escapeHtml('&'), '&amp;', 'Should escape ampersand');
        this.assertEqual(escapeHtml('"'), '&quot;', 'Should escape quotes');
        this.assertEqual(escapeHtml(null), '', 'Should handle null');
        this.assertEqual(escapeHtml(undefined), '', 'Should handle undefined');
        this.assertEqual(escapeHtml(123), '123', 'Should handle numbers');
    },
    
    /**
     * Logger测试
     */
    testLogger() {
        console.log('\n📝 Testing Logger Module...');
        
        Logger.clear();
        
        // 测试各级别日志
        Logger.debug('Debug message');
        Logger.info('Info message');
        Logger.warn('Warn message');
        Logger.error('Error message');
        
        const logs = Logger.getLogs();
        this.assert(logs.length >= 4, 'Should have at least 4 log entries');
        
        // 测试action日志
        Logger.action('TEST_ACTION', { key: 'value' });
        const actionLogs = logs.filter(l => l.message.includes('[ACTION]'));
        this.assert(actionLogs.length >= 0, 'Should have action logs');
        
        // 测试导出
        const exported = Logger.export();
        this.assert(typeof exported === 'string', 'Export should return string');
        this.assert(exported.startsWith('['), 'Export should be valid JSON array');
    },
    
    /**
     * 边界条件测试
     */
    testEdgeCases() {
        console.log('\n⚠️ Testing Edge Cases...');
        
        LotteryStorage.resetAll();
        
        // 测试大量数据
        console.log('\n--- Large Data Tests ---');
        const manyParticipants = [];
        for (let i = 0; i < 100; i++) {
            manyParticipants.push({ name: `用户${i}`, department: `部门${i % 10}` });
        }
        LotteryStorage.addParticipants(manyParticipants);
        this.assertEqual(LotteryStorage.getParticipants().length, 100, 'Should handle 100 participants');
        
        // 测试球体显示限制
        Lottery.initSphere(LotteryStorage.getAvailableParticipants());
        this.assert(Lottery.nameElements.length <= 30, 'Should limit displayed names to 30');
        
        // 测试特殊字符
        console.log('\n--- Special Character Tests ---');
        LotteryStorage.resetAll();
        const specialPrize = LotteryStorage.addPrize({ name: '特殊<>&"\'奖品', count: 1 });
        this.assert(specialPrize.name.includes('<'), 'Should preserve special characters in storage');
        
        // 测试空字符串处理
        console.log('\n--- Empty String Tests ---');
        LotteryStorage.addParticipants([{ name: '  空格测试  ', phone: '  ', department: '' }]);
        const trimmedParticipant = LotteryStorage.getParticipants()[0];
        this.assertEqual(trimmedParticipant.name, '空格测试', 'Name should be trimmed');
    },
    
    /**
     * 运行所有测试
     */
    runAll() {
        console.log('🚀 Starting Lottery System Tests...\n');
        console.log('=' .repeat(50));
        
        this.reset();
        
        try {
            this.testStorage();
            this.reset();
            
            this.testParticipants();
            this.reset();
            
            this.testWinners();
            this.reset();
            
            this.testSettings();
            this.reset();
            
            this.testDataIntegrity();
            this.reset();
            
            this.testLottery();
            
            this.testUtils();
            
            this.testLogger();
            
            this.testEdgeCases();
            
        } catch (error) {
            console.error('❌ Test execution error:', error);
            this.failed++;
        }
        
        // 清理测试数据
        LotteryStorage.resetAll();
        Lottery.reset();
        
        // 输出结果
        console.log('\n' + '='.repeat(50));
        console.log('📊 Test Results Summary');
        console.log('='.repeat(50));
        console.log(`✅ Passed: ${this.passed}`);
        console.log(`❌ Failed: ${this.failed}`);
        console.log(`📈 Total:  ${this.passed + this.failed}`);
        console.log(`📉 Pass Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
        console.log('='.repeat(50));
        
        if (this.failed === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️ Some tests failed. Check the logs above.');
        }
        
        return {
            passed: this.passed,
            failed: this.failed,
            results: this.results
        };
    }
};

// 导出到全局
window.LotteryTests = LotteryTests;

console.log('📋 Test suite loaded. Run LotteryTests.runAll() to execute tests.');
