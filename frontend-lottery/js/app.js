/**
 * 3D抽奖系统主应用
 * 增强版：添加错误处理、日志记录、输入验证
 */

// 全局状态
let currentPrizeId = null;
let isLotteryRunning = false;
// 抽奖模式：'single' 单抽 | 'batch' 批量
let lotteryMode = 'single';
// 本次批量抽奖的中奖名单（仅运行期间持有）
let currentBatchWinners = [];

// 随机姓名库
const SURNAMES = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '罗', '高'];
const NAMES = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '华', '平'];
const DEPARTMENTS = ['技术部', '产品部', '运营部', '市场部', '人事部', '财务部', '行政部', '销售部', '客服部', '研发部'];

/**
 * 页面初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    Logger.info('Application starting');
    initApp();
});

function initApp() {
    try {
        // 初始化粒子效果
        initParticles();
        
        // 数据完整性检查
        const integrity = LotteryStorage.validateIntegrity();
        if (!integrity.valid) {
            Logger.warn('Data integrity issues detected on startup');
        }
        
        // 加载设置
        loadSettings();
        
        // 渲染奖品列表
        renderPrizeList();
        
        // 渲染参与者列表
        renderParticipantList();
        
        // 初始化3D球体
        const participants = LotteryStorage.getAvailableParticipants();
        Lottery.initSphere(participants);
        
        // 初始化模式切换控件
        updateModeSwitchUI();
        
        // 输出统计信息
        const stats = LotteryStorage.getStats();
        Logger.info('Application initialized', stats);
        
    } catch (error) {
        Logger.error('Application initialization failed', { error: error.message, stack: error.stack });
        showToast('应用初始化失败，请刷新页面重试', 'error');
    }
}

/**
 * 初始化粒子效果
 */
function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        container.appendChild(particle);
    }
}


/**
 * 加载设置
 */
function loadSettings() {
    try {
        const settings = LotteryStorage.getSettings();
        
        // 应用背景图片
        if (settings.backgroundImage) {
            const bgLayer = document.getElementById('background-layer');
            if (bgLayer) {
                bgLayer.style.backgroundImage = `url(${settings.backgroundImage})`;
            }
        }
        
        // 设置抽奖速度选项
        const speedSelect = document.getElementById('lotterySpeed');
        if (speedSelect) {
            speedSelect.value = settings.lotterySpeed || 'normal';
        }
        
        Logger.debug('Settings loaded', { speed: settings.lotterySpeed });
    } catch (error) {
        Logger.error('Failed to load settings', { error: error.message });
    }
}

/**
 * 渲染奖品列表
 */
