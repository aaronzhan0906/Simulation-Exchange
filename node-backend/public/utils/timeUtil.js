/**
 * Converts a UTC time string to a formatted local time string
 * @param {string} utcTimeString - UTC time string
 * @returns {string} Formatted local time string (MM/DD/YYYY HH:mm:ss)
 */
export function formatLocalTime(utcTimeString) {
    const date = new Date(utcTimeString);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");


    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
}