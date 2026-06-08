/**
 * 日志系统模块
 * 提供统一的日志记录、错误追踪和调试功能
 */

const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const Logger = {
    level: LogLevel.DEBUG,
    logs: [],
    maxLogs: 500,
    
    /**
     * 设置日志级别
     */
    setLevel(level) {
        this.level = level;
    },
    
    /**
     * 格式化时间戳
     */
    _timestamp() {
        return new Date().toISOString();
    },
    
    /**
     * 记录日志
     */
    _log(level, levelName, message, data = null) {
        if (level < this.level) return;
        
        const logEntry = {
            timestamp: this._timestamp(),
            level: levelName,
            message,
            data: data ? JSON.parse(JSON.stringify(data)) : null
        };
        
        this.logs.push(logEntry);
        
        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        
        // 控制台输出
        const consoleMethod = level === LogLevel.ERROR ? 'error' : 
                             level === LogLevel.WARN ? 'warn' : 
                             level === LogLevel.DEBUG ? 'debug' : 'log';
        
        const prefix = `[${logEntry.timestamp}] [${levelName}]`;
        if (data) {
            console[consoleMethod](prefix, message, data);
        } else {
            console[consoleMethod](prefix, message);
        }
        
        return logEntry;
    },
    
    debug(message, data = null) {
        return this._log(LogLevel.DEBUG, 'DEBUG', message, data);
    },
    
    info(message, data = null) {
        return this._log(LogLevel.INFO, 'INFO', message, data);
    },
    
    warn(message, data = null) {
        return this._log(LogLevel.WARN, 'WARN', message, data);
    },
    
    error(message, data = null) {
        return this._log(LogLevel.ERROR, 'ERROR', message, data);
    },
    
    /**
     * 记录操作日志（用于关键业务操作）
     */
    action(actionName, details = {}) {
        return this.info(`[ACTION] ${actionName}`, details);
    },
    
    /**
     * 获取所有日志
     */
    getLogs(level = null) {
        if (level === null) return [...this.logs];
        const levelName = Object.keys(LogLevel).find(k => LogLevel[k] === level);
        return this.logs.filter(log => log.level === levelName);
    },
    
    /**
     * 清空日志
     */
    clear() {
        this.logs = [];
        console.clear();
    },
    
    /**
     * 导出日志
     */
    export() {
        return JSON.stringify(this.logs, null, 2);
    }
};

/**
 * 全局错误处理器
 */
const ErrorHandler = {
    /**
     * 初始化全局错误捕获
     */
    init() {
        // 捕获未处理的错误
        window.onerror = (message, source, lineno, colno, error) => {
            Logger.error('Uncaught Error', {
                message,
                source,
                lineno,
                colno,
                stack: error?.stack
            });
            return false;
        };
        
        // 捕获Promise rejection
        window.onunhandledrejection = (event) => {
            Logger.error('Unhandled Promise Rejection', {
                reason: event.reason?.message || event.reason,
                stack: event.reason?.stack
            });
        };
        
        Logger.info('ErrorHandler initialized');
    },
    
    /**
     * 包装函数以捕获错误
     */
    wrap(fn, context = 'Unknown') {
        return function(...args) {
            try {
                const result = fn.apply(this, args);
                if (result instanceof Promise) {
                    return result.catch(error => {
                        Logger.error(`Error in ${context}`, {
                            error: error.message,
                            stack: error.stack,
                            args
                        });
                        throw error;
                    });
                }
                return result;
            } catch (error) {
                Logger.error(`Error in ${context}`, {
                    error: error.message,
                    stack: error.stack,
                    args
                });
                throw error;
            }
        };
    },
    
    /**
     * 安全执行函数
     */
    safeExecute(fn, fallback = null, context = 'Unknown') {
        try {
            return fn();
        } catch (error) {
            Logger.error(`Safe execution failed in ${context}`, {
                error: error.message,
                stack: error.stack
            });
            return fallback;
        }
    }
};

// 初始化错误处理器
ErrorHandler.init();
