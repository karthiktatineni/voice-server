const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

function timestamp() {
    return new Date().toISOString();
}

const logger = {
    info(context, message, data = null) {
        const line = `${COLORS.gray}[${timestamp()}]${COLORS.reset} ${COLORS.cyan}INFO${COLORS.reset}  [${context}] ${message}`;
        console.log(data ? `${line}` : line, data || '');
    },

    warn(context, message, data = null) {
        const line = `${COLORS.gray}[${timestamp()}]${COLORS.reset} ${COLORS.yellow}WARN${COLORS.reset}  [${context}] ${message}`;
        console.warn(data ? `${line}` : line, data || '');
    },

    error(context, message, error = null) {
        const line = `${COLORS.gray}[${timestamp()}]${COLORS.reset} ${COLORS.red}ERROR${COLORS.reset} [${context}] ${message}`;
        console.error(line, error || '');
    },

    success(context, message) {
        console.log(`${COLORS.gray}[${timestamp()}]${COLORS.reset} ${COLORS.green}OK${COLORS.reset}    [${context}] ${message}`);
    },

    call(context, message, data = null) {
        const line = `${COLORS.gray}[${timestamp()}]${COLORS.reset} ${COLORS.magenta}CALL${COLORS.reset}  [${context}] ${message}`;
        console.log(data ? `${line}` : line, data || '');
    },
};

export default logger;
