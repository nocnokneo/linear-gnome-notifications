export class Logger {
    constructor(component) {
        this.component = component;
        this.debugEnabled = false;
    }

    debug(message, ...args) {
        if (this.debugEnabled || globalThis.LINEAR_DEBUG) {
            console.debug(`[${this.component}] ${message}`, ...args);
        }
    }

    info(message, ...args) {
        console.info(`[${this.component}] ${message}`, ...args);
    }

    warn(message, ...args) {
        console.warn(`[${this.component}] ${message}`, ...args);
    }

    error(message, ...args) {
        console.error(`[${this.component}] ${message}`, ...args);
    }

    enableDebug() {
        this.debugEnabled = true;
    }

    disableDebug() {
        this.debugEnabled = false;
    }
}

// Global debug mode control
export function enableDebugLogging() {
    globalThis.LINEAR_DEBUG = true;
}

export function disableDebugLogging() {
    globalThis.LINEAR_DEBUG = false;
}

export function isDebugEnabled() {
    return !!globalThis.LINEAR_DEBUG;
}