function renderPrizeList() {
    try {
        const prizes = LotteryStorage.getPrizes();
        const container = document.getElementById('prizeList');
        
        if (!container) {
            Logger.error('Prize list container not found');
            return;
        }
        
        if (prizes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎁</div>
                    <div class="empty-state-text">暂无奖品，点击上方按钮添加</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = prizes.map(prize => {
            const drawnCount = prize.drawnCount || 0;
            const totalCount = prize.count || 1;
            const isCompleted = drawnCount >= totalCount;
            const isActive = prize.id === currentPrizeId;
            const progress = Math.min((drawnCount / totalCount) * 100, 100);
            
            return `
                <div class="prize-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" 
                     onclick="selectPrize('${escapeHtml(prize.id)}')" 
                     data-prize-id="${escapeHtml(prize.id)}">
                    <button class="prize-delete" onclick="event.stopPropagation(); deletePrize('${escapeHtml(prize.id)}')">&times;</button>
                    <div class="prize-name">${escapeHtml(prize.name)}</div>
                    <div class="prize-info">中奖人数：${drawnCount} / ${totalCount}</div>
                    <div class="prize-progress">
                        <div class="prize-progress-bar" style="width: ${progress}%"></div>
                    </div>
                </div>
            `;
        }).join('');
        
        Logger.debug('Prize list rendered', { count: prizes.length });
    } catch (error) {
        Logger.error('Failed to render prize list', { error: error.message });
    }
}

/**
 * 渲染参与者列表
 */
function renderParticipantList() {
    try {
        const participants = LotteryStorage.getParticipants();
        const container = document.getElementById('participantList');
        const countEl = document.getElementById('participantCount');
        
        if (!container) {
            Logger.error('Participant list container not found');
            return;
        }
        
        const availableCount = participants.filter(p => !p.hasWon).length;
        
        if (countEl) {
            countEl.textContent = `${availableCount}/${participants.length}人`;
        }
        
        if (participants.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <div class="empty-state-text">暂无参与者，请导入或随机生成</div>
                </div>
            `;
            return;
        }
        
        // 只显示未中奖的参与者
        const availableList = participants.filter(p => !p.hasWon);
        
        if (availableList.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎉</div>
                    <div class="empty-state-text">所有人员已中奖</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = availableList.map(p => `
            <div class="participant-item">
                <div class="participant-name">${escapeHtml(p.name || '')}</div>
                <div class="participant-dept">${escapeHtml(p.department || '')}</div>
            </div>
        `).join('');
        
        Logger.debug('Participant list rendered', { total: participants.length, available: availableCount });
    } catch (error) {
        Logger.error('Failed to render participant list', { error: error.message });
    }
}

/**
 * 选择奖品
 */
function selectPrize(prizeId) {
    try {
        if (isLotteryRunning) {
            showToast('抽奖进行中，请先停止', 'warning');
            return;
        }
        
        if (!prizeId) {
            Logger.warn('selectPrize called without prizeId');
            return;
        }
        
        const prizes = LotteryStorage.getPrizes();
        const prize = prizes.find(p => p.id === prizeId);
        
        if (!prize) {
            showToast('奖品不存在', 'error');
            Logger.warn('Prize not found', { prizeId });
            return;
        }
        
        const drawnCount = prize.drawnCount || 0;
        if (drawnCount >= prize.count) {
            showToast('该奖品已抽完', 'warning');
            return;
        }
        
        currentPrizeId = prizeId;
        
        // 更新UI
        const prizeNameEl = document.getElementById('currentPrizeName');
        const prizeInfoEl = document.getElementById('currentPrizeInfo');
        
        if (prizeNameEl) prizeNameEl.textContent = prize.name;
        if (prizeInfoEl) prizeInfoEl.textContent = `剩余 ${prize.count - drawnCount} 个名额`;
        
        // 启用抽奖按钮
        const lotteryBtn = document.getElementById('lotteryBtn');
        const availableParticipants = LotteryStorage.getAvailableParticipants();
        
        if (lotteryBtn) {
            if (availableParticipants.length === 0) {
                lotteryBtn.disabled = true;
                showToast('没有可参与抽奖的人员', 'warning');
            } else {
                lotteryBtn.disabled = false;
            }
        }
        
        // 更新奖品列表高亮
        renderPrizeList();
        
        // 重新初始化3D球体
        Lottery.initSphere(availableParticipants);
        
        // 根据剩余名额更新模式切换控件
        updateModeSwitchUI();
        
        Logger.info('Prize selected', { prizeId, prizeName: prize.name });
    } catch (error) {
        Logger.error('Failed to select prize', { error: error.message, prizeId });
        showToast('选择奖品失败', 'error');
    }
}


/**
 * 切换抽奖状态
 */
async function toggleLottery() {
    try {
        if (!currentPrizeId) {
            showToast('请先选择奖品', 'warning');
            return;
        }
        
        // 批量模式走独立流程
        if (lotteryMode === 'batch') {
            if (isLotteryRunning) {
                showToast('批量抽奖进行中，请稍候', 'warning');
                return;
            }
            await runBatchLottery();
            return;
        }
        
        const lotteryBtn = document.getElementById('lotteryBtn');
        const lotteryBtnText = document.getElementById('lotteryBtnText');
        
        if (!lotteryBtn || !lotteryBtnText) {
            Logger.error('Lottery button elements not found');
            return;
        }
        
        if (!isLotteryRunning) {
            // 开始抽奖
            const availableParticipants = LotteryStorage.getAvailableParticipants();
            
            if (availableParticipants.length === 0) {
                showToast('没有可参与抽奖的人员', 'warning');
                return;
            }
            
            const settings = LotteryStorage.getSettings();
            const started = Lottery.start(currentPrizeId, availableParticipants, settings.lotterySpeed);
            
            if (started) {
                isLotteryRunning = true;
                lotteryBtn.classList.add('running');
                lotteryBtnText.textContent = '停止抽奖';
                setModeSwitchDisabled(true);
            } else {
                showToast('抽奖启动失败', 'error');
            }
        } else {
            // 停止抽奖
            lotteryBtn.disabled = true;
            lotteryBtnText.textContent = '抽取中...';
            
            const availableParticipants = LotteryStorage.getAvailableParticipants();
            const winner = await Lottery.stop(availableParticipants);
            
            if (winner) {
                try {
                    // 记录中奖
                    LotteryStorage.addWinner(currentPrizeId, winner);
                    
                    // 显示中奖结果
                    const prizes = LotteryStorage.getPrizes();
                    const prize = prizes.find(p => p.id === currentPrizeId);
                    
                    if (prize) {
                        showWinnerResult(prize.name, winner);
                    }
                    
                    // 更新UI
                    renderPrizeList();
                    renderParticipantList();
                    
                    // 检查奖品是否抽完
                    const updatedPrize = LotteryStorage.getPrizes().find(p => p.id === currentPrizeId);
                    const prizeInfoEl = document.getElementById('currentPrizeInfo');
                    const prizeNameEl = document.getElementById('currentPrizeName');
                    
                    if (updatedPrize && updatedPrize.drawnCount >= updatedPrize.count) {
                        currentPrizeId = null;
                        if (prizeNameEl) prizeNameEl.textContent = '请选择下一个奖品';
                        if (prizeInfoEl) prizeInfoEl.textContent = '当前奖品已抽完';
                        lotteryBtn.disabled = true;
                    } else if (updatedPrize && prizeInfoEl) {
                        prizeInfoEl.textContent = `剩余 ${updatedPrize.count - updatedPrize.drawnCount} 个名额`;
                    }
                    
                    // 重新初始化3D球体（移除已中奖者）
                    const newAvailable = LotteryStorage.getAvailableParticipants();
                    Lottery.initSphere(newAvailable);
                    
                    if (newAvailable.length === 0) {
                        lotteryBtn.disabled = true;
                        showToast('所有人员已中奖', 'success');
                    }
                } catch (error) {
                    Logger.error('Failed to record winner', { error: error.message });
                    showToast('记录中奖信息失败: ' + error.message, 'error');
                }
            }
            
            isLotteryRunning = false;
            lotteryBtn.classList.remove('running');
            lotteryBtnText.textContent = '开始抽奖';
            
            // 重新检查按钮状态
            const newAvailable = LotteryStorage.getAvailableParticipants();
            if (currentPrizeId && newAvailable.length > 0) {
                lotteryBtn.disabled = false;
            }
            // 抽奖结束后刷新模式切换可见性
            updateModeSwitchUI();
            setModeSwitchDisabled(false);
        }
    } catch (error) {
        Logger.error('Lottery toggle failed', { error: error.message, stack: error.stack });
        showToast('抽奖操作失败', 'error');
        
        // 重置状态
        isLotteryRunning = false;
        Lottery.reset();
        
        const lotteryBtn = document.getElementById('lotteryBtn');
        const lotteryBtnText = document.getElementById('lotteryBtnText');
        if (lotteryBtn) {
            lotteryBtn.classList.remove('running');
            lotteryBtn.disabled = false;
        }
        if (lotteryBtnText) {
            lotteryBtnText.textContent = '开始抽奖';
        }
        setModeSwitchDisabled(false);
    }
}

/**
 * 切换抽奖模式（单抽 / 批量）
 */
function switchLotteryMode(mode) {
    try {
        if (isLotteryRunning) {
            showToast('抽奖进行中，无法切换模式', 'warning');
            return;
        }
        if (mode !== 'single' && mode !== 'batch') return;
        if (lotteryMode === mode) return;
        
        lotteryMode = mode;
        
        // 更新模式按钮高亮
        const switchEl = document.getElementById('lotteryModeSwitch');
        if (switchEl) {
            switchEl.querySelectorAll('.mode-option').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
        }
        
        // 同步抽奖按钮文案
        const lotteryBtnText = document.getElementById('lotteryBtnText');
        if (lotteryBtnText) {
            lotteryBtnText.textContent = mode === 'batch' ? '批量抽奖' : '开始抽奖';
        }
        
        Logger.action('SWITCH_LOTTERY_MODE', { mode });
    } catch (error) {
        Logger.error('Failed to switch lottery mode', { error: error.message });
    }
}

/**
 * 根据当前奖品剩余名额更新模式切换控件可见性
 */
function updateModeSwitchUI() {
    try {
        const switchEl = document.getElementById('lotteryModeSwitch');
        const lotteryBtnText = document.getElementById('lotteryBtnText');
        if (!switchEl) return;
        
        let remaining = 0;
        if (currentPrizeId) {
            const prize = LotteryStorage.getPrizes().find(p => p.id === currentPrizeId);
            if (prize) {
                remaining = (prize.count || 0) - (prize.drawnCount || 0);
            }
        }
        
        if (remaining > 1) {
            switchEl.style.display = 'inline-flex';
        } else {
            switchEl.style.display = 'none';
            // 名额不足时强制回到单抽
            if (lotteryMode !== 'single') {
                lotteryMode = 'single';
                switchEl.querySelectorAll('.mode-option').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.mode === 'single');
                });
                if (lotteryBtnText && !isLotteryRunning) {
                    lotteryBtnText.textContent = '开始抽奖';
                }
            }
        }
    } catch (error) {
        Logger.error('Failed to update mode switch UI', { error: error.message });
    }
}

/**
 * 设置模式切换按钮的禁用状态
 */
function setModeSwitchDisabled(disabled) {
    const switchEl = document.getElementById('lotteryModeSwitch');
    if (!switchEl) return;
    switchEl.querySelectorAll('.mode-option').forEach(btn => {
        btn.disabled = !!disabled;
    });
}

/**
 * 执行批量抽奖：依次为剩余名额抽取中奖者并展示
 */
async function runBatchLottery() {
    const lotteryBtn = document.getElementById('lotteryBtn');
    const lotteryBtnText = document.getElementById('lotteryBtnText');
    
    try {
        const prize = LotteryStorage.getPrizes().find(p => p.id === currentPrizeId);
        if (!prize) {
            showToast('奖品不存在', 'error');
            return;
        }
        
        const remaining = (prize.count || 0) - (prize.drawnCount || 0);
        if (remaining <= 0) {
            showToast('该奖品已抽完', 'warning');
            return;
        }
        
        let pool = LotteryStorage.getAvailableParticipants();
        if (pool.length === 0) {
            showToast('没有可参与抽奖的人员', 'warning');
            return;
        }
        
        const settings = LotteryStorage.getSettings();
        const totalToDraw = Math.min(remaining, pool.length);
        const insufficient = pool.length < remaining;
        
        // 进入批量运行状态
        isLotteryRunning = true;
        currentBatchWinners = [];
        setModeSwitchDisabled(true);
        if (lotteryBtn) {
            lotteryBtn.disabled = true;
            lotteryBtn.classList.add('running');
        }
        
        Logger.action('BATCH_LOTTERY_START', { prizeId: currentPrizeId, totalToDraw, remaining, poolSize: pool.length });
        
        for (let i = 0; i < totalToDraw; i++) {
            // 进度提示
            if (lotteryBtnText) {
                lotteryBtnText.textContent = `抽取中 ${i + 1}/${totalToDraw}`;
            }
            
            // 启动一次旋转
            const started = Lottery.start(currentPrizeId, pool, settings.lotterySpeed);
            if (!started) {
                Logger.warn('Batch lottery: start failed', { index: i });
                break;
            }
            
            // 短暂旋转后停止，触发减速定格动画
            await sleep(900);
            const winner = await Lottery.stop(pool);
            
            if (!winner) {
                Logger.warn('Batch lottery: no winner produced', { index: i });
                break;
            }
            
            try {
                LotteryStorage.addWinner(currentPrizeId, winner);
                currentBatchWinners.push(winner);
                
                // 更新列表与球体
                renderPrizeList();
                renderParticipantList();
                
                // 更新当前奖品剩余名额展示
                const livePrize = LotteryStorage.getPrizes().find(p => p.id === currentPrizeId);
                const prizeInfoEl = document.getElementById('currentPrizeInfo');
                if (livePrize && prizeInfoEl) {
                    prizeInfoEl.textContent = `剩余 ${livePrize.count - livePrize.drawnCount} 个名额`;
                }
                
                // 刷新可用池
                pool = LotteryStorage.getAvailableParticipants();
                Lottery.initSphere(pool);
                
                // 中奖揭晓后短暂停顿再进入下一轮
                await sleep(700);
            } catch (error) {
                Logger.error('Batch lottery: failed to record winner', { error: error.message });
                showToast('记录中奖信息失败: ' + error.message, 'error');
                break;
            }
            
            // 池子空了就提前结束
            if (pool.length === 0) break;
        }
        
        // 收尾：展示汇总
        if (currentBatchWinners.length > 0) {
            showBatchSummary(prize.name, currentBatchWinners, {
                requested: remaining,
                drawn: currentBatchWinners.length,
                insufficient: insufficient && currentBatchWinners.length < remaining
            });
        }
        
        if (insufficient) {
            showToast(`参与者不足，已抽取 ${currentBatchWinners.length} 人后停止`, 'warning');
        }
        
        // 同步当前奖品状态
        const updatedPrize = LotteryStorage.getPrizes().find(p => p.id === currentPrizeId);
        const prizeInfoEl = document.getElementById('currentPrizeInfo');
        const prizeNameEl = document.getElementById('currentPrizeName');
        
        if (updatedPrize && updatedPrize.drawnCount >= updatedPrize.count) {
            currentPrizeId = null;
            if (prizeNameEl) prizeNameEl.textContent = '请选择下一个奖品';
            if (prizeInfoEl) prizeInfoEl.textContent = '当前奖品已抽完';
        } else if (updatedPrize && prizeInfoEl) {
            prizeInfoEl.textContent = `剩余 ${updatedPrize.count - updatedPrize.drawnCount} 个名额`;
        }
        
        Logger.action('BATCH_LOTTERY_END', {
            prizeId: updatedPrize ? updatedPrize.id : null,
            drawn: currentBatchWinners.length,
            insufficient
        });
    } catch (error) {
        Logger.error('Batch lottery failed', { error: error.message, stack: error.stack });
        showToast('批量抽奖失败', 'error');
    } finally {
        isLotteryRunning = false;
        Lottery.reset();
        
        if (lotteryBtn) {
            lotteryBtn.classList.remove('running');
        }
        
        // 恢复按钮文案与禁用状态
        const newAvailable = LotteryStorage.getAvailableParticipants();
        updateModeSwitchUI();
        setModeSwitchDisabled(false);
        
        if (lotteryBtnText) {
            lotteryBtnText.textContent = lotteryMode === 'batch' ? '批量抽奖' : '开始抽奖';
        }
        if (lotteryBtn) {
            lotteryBtn.disabled = !(currentPrizeId && newAvailable.length > 0);
        }
        
        // 重新初始化球体
        Lottery.initSphere(newAvailable);
        
        // 清理批次缓存
        currentBatchWinners = [];
    }
}

/**
 * 简单的延迟工具
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 展示批量抽奖汇总面板
 */
function showBatchSummary(prizeName, winners, meta) {
    try {
        const headerEl = document.getElementById('batchSummaryHeader');
        const listEl = document.getElementById('batchSummaryList');
        
        if (headerEl) {
            const tip = meta && meta.insufficient
                ? `<div class="batch-meta" style="color:#fbbf24;">⚠ 参与者不足，仅抽取 ${meta.drawn} / ${meta.requested} 人</div>`
                : `<div class="batch-meta">本批次共抽取 ${winners.length} 人</div>`;
            headerEl.innerHTML = `
                <div class="batch-prize-name">${escapeHtml(prizeName || '未知奖品')}</div>
                ${tip}
            `;
        }
        
        if (listEl) {
            if (winners.length === 0) {
                listEl.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🏆</div>
                        <div class="empty-state-text">本次未产生中奖者</div>
                    </div>
                `;
            } else {
                listEl.innerHTML = winners.map((w, index) => `
                    <div class="batch-summary-item">
                        <span class="batch-index">${index + 1}</span>
                        <span class="batch-name">${escapeHtml(w.name || '未知')}</span>
                        ${w.department ? `<span class="batch-dept">${escapeHtml(w.department)}</span>` : ''}
                    </div>
                `).join('');
            }
        }
        
        // 触发庆祝效果
        createFireworks();
        showModal('batchSummaryModal');
    } catch (error) {
        Logger.error('Failed to show batch summary', { error: error.message });
    }
}

