import {
  Linking,
  Platform,
} from 'react-native';
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  intervalToDuration,
  isThisWeek,
  isThisYear,
  isToday,
  isYesterday,
  subSeconds,
} from 'date-fns'
import * as _ from 'lodash';

const isMobile = () => {
  const re = /(android|iphone|ipod|iemobile|blackberry|webos|symbian)/i;

  return (
    Platform.OS === 'android' ||
    Platform.OS === 'ios' ||
    re.test(window.navigator.userAgent)
  );
};

/* Compare arrays as they would be in Python
 */
const compareArrays = (arrA: any[], arrB: any[]): number => {
  let minLength = Math.min(arrA.length, arrB.length);

  for (let i = 0; i < minLength; i++) {
    if (arrA[i] < arrB[i]) {
      return -1;
    } else if (arrA[i] > arrB[i]) {
      return 1;
    }
  }

  return arrA.length - arrB.length;
}

const assert = (x: boolean) => { if (!x) throw new Error('Assertion failed')};

const jsonParseSilently = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const friendlyTimestamp = (date: Date): string => {
  if (isToday(date)) {
    // Format as 'hh:mm'
    return format(date, 'h:mm aaa')
  } else if (isThisWeek(date)) {
    // Format as 'eeee' (day of the week)
    return format(date, 'eee')
  } else if (isThisYear(date)) {
    // Format as 'd MMM' (date and month)
    return format(date, 'd MMM')
  } else {
    // Format as 'd MMM yyyy' (date, month and year)
    return format(date, 'd MMM yyyy')
  }
};

const longFriendlyTimestamp = (date: Date): string => {
  // Format as 'hh:mm'
  const timeOfDay = format(date, 'h:mm aaa');

  if (isToday(date)) {
    return timeOfDay;
  } else {
    return friendlyTimestamp(date) + ', ' + timeOfDay
  }
};

const friendlyDate = (date: Date): string => {
  if (isToday(date)) {
    return 'Today';
  }

  if (isYesterday(date)) {
    return 'Yesterday';
  }

  // Check if the date is within the last 7 days
  if (differenceInCalendarDays(new Date(), date) < 7) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long'
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(isThisYear(date) ? {} : { year: 'numeric' }),
  }).format(date);
};

const getShortElapsedTime = (start: Date) => {
  const end = new Date();
  const duration = intervalToDuration({ start, end });

  if (duration?.years ?? 0 > 0) return `${duration.years}y`;
  if (duration?.months ?? 0 > 0) return `${duration.months}mo`;
  if (duration?.days ?? 0 > 0) return `${duration.days}d`;
  if (duration?.hours ?? 0 > 0) return `${duration.hours}h`;
  if (duration?.minutes ?? 0 > 0) return `${duration.minutes}m`;
  return `${duration.seconds}s`;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const deleteFromArray = <T,>(array: T[], element: T): T[] => {
  let index = array.indexOf(element);
  if (index !== -1) {
    array.splice(index, 1);
  }
  return array;
};

const withTimeout = <T,>(ms: number, promise: Promise<T>): Promise<T | 'timeout'> => {
  const timeout = new Promise<T | 'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), ms)
  );
  return Promise.race([promise, timeout]);
};

const parseUrl = async () => {
  const initialUrl = await Linking.getInitialURL();

  if (!initialUrl) {
    return null;
  }

  const url = new URL(initialUrl);

  const match = url.pathname.match(/^\/([^\/]+)\/([^\/]+)$/);
  const left = match ? match[1] : undefined;
  const right = match ? match[2] : undefined;

  if (!left)
    return null

  if (!right)
    return null;

  return { left, right };
};

const friendlyTimeAgo = (secondsAgo: number): string => {
  const lastOnlineDate = subSeconds(new Date(), secondsAgo);

  return _.capitalize(formatDistanceToNow(lastOnlineDate));
}

const possessive = (s: string) => {
  const possessiveMarker = String(s).endsWith('s') ? "’" : "’s";

  return s + possessiveMarker;
};

const pluralize = (s: string, n: number) => {
  if (n === 1) {
    return s;
  } else {
    return s + 's';
  }
};

const secToMinSec = (sec: number): [string, string] => {
  const minutes = String(Math.floor(sec / 60));
  const seconds = String(sec % 60).padStart(2, '0');

  return [minutes, seconds];
};

const getRandomElement = <T,>(list: T[]): T | undefined =>
    list.length === 0 ?
    undefined :
    list[Math.floor(Math.random() * list.length)];

const assertNever = (x: never): never => {
  throw new Error(`Unexpected object: ${x}`);
};

