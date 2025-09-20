export class Logger {
    constructor(component) {
        this.component = component;
        this.debugEnabled = false;
    }

    debug(message, ...args) {
        if (this.debugEnabled || globalThis.LINEAR_DEBUG) {
            log(`linear-notifications.${this.component}: ${message}`, ...args);
        }
    }

    info(message, ...args) {
        log(`linear-notifications.${this.component}: ${message}`, ...args);
    }

    warn(message, ...args) {
        log(`linear-notifications.${this.component}: WARNING: ${message}`, ...args);
    }

    error(message, ...args) {
        log(`linear-notifications.${this.component}: ERROR: ${message}`, ...args);
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