/**
 * 显示中奖结果弹窗
 */
function showWinnerResult(prizeName, winner) {
    try {
        const prizeNameEl = document.getElementById('resultPrizeName');
        const winnerInfoEl = document.getElementById('resultWinnerInfo');
        
        if (prizeNameEl) prizeNameEl.textContent = prizeName || '未知奖品';
        if (winnerInfoEl) winnerInfoEl.textContent = winner?.name || '未知';
        
        // 触发烟花效果
        createFireworks();
        
        showModal('winnerResultModal');
    } catch (error) {
        Logger.error('Failed to show winner result', { error: error.message });
    }
}

/**
 * 创建烟花效果
 */
function createFireworks() {
    const colors = ['#ffd700', '#ff6b6b', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa'];
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const firework = document.createElement('div');
            firework.className = 'firework';
            firework.style.left = centerX + 'px';
            firework.style.top = centerY + 'px';
            firework.style.background = colors[Math.floor(Math.random() * colors.length)];
            firework.style.boxShadow = `0 0 6px ${firework.style.background}`;
            
            const angle = (Math.PI * 2 * i) / 50;
            const velocity = 100 + Math.random() * 150;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;
            
            firework.style.setProperty('--tx', tx + 'px');
            firework.style.setProperty('--ty', ty + 'px');
            firework.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
            ], {
                duration: 1000 + Math.random() * 500,
                easing: 'cubic-bezier(0, 0.5, 0.5, 1)'
            });
            
            document.body.appendChild(firework);
            
            setTimeout(() => firework.remove(), 1500);
        }, Math.random() * 300);
    }
}

