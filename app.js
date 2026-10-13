import {
  ACRES_PER_HECTARE,
  KG_PER_LB,
  KM_PER_MILE,
  METRES_PER_FOOT,
  calculateCatchTest,
  calculateEffectiveFieldTime,
  calculateFieldProductTotal,
  calculateRefills,
  calculateTheoreticalCapacity,
  convertMassRate,
  optimizeBinAssignments,
  productRateFromSeedCount,
  seedCountFromProductRate
} from "./calculations.js";
import { VADERSTAD_PD_MODELS, VADERSTAD_PD_SOURCE } from "./vaderstad-pd-specs.js";

const STORAGE_KEY = "air-seeder-field-toolkit-v1";
const $ = (id) => document.getElementById(id);
const storageNote = $("storage-note");
let storageAvailable = true;
let installPrompt = null;

function readStoredValues() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    storageAvailable = false;
    storageNote.textContent = "This browser cannot read saved entries; current values will remain until you close the page.";
    return {};
  }
}

let savedValues = readStoredValues();

function saveValue(element) {
  if (!storageAvailable || !element.id || !element.matches("[data-persist]")) return;
  savedValues[element.id] = element.value;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedValues));
  } catch {
    storageAvailable = false;
    storageNote.textContent = "Device storage is unavailable or full; entries will not persist after this page closes.";
  }
}

function restoreValues(root = document) {
  root.querySelectorAll("[data-persist][id]").forEach((element) => {
    if (Object.prototype.hasOwnProperty.call(savedValues, element.id)) {
      element.value = savedValues[element.id];
    }
  });
  syncUnitToggles(root);
}

function syncUnitToggle(button) {
  const units = button.dataset.units.split("|");
  const current = units.includes(button.value) ? button.value : units[0];
  button.value = current;
  button.textContent = current;
  const next = units[(units.indexOf(current) + 1) % units.length];
  button.setAttribute("aria-label", `Change units from ${current} to ${next}`);
}

function syncUnitToggles(root = document) {
  root.querySelectorAll("[data-unit-toggle]").forEach(syncUnitToggle);
}

function convertUnitValue(value, kind, from, to) {
  if (kind === "rate-mass") return convertMassRate(value, from);
  if (kind === "mass") {
    return from === "lb/ac" ? value * KG_PER_LB : value / KG_PER_LB;
  }
  if (kind === "rate") {
    if ($("conversion-direction").value === "to-seeds") return convertMassRate(value, from);
    return from === "lb/ac" ? value * ACRES_PER_HECTARE : value / ACRES_PER_HECTARE;
  }
  if (kind === "area") {
    const fromAcres = from === "ac" || from.endsWith("/ac");
    const toAcres = to === "ac" || to.endsWith("/ac");
    return fromAcres && !toAcres
      ? value / ACRES_PER_HECTARE
      : value * ACRES_PER_HECTARE;
  }
  if (kind === "length") return from === "ft"
    ? value * METRES_PER_FOOT
    : value / METRES_PER_FOOT;
  if (kind === "speed") return from === "mph"
    ? value * KM_PER_MILE
    : value / KM_PER_MILE;
  throw new RangeError(`Unsupported unit conversion: ${kind}.`);
}

function changeUnit(button) {
  const units = button.dataset.units.split("|");
  const currentIndex = units.indexOf(button.value);
  const nextUnit = units[(currentIndex + 1 + units.length) % units.length];
  const conversions = button.dataset.converts || "";
  conversions.split(",").filter(Boolean).forEach((conversion) => {
    const [inputId, kind] = conversion.split(":");
    const input = $(inputId);
    const text = input.value.trim();
    if (!text) return;
    const value = Number(text);
    if (!Number.isFinite(value) || value <= 0) return;
    input.value = String(Number(convertUnitValue(value, kind, button.value, nextUnit).toPrecision(10)));
    saveValue(input);
  });
  button.value = nextUnit;
  syncUnitToggle(button);
  saveValue(button);
  updateAll();
}

function numeric(id, { optional = false } = {}) {
  const input = $(id);
  const text = input.value.trim();
  input.removeAttribute("aria-invalid");
  if (text === "" && optional) return null;
  if (text === "") return null;
  const value = Number(text);
  if (Number.isFinite(value) && value > 0) return value;
  input.setAttribute("aria-invalid", "true");
  return null;
}

