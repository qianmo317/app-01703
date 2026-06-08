/**
 * 数据存储模块
 * 使用 LocalStorage 持久化数据
 * 增强版：添加数据验证、错误处理、日志记录
 */

const StorageKeys = {
    PRIZES: 'lottery_prizes',
    PARTICIPANTS: 'lottery_participants',
    WINNERS: 'lottery_winners',
    SETTINGS: 'lottery_settings'
};

const LotteryStorage = {
    /**
     * 安全读取LocalStorage
     */
    _safeGet(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            if (!data) return defaultValue;
            
            const parsed = JSON.parse(data);
            Logger.debug(`Storage read: ${key}`, { itemCount: Array.isArray(parsed) ? parsed.length : 1 });
            return parsed;
        } catch (error) {
            Logger.error(`Storage read error: ${key}`, { error: error.message });
            return defaultValue;
        }
    },
    
    /**
     * 安全写入LocalStorage
     */
    _safeSet(key, value) {
        try {
            const serialized = JSON.stringify(value);
            
            // 检查存储配额
            const sizeInKB = (serialized.length * 2) / 1024;
            if (sizeInKB > 4096) {
                Logger.warn(`Storage size warning: ${key} is ${sizeInKB.toFixed(2)}KB`);
            }
            
            localStorage.setItem(key, serialized);
            Logger.debug(`Storage write: ${key}`, { sizeKB: sizeInKB.toFixed(2) });
            return true;
        } catch (error) {
            Logger.error(`Storage write error: ${key}`, { error: error.message });
            
            // 处理配额超限
            if (error.name === 'QuotaExceededError') {
                Logger.error('LocalStorage quota exceeded');
            }
            return false;
        }
    },

    /**
     * 验证奖品数据
     */
    _validatePrize(prize) {
        if (!prize || typeof prize !== 'object') {
            return { valid: false, error: '奖品数据无效' };
        }
        if (!prize.name || typeof prize.name !== 'string' || prize.name.trim() === '') {
            return { valid: false, error: '奖品名称不能为空' };
        }
        if (!Number.isInteger(prize.count) || prize.count < 1) {
            return { valid: false, error: '中奖人数必须是正整数' };
        }
        if (prize.count > 1000) {
            return { valid: false, error: '中奖人数不能超过1000' };
        }
        return { valid: true };
    },
    
    /**
     * 验证参与者数据
     */
    _validateParticipant(participant) {
        if (!participant || typeof participant !== 'object') {
            return { valid: false, error: '参与者数据无效' };
        }
        if (!participant.name || typeof participant.name !== 'string' || participant.name.trim() === '') {
            return { valid: false, error: '参与者姓名不能为空' };
        }
        if (participant.name.length > 50) {
            return { valid: false, error: '姓名长度不能超过50字符' };
        }
        return { valid: true };
    },

    /**
     * 获取奖品列表
     */
    getPrizes() {
        return this._safeGet(StorageKeys.PRIZES, []);
    },

    /**
     * 保存奖品列表
     */
    savePrizes(prizes) {
        return this._safeSet(StorageKeys.PRIZES, prizes);
    },

    /**
     * 添加奖品
     */
    addPrize(prize) {
        const validation = this._validatePrize(prize);
        if (!validation.valid) {
            Logger.warn('Prize validation failed', { prize, error: validation.error });
            throw new Error(validation.error);
        }
        
        const prizes = this.getPrizes();
        
        // 检查重名
        if (prizes.some(p => p.name === prize.name.trim())) {
            Logger.warn('Duplicate prize name', { name: prize.name });
            throw new Error('已存在同名奖品');
        }
        
        const newPrize = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            name: prize.name.trim(),
            count: prize.count,
            drawnCount: 0,
            createdAt: new Date().toISOString()
        };
        
        prizes.push(newPrize);
        this.savePrizes(prizes);
        
        Logger.action('ADD_PRIZE', { prize: newPrize });
        return newPrize;
    },

    /**
     * 更新奖品
     */
    updatePrize(prizeId, updates) {
        if (!prizeId) {
            Logger.warn('Update prize failed: no prizeId');
            return null;
        }
        
        const prizes = this.getPrizes();
        const index = prizes.findIndex(p => p.id === prizeId);
        
        if (index === -1) {
            Logger.warn('Prize not found for update', { prizeId });
            return null;
        }
        
        const oldPrize = { ...prizes[index] };
        prizes[index] = { ...prizes[index], ...updates, updatedAt: new Date().toISOString() };
        this.savePrizes(prizes);
        
        Logger.action('UPDATE_PRIZE', { prizeId, oldPrize, newPrize: prizes[index] });
        return prizes[index];
    },

    /**
     * 删除奖品
     */
    deletePrize(prizeId) {
        if (!prizeId) {
            Logger.warn('Delete prize failed: no prizeId');
            return false;
        }
        
        const prizes = this.getPrizes();
        const prize = prizes.find(p => p.id === prizeId);
        
        if (!prize) {
            Logger.warn('Prize not found for deletion', { prizeId });
            return false;
        }
        
        const filtered = prizes.filter(p => p.id !== prizeId);
        this.savePrizes(filtered);
        
        // 同时删除该奖品的中奖记录
        const winners = this.getWinners();
        const deletedWinners = winners[prizeId] || [];
        delete winners[prizeId];
        this.saveWinners(winners);
        
        Logger.action('DELETE_PRIZE', { prize, deletedWinnersCount: deletedWinners.length });
        return true;
    },

    /**
     * 获取参与者列表
     */
    getParticipants() {
        return this._safeGet(StorageKeys.PARTICIPANTS, []);
    },

    /**
     * 保存参与者列表
     */
    saveParticipants(participants) {
        return this._safeSet(StorageKeys.PARTICIPANTS, participants);
    },

    /**
     * 添加参与者
     */
    addParticipants(newParticipants) {
        if (!Array.isArray(newParticipants) || newParticipants.length === 0) {
            Logger.warn('Invalid participants array');
            return [];
        }
        
        const participants = this.getParticipants();
        const existingNames = new Set(participants.map(p => p.name));
        const added = [];
        const skipped = [];
        
        newParticipants.forEach(p => {
            const validation = this._validateParticipant(p);
            if (!validation.valid) {
                skipped.push({ participant: p, reason: validation.error });
                return;
            }
            
            const name = p.name.trim();
            
            // 检查重名（可选：允许重名则注释此段）
            if (existingNames.has(name)) {
                skipped.push({ participant: p, reason: '姓名重复' });
                return;
            }
            
            const newParticipant = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                name: name,
                phone: (p.phone || '').toString().trim(),
                department: (p.department || '').toString().trim(),
                hasWon: false,
                addedAt: new Date().toISOString()
            };
            
            participants.push(newParticipant);
            existingNames.add(name);
            added.push(newParticipant);
        });
        
        this.saveParticipants(participants);
        
        Logger.action('ADD_PARTICIPANTS', { 
            addedCount: added.length, 
            skippedCount: skipped.length,
            skipped: skipped.length > 0 ? skipped : undefined
        });
        
        return participants;
    },

    /**
     * 标记参与者已中奖
     */
    markParticipantWon(participantId) {
        if (!participantId) {
            Logger.warn('Mark won failed: no participantId');
            return false;
        }
        
        const participants = this.getParticipants();
        const index = participants.findIndex(p => p.id === participantId);
        
        if (index === -1) {
            Logger.warn('Participant not found', { participantId });
            return false;
        }
        
        if (participants[index].hasWon) {
            Logger.warn('Participant already won', { participantId });
            return false;
        }
        
        participants[index].hasWon = true;
        participants[index].wonAt = new Date().toISOString();
        this.saveParticipants(participants);
        
        Logger.debug('Participant marked as won', { participantId });
        return true;
    },

    /**
     * 获取可参与抽奖的人员（未中奖）
     */
    getAvailableParticipants() {
        const available = this.getParticipants().filter(p => !p.hasWon);
        Logger.debug('Get available participants', { count: available.length });
        return available;
    },

    /**
     * 清空参与者
     */
    clearParticipants() {
        const count = this.getParticipants().length;
        this.saveParticipants([]);
        Logger.action('CLEAR_PARTICIPANTS', { clearedCount: count });
    },

    /**
     * 获取中奖记录
     */
    getWinners() {
        return this._safeGet(StorageKeys.WINNERS, {});
    },

    /**
     * 保存中奖记录
     */
    saveWinners(winners) {
        return this._safeSet(StorageKeys.WINNERS, winners);
    },

    /**
     * 添加中奖记录
     */
    addWinner(prizeId, participant) {
        if (!prizeId || !participant || !participant.id) {
            Logger.error('Invalid winner data', { prizeId, participant });
            throw new Error('中奖数据无效');
        }
        
        // 检查是否已中奖
        const existingParticipant = this.getParticipants().find(p => p.id === participant.id);
        if (existingParticipant?.hasWon) {
            Logger.error('Participant already won', { participantId: participant.id });
            throw new Error('该参与者已中奖');
        }
        
        const winners = this.getWinners();
        if (!winners[prizeId]) {
            winners[prizeId] = [];
        }
        
        const winnerRecord = {
            ...participant,
            wonAt: new Date().toISOString()
        };
        
        winners[prizeId].push(winnerRecord);
        this.saveWinners(winners);
        
        // 标记参与者已中奖
        this.markParticipantWon(participant.id);
        
        // 更新奖品已抽取数量
        const prizes = this.getPrizes();
        const prizeIndex = prizes.findIndex(p => p.id === prizeId);
        if (prizeIndex !== -1) {
            prizes[prizeIndex].drawnCount = (prizes[prizeIndex].drawnCount || 0) + 1;
            this.savePrizes(prizes);
        }
        
        Logger.action('ADD_WINNER', { 
            prizeId, 
            winner: { id: participant.id, name: participant.name },
            totalWinnersForPrize: winners[prizeId].length
        });
        
        return winnerRecord;
    },

    /**
     * 获取设置
     */
    getSettings() {
        return this._safeGet(StorageKeys.SETTINGS, {
            backgroundImage: '',
            lotterySpeed: 'normal'
        });
    },

    /**
     * 保存设置
     */
    saveSettings(settings) {
        const result = this._safeSet(StorageKeys.SETTINGS, settings);
        Logger.action('SAVE_SETTINGS', { settings: { ...settings, backgroundImage: settings.backgroundImage ? '[IMAGE]' : '' } });
        return result;
    },

    /**
     * 重置所有数据
     */
    resetAll() {
        const stats = {
            prizes: this.getPrizes().length,
            participants: this.getParticipants().length,
            winners: Object.values(this.getWinners()).flat().length
        };
        
        localStorage.removeItem(StorageKeys.PRIZES);
        localStorage.removeItem(StorageKeys.PARTICIPANTS);
        localStorage.removeItem(StorageKeys.WINNERS);
        localStorage.removeItem(StorageKeys.SETTINGS);
        
        Logger.action('RESET_ALL', stats);
    },
    
    /**
     * 获取存储统计信息
     */
    getStats() {
        const prizes = this.getPrizes();
        const participants = this.getParticipants();
        const winners = this.getWinners();
        
        return {
            prizesCount: prizes.length,
            participantsCount: participants.length,
            availableCount: participants.filter(p => !p.hasWon).length,
            winnersCount: Object.values(winners).flat().length,
            storageUsed: this._getStorageSize()
        };
    },
    
    /**
     * 获取存储使用量
     */
    _getStorageSize() {
        let total = 0;
        for (const key of Object.values(StorageKeys)) {
            const item = localStorage.getItem(key);
            if (item) {
                total += item.length * 2; // UTF-16
            }
        }
        return (total / 1024).toFixed(2) + ' KB';
    },
    
    /**
     * 数据完整性检查
     */
    validateIntegrity() {
        const issues = [];
        
        // 检查奖品数据
        const prizes = this.getPrizes();
        prizes.forEach((prize, index) => {
            if (!prize.id) issues.push(`Prize ${index} missing id`);
            if (!prize.name) issues.push(`Prize ${index} missing name`);
        });
        
        // 检查参与者数据
        const participants = this.getParticipants();
        participants.forEach((p, index) => {
            if (!p.id) issues.push(`Participant ${index} missing id`);
            if (!p.name) issues.push(`Participant ${index} missing name`);
        });
        
        // 检查中奖记录一致性
        const winners = this.getWinners();
        Object.entries(winners).forEach(([prizeId, winnerList]) => {
            const prize = prizes.find(p => p.id === prizeId);
            if (!prize) {
                issues.push(`Winners reference non-existent prize: ${prizeId}`);
            }
            
            winnerList.forEach(winner => {
                const participant = participants.find(p => p.id === winner.id);
                if (participant && !participant.hasWon) {
                    issues.push(`Winner ${winner.id} not marked as won`);
                }
            });
        });
        
        if (issues.length > 0) {
            Logger.warn('Data integrity issues found', { issues });
        } else {
            Logger.info('Data integrity check passed');
        }
        
        return { valid: issues.length === 0, issues };
    }
};
