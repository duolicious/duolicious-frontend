import {
  Linking,
  Platform,
} from 'react-native';
import {
  format,
  formatDistanceToNow,
  isThisWeek,
  isThisYear,
  isToday,
  subSeconds,
  isYesterday,
} from 'date-fns'
import _ from 'lodash';

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
  
  return format(date, 'PPP'); // Makes it use the default locale
};

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
  if (secondsAgo < 300) { // 5 minutes
    return "Now";
  }

  const lastOnlineDate = subSeconds(new Date(), secondsAgo);

  return _.capitalize(formatDistanceToNow(lastOnlineDate));
}

const possessive = (s: string) => {
  const possessiveMarker = String(s).endsWith('s') ? "'" : "'s";

  return s + possessiveMarker;
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


/**
 * Creates a debounced function that delays invoking `func` until after
 * `dynamicWaitFn()` milliseconds have elapsed since the last time the
 * debounced function was called. Also, if `dynamicMaxWaitFn()` milliseconds 
 * have passed since the last invocation, `func` is invoked immediately 
 * instead of waiting.
 *
 * @param func             The function to debounce.
 * @param dynamicWaitFn    A function returning the current wait time (ms).
 * @param dynamicMaxWaitFn A function returning the current maxWait time (ms).
 * @returns                A new debounced function.
 */
const dynamicDebounce = <T extends (...args: any[]) => any>(
  func: T,
  dynamicWaitFn: () => number,
): ((...args: Parameters<T>) => void) => {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let lastInvokeTime = 0;
  let lastArgs: Parameters<T> | undefined;

  // Helper to actually invoke the original function
  const invoke = (): void => {
    if (lastArgs) {
      console.log('invoke'); // TODO
      func(...lastArgs);
      lastInvokeTime = performance.now();
      lastArgs = undefined;
    }
  };

  // The debounced function (arrow function)
  const debounced = (...args: Parameters<T>): void => {
    const now = performance.now();
    const wait = dynamicWaitFn();

    lastArgs = args;
    const timeSinceLastInvoke = now - lastInvokeTime;
    const shouldInvokeNow = timeSinceLastInvoke >= wait;

    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }

    if (shouldInvokeNow) {
      // Invoke immediately if `wait` has elapsed
      invoke();
    } else {
      // Otherwise, schedule for trailing invocation after `wait`
      timerId = setTimeout(invoke, wait);
    }
  };

  return debounced;
};

export {
  compareArrays,
  delay,
  deleteFromArray,
  dynamicDebounce,
  friendlyDate,
  friendlyTimeAgo,
  friendlyTimestamp,
  getRandomElement,
  isMobile,
  longFriendlyTimestamp,
  parseUrl,
  possessive,
  secToMinSec,
  withTimeout,
};