function nonNegativeNumeric(id, { optional = false } = {}) {
  const input = $(id);
  const text = input.value.trim();
  input.removeAttribute("aria-invalid");
  if (text === "" && optional) return null;
  if (text === "") return null;
  const value = Number(text);
  if (Number.isFinite(value) && value >= 0) return value;
  input.setAttribute("aria-invalid", "true");
  return null;
}

function format(value, digits = 1) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}

function resultText(id, text) {
  $(id).textContent = text;
}

function updateConversionLabels() {
  const unit = $("conversion-unit").value;
  const direction = $("conversion-direction").value;
  const massName = unit === "lb/ac" ? "lb/ac" : "kg/ha";
  const countName = unit === "lb/ac" ? "seeds/ac" : "seeds/ha";
  $("conversion-value-label").textContent = direction === "to-seeds"
    ? "Product rate"
    : "Seed rate";
  $("conversion-factor-label").textContent = "TKW (g / 1,000 seeds)";
  $("conversion-result-label").textContent = direction === "to-seeds" ? countName : massName;
}

function updateConversion() {
  updateConversionLabels();
  const value = numeric("conversion-value");
  const factor = numeric("conversion-factor");
  if (value === null || factor === null) {
    resultText("conversion-result", "Enter both values");
    return;
  }
  try {
    const unit = $("conversion-unit").value;
    const direction = $("conversion-direction").value;
    const answer = direction === "to-seeds"
      ? seedCountFromProductRate(value, unit, factor)
      : productRateFromSeedCount(value, unit, factor);
    const suffix = direction === "to-seeds"
      ? (unit === "lb/ac" ? " seeds/ac" : " seeds/ha")
      : ` ${unit}`;
    resultText("conversion-result", `${format(answer, 2)}${suffix}`);
  } catch (error) {
    resultText("conversion-result", error.message);
  }
}

function updateMassRate() {
  const value = numeric("mass-rate-value");
  const unit = $("mass-rate-unit").value;
  if (value === null) {
    resultText("mass-rate-result", "Enter a rate");
    return;
  }
  try {
    const converted = convertMassRate(value, unit);
    const toUnit = unit === "lb/ac" ? "kg/ha" : "lb/ac";
    $("mass-rate-result-label").textContent = `Equivalent rate (${toUnit})`;
    resultText("mass-rate-result", `${format(converted, 3)} ${toUnit}`);
  } catch (error) {
    resultText("mass-rate-result", error.message);
  }
}

function updateFieldTotal() {
  const area = numeric("total-area-value");
  const rate = numeric("total-rate-value");
  const tkw = numeric("total-seed-factor", { optional: true });
  $("total-seed-factor-label").textContent = "Optional TKW (g / 1,000 seeds)";
  if ($("total-seed-factor").value.trim() && tkw === null) {
    resultText("total-result", "Enter a positive TKW or clear the field");
    resultText("total-seed-result", "");
    return;
  }
  if (area === null || rate === null) {
    resultText("total-result", "Enter area and rate");
    resultText("total-seed-result", "");
    return;
  }
  try {
    const areaUnit = $("total-area-unit").value;
    const rateUnit = $("total-rate-unit").value;
    const total = calculateFieldProductTotal(area, areaUnit, rate, rateUnit, tkw);
    $("total-result-label").textContent = `Product needed (${rateUnit === "lb/ac" ? "lb" : "kg"})`;
    resultText("total-result", `${format(rateUnit === "lb/ac" ? total.totalLb : total.totalKg, 2)} ${rateUnit === "lb/ac" ? "lb" : "kg"}`);
    resultText("total-seed-result", total.totalSeeds === null
      ? ""
      : `Estimated seed count: ${format(total.totalSeeds, 0)} seeds`);
  } catch (error) {
    resultText("total-result", error.message);
  }
}

let binIds = [];
let nextBinId = 1;
let productIds = [];
let nextProductId = 1;
let previousCartFamily = savedValues["cart-family"] || "";

