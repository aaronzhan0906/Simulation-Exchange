/**
 * formatted /n to
 * @param {Object} details 
 * @returns {string} string after formatted
 */

export function formatErrorDetails(details) {
    return Object.entries(details).map(([key, value]) => {
        if (typeof value === "string") {
            value = value.replace(/\\n/g, '\n');
        }
        return `${key}: ${value}`;
    }).join('\n');
}