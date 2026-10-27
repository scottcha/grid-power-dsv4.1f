import type { Conditions, Forecast, MarketEventKind, WeatherKind } from './types';
import { MARKET, MARKET_EVENTS, MARKET_EVENT_WEIGHTS, WEATHER, WEATHER_WEIGHTS } from './balance';
import { Rng } from './rng';

export function rollConditions(rng: Rng): Conditions {
  const weather = rng.weighted(Object.entries(WEATHER_WEIGHTS) as Array<[WeatherKind, number]>);
  const marketEvent = rng.weighted(Object.entries(MARKET_EVENT_WEIGHTS) as Array<[MarketEventKind, number]>);
  const w = WEATHER[weather];
  const e = MARKET_EVENTS[marketEvent];
  const drift = () => rng.range(1 - MARKET.priceDrift, 1 + MARKET.priceDrift);
  const headline = marketEvent === 'none' ? w.name : `${w.name} · ${e.name}`;
  const description = marketEvent === 'none' ? w.blurb : `${w.blurb} ${e.blurb}`;
  return {
    weather,
    marketEvent,
    solar: w.solar,
    wind: w.wind,
    cooling: w.cooling,
    hydro: w.hydro,
    elecPrice: MARKET.elecBase * w.elecPrice * e.elecPrice * drift(),
    computePrice: MARKET.computeBase * w.computePrice * e.computePrice * drift(),
    fuelPrice: MARKET.fuelBase * w.fuel * e.fuel * drift(),
    headline,
    description,
  };
}

/** The forecast commits this turn to next turn's conditions, with honest price bands. */
export function makeForecast(rng: Rng): Forecast {
  const conditions = rollConditions(rng);
  const priceSpread = 0.12;
  return {
    conditions,
    elecLow: conditions.elecPrice * (1 - priceSpread),
    elecHigh: conditions.elecPrice * (1 + priceSpread),
    computeLow: conditions.computePrice * (1 - priceSpread),
    computeHigh: conditions.computePrice * (1 + priceSpread),
    confidence: 0.8,
  };
}
