import {
  calculateBinCoverage,
  calculateCatchTest,
  calculateEffectiveFieldTime,
  calculateFieldProductTotal,
  calculateRefills,
  calculateTheoreticalCapacity,
  convertMassRate,
  optimizeBinAssignments,
  productRateFromSeedCount,
  seedCountFromProductRate
} from "../calculations.js";
import { VADERSTAD_PD_MODELS, VADERSTAD_PD_SOURCE } from "../vaderstad-pd-specs.js";

const results = document.getElementById("results");
let passed = 0;
let failed = 0;

function assertEqual(name, actual, expected, tolerance = 1e-8) {
  const ok = Math.abs(actual - expected) <= tolerance;
  record(name, ok, ok ? "" : `Expected ${expected}; received ${actual}`);
}

function assertThrows(name, callback) {
  let didThrow = false;
  try { callback(); } catch (error) { didThrow = error instanceof RangeError; }
  record(name, didThrow, didThrow ? "" : "Expected a RangeError");
}

function record(name, ok, detail) {
  const item = document.createElement("li");
  item.className = ok ? "pass" : "fail";
  item.textContent = `${ok ? "PASS" : "FAIL"} · ${name}${detail ? ` — ${detail}` : ""}`;
  results.append(item);
  if (ok) passed += 1;
  else failed += 1;
}

assertEqual("lb/ac converts to kg/ha", convertMassRate(10, "lb/ac"), 11.2085115619, 1e-8);
assertEqual("kg/ha converts to lb/ac", convertMassRate(11.2085115619, "kg/ha"), 10, 1e-8);
assertEqual("product rate and TKW convert to seed count", seedCountFromProductRate(5, "lb/ac", 25), 90718.474);
assertEqual("seed count and TKW convert to product rate", productRateFromSeedCount(90718.474, "lb/ac", 25), 5);

const total = calculateFieldProductTotal(10, "ac", 50, "lb/ac", 25);
assertEqual("field product total is converted to pounds", total.totalLb, 500);
assertEqual("field seed total uses TKW", total.totalSeeds, 9071847.4);
const metricSeeds = calculateFieldProductTotal(2, "ha", 50, "kg/ha", 25);
assertEqual("metric field seed total uses TKW and hectares", metricSeeds.totalSeeds, 4000000);
const metricTotal = calculateFieldProductTotal(4, "ha", 50, "lb/ac");
assertEqual("mixed area and rate units produce metric product mass", metricTotal.totalKg, 224.17023113, 1e-6);

const bin = calculateBinCoverage({
  volumeLitres: 1000,
  bulkDensityKgPerLitre: 0.8,
  fillFactorPercent: 90,
  rate: 80,
  rateUnit: "kg/ha"
});
assertEqual("bin mass applies bulk density and fill factor", bin.usableMassKg, 720);
assertEqual("bin coverage converts to acres", bin.coverageAcres, 22.23948433, 1e-6);
assertEqual("official source publishes six cart sizes", Object.keys(VADERSTAD_PD_MODELS).length, 6);
assertEqual("PD 400 Bin 1 volume matches source table", VADERSTAD_PD_MODELS["400"].binVolumesLitres[0], 1410);
assertEqual("PD 1350 Bin 4 volume matches source table", VADERSTAD_PD_MODELS["1350"].binVolumesLitres[3], 7505);
assertEqual("PD 820 optional Bin 5 volume matches source table", VADERSTAD_PD_MODELS["820"].optionalBin5Litres, 2466);
record("PD capacities cite the official product page", VADERSTAD_PD_SOURCE.includes("vaderstad.com/ca-en/"),
  VADERSTAD_PD_SOURCE.includes("vaderstad.com/ca-en/") ? "" : "Source URL invalid");
const planInputs = {
  bins: [1000, 2000, 3000].map((volumeLitres, index) => ({ volumeLitres, binNumber: index + 1 })),
  products: [
    { name: "Wheat", rate: 100, rateUnit: "lb/ac", bulkDensityKgPerLitre: 1, fillFactorPercent: 100 },
    { name: "Fertilizer blend", rate: 200, rateUnit: "lb/ac", bulkDensityKgPerLitre: 1, fillFactorPercent: 100 }
  ]
};
const independentPlan = optimizeBinAssignments(planInputs);
assertEqual("automatic assignment balances dedicated bins", independentPlan.runLimitAcres,
  Math.min(2000 / (100 * 0.45359237), 3000 / (200 * 0.45359237)));
assertEqual("unused bins are identified when chaining is off", independentPlan.unusedBinNumbers[0], 1);
const chainedPlan = optimizeBinAssignments({ ...planInputs, chainedBins: true });
assertEqual("chained-bin assignment maximizes the shared run limit",
  chainedPlan.runLimitAcres, 2000 / (100 * 0.45359237), 1e-8);
assertEqual("chained-bin assignment can group bins per product",
  chainedPlan.assignments[1].binNumbers.length, 2);
assertEqual("refills exclude the initial load", calculateRefills(160, 80), 1);
assertEqual("no refill is needed when one load covers the field", calculateRefills(80, 80), 0);

assertEqual("theoretical capacity uses width and speed", calculateTheoreticalCapacity({
  width: 40, widthUnit: "ft", speed: 5, speedUnit: "mph"
}), 40 * 5 / 8.25);
assertEqual("metric width and speed convert to acres per hour", calculateTheoreticalCapacity({
  width: 12.192, widthUnit: "m", speed: 8.04672, speedUnit: "km/h"
}), 40 * 5 / 8.25);
const effective = calculateEffectiveFieldTime({
  fieldAcres: 10,
  theoreticalAcresPerHour: 40 * 5 / 8.25,
  width: 40,
  widthUnit: "ft",
  passLengthFeet: 1000,
  turnMinutesPerPass: 1,
  refillEveryAcres: 5,
  refillMinutes: 10
});
assertEqual("effective time includes turns and refill stops", effective.totalHours,
  10 / (40 * 5 / 8.25) + effective.turnCount / 60 + effective.refillCount / 6);
assertEqual("pass area is calculated in square feet", effective.acresPerPass, 40 * 1000 / 43560);

const catchResult = calculateCatchTest({ targetRate: 60, rateUnit: "lb/ac", sampleArea: 0.01, caughtMass: 0.5 });
assertEqual("catch test reports measured rate", catchResult.measuredRate, 50);
assertEqual("catch test calculates target adjustment", catchResult.adjustmentPercent, 120);
assertEqual("catch test reports percent difference", catchResult.differencePercent, -100 / 6);

assertThrows("zero rate is rejected", () => convertMassRate(0, "lb/ac"));
assertThrows("unsupported rate unit is rejected", () => convertMassRate(1, "kg/m2"));
assertThrows("zero TKW is rejected", () => seedCountFromProductRate(1, "lb/ac", 0));
assertThrows("fill factor over 100 percent is rejected", () => calculateBinCoverage({
  volumeLitres: 100,
  bulkDensityKgPerLitre: 0.5,
  fillFactorPercent: 101,
  rate: 10,
  rateUnit: "kg/ha"
}));
assertThrows("more products than available bins is rejected", () => optimizeBinAssignments({
  bins: [{ volumeLitres: 1000 }],
  products: [
    { name: "A", rate: 10, rateUnit: "lb/ac", bulkDensityKgPerLitre: 1, fillFactorPercent: 100 },
    { name: "B", rate: 10, rateUnit: "lb/ac", bulkDensityKgPerLitre: 1, fillFactorPercent: 100 }
  ]
}));

document.getElementById("summary").textContent = `${passed} passed · ${failed} failed`;
