export const KG_PER_LB = 0.45359237;
export const HECTARES_PER_ACRE = 0.40468564224;
export const ACRES_PER_HECTARE = 1 / HECTARES_PER_ACRE;
export const KG_PER_LB_PER_HA_PER_ACRE = KG_PER_LB / HECTARES_PER_ACRE;
export const METRES_PER_FOOT = 0.3048;
export const KM_PER_MILE = 1.609344;
export const SQUARE_FEET_PER_ACRE = 43560;

function positive(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be greater than zero.`);
  }
}

function nonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be zero or greater.`);
  }
}

function rateInKgPerHectare(rate, unit) {
  positive(rate, "Application rate");
  if (unit === "kg/ha") return rate;
  if (unit === "lb/ac") return rate * KG_PER_LB_PER_HA_PER_ACRE;
  throw new RangeError("Rate unit must be lb/ac or kg/ha.");
}

export function convertMassRate(value, fromUnit) {
  positive(value, "Rate");
  if (fromUnit === "lb/ac") return value * KG_PER_LB_PER_HA_PER_ACRE;
  if (fromUnit === "kg/ha") return value / KG_PER_LB_PER_HA_PER_ACRE;
  throw new RangeError("Rate unit must be lb/ac or kg/ha.");
}

function seedCountPerRateUnit(rateUnit, thousandKernelWeightGrams) {
  positive(thousandKernelWeightGrams, "Thousand kernel weight");
  if (rateUnit === "lb/ac") return KG_PER_LB * 1_000_000 / thousandKernelWeightGrams;
  if (rateUnit === "kg/ha") return 1_000_000 / thousandKernelWeightGrams;
  throw new RangeError("Rate unit must be lb/ac or kg/ha.");
}

export function seedCountFromProductRate(rate, rateUnit, thousandKernelWeightGrams) {
  positive(rate, "Product rate");
  return rate * seedCountPerRateUnit(rateUnit, thousandKernelWeightGrams);
}

export function productRateFromSeedCount(seedCount, rateUnit, thousandKernelWeightGrams) {
  positive(seedCount, "Seed count");
  return seedCount / seedCountPerRateUnit(rateUnit, thousandKernelWeightGrams);
}

export function calculateFieldProductTotal(area, areaUnit, rate, rateUnit, thousandKernelWeightGrams) {
  positive(area, "Field area");
  const rateKgHa = rateInKgPerHectare(rate, rateUnit);
  let areaHa;
  if (areaUnit === "ha") areaHa = area;
  else if (areaUnit === "ac") areaHa = area * HECTARES_PER_ACRE;
  else throw new RangeError("Area unit must be ac or ha.");

  const totalKg = areaHa * rateKgHa;
  const rateArea = rateUnit === "lb/ac" ? areaHa * ACRES_PER_HECTARE : areaHa;
  const totalSeeds = thousandKernelWeightGrams === undefined || thousandKernelWeightGrams === null || thousandKernelWeightGrams === ""
    ? null
    : seedCountFromProductRate(rate, rateUnit, thousandKernelWeightGrams) * rateArea;
  return { totalKg, totalLb: totalKg / KG_PER_LB, totalSeeds };
}

export function calculateBinCoverage({ volumeLitres, bulkDensityKgPerLitre, fillFactorPercent, rate, rateUnit }) {
  positive(volumeLitres, "Usable bin capacity");
  positive(bulkDensityKgPerLitre, "Bulk density");
  positive(rate, "Application rate");
  if (!Number.isFinite(fillFactorPercent) || fillFactorPercent <= 0 || fillFactorPercent > 100) {
    throw new RangeError("Fill factor must be greater than 0 and no more than 100 percent.");
  }
  const usableMassKg = volumeLitres * bulkDensityKgPerLitre * (fillFactorPercent / 100);
  const coverageHa = usableMassKg / rateInKgPerHectare(rate, rateUnit);
  return {
    usableMassKg,
    usableMassLb: usableMassKg / KG_PER_LB,
    coverageHa,
    coverageAcres: coverageHa * ACRES_PER_HECTARE
  };
}

