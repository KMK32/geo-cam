// src/api/sounding.ts
import axios from 'axios';

/**
 * Sounding fetch + index calculations (approximate).
 *
 * We request pressure-level temperature & dew-point variables from Open-Meteo.
 * The code is defensive: tries the normal forecast endpoint with pressure-level variables.
 *
 * Returned sounding contains standard levels (1000,925,850,700,500,300 etc) that are present.
 *
 * NOTE: This is an approximation and intended for demonstration/educational use.
 */

// standard pressure levels we want (hPa) and approximate geopotential heights (m)
export const STANDARD_LEVELS: { p: number; z: number }[] = [
  { p: 1000, z: 110 },
  { p: 975, z: 320 },
  { p: 950, z: 500 },
  { p: 925, z: 800 },
  { p: 900, z: 1000 },
  { p: 850, z: 1500 },
  { p: 800, z: 1900 },
  { p: 700, z: 3000 },
  { p: 600, z: 4200 },
  { p: 500, z: 5600 },
  { p: 400, z: 7200 },
  { p: 300, z: 9200 },
  { p: 250, z: 10400 },
  { p: 200, z: 11800 },
];

export type SoundingLevel = {
  p: number; // hPa
  z: number; // meters (approx)
  t: number | null; // °C
  td: number | null; // °C
};

export type Sounding = {
  time: string | null;
  levels: SoundingLevel[];
  raw?: any;
};

/** helper: build variable names for Open-Meteo for given pressure levels */
function buildVariableNames(levels: number[]) {
  // Open-Meteo uses names like temperature_850hPa and dew_point_850hPa (per their docs)
  const vars: string[] = [];
  for (const p of levels) {
    vars.push(`temperature_${p}hPa`);
    vars.push(`dew_point_${p}hPa`);
  }
  return vars;
}

/**
 * Fetch sounding from Open-Meteo.
 * We attempt the "forecast" endpoint with pressure-level variables.
 * If that fails, we surface an error.
 */