const truncateText = (
  text: string,
  opts: { maxLength?: number; maxLines?: number } = {}
): string => {
  const { maxLength, maxLines } = opts;
  let truncated = false;

  // 1. Line‑wise truncation
  let result = text;
  if (maxLines != null && maxLines >= 0) {
    const lines = result.split('\n');
    if (lines.length > maxLines) {
      result = lines.slice(0, maxLines).join('\n');
      truncated = true;
    }
  }

  // 2. Length‑wise truncation (unicode‑safe)
  if (maxLength != null && maxLength >= 0) {
    const chars = Array.from(result);               // grapheme clusters
    if (chars.length > maxLength) {
      result = chars.slice(0, maxLength).join('');
      truncated = true;
    }
  }

  return truncated ? `${result}…` : result;
};

const getLuminance = (hex: string): number => {
  let h = hex.trim().replace(/^#/, '');
  // expand #RGB / #RGBA to #RRGGBB (drop alpha)
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join('');
  // drop alpha if #RRGGBBAA
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) throw new Error(`Invalid hex color: ${hex}`);

  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);

  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

/**
 * Choose readable text color for a given background.
 * @param bg - background hex (#RGB, #RRGGBB, #RGBA, #RRGGBBAA)
 * @param bias - number in [-1, 1]; positive leans toward white, negative toward black.
 *               Implemented as a multiplicative weight on the white/black contrast.
 *               0 = neutral (no bias).
 */
const bestTextOn = (bg: string, bias: number = 0): '#000000' | '#ffffff' => {
  const L = getLuminance(bg);
  const contrastWhite = (1 + 0.05) / (L + 0.05);
  const contrastBlack = (L + 0.05) / 0.05;

  // Clamp bias to [-0.99, 0.99] to avoid zeroing a side completely
  const b = Math.max(-0.99, Math.min(0.99, bias));

  // Tilt the decision by weighting contrasts
  const weightedWhite = contrastWhite * (1 + b);
  const weightedBlack = contrastBlack * (1 - b);

  return weightedWhite >= weightedBlack ? '#ffffff' : '#000000';
};

/**
 * Cap a color's WCAG relative luminance to a maximum value.
 * If the color's luminance <= maxL, it's returned unchanged.
 *
 * @param hex - Color in #RRGGBB format
 * @param maxL - Max relative luminance [0..1]
 * @returns Hex color string (#RRGGBB) with luminance <= maxL
 */
const capLuminance = (hex: string, maxL: number = 0.05): string => {
  const assertHex = /^#([0-9a-fA-F]{6})$/;
  if (!assertHex.test(hex)) {
    throw new Error("Invalid hex color. Expected format: #RRGGBB");
  }

  const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const Lmax = clamp01(maxL);

  const hexToSRGB = (h: string): [number, number, number] => {
    const r = parseInt(h.slice(1, 3), 16) / 255;
    const g = parseInt(h.slice(3, 5), 16) / 255;
    const b = parseInt(h.slice(5, 7), 16) / 255;
    return [r, g, b];
  };

  const s2l = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const l2s = (c: number) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

  const luminance = ([r, g, b]: [number, number, number]) => {
    const R = s2l(r), G = s2l(g), B = s2l(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };

  const toHex = ([r, g, b]: [number, number, number]) => {
    const toByte = (c: number) => {
      const v = Math.round(clamp01(c) * 255);
      return v.toString(16).padStart(2, "0").toUpperCase();
    };
    return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
  };

  const srgb = hexToSRGB(hex);
  const L = luminance(srgb);

  // Already within cap (or black)
  if (L === 0 || L <= Lmax) return hex;

  // Scale *linear* RGB by k so luminance scales exactly to the cap.
  const k = Lmax / L;

  const [rL, gL, bL] = srgb.map(s2l) as [number, number, number];
  const scaledLinear: [number, number, number] = [
    clamp01(rL * k),
    clamp01(gL * k),
    clamp01(bL * k),
  ];

  const scaledSRGB: [number, number, number] = [
    l2s(scaledLinear[0]),
    l2s(scaledLinear[1]),
    l2s(scaledLinear[2]),
  ].map(clamp01) as [number, number, number];

  return toHex(scaledSRGB);
};


export {
  assert,
  assertNever,
  compareArrays,
  delay,
  deleteFromArray,
  friendlyDate,
  friendlyTimeAgo,
  friendlyTimestamp,
  getRandomElement,
  getShortElapsedTime,
  isMobile,
  jsonParseSilently,
  longFriendlyTimestamp,
  parseUrl,
  possessive,
  secToMinSec,
  truncateText,
  withTimeout,
  pluralize,
  getLuminance,
  bestTextOn,
  capLuminance,
};