/**
 * 显示添加奖品弹窗
 */
function showAddPrizeModal() {
    const nameInput = document.getElementById('prizeName');
    const countInput = document.getElementById('prizeCount');
    
    if (nameInput) nameInput.value = '';
    if (countInput) countInput.value = '';
    
    showModal('addPrizeModal');
}

/**
 * 添加奖品
 */
function addPrize() {
    try {
        const nameInput = document.getElementById('prizeName');
        const countInput = document.getElementById('prizeCount');
        
        const name = (nameInput?.value || '').trim();
        const count = parseInt(countInput?.value || '0');
        
        if (!name) {
            showToast('请输入奖品名称', 'error');
            nameInput?.focus();
            return;
        }
        
        if (name.length > 20) {
            showToast('奖品名称不能超过20个字符', 'error');
            return;
        }
        
        if (!count || count < 1) {
            showToast('请输入有效的中奖人数', 'error');
            countInput?.focus();
            return;
        }
        
        if (count > 100) {
            showToast('单个奖品中奖人数不能超过100', 'error');
            return;
        }
        
        LotteryStorage.addPrize({ name, count });
        renderPrizeList();
        closeModal('addPrizeModal');
        showToast('奖品添加成功', 'success');
        
    } catch (error) {
        Logger.error('Failed to add prize', { error: error.message });
        showToast(error.message || '添加奖品失败', 'error');
    }
}