function renderBin(id) {
  const number = binIds.indexOf(id) + 1;
  const wrapper = document.createElement("section");
  wrapper.className = "bin-entry";
  wrapper.dataset.binId = String(id);
  wrapper.innerHTML = `
    <details class="bin-entry-details" open>
      <summary><span id="bin-title-${id}">Bin ${number}</span><span class="manual-bin-summary" id="bin-summary-${id}">Enter usable volume</span></summary>
      <div class="bin-fields">
        <label class="field"><span>Usable capacity (L)</span><input id="bin-volume-${id}" data-persist inputmode="decimal" type="number" min="0" step="any" placeholder="From cart manual"></label>
        <button class="remove-bin" type="button" data-remove-bin="${id}" aria-label="Remove bin ${number}">Remove bin</button>
      </div>
    </details>`;
  return wrapper;
}

function renderProduct(id) {
  const number = productIds.indexOf(id) + 1;
  const wrapper = document.createElement("details");
  wrapper.className = "product-entry";
  wrapper.open = number === 1;
  wrapper.dataset.productId = String(id);
  wrapper.innerHTML = `
    <summary><span id="product-title-${id}">Product ${number}</span><span class="product-summary-detail" id="product-summary-${id}">Enter product details</span></summary>
    <div class="product-fields">
      <label class="field"><span>Product name</span><input id="product-name-${id}" data-persist type="text" autocomplete="off" placeholder="e.g. Wheat"></label>
      <div class="control-row">
        <label class="field">
          <span class="field-topline"><span>Application rate</span><button class="unit-toggle" id="product-unit-${id}" type="button" data-unit-toggle data-units="lb/ac|kg/ha" data-converts="product-rate-${id}:rate-mass" data-persist value="lb/ac">lb/ac</button></span>
          <input id="product-rate-${id}" data-persist inputmode="decimal" type="number" min="0" step="any" placeholder="Enter rate">
        </label>
      </div>
      <div class="control-row">
        <label class="field"><span>Bulk density (kg/L)</span><input id="product-density-${id}" data-persist inputmode="decimal" type="number" min="0" step="any" placeholder="From product / scale"></label>
        <label class="field"><span>Fill factor (%)</span><input id="product-fill-${id}" data-persist inputmode="decimal" type="number" min="0" max="100" step="any" placeholder="1–100"></label>
      </div>
      <label class="field"><span>Optional TKW (g / 1,000 seeds)</span><input id="product-tkw-${id}" data-persist inputmode="decimal" type="number" min="0" step="any" placeholder="For seed-count estimate"></label>
      <button class="remove-product" type="button" data-remove-product="${id}" aria-label="Remove product ${number}">Remove product</button>
    </div>`;
  return wrapper;
}

function saveProductIds() {
  savedValues.productIds = productIds.slice();
  if (!storageAvailable) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedValues));
  } catch {
    storageAvailable = false;
    storageNote.textContent = "Device storage is unavailable or full; entries will not persist after this page closes.";
  }
}

function addProduct(restore = true, requestedId = null) {
  if (productIds.length >= 5) return;
  const id = requestedId === null ? nextProductId++ : requestedId;
  nextProductId = Math.max(nextProductId, id + 1);
  productIds.push(id);
  $("product-list").append(renderProduct(id));
  if (restore) restoreValues($("product-list").lastElementChild);
  saveProductIds();
  $("add-product").disabled = productIds.length >= 5;
  updateBinResults();
}

function removeProduct(id) {
  if (productIds.length <= 1) return;
  const entry = $("product-list").querySelector(`[data-product-id="${id}"]`);
  if (!entry) return;
  entry.remove();
  productIds = productIds.filter((productId) => productId !== id);
  ["name", "rate", "unit", "density", "fill", "tkw"].forEach((suffix) => {
    delete savedValues[`product-${suffix}-${id}`];
  });
  [...$("product-list").children].forEach((child, index) => {
    child.querySelector(`#product-title-${child.dataset.productId}`).textContent = `Product ${index + 1}`;
  });
  saveProductIds();
  $("add-product").disabled = productIds.length >= 5;
  updateBinResults();
}

function saveBinIds() {
  savedValues.binIds = binIds.slice();
  if (!storageAvailable) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedValues));
  } catch {
    storageAvailable = false;
    storageNote.textContent = "Device storage is unavailable or full; entries will not persist after this page closes.";
  }
}