export async function fetchSoundingOpenMeteo(lat: number, lon: number): Promise<Sounding> {
  try {
    const levels = STANDARD_LEVELS.map((l) => l.p);
    const vars = buildVariableNames(levels);
    const hourly = vars.join(',');
    // Use the forecast endpoint which on many models supports pressure-level variables
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${encodeURIComponent(
      hourly
    )}&timezone=auto`;

    const resp = await axios.get(url, { timeout: 15000 });
    const data = resp.data;

    // Find first timestamp index (usually index 0)
    const timeArr = data.hourly?.time ?? null;
    const idx = timeArr && timeArr.length > 0 ? 0 : -1;

    const levelsOut: SoundingLevel[] = STANDARD_LEVELS.map((lev) => {
      const tVar = `temperature_${lev.p}hPa`;
      const tdVar = `dew_point_${lev.p}hPa`;
      const tVal = data.hourly && data.hourly[tVar] && idx >= 0 ? data.hourly[tVar][idx] : null;
      const tdVal = data.hourly && data.hourly[tdVar] && idx >= 0 ? data.hourly[tdVar][idx] : null;
      return { p: lev.p, z: lev.z, t: tVal !== undefined ? (tVal as number) : null, td: tdVal !== undefined ? (tdVal as number) : null };
    });

    return { time: idx >= 0 ? timeArr[idx] : null, levels: levelsOut, raw: data };
  } catch (e) {
    // bubble error message
    throw new Error('Could not fetch sounding from Open-Meteo. ' + (e as Error).message);
  }
}

/* -------------------
   Thermo helper functions (approximate)
   ------------------- */

const g = 9.80665; // m/s^2
const Rd = 287.05; // J/(kg K)
const Cp = 1004.0; // J/(kg K)
const epsilon = 0.622;

function c2k(tC: number) {
  return tC + 273.15;
}
function k2c(tK: number) {
  return tK - 273.15;
}

// saturation vapor pressure (hPa) from Tetens approx (over water)
function svp_hpa(tC: number) {
  return 6.112 * Math.exp((17.67 * tC) / (tC + 243.5));
}

// mixing ratio (kg/kg) from e (hPa) and p (hPa)
function mixingRatio(e_hPa: number, p_hPa: number) {
  return (epsilon * e_hPa) / (p_hPa - e_hPa);
}

// virtual temperature (K) – using T in K and mixing ratio r (kg/kg)
function virtualTemperatureK(Tk: number, r: number) {
  return Tk * (1 + 0.61 * r);
}

/**
 * Approximate LCL temperature (Bolton, 1980) — input in °C, output in K
 * T: temperature (°C), Td: dewpoint (°C)
 */
function t_lcl_k(Tc: number, Tdc: number) {
  const Tk = c2k(Tc);
  const Tdk = c2k(Tdc);
  const num = 1 / (Tdk - 56.0);
  const den = Math.log(Tk / Tdk) / 800.0;
  const Tlcl = 1 / (num + den) + 56.0;
  return Tlcl;
}

/**
 * Lift a parcel from a starting level with T (°C) and Td (°C), to target height z_target (m).
 * We integrate with two lapse rates:
 *  - dry lapse rate until LCL: Gamma_d = 9.8 K/km
 *  - pseudo-moist lapse rate above LCL: approximate Gamma_m = 6.0 K/km
 *
 * This is a simplified approach: good for Showalter/LI demonstration.
 *
 * Returns parcel temperature at z_target (°C)
 */
export function liftParcelToHeight(
  startT_C: number,
  startTd_C: number,
  startZ_m: number,
  zTarget_m: number
): number {
  const Gamma_d = 9.8 / 1000.0; // K/m
  const Gamma_m = 6.0 / 1000.0; // K/m (approx)
  // compute LCL temperature (K)
  const TlclK = t_lcl_k(startT_C, startTd_C);
  // estimate height of LCL: z_LCL ≈ (Tstart_K - TlclK)/Gamma_d (m)
  const TstartK = c2k(startT_C);
  const zLCL = startZ_m + (TstartK - TlclK) / Gamma_d;

  let TparK = TstartK; // current parcel temp in K
  // integrate from startZ to zTarget in two segments
  if (zTarget_m <= zLCL) {
    // entirely dry
    const dz = zTarget_m - startZ_m;
    TparK = TstartK - Gamma_d * dz;
  } else {
    // dry portion to LCL
    const dzDry = zLCL - startZ_m;
    TparK = TstartK - Gamma_d * dzDry;
    // moist portion from LCL to target
    const dzMoist = zTarget_m - zLCL;
    TparK = TparK - Gamma_m * dzMoist;
  }
  return k2c(TparK);
}

/**
 * Compute virtual temperature given T (°C), Td (°C) and pressure (hPa). Returns K.
 */
function virtualTempFromTandTd(Tc: number, Tdc: number, p_hPa: number) {
  const e = svp_hpa(Tdc); // hPa
  const r = mixingRatio(e, p_hPa); // kg/kg
  const Tk = c2k(Tc);
  return virtualTemperatureK(Tk, r);
}

/**
 * Compute CAPE & CIN approximately by integrating between levels provided in sounding.
 * 
 * Algorithm:
 *  - input: levels[] sorted from low pressure (surface) to high altitude (500hPa..)
 *  - compute parcel temperature at each level by lifting parcel from a chosen origin (we will lift from 850 or surface if available)
 *  - compute virtual temps for parcel and environment for each level
 *  - using trapezoidal rule over z, sum positive buoyancy for CAPE and negative for CIN:
 *      local_contribution = g * (Tv_parcel - Tv_env) / Tv_env * dz
 *
 * Returns { cape: J/kg, cin: J/kg }
 *
 * WARNING: approximate. Good for demonstration.
 */
export function computeCAPEandCIN(levels: SoundingLevel[], liftFromLevelIndex = 0) {
  // build arrays of z (m), p(hPa), Tenv(C), Tdenv(C)
  const z: number[] = [];
  const p: number[] = [];
  const Tenv: number[] = [];
  const Tdenv: number[] = [];
  for (const lv of levels) {
    if (lv.t === null || lv.td === null) continue; // skip missing levels
    z.push(lv.z);
    p.push(lv.p);
    Tenv.push(lv.t);
    Tdenv.push(lv.td);
  }
  if (z.length < 2) return { cape: 0, cin: 0 };

  // initial parcel source: use the level index passed (0 by default -> lowest available)
  const sourceIndex = Math.max(0, Math.min(liftFromLevelIndex, z.length - 1));
  const sourceT = Tenv[sourceIndex];
  const sourceTd = Tdenv[sourceIndex];
  const sourceZ = z[sourceIndex];

  // compute parcel temps at each z using simplified lift
  const Tparcel: number[] = [];
  for (let i = 0; i < z.length; i++) {
    const tz = liftParcelToHeight(sourceT, sourceTd, sourceZ, z[i]);
    Tparcel.push(tz);
  }

  // compute virtual temps and integrate
  let cape = 0;
  let cin = 0;
  for (let i = 0; i < z.length - 1; i++) {
    const dz = z[i + 1] - z[i];
    const Tv_env_i = virtualTempFromTandTd(Tenv[i], Tdenv[i], p[i]);
    const Tv_env_j = virtualTempFromTandTd(Tenv[i + 1], Tdenv[i + 1], p[i + 1]);
    const Tv_env = 0.5 * (Tv_env_i + Tv_env_j);

    const Tv_par_i = virtualTempFromTandTd(Tparcel[i], Tdenv[i], p[i]); // parcel uses env dew? approx
    const Tv_par_j = virtualTempFromTandTd(Tparcel[i + 1], Tdenv[i + 1], p[i + 1]);
    const Tv_par = 0.5 * (Tv_par_i + Tv_par_j);

    const buoyancy = (Tv_par - Tv_env) / Tv_env;
    const local = g * buoyancy * dz; // J/kg
    if (local > 0) cape += local;
    else cin += local; // negative
  }

  // cin will be negative; return cin as positive quantity for display or keep negative? we'll return negative value for clarity
  return { cape: Math.round(cape), cin: Math.round(cin) };
}

/**
 * Compute Showalter index: lift parcel from 850 hPa to 500 hPa.
 * We will locate the 850 & 500 levels in the sounding and perform a lift.
 */
export function computeShowalter(levels: SoundingLevel[]) {
  const lev850 = levels.find((l) => l.p === 850);
  const lev500 = levels.find((l) => l.p === 500);
  if (!lev850 || !lev500 || lev850.t === null || lev850.td === null || lev500.t === null) {
    throw new Error('Missing 850 or 500 level data for Showalter');
  }
  const Tparcel500 = liftParcelToHeight(lev850.t, lev850.td, lev850.z, lev500.z);
  // Showalter = Tenv500 - Tparcel500
  const show = lev500.t - Tparcel500;
  return Math.round(show * 10) / 10;
}

/**
 * Compute Lifted Index (LI) by lifting from surface level (use lowest available level).
 * LI = Tenv500 - Tparcel500 (parcel lifted from surface)
 */
export function computeLiftedIndex(levels: SoundingLevel[]) {
  const lev500 = levels.find((l) => l.p === 500);
  if (!lev500 || lev500.t === null) throw new Error('Missing 500 hPa data for LI');

  // choose lowest available level as surface (first in list)
  const sorted = levels.slice().sort((a, b) => b.p - a.p); // descending pressure -> surface first
  const surface = sorted[0];
  if (!surface || surface.t === null || surface.td === null) throw new Error('Missing surface-level temp/td for LI');

  const Tparcel500 = liftParcelToHeight(surface.t, surface.td, surface.z, lev500.z);
  const li = lev500.t - Tparcel500;
  return Math.round(li * 10) / 10;
}

/**
 * Higher-level function: fetch sounding and compute indices.
 */
export async function fetchSoundingAndCompute(lat: number, lon: number) {
  const sounding = await fetchSoundingOpenMeteo(lat, lon);
  const levels = sounding.levels;

  // compute Showalter and LI if possible
  let show: number | null = null;
  let li: number | null = null;
  try {
    show = computeShowalter(levels);
  } catch (e) {
    show = null;
  }
  try {
    li = computeLiftedIndex(levels);
  } catch (e) {
    li = null;
  }

  // compute CAPE/CIN (approx) lifting from 850 if present; otherwise from lowest level
  const levelsWithData = levels.filter((l) => l.t !== null && l.td !== null);
  let cape = null;
  let cin = null;
  if (levelsWithData.length >= 3) {
    const { cape: c, cin: ci } = computeCAPEandCIN(levelsWithData, 0);
    cape = c;
    cin = ci;
  }

  return {
    sounding,
    showalter: show,
    liftedIndex: li,
    cape,
    cin,
  };
}
