function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function pillBackground(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return 'transparent';
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.15)';
}

function pillForeground(hex) {
    if (!hex || !hexToRgb(hex)) return '#333';
    return hex;
}

if (typeof module !== 'undefined') {
    module.exports = { hexToRgb: hexToRgb, pillBackground: pillBackground, pillForeground: pillForeground };
}
