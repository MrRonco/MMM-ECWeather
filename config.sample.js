/* ================================================================
   MMM-ECWeather — Sample Configuration

   Add this block to the modules array in your
   ~/MagicMirror/config/config.js file.

   See README.md for full configuration options and
   how to find your city ID.
   ================================================================ */

// --- Minimal configuration (most common) ---

{
  module: "MMM-ECWeather",
  position: "top_left",
  header: "Current Conditions",
  config: {
    cityId: "on-143"         // Your EC city identifier (Toronto)
  }
},

// --- Full configuration with all options ---

/*
{
  module: "MMM-ECWeather",
  position: "top_left",
  header: "Current Conditions",
  config: {
    cityId: "on-143",              // REQUIRED: EC city identifier (see README for lookup)
    lang: "en",                    // Language: "en" or "fr"
    updateInterval: 600000,        // Update every 10 minutes (default)
    animationSpeed: 1000,          // DOM update fade speed in ms (default)
    mode: "full",                  // "full" = current + forecast, "current", or "forecast"
    showIcon: true,                // Show weather icon (default)
    showCondition: true,           // Show condition text e.g. "Partly Cloudy" (default)
    showFeelsLike: true,           // Show feels like / wind chill / humidex (default)
    showWind: true,                // Show wind speed and direction (default)
    showHumidity: true,            // Show relative humidity (default)
    showPressure: false,           // Show atmospheric pressure (default: off)
    showForecastDays: 5,           // Number of forecast days, max 6 (default)
    showForecastCondition: false,  // Show condition text per forecast day (default: off)
    tempUnit: "\u00b0",            // Temperature unit suffix (default: \u00b0)
    iconStyle: "ec"                // "ec" = EC icons, "fa" = Font Awesome (default: ec)
  }
},
*/

// --- Two-instance setup: current + forecast in separate regions ---

/*
// Left column — Current Conditions
{
  module: "MMM-ECWeather",
  position: "top_left",
  header: "Current Conditions",
  config: {
    cityId: "on-143",
    mode: "current",
    showIcon: true,
    showCondition: true,
    showFeelsLike: true,
    showWind: true,
    showHumidity: true
  }
},

// Right column — 5-Day Forecast
{
  module: "MMM-ECWeather",
  position: "top_right",
  header: "5-Day Forecast",
  config: {
    cityId: "on-143",
    mode: "forecast",
    showForecastDays: 5,
    showIcon: true,
    iconStyle: "fa"
  }
},
*/

// --- Common City IDs ---
//
// on-143  — Toronto, ON
// on-118  — Ottawa, ON
// on-40   — Greater Sudbury, ON
// qc-147  — Montreal, QC
// bc-74   — Vancouver, BC
// ab-52   — Calgary, AB
// ab-50   — Edmonton, AB
// mb-38   — Winnipeg, MB
// ns-19   — Halifax, NS
// nl-24   — St. John's, NL
//
// Find yours: https://api.weather.gc.ca/collections/citypageweather-realtime/items?f=json&lang=en