function addBin(restore = true, requestedId = null) {
  if (binIds.length >= maxBinsForSelectedCart()) {
    $("add-bin").disabled = true;
    return;
  }
  const id = requestedId === null ? nextBinId++ : requestedId;
  nextBinId = Math.max(nextBinId, id + 1);
  binIds.push(id);
  $("bin-list").append(renderBin(id));
  if (restore) restoreValues($("bin-list").lastElementChild);
  if (restore) saveBinIds();
  $("add-bin").disabled = binIds.length >= maxBinsForSelectedCart();
  updateBinResults();
}

function removeBin(id) {
  if (binIds.length <= 1) return;
  const index = binIds.indexOf(id);
  if (index < 0) return;
  const entry = $("bin-list").querySelector(`[data-bin-id="${id}"]`);
  entry.remove();
  binIds.splice(index, 1);
  const oldValues = { ...savedValues };
  ["product", "volume", "density", "fill", "rate", "unit"].forEach((suffix) => {
    delete oldValues[`bin-${suffix}-${id}`];
  });
  savedValues = oldValues;
  saveBinIds();
  [...$("bin-list").children].forEach((child, childIndex) => {
    const title = child.querySelector('[id^="bin-title-"]');
    title.textContent = `Bin ${childIndex + 1}`;
    child.querySelector(".remove-bin").setAttribute("aria-label", `Remove bin ${childIndex + 1}`);
  });
  $("add-bin").disabled = binIds.length >= maxBinsForSelectedCart();
  updateBinResults();
}

function maxBinsForSelectedCart() {
  const model = VADERSTAD_PD_MODELS[$("cart-family").value];
  if (!model) return 5;
  const optionalEnabled = model.optionalBin5Litres !== null && $("use-optional-bin").value === "yes";
  return model.binVolumesLitres.length + (optionalEnabled ? 1 : 0);
}

function syncCartModel() {
  const selected = $("cart-family").value;
  const model = VADERSTAD_PD_MODELS[selected];
  const optionalField = $("optional-bin-field");
  const optionalSelect = $("use-optional-bin");
  $("manual-bin-setup").hidden = selected !== "other";

  if (!model) {
    optionalField.hidden = true;
    optionalSelect.value = "no";
    const changedFromPublishedModel = Boolean(VADERSTAD_PD_MODELS[previousCartFamily]);
    binIds.forEach((id) => {
      const capacity = $(`bin-volume-${id}`);
      capacity.readOnly = false;
      if (changedFromPublishedModel) capacity.value = "";
      capacity.previousElementSibling.textContent = "Usable capacity (L)";
      capacity.placeholder = "Enter from manual / dealer";
      saveValue(capacity);
    });
    $("model-capacity-note").textContent = selected === "other"
      ? "Other cart selected. All bin volumes must be entered from the exact cart documentation."
      : "Choose a listed cart size to load its published nominal volumes, or choose Other air cart to enter all bin capacities manually.";
    $("add-bin").disabled = binIds.length >= 5;
    previousCartFamily = selected;
    updateAll();
    return;
  }

  const hasOptional = model.optionalBin5Litres !== null;
  optionalField.hidden = !hasOptional;
  if (!hasOptional) {
    optionalSelect.value = "no";
    saveValue(optionalSelect);
  }
  const capacities = model.binVolumesLitres.slice();
  if (hasOptional && optionalSelect.value === "yes") capacities.push(model.optionalBin5Litres);

  while (binIds.length > capacities.length) removeBin(binIds[binIds.length - 1]);
  while (binIds.length < capacities.length) addBin();
  binIds.forEach((id, index) => {
    const capacity = $(`bin-volume-${id}`);
    capacity.value = String(capacities[index]);
    capacity.readOnly = true;
    capacity.previousElementSibling.textContent = "Published bin volume (L)";
    capacity.placeholder = "Published value";
    saveValue(capacity);
  });
  $("model-capacity-note").textContent =
    `Published total volume: ${model.totalVolume}. Per-bin volumes are loaded from the official technical data table. Enter product density and fill factor for your material; neither is assumed. Source: ${VADERSTAD_PD_SOURCE}`;
  $("add-bin").disabled = binIds.length >= capacities.length;
  previousCartFamily = selected;
  updateAll();
}

