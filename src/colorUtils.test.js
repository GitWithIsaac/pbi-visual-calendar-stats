const { hexToRgb, pillBackground, pillForeground } = require('./colorUtils');

test('hexToRgb parses 6-digit hex', () => {
    expect(hexToRgb('#2563eb')).toEqual({ r: 37, g: 99, b: 235 });
});

test('hexToRgb returns null for invalid input', () => {
    expect(hexToRgb('notacolor')).toBeNull();
    expect(hexToRgb(null)).toBeNull();
});

test('pillBackground produces rgba with 0.15 alpha', () => {
    expect(pillBackground('#2563eb')).toBe('rgba(37,99,235,0.15)');
});

test('pillBackground falls back to transparent on invalid color', () => {
    expect(pillBackground(null)).toBe('transparent');
});

test('pillForeground returns the original color unchanged', () => {
    expect(pillForeground('#2563eb')).toBe('#2563eb');
});

test('pillForeground falls back to #333 on invalid color', () => {
    expect(pillForeground(null)).toBe('#333');
});

test('pillForeground falls back to #333 on invalid non-null string', () => {
    expect(pillForeground('notacolor')).toBe('#333');
});

test('hexToRgb returns null for 3-digit shorthand hex', () => {
    expect(hexToRgb('#f00')).toBeNull();
});

test('hexToRgb parses hex without leading hash', () => {
    expect(hexToRgb('2563eb')).toEqual({ r: 37, g: 99, b: 235 });
});