/**
 * 删除奖品
 */
async function deletePrize(prizeId) {
    try {
        if (isLotteryRunning) {
            showToast('抽奖进行中，无法删除', 'warning');
            return;
        }
        
        const confirmed = await showConfirm('确定要删除该奖品吗？<br>相关中奖记录也会被删除。', '删除奖品');
        if (!confirmed) {
            return;
        }
        
        LotteryStorage.deletePrize(prizeId);
        
        if (currentPrizeId === prizeId) {
            currentPrizeId = null;
            const prizeNameEl = document.getElementById('currentPrizeName');
            const prizeInfoEl = document.getElementById('currentPrizeInfo');
            const lotteryBtn = document.getElementById('lotteryBtn');
            
            if (prizeNameEl) prizeNameEl.textContent = '请先选择奖品';
            if (prizeInfoEl) prizeInfoEl.textContent = '点击左侧奖品开始抽奖';
            if (lotteryBtn) lotteryBtn.disabled = true;
        }
        
        renderPrizeList();
        showToast('奖品已删除', 'success');
        updateModeSwitchUI();
        
    } catch (error) {
        Logger.error('Failed to delete prize', { error: error.message, prizeId });
        showToast('删除奖品失败', 'error');
    }
}


/**
 * 随机生成参与者
 */
async function generateRandomParticipants() {
    try {
        const countStr = await showPrompt('请输入要生成的人数（1-100）：', '20', '随机生成名单');
        
        if (countStr === null || countStr === '') return; // 用户取消
        
        const num = parseInt(countStr);
        
        if (isNaN(num) || num < 1 || num > 100) {
            showToast('请输入1-100之间的数字', 'error');
            return;
        }
        
        const participants = [];
        const usedNames = new Set();
        
        for (let i = 0; i < num; i++) {
            let fullName;
            let attempts = 0;
            
            // 避免重名
            do {
                const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
                const name = NAMES[Math.floor(Math.random() * NAMES.length)];
                fullName = surname + name;
                attempts++;
            } while (usedNames.has(fullName) && attempts < 100);
            
            usedNames.add(fullName);
            
            const department = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
            
            // 随机生成手机号（可能为空）
            let phone = '';
            if (Math.random() > 0.3) {
                phone = '1' + ['3', '5', '7', '8', '9'][Math.floor(Math.random() * 5)] + 
                        Math.random().toString().slice(2, 11);
            }
            
            participants.push({
                name: fullName,
                phone,
                department
            });
        }
        
        LotteryStorage.addParticipants(participants);
        renderParticipantList();
        
        // 更新3D球体
        const available = LotteryStorage.getAvailableParticipants();
        Lottery.initSphere(available);
        
        showToast(`成功生成 ${num} 名参与者`, 'success');
        
    } catch (error) {
        Logger.error('Failed to generate participants', { error: error.message });
        showToast('生成参与者失败', 'error');
    }
}

/**
 * 触发文件上传
 */
function triggerFileUpload() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    }
}

/**
 * 下载导入模板
 */
function downloadTemplate() {
    try {
        // 检查XLSX库
        if (typeof XLSX === 'undefined') {
            showToast('模板生成功能不可用', 'error');
            return;
        }
        
        // 模板数据
        const templateData = [
            ['姓名', '手机号码', '部门'],
            ['张三', '13800138001', '技术部'],
            ['李四', '13900139002', '产品部'],
            ['王五', '', '运营部'],
            ['赵六', '15800158003', '市场部']
        ];
        
        // 创建工作簿
        const ws = XLSX.utils.aoa_to_sheet(templateData);
        
        // 设置列宽
        ws['!cols'] = [
            { wch: 15 },  // 姓名
            { wch: 15 },  // 手机号码
            { wch: 12 }   // 部门
        ];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '抽奖名单');
        
        // 下载文件
        XLSX.writeFile(wb, '抽奖名单导入模板.xlsx');
        
        showToast('模板下载成功', 'success');
        Logger.action('DOWNLOAD_TEMPLATE');
        
    } catch (error) {
        Logger.error('Failed to download template', { error: error.message });
        showToast('模板下载失败', 'error');
    }
}

