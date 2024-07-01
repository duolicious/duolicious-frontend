const clamp = (value: number, min: number = 0, max: number = 1) =>
  Math.min(Math.max(value, min), max);

/**
 * Converts an HSL color value to RGB using arrow functions.
 * Assumes h, s, and l are in the range [0, 1] and
 * returns r, g, and b in the range [0, 255].
 *
 * @param {number} h - The hue, between 0 and 1.
 * @param {number} s - The saturation, between 0 and 1.
 * @param {number} l - The lightness, between 0 and 1.
 * @return {Array} The RGB representation
 */
const hslToRgb = (h, s, l) => {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1/3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1/3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

/**
 * Converts RGB to HEX using arrow functions.
 * Assumes r, g, and b are in the range [0, 255] and
 * returns HEX string.
 *
 * @param {number} r - The red component
 * @param {number} g - The green component
 * @param {number} b - The blue component
 * @return {string} The HEX color representation
 */
const rgbToHex = (r, g, b) =>
  `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

/**
 * Converts HSL to HEX color format using arrow functions.
 *
 * @param {number} h - The hue, between 0 and 360.
 * @param {number} s - The saturation, between 0 and 1.
 * @param {number} l - The lightness, between 0 and 1.
 * @return {string} The HEX color representation
 */
const hslToHex = (h, s, l) => {
  h /= 360; // Normalize hue to be between 0 and 1
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
};


/**
 * Converts an HSV color value to RGB.
 * Assumes h, s, and v are contained in the set [0, 1] for s and v, and [0, 360] for h.
 * Returns r, g, and b in the set [0, 255].
 *
 * @param {number} h - The hue, between 0 and 360 degrees.
 * @param {number} s - The saturation, between 0 and 1.
 * @param {number} v - The value, between 0 and 1.
 * @return {Array} The RGB representation
 */
const hsvToRgb = (h, s, v) => {
  let r, g, b;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v, g = t, b = p;
      break;
    case 1:
      r = q, g = v, b = p;
      break;
    case 2:
      r = p, g = v, b = t;
      break;
    case 3:
      r = p, g = q, b = v;
      break;
    case 4:
      r = t, g = p, b = v;
      break;
    case 5:
      r = v, g = p, b = q;
      break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};


/**
 * Converts HSV to HEX color format using arrow functions.
 *
 * @param {number} h - The hue, between 0 and 360.
 * @param {number} s - The saturation, between 0 and 1.
 * @param {number} v - The value, between 0 and 1.
 * @return {string} The HEX color representation
 */
const hsvToHex = (h, s, v) => {
  const [r, g, b] = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
};

// Example usage:
console.log(hsvToHex(100, 0.5, 0.5)); // Output: "#40bf40"


export {
  clamp,
  hslToHex,
  hsvToHex,
};
