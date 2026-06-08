/**
 * 3D抽奖核心模块
 * 优化版：减速时文字模糊晃动效果
 */

const Lottery = {
    isRunning: false,
    currentPrize: null,
    nameElements: [],
    spinInterval: null,
    _participants: [],
    _selectedWinner: null,
    
    _getElement(id) {
        const el = document.getElementById(id);
        if (!el) Logger.error(`Element not found: ${id}`);
        return el;
    },
    
    initSphere(participants) {
        Logger.debug('Initializing lottery sphere', { participantCount: participants.length });
        
        const sphere = this._getElement('lotterySphere');
        if (!sphere) return;
        
        sphere.innerHTML = '';
        this.nameElements = [];
        this._participants = [...participants];
        this._selectedWinner = null;
        
        if (participants.length === 0) return;
        
        const displayCount = Math.min(participants.length, 30);
        const radius = 150;
        
        for (let i = 0; i < displayCount; i++) {
            const participant = participants[i % participants.length];
            if (!participant || !participant.name) continue;
            
            const tag = document.createElement('span');
            tag.className = 'name-tag';
            tag.textContent = participant.name;
            tag.dataset.participantId = participant.id;
            
            // 强制设置白色
            tag.style.color = '#ffffff';
            tag.style.textShadow = '0 2px 10px rgba(0, 0, 0, 0.8)';
            
            const phi = Math.acos(-1 + (2 * i) / displayCount);
            const theta = Math.sqrt(displayCount * Math.PI) * phi;
            
            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(phi);
            
            tag.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
            
            sphere.appendChild(tag);
            this.nameElements.push(tag);
        }
    },
    
    start(prizeId, participants, speed = 'normal') {
        Logger.info('Starting lottery', { prizeId, participantCount: participants.length, speed });
        
        if (this.isRunning) return false;
        if (!participants || participants.length === 0) return false;
        
        const validParticipants = participants.filter(p => p && p.id && p.name);
        if (validParticipants.length === 0) return false;
        
        this.isRunning = true;
        this.currentPrize = prizeId;
        this._participants = [...validParticipants];
        this._selectedWinner = null;
        
        const sphere = this._getElement('lotterySphere');
        const winnerDisplay = this._getElement('winnerDisplay');
        const winnerName = this._getElement('winnerName');
        
        if (!sphere || !winnerDisplay || !winnerName) {
            this.isRunning = false;
            return false;
        }
        
        // 重置状态
        winnerDisplay.classList.remove('show', 'blur-shake', 'final-reveal');
        winnerName.classList.remove('blur-shake', 'final-reveal');
        
        sphere.classList.remove('fast', 'slow');
        sphere.classList.add('spinning');
        
        if (speed === 'fast') sphere.classList.add('fast');
        else if (speed === 'slow') sphere.classList.add('slow');
        
        if (this.spinInterval) clearInterval(this.spinInterval);
        
        const intervalTime = speed === 'fast' ? 50 : (speed === 'slow' ? 150 : 80);
        
        this.spinInterval = setInterval(() => {
            try {
                // 中央快速切换姓名
                if (this._participants.length > 0) {
                    const randomParticipant = this._participants[Math.floor(Math.random() * this._participants.length)];
                    if (randomParticipant && randomParticipant.name) {
                        winnerName.textContent = randomParticipant.name;
                        winnerDisplay.classList.add('show');
                    }
                }
            } catch (error) {
                Logger.error('Error in spin interval', { error: error.message });
            }
        }, intervalTime);
        
        Logger.action('LOTTERY_START', { prizeId, participantCount: validParticipants.length });
        return true;
    },
    
    /**
     * 停止抽奖 - 带模糊晃动效果
     */
    stop(participants) {
        Logger.info('Stopping lottery');
        
        if (!this.isRunning) return Promise.resolve(null);
        
        const sphere = this._getElement('lotterySphere');
        const winnerDisplay = this._getElement('winnerDisplay');
        const winnerName = this._getElement('winnerName');
        
        if (!sphere || !winnerDisplay || !winnerName) {
            this.isRunning = false;
            return Promise.resolve(null);
        }
        
        const availableParticipants = (participants && participants.length > 0) 
            ? participants 
            : this._participants;
        
        if (!availableParticipants || availableParticipants.length === 0) {
            this.isRunning = false;
            sphere.classList.remove('spinning', 'fast', 'slow');
            return Promise.resolve(null);
        }
        
        // 确定中奖者
        let randomIndex;
        if (window.crypto && window.crypto.getRandomValues) {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            randomIndex = array[0] % availableParticipants.length;
        } else {
            randomIndex = Math.floor(Math.random() * availableParticipants.length);
        }
        
        const winner = availableParticipants[randomIndex];
        this._selectedWinner = winner;
        
        if (!winner || !winner.id || !winner.name) {
            this.isRunning = false;
            sphere.classList.remove('spinning', 'fast', 'slow');
            return Promise.resolve(null);
        }
        
        Logger.info('Winner selected', { winnerName: winner.name });
        
        // 清除快速切换
        if (this.spinInterval) {
            clearInterval(this.spinInterval);
            this.spinInterval = null;
        }
        
        return new Promise((resolve) => {
            let slowdownCount = 0;
            const maxSlowdown = 12;
            
            // 添加模糊晃动效果
            winnerName.classList.add('blur-shake');
            
            const slowdownInterval = () => {
                slowdownCount++;
                const delay = 100 + (slowdownCount * 80);
                
                if (slowdownCount >= maxSlowdown) {
                    // 最终定格
                    winnerName.textContent = winner.name;
                    winnerName.classList.remove('blur-shake');
                    winnerName.classList.add('final-reveal');
                    
                    sphere.classList.remove('spinning', 'fast', 'slow');
                    this._highlightWinner(winner);
                    this.isRunning = false;
                    
                    // 延迟一下再返回结果，让用户看清中奖者
                    setTimeout(() => {
                        Logger.action('LOTTERY_STOP', { winner: { id: winner.id, name: winner.name } });
                        resolve(winner);
                    }, 800);
                    
                } else {
                    // 减速过程
                    if (slowdownCount >= maxSlowdown - 2) {
                        // 最后2次显示中奖者
                        winnerName.textContent = winner.name;
                    } else {
                        // 随机切换，概率逐渐偏向中奖者
                        const prob = slowdownCount / maxSlowdown;
                        if (Math.random() < prob * 0.8) {
                            winnerName.textContent = winner.name;
                        } else {
                            const rp = availableParticipants[Math.floor(Math.random() * availableParticipants.length)];
                            winnerName.textContent = rp.name;
                        }
                    }
                    
                    // 球体减速
                    if (slowdownCount > maxSlowdown / 2) {
                        sphere.classList.remove('fast');
                        sphere.classList.add('slow');
                    }
                    
                    setTimeout(slowdownInterval, delay);
                }
            };
            
            setTimeout(slowdownInterval, 100);
        });
    },
    
    _highlightWinner(winner) {
        // 从球体中移除所有中奖者的名字标签（可能有重复）
        const toRemove = [];
        this.nameElements = this.nameElements.filter(el => {
            if (el.dataset.participantId === winner.id) {
                toRemove.push(el);
                return false; // 从数组中移除
            }
            // 其他名字保持白色
            el.style.color = '#ffffff';
            el.style.textShadow = '0 2px 10px rgba(0, 0, 0, 0.5)';
            return true;
        });
        
        // 淡出动画后移除所有匹配的元素
        toRemove.forEach(el => {
            el.style.transition = 'opacity 0.5s ease';
            el.style.opacity = '0';
            setTimeout(() => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            }, 500);
        });
    },
    
    reset() {
        this.isRunning = false;
        this.currentPrize = null;
        this._participants = [];
        this._selectedWinner = null;
        
        if (this.spinInterval) {
            clearInterval(this.spinInterval);
            this.spinInterval = null;
        }
        
        const sphere = this._getElement('lotterySphere');
        const winnerDisplay = this._getElement('winnerDisplay');
        const winnerName = this._getElement('winnerName');
        
        if (sphere) sphere.classList.remove('spinning', 'fast', 'slow');
        if (winnerDisplay) winnerDisplay.classList.remove('show', 'blur-shake', 'final-reveal');
        if (winnerName) winnerName.classList.remove('blur-shake', 'final-reveal');
        
        this.nameElements.forEach(el => {
            el.style.color = '#ffffff';
            el.style.textShadow = '0 2px 10px rgba(0, 0, 0, 0.5)';
            el.style.fontSize = '20px';
        });
    },
    
    getState() {
        return {
            isRunning: this.isRunning,
            currentPrize: this.currentPrize,
            participantCount: this._participants.length,
            selectedWinner: this._selectedWinner ? this._selectedWinner.name : null
        };
    }
};