/**
 * 处理文件上传
 */
function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    Logger.info('File upload started', { fileName: file.name, fileSize: file.size });
    
    // 文件大小检查（最大5MB）
    if (file.size > 5 * 1024 * 1024) {
        showToast('文件大小不能超过5MB', 'error');
        event.target.value = '';
        return;
    }
    
    // 文件类型检查
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
                        'application/vnd.ms-excel'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.xlsx?$/i)) {
        showToast('请选择Excel文件（.xlsx或.xls）', 'error');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    
    reader.onerror = () => {
        Logger.error('File read error', { fileName: file.name });
        showToast('文件读取失败', 'error');
        event.target.value = '';
    };
    
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                showToast('Excel文件中没有工作表', 'error');
                return;
            }
            
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            if (!jsonData || jsonData.length < 2) {
                showToast('文件内容为空或格式不正确', 'error');
                return;
            }
            
            // 解析表头
            const headers = jsonData[0].map(h => String(h || '').toLowerCase().trim());
            const nameIndex = headers.findIndex(h => 
                h.includes('姓名') || h.includes('name') || h === '名字' || h === '姓名'
            );
            const phoneIndex = headers.findIndex(h => 
                h.includes('手机') || h.includes('电话') || h.includes('phone') || h.includes('mobile')
            );
            const deptIndex = headers.findIndex(h => 
                h.includes('部门') || h.includes('department') || h.includes('dept')
            );
            
            if (nameIndex === -1) {
                showToast('未找到姓名列，请确保表头包含"姓名"', 'error');
                Logger.warn('Name column not found', { headers });
                return;
            }
            
            const participants = [];
            const errors = [];
            
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;
                
                const name = row[nameIndex];
                
                if (!name || String(name).trim() === '') {
                    errors.push(`第${i + 1}行：姓名为空`);
                    continue;
                }
                
                // 过滤掉模板示例数据
                const nameStr = String(name).trim();
                if (nameStr.includes('在此添加') || nameStr.includes('...') || nameStr.startsWith('（') || nameStr.startsWith('(')) {
                    continue;
                }
                
                participants.push({
                    name: nameStr,
                    phone: phoneIndex !== -1 ? String(row[phoneIndex] || '').trim() : '',
                    department: deptIndex !== -1 ? String(row[deptIndex] || '').trim() : ''
                });
            }
            
            if (participants.length === 0) {
                showToast('未解析到有效数据', 'error');
                Logger.warn('No valid participants parsed', { errors });
                return;
            }
            
            LotteryStorage.addParticipants(participants);
            renderParticipantList();
            
            // 更新3D球体
            const available = LotteryStorage.getAvailableParticipants();
            Lottery.initSphere(available);
            
            let message = `成功导入 ${participants.length} 名参与者`;
            if (errors.length > 0) {
                message += `，${errors.length} 条数据被跳过`;
                Logger.warn('Some rows skipped during import', { errors });
            }
            
            showToast(message, 'success');
            Logger.info('File import completed', { imported: participants.length, skipped: errors.length });
            
        } catch (error) {
            Logger.error('File parse error', { error: error.message, fileName: file.name });
            showToast('文件解析失败，请检查格式', 'error');
        }
    };
    
    reader.readAsArrayBuffer(file);
    event.target.value = ''; // 清空input，允许重复上传同一文件
}

/**
 * 清空参与者
 */
async function clearParticipants() {
    try {
        if (isLotteryRunning) {
            showToast('抽奖进行中，无法清空', 'warning');
            return;
        }
        
        const count = LotteryStorage.getParticipants().length;
        if (count === 0) {
            showToast('名单已经是空的', 'warning');
            return;
        }
        
        const confirmed = await showConfirm(`确定要清空所有 <strong>${count}</strong> 名参与者吗？`, '清空名单');
        if (!confirmed) {
            return;
        }
        
        LotteryStorage.clearParticipants();
        renderParticipantList();
        Lottery.initSphere([]);
        showToast('参与者已清空', 'success');
        
    } catch (error) {
        Logger.error('Failed to clear participants', { error: error.message });
        showToast('清空参与者失败', 'error');
    }
}


/**
 * 显示中奖名单弹窗
 */
