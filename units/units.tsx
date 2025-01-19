import { signedInUser } from '../App';

const cmToFeetInches = (cm: number): {feet: number, inches: number} => {
    const inches = cm / 2.54;
    const feet = Math.floor(inches / 12);
    const remainingInches = Math.floor(inches % 12);

    return { feet, inches: remainingInches };
};

const cmToFeetInchesStr = (cm: number): string => {
  const feetInches = cmToFeetInches(cm);
  return `${feetInches.feet}'${feetInches.inches}"`;
}

const kmToMiles = (km: number): number => {
  return Math.round(km * 0.621371);
}

const kmToMilesStr = (km: number): string => {
  return String(kmToMiles(km));
};

const cmToLocaleUnitsStr = (): string =>
  signedInUser?.units === 'Imperial' ? "ft'in\"" : "cm"

const cmToLocaleStr = (cm: number): string =>
  signedInUser?.units === 'Imperial' ? cmToFeetInchesStr(cm) : String(cm)

const cmToLocaleWithUnitsStr = (cm: number): string =>
  cmToLocaleStr(cm) + (signedInUser?.units === 'Imperial' ? '' : ' cm')

const kmToLocaleUnitsStr = (): string =>
  signedInUser?.units === 'Imperial' ? "mi." : "km"

const kmToLocaleStr = (km: number): string =>
  signedInUser?.units === 'Imperial' ? kmToMilesStr(km) : String(km)

const kmToLocaleWithUnitsStr = (cm: number): string =>
  kmToLocaleStr(cm) + (signedInUser?.units === 'Imperial' ? ' mi.' : ' km')

export {
  cmToLocaleUnitsStr,
  cmToLocaleStr,
  cmToLocaleWithUnitsStr,
  kmToLocaleUnitsStr,
  kmToLocaleStr,
  kmToLocaleWithUnitsStr,

  // TODO: Try removing the use of these
  cmToFeetInchesStr,
  kmToMilesStr,
};