function updateBinResults() {
  const modelId = $("cart-family").value;
  const model = VADERSTAD_PD_MODELS[modelId];
  let bins = [];
  if (model) {
    bins = model.binVolumesLitres.map((volumeLitres, index) => ({
      volumeLitres,
      binNumber: index + 1
    }));
    if (model.optionalBin5Litres !== null && $("use-optional-bin").value === "yes") {
      bins.push({ volumeLitres: model.optionalBin5Litres, binNumber: 5 });
    }
  } else if (modelId === "other") {
    bins = binIds.map((id, index) => ({
      volumeLitres: numeric(`bin-volume-${id}`),
      binNumber: index + 1
    }));
    bins.forEach((bin, index) => {
      const summary = $(`bin-summary-${binIds[index]}`);
      if (summary) summary.textContent = bin.volumeLitres === null
        ? "Enter usable volume"
        : `${format(bin.volumeLitres, 0)} L usable`;
    });
    bins = bins.filter((bin) => bin.volumeLitres !== null);
  }

  const products = productIds.map((id) => {
    const name = $(`product-name-${id}`).value.trim();
    const rate = numeric(`product-rate-${id}`);
    const bulkDensityKgPerLitre = numeric(`product-density-${id}`);
    const fillFactorPercent = numeric(`product-fill-${id}`);
    const thousandKernelWeight = numeric(`product-tkw-${id}`, { optional: true });
    const invalidTkw = Boolean($(`product-tkw-${id}`).value.trim() && thousandKernelWeight === null);
    if (invalidTkw) $(`product-tkw-${id}`).setAttribute("aria-invalid", "true");
    const rateUnit = $(`product-unit-${id}`).value;
    const summary = $(`product-summary-${id}`);
    const title = $(`product-title-${id}`);
    title.textContent = name || `Product ${productIds.indexOf(id) + 1}`;
    const shortRate = rate === null ? "Rate missing" : `${format(rate, 2)} ${rateUnit}`;
    summary.textContent = shortRate;
    if (rate !== null && thousandKernelWeight !== null) {
      try {
        const seedUnit = rateUnit === "lb/ac" ? "seeds/ac" : "seeds/ha";
        summary.textContent += ` · ${format(seedCountFromProductRate(rate, rateUnit, thousandKernelWeight), 0)} ${seedUnit}`;
      } catch {
        summary.textContent += " · invalid TKW";
      }
    }
    return { id, name, rate, rateUnit, bulkDensityKgPerLitre, fillFactorPercent, invalidTkw };
  });

  if (!modelId) {
    $("bin-results").innerHTML = "<p>Select a cart model or choose Other air cart before estimating assignments.</p>";
    return;
  }
  if (products.some((product) => !product.name || product.rate === null
    || product.bulkDensityKgPerLitre === null || product.fillFactorPercent === null
    || product.invalidTkw)
    || (modelId === "other" && bins.length !== binIds.length)) {
    $("bin-results").innerHTML = "<p>Complete every product name, rate, density and fill factor, plus each manual bin volume. Optional TKW must be positive if entered.</p>";
    return;
  }

  const areaInput = $("bin-field-area").value.trim();
  const areaValue = numeric("bin-field-area", { optional: true });
  const areaUnit = $("bin-area-unit").value;
  const area = areaValue === null
    ? null
    : areaUnit === "ha" ? areaValue * ACRES_PER_HECTARE : areaValue;
  const chainedBins = $("chain-bins").value === "yes";
  try {
    const plan = optimizeBinAssignments({ bins, products, chainedBins });
    const limiting = plan.assignments.reduce((lowest, item) =>
      item.coverageAcres < lowest.coverageAcres ? item : lowest);
    const refills = area === null ? null : calculateRefills(area, plan.runLimitAcres);
    const rows = plan.assignments.map((item) => {
      const binNames = item.binNumbers.map((number) => `Bin ${number}`).join(" + ");
      return `<div class="bin-result-row"><span><strong>${escapeHtml(item.productName)}</strong><small>${binNames}</small></span><strong>${format(item.coverageAcres, 1)} ac</strong></div>`;
    }).join("");
    const refillText = areaInput && areaValue === null
      ? "Field area must be greater than zero."
      : refills === null
        ? "Enter field area for refill estimate."
      : `${refills} refill${refills === 1 ? "" : "s"} after the initial load for ${format(areaValue, 1)} ${areaUnit}.`;
    const unused = plan.unusedBinNumbers.length
      ? `<small>Unused bin${plan.unusedBinNumbers.length === 1 ? "" : "s"}: ${plan.unusedBinNumbers.join(", ")}.</small>`
      : "";
    $("bin-results").innerHTML = `${rows}
      <div class="run-limit">
        <strong>Shared run limit · ${escapeHtml(limiting.productName)} limits first</strong>
        <strong class="run-number">${format(plan.runLimitAcres, 1)} ac</strong>
        <small>${refillText}</small>
      </div>${unused}`;
  } catch (error) {
    $("bin-results").innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function updateTheoreticalCapacity() {
  const width = numeric("field-width");
  const speed = numeric("field-speed");
  if (width === null || speed === null) {
    resultText("theoretical-result", "Enter width and speed");
    return null;
  }
  try {
    const rate = calculateTheoreticalCapacity({
      width,
      widthUnit: $("field-width-unit").value,
      speed,
      speedUnit: $("field-speed-unit").value
    });
    resultText("theoretical-result", `${format(rate, 2)} ac/hr`);
    return rate;
  } catch (error) {
    resultText("theoretical-result", error.message);
    return null;
  }
}

function updateFieldTime() {
  const theoretical = updateTheoreticalCapacity();
  const areaValue = numeric("field-area");
  const areaUnit = $("field-area-unit").value;
  const area = areaValue === null ? null
    : areaUnit === "ha" ? areaValue * ACRES_PER_HECTARE : areaValue;
  const passLengthValue = numeric("pass-length");
  const passLength = passLengthValue === null ? null
    : $("pass-length-unit").value === "m" ? passLengthValue / METRES_PER_FOOT : passLengthValue;
  const turnMinutes = nonNegativeNumeric("turn-minutes");
  const refillEveryValue = numeric("refill-interval", { optional: true });
  const refillEvery = refillEveryValue === null ? null
    : areaUnit === "ha" ? refillEveryValue * ACRES_PER_HECTARE : refillEveryValue;
  const refillMinutesInput = $("refill-minutes").value.trim();
  const parsedRefillMinutes = nonNegativeNumeric("refill-minutes", { optional: true });
  const refillMinutes = parsedRefillMinutes ?? 0;
  $("refill-interval-label").textContent = `Refill every (${areaUnit})`;
  const invalidOptionalRefill = ($("refill-interval").value.trim() !== "" && refillEveryValue === null)
    || (refillMinutesInput !== "" && parsedRefillMinutes === null);
  if (invalidOptionalRefill) {
    resultText("effective-result", "Enter a positive refill interval and a non-negative refill delay, or clear the field");
    resultText("field-time-result", "");
    return;
  }
  if (theoretical === null || area === null || passLength === null || turnMinutes === null) {
    resultText("effective-result", "Enter field, pass and turn values");
    resultText("field-time-result", "");
    return;
  }
  try {
    const estimate = calculateEffectiveFieldTime({
      fieldAcres: area,
      theoreticalAcresPerHour: theoretical,
      width: numeric("field-width"),
      widthUnit: $("field-width-unit").value,
      passLengthFeet: passLength,
      turnMinutesPerPass: turnMinutes,
      refillEveryAcres: refillEvery,
      refillMinutes
    });
    resultText("effective-result", `${format(estimate.effectiveAcresPerHour, 2)} ac/hr`);
    resultText("field-time-result", `${format(estimate.totalHours, 2)} hr total · ${estimate.turnCount} turns · ${estimate.refillCount} refill stops`);
  } catch (error) {
    resultText("effective-result", error.message);
    resultText("field-time-result", "");
  }
}

function updateCatchLabels() {
  const unit = $("catch-unit").value;
  const metric = unit === "kg/ha";
  $("catch-area-label").textContent = metric ? "Sample area (ha)" : "Sample area (acres)";
  $("catch-mass-label").textContent = metric ? "Caught product (kg)" : "Caught product (lb)";
}

function updateCatchTest() {
  updateCatchLabels();
  const targetRate = numeric("catch-target");
  const sampleArea = numeric("catch-area");
  const caughtMass = numeric("catch-mass");
  if (targetRate === null || sampleArea === null || caughtMass === null) {
    resultText("catch-measured-result", "Enter test values");
    resultText("catch-adjustment-result", "");
    return;
  }
  try {
    const unit = $("catch-unit").value;
    const result = calculateCatchTest({ targetRate, rateUnit: unit, sampleArea, caughtMass });
    resultText("catch-measured-result", `${format(result.measuredRate, 3)} ${unit}`);
    resultText("catch-adjustment-result", `Meter adjustment: ${format(result.adjustmentPercent, 1)}% of current setting · ${format(result.differencePercent, 1)}% from target`);
  } catch (error) {
    resultText("catch-measured-result", error.message);
    resultText("catch-adjustment-result", "");
  }
}

function updateAll() {
  updateConversion();
  updateMassRate();
  updateFieldTotal();
  updateBinResults();
  updateFieldTime();
  updateCatchTest();
}

function selectTab(tab) {
  document.querySelectorAll(".nav-tab").forEach((item) => {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
    item.classList.toggle("is-active", selected);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== tab.getAttribute("aria-controls");
  });
  window.scrollTo(0, 0);
}

const bottomNav = document.querySelector(".bottom-nav");
bottomNav.addEventListener("click", (event) => {
  const tab = event.target.closest(".nav-tab");
  if (tab && bottomNav.contains(tab)) selectTab(tab);
});

document.querySelectorAll(".nav-tab").forEach((tab) => {
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll(".nav-tab")];
    const current = tabs.indexOf(tab);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    tabs[(current + offset + tabs.length) % tabs.length].click();
    tabs[(current + offset + tabs.length) % tabs.length].focus();
  });
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-persist]")) saveValue(event.target);
  updateAll();
});
document.addEventListener("change", (event) => {
  if (event.target.matches("[data-persist]")) saveValue(event.target);
  updateAll();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-unit-toggle]");
  if (!button) return;
  changeUnit(button);
});