function showWinnerListModal() {
    try {
        const winners = LotteryStorage.getWinners();
        const prizes = LotteryStorage.getPrizes();
        const container = document.getElementById('winnerListContainer');
        
        if (!container) {
            Logger.error('Winner list container not found');
            return;
        }
        
        const prizeIds = Object.keys(winners);
        
        if (prizeIds.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🏆</div>
                    <div class="empty-state-text">暂无中奖记录</div>
                </div>
            `;
        } else {
            container.innerHTML = prizeIds.map(prizeId => {
                const prize = prizes.find(p => p.id === prizeId);
                const prizeWinners = winners[prizeId] || [];
                
                return `
                    <div class="winner-group">
                        <div class="winner-group-header">
                            <span>${prize ? escapeHtml(prize.name) : '已删除的奖品'}</span>
                            <span>${prizeWinners.length}人</span>
                        </div>
                        <div class="winner-group-list">
                            ${prizeWinners.map((w, index) => `
                                <div class="winner-group-item">
                                    <span>${index + 1}. ${escapeHtml(w.name || '未知')}</span>
                                    <span style="color: var(--text-muted); font-size: 12px;">
                                        ${w.department ? escapeHtml(w.department) : ''}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        showModal('winnerListModal');
    } catch (error) {
        Logger.error('Failed to show winner list', { error: error.message });
        showToast('显示中奖名单失败', 'error');
    }
}

/**
 * 导出中奖名单
 */
function exportWinnerList() {
    try {
        const winners = LotteryStorage.getWinners();
        const prizes = LotteryStorage.getPrizes();
        
        const prizeIds = Object.keys(winners);
        if (prizeIds.length === 0) {
            showToast('暂无中奖记录可导出', 'warning');
            return;
        }
        
        // 检查XLSX库是否可用
        if (typeof XLSX === 'undefined') {
            showToast('导出功能不可用，请刷新页面重试', 'error');
            Logger.error('XLSX library not loaded');
            return;
        }
        
        // 构建导出数据
        const exportData = [];
        exportData.push(['奖品名称', '中奖者姓名', '手机号码', '部门', '中奖时间']);
        
        prizeIds.forEach(prizeId => {
            const prize = prizes.find(p => p.id === prizeId);
            const prizeWinners = winners[prizeId] || [];
            
            prizeWinners.forEach(w => {
                exportData.push([
                    prize ? prize.name : '已删除的奖品',
                    w.name || '',
                    w.phone || '',
                    w.department || '',
                    w.wonAt ? new Date(w.wonAt).toLocaleString('zh-CN') : ''
                ]);
            });
        });
        
        // 创建工作簿并导出
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '中奖名单');
        
        const fileName = `中奖名单_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showToast('导出成功', 'success');
        Logger.action('EXPORT_WINNERS', { fileName, recordCount: exportData.length - 1 });
        
    } catch (error) {
        Logger.error('Failed to export winner list', { error: error.message });
        showToast('导出失败: ' + error.message, 'error');
    }
}

/**
 * 显示设置弹窗
 */
function showSettingsModal() {
    try {
        const settings = LotteryStorage.getSettings();
        const speedSelect = document.getElementById('lotterySpeed');
        
        if (speedSelect) {
            speedSelect.value = settings.lotterySpeed || 'normal';
        }
        
        showModal('settingsModal');
    } catch (error) {
        Logger.error('Failed to show settings', { error: error.message });
    }
}

/**
 * 触发背景图片上传
 */
function triggerBgUpload() {
    const bgInput = document.getElementById('bgInput');
    if (bgInput) {
        bgInput.click();
    }
}

// 临时存储待应用的背景图片
let pendingBackgroundImage = null;

/**
 * 处理背景图片上传 - 只预览，不立即应用
 */
function handleBgUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // 文件类型检查
    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件', 'error');
        event.target.value = '';
        return;
    }
    
    // 文件大小检查（最大2MB）
    if (file.size > 2 * 1024 * 1024) {
        showToast('图片大小不能超过2MB', 'error');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    
    reader.onerror = () => {
        showToast('图片读取失败', 'error');
        event.target.value = '';
    };
    
    reader.onload = (e) => {
        try {
            const imageData = e.target.result;
            
            // 存储待应用的图片
            pendingBackgroundImage = imageData;
            
            // 显示预览
            const previewContainer = document.getElementById('bgPreviewContainer');
            const previewImg = document.getElementById('bgPreviewImg');
            const uploadText = document.getElementById('bgUploadText');
            
            if (previewContainer && previewImg) {
                previewImg.src = imageData;
                previewContainer.style.display = 'block';
            }
            if (uploadText) {
                uploadText.textContent = '重新选择图片';
            }
            
            showToast('图片已选择，点击保存设置生效', 'info');
            Logger.action('PREVIEW_BACKGROUND', { fileSize: file.size });
            
        } catch (error) {
            Logger.error('Failed to preview background', { error: error.message });
            showToast('预览背景失败', 'error');
        }
    };
    
    reader.readAsDataURL(file);
    event.target.value = '';
}

/**
 * 清除背景预览
 */
function clearBgPreview() {
    pendingBackgroundImage = null;
    
    const previewContainer = document.getElementById('bgPreviewContainer');
    const previewImg = document.getElementById('bgPreviewImg');
    const uploadText = document.getElementById('bgUploadText');
    
    if (previewContainer) {
        previewContainer.style.display = 'none';
    }
    if (previewImg) {
        previewImg.src = '';
    }
    if (uploadText) {
        uploadText.textContent = '点击上传背景图片';
    }
    
    showToast('已移除选择的图片', 'info');
}

/**
 * 保存设置
 */
function saveSettings() {
    try {
        const settings = LotteryStorage.getSettings();
        const speedSelect = document.getElementById('lotterySpeed');
        
        if (speedSelect) {
            settings.lotterySpeed = speedSelect.value;
        }
        
        // 应用待保存的背景图片
        if (pendingBackgroundImage) {
            const bgLayer = document.getElementById('background-layer');
            if (bgLayer) {
                bgLayer.style.backgroundImage = `url(${pendingBackgroundImage})`;
            }
            settings.backgroundImage = pendingBackgroundImage;
            Logger.action('UPDATE_BACKGROUND', { applied: true });
        }
        
        LotteryStorage.saveSettings(settings);
        
        // 重置预览状态
        pendingBackgroundImage = null;
        const previewContainer = document.getElementById('bgPreviewContainer');
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
        
        closeModal('settingsModal');
        showToast('设置已保存', 'success');
        
    } catch (error) {
        Logger.error('Failed to save settings', { error: error.message });
        showToast('保存设置失败', 'error');
    }
}

/**
 * 重置所有数据
 */
async function resetAllData() {
    try {
        if (isLotteryRunning) {
            showToast('抽奖进行中，无法重置', 'warning');
            return;
        }
        
        const stats = LotteryStorage.getStats();
        
        const message = `确定要重置所有数据吗？<br><br>将清除：<br>• <strong>${stats.prizesCount}</strong> 个奖品<br>• <strong>${stats.participantsCount}</strong> 名参与者<br>• <strong>${stats.winnersCount}</strong> 条中奖记录`;
        
        const confirmed = await showConfirm(message, '⚠️ 重置所有数据');
        if (!confirmed) {
            return;
        }
        
        LotteryStorage.resetAll();
        currentPrizeId = null;
        
        // 重置UI
        const prizeNameEl = document.getElementById('currentPrizeName');
        const prizeInfoEl = document.getElementById('currentPrizeInfo');
        const lotteryBtn = document.getElementById('lotteryBtn');
        const bgLayer = document.getElementById('background-layer');
        
        if (prizeNameEl) prizeNameEl.textContent = '请先选择奖品';
        if (prizeInfoEl) prizeInfoEl.textContent = '点击左侧奖品开始抽奖';
        if (lotteryBtn) lotteryBtn.disabled = true;
        if (bgLayer) bgLayer.style.backgroundImage = '';
        
        renderPrizeList();
        renderParticipantList();
        Lottery.initSphere([]);
        updateModeSwitchUI();
        
        closeModal('settingsModal');
        showToast('所有数据已重置', 'success');
        
    } catch (error) {
        Logger.error('Failed to reset data', { error: error.message });
        showToast('重置数据失败', 'error');
    }
}


/**
 * 显示弹窗
 */
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        Logger.debug('Modal opened', { modalId });
    } else {
        Logger.warn('Modal not found', { modalId });
    }
}