export function optimizeBinAssignments({ bins, products, chainedBins = false }) {
  if (!Array.isArray(bins) || bins.length === 0) {
    throw new RangeError("Select a cart with at least one bin capacity.");
  }
  if (!Array.isArray(products) || products.length === 0) {
    throw new RangeError("Add at least one product.");
  }
  if (products.length > bins.length) {
    throw new RangeError("Each product needs at least one bin. Add bins or remove products.");
  }

  const coverageByBinAndProduct = bins.map((bin) => products.map((product) =>
    calculateBinCoverage({
      volumeLitres: bin.volumeLitres,
      bulkDensityKgPerLitre: product.bulkDensityKgPerLitre,
      fillFactorPercent: product.fillFactorPercent,
      rate: product.rate,
      rateUnit: product.rateUnit
    }).coverageAcres
  ));
  const assigned = products.map(() => []);
  let best = null;

  function evaluate() {
    if (assigned.some((binIndices) => binIndices.length === 0)) return;
    const productCoverage = assigned.map((binIndices, productIndex) =>
      binIndices.reduce((sum, binIndex) => sum + coverageByBinAndProduct[binIndex][productIndex], 0)
    );
    const runLimitAcres = Math.min(...productCoverage);
    const totalCoverage = productCoverage.reduce((sum, acres) => sum + acres, 0);
    if (!best || runLimitAcres > best.runLimitAcres
      || (runLimitAcres === best.runLimitAcres && totalCoverage > best.totalCoverage)) {
      best = {
        runLimitAcres,
        totalCoverage,
        productCoverage,
        assignments: assigned.map((indices) => indices.slice())
      };
    }
  }

  if (chainedBins) {
    function distribute(binIndex) {
      if (binIndex === bins.length) {
        evaluate();
        return;
      }
      for (let productIndex = 0; productIndex < products.length; productIndex += 1) {
        assigned[productIndex].push(binIndex);
        distribute(binIndex + 1);
        assigned[productIndex].pop();
      }
    }
    distribute(0);
  } else {
    function chooseOneBinPerProduct(productIndex) {
      if (productIndex === products.length) {
        evaluate();
        return;
      }
      for (let binIndex = 0; binIndex < bins.length; binIndex += 1) {
        if (assigned.some((binIndices) => binIndices.includes(binIndex))) continue;
        assigned[productIndex].push(binIndex);
        chooseOneBinPerProduct(productIndex + 1);
        assigned[productIndex].pop();
      }
    }
    chooseOneBinPerProduct(0);
  }

  if (!best) throw new RangeError("No valid bin assignment could be calculated.");
  const usedIndices = new Set(best.assignments.flat());
  return {
    runLimitAcres: best.runLimitAcres,
    assignments: products.map((product, productIndex) => ({
      productName: product.name,
      binNumbers: best.assignments[productIndex].map((binIndex) =>
        bins[binIndex].binNumber ?? binIndex + 1
      ),
      coverageAcres: best.productCoverage[productIndex]
    })),
    unusedBinNumbers: bins
      .map((bin, index) => ({ number: bin.binNumber ?? index + 1, index }))
      .filter(({ index }) => !usedIndices.has(index))
      .map(({ number }) => number)
  };
}

export function calculateRefills(fieldAcres, acresPerLoad) {
  positive(fieldAcres, "Field area");
  positive(acresPerLoad, "Acres per load");
  return Math.max(0, Math.ceil(fieldAcres / acresPerLoad) - 1);
}

export function calculateTheoreticalCapacity({ width, widthUnit, speed, speedUnit }) {
  positive(width, "Working width");
  positive(speed, "Travel speed");
  let widthFeet;
  let speedMph;
  if (widthUnit === "ft") widthFeet = width;
  else if (widthUnit === "m") widthFeet = width / METRES_PER_FOOT;
  else throw new RangeError("Width unit must be ft or m.");
  if (speedUnit === "mph") speedMph = speed;
  else if (speedUnit === "km/h") speedMph = speed / KM_PER_MILE;
  else throw new RangeError("Speed unit must be mph or km/h.");
  return widthFeet * speedMph / 8.25;
}

export function calculateEffectiveFieldTime({
  fieldAcres,
  theoreticalAcresPerHour,
  width,
  widthUnit,
  passLengthFeet,
  turnMinutesPerPass,
  refillEveryAcres = null,
  refillMinutes = 0
}) {
  positive(fieldAcres, "Field area");
  positive(theoreticalAcresPerHour, "Theoretical capacity");
  positive(width, "Working width");
  positive(passLengthFeet, "Pass length");
  nonNegative(turnMinutesPerPass, "Turn time");
  nonNegative(refillMinutes, "Refill time");
  const widthFeet = widthUnit === "ft" ? width
    : widthUnit === "m" ? width / METRES_PER_FOOT
      : NaN;
  positive(widthFeet, "Working width");

  const acresPerPass = widthFeet * passLengthFeet / SQUARE_FEET_PER_ACRE;
  const turnCount = Math.max(0, Math.ceil(fieldAcres / acresPerPass) - 1);
  const refillCount = refillEveryAcres === null || refillEveryAcres === undefined || refillEveryAcres === ""
    ? 0
    : calculateRefills(fieldAcres, refillEveryAcres);
  const travelHours = fieldAcres / theoreticalAcresPerHour;
  const turnHours = turnCount * turnMinutesPerPass / 60;
  const refillHours = refillCount * refillMinutes / 60;
  const totalHours = travelHours + turnHours + refillHours;
  return {
    acresPerPass,
    turnCount,
    refillCount,
    travelHours,
    turnHours,
    refillHours,
    totalHours,
    effectiveAcresPerHour: fieldAcres / totalHours
  };
}

export function calculateCatchTest({ targetRate, rateUnit, sampleArea, caughtMass }) {
  positive(targetRate, "Target rate");
  positive(sampleArea, "Sample area");
  positive(caughtMass, "Caught mass");
  if (rateUnit !== "lb/ac" && rateUnit !== "kg/ha") {
    throw new RangeError("Rate unit must be lb/ac or kg/ha.");
  }
  const measuredRate = caughtMass / sampleArea;
  return {
    measuredRate,
    adjustmentPercent: targetRate / measuredRate * 100,
    differencePercent: (measuredRate - targetRate) / targetRate * 100
  };
}