$("add-bin").addEventListener("click", () => addBin());
$("add-product").addEventListener("click", () => addProduct());
$("cart-family").addEventListener("change", syncCartModel);
$("use-optional-bin").addEventListener("change", syncCartModel);
$("bin-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-bin]");
  if (button) removeBin(Number(button.dataset.removeBin));
});
$("product-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-product]");
  if (button) {
    event.preventDefault();
    removeProduct(Number(button.dataset.removeProduct));
  }
});

restoreValues();
const storedProductIds = Array.isArray(savedValues.productIds)
  ? savedValues.productIds.filter((id, index, ids) => Number.isInteger(id) && id > 0 && ids.indexOf(id) === index).slice(0, 5)
  : Object.keys(savedValues)
  .map((key) => /^product-name-(\d+)$/.exec(key))
  .filter(Boolean)
  .map((match) => Number(match[1]));
const productIdsToRestore = storedProductIds.length ? storedProductIds : [1];
productIdsToRestore.forEach((id) => addProduct(false, id));
restoreValues($("product-list"));
nextProductId = Math.max(...productIds, 0) + 1;
$("add-product").disabled = productIds.length >= 5;
const storedBinIds = Array.isArray(savedValues.binIds)
  ? savedValues.binIds.filter((id, index, ids) => Number.isInteger(id) && id > 0 && ids.indexOf(id) === index).slice(0, 4)
  : Object.keys(savedValues)
  .map((key) => /^bin-volume-(\d+)$/.exec(key))
  .filter(Boolean)
  .map((match) => Number(match[1]));
const binIdsToRestore = storedBinIds.length ? storedBinIds : [1];
binIdsToRestore.forEach((id) => addBin(false, id));
restoreValues($("bin-list"));
nextBinId = Math.max(...binIds, 0) + 1;
saveBinIds();
syncCartModel();
updateAll();

window.addEventListener("online", () => { $("connection-status").textContent = "Online · calculations work offline"; });
window.addEventListener("offline", () => { $("connection-status").textContent = "Offline · app shell available"; });
if (!navigator.onLine) $("connection-status").textContent = "Offline · app shell available";

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  $("install-button").hidden = false;
});
$("install-button").addEventListener("click", async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  $("install-button").hidden = true;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    $("connection-status").textContent = "Offline install unavailable · use online";
  });
}