/**
 * 关闭弹窗
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        Logger.debug('Modal closed', { modalId });
    }
}

// ========================================
// 自定义确认弹窗（替代 confirm）
// ========================================
let confirmResolve = null;

function showConfirm(message, title = '确认操作') {
    return new Promise((resolve) => {
        confirmResolve = resolve;
        
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.innerHTML = message;
        
        showModal('confirmModal');
    });
}

function closeConfirmModal(result) {
    closeModal('confirmModal');
    if (confirmResolve) {
        confirmResolve(result);
        confirmResolve = null;
    }
}

// ========================================
// 自定义输入弹窗（替代 prompt）
// ========================================
let promptResolve = null;

function showPrompt(label, defaultValue = '', title = '请输入') {
    return new Promise((resolve) => {
        promptResolve = resolve;
        
        const titleEl = document.getElementById('promptTitle');
        const labelEl = document.getElementById('promptLabel');
        const inputEl = document.getElementById('promptInput');
        
        if (titleEl) titleEl.textContent = title;
        if (labelEl) labelEl.textContent = label;
        if (inputEl) {
            inputEl.value = defaultValue;
            inputEl.placeholder = defaultValue;
        }
        
        showModal('promptModal');
        
        // 自动聚焦输入框
        setTimeout(() => inputEl?.focus(), 100);
    });
}

function closePromptModal(value) {
    closeModal('promptModal');
    if (promptResolve) {
        promptResolve(value);
        promptResolve = null;
    }
}

function submitPromptModal() {
    const inputEl = document.getElementById('promptInput');
    const value = inputEl?.value || '';
    closePromptModal(value);
}

// 支持回车提交
document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('promptInput');
    if (promptInput) {
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitPromptModal();
            }
        });
    }
});

/**
 * 显示Toast提示
 */
function showToast(message, type = 'info') {
    try {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.warn('Toast container not found');
            return;
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // 自动移除
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 3000);
        
        // 记录日志
        if (type === 'error') {
            Logger.warn('Toast error shown', { message });
        }
    } catch (error) {
        console.error('Failed to show toast:', error);
    }
}

/**
 * HTML转义（防XSS）
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * 键盘快捷键
 */
document.addEventListener('keydown', (e) => {
    // 空格键开始/停止抽奖
    if (e.code === 'Space' && !e.target.matches('input, textarea, select')) {
        e.preventDefault();
        const lotteryBtn = document.getElementById('lotteryBtn');
        if (lotteryBtn && !lotteryBtn.disabled) {
            toggleLottery();
        }
    }
    
    // ESC关闭弹窗
    if (e.code === 'Escape') {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
    }
    
    // Ctrl+D 调试信息
    if (e.ctrlKey && e.code === 'KeyD') {
        e.preventDefault();
        console.log('=== Debug Info ===');
        console.log('Storage Stats:', LotteryStorage.getStats());
        console.log('Lottery State:', Lottery.getState());
        console.log('Current Prize ID:', currentPrizeId);
        console.log('Is Running:', isLotteryRunning);
        console.log('Recent Logs:', Logger.getLogs().slice(-20));
    }
});

/**
 * 页面可见性变化处理
 */
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isLotteryRunning) {
        Logger.warn('Page hidden while lottery running');
    }
});

/**
 * 页面卸载前保存状态
 */
window.addEventListener('beforeunload', (e) => {
    if (isLotteryRunning) {
        e.preventDefault();
        e.returnValue = '抽奖正在进行中，确定要离开吗？';
        return e.returnValue;
    }
});

// 导出调试接口
window.LotteryDebug = {
    getStats: () => LotteryStorage.getStats(),
    getLogs: () => Logger.getLogs(),
    exportLogs: () => Logger.export(),
    validateData: () => LotteryStorage.validateIntegrity(),
    getState: () => ({
        currentPrizeId,
        isLotteryRunning,
        lotteryState: Lottery.getState()
    })
};

Logger.info('App.js loaded successfully');
