/**
 * MMM-ECWeather — Node Helper
 *
 * Fetches weather data from Environment Canada's GeoMet API.
 * Endpoint: https://api.weather.gc.ca/collections/citypageweather-realtime/items/{cityId}
 *
 * No API key required. No rate limits.
 */

const NodeHelper = require("node_helper");
const https = require("https");
const http = require("http");

module.exports = NodeHelper.create({
  start: function () {
    this.fetching = false;
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "EC_WEATHER_FETCH") {
      this.fetchWeather(payload);
    }
  },

  fetchWeather: function (config) {
    if (this.fetching) return;
    this.fetching = true;

    const lang = config.lang || "en";
    const url = `https://api.weather.gc.ca/collections/citypageweather-realtime/items/${config.cityId}?f=json&lang=${lang}`;

    this.makeRequest(url)
      .then((data) => {
        this.fetching = false;

        if (!data || !data.properties) {
          this.sendSocketNotification("EC_WEATHER_ERROR", {
            error: "Invalid response from Environment Canada API",
          });
          return;
        }

        const props = data.properties;
        const parsed = this.parseWeatherData(props, config);
        this.sendSocketNotification("EC_WEATHER_DATA", parsed);
      })
      .catch((err) => {
        this.fetching = false;
        console.error("[MMM-ECWeather] Fetch error:", err.message);
        this.sendSocketNotification("EC_WEATHER_ERROR", {
          error: err.message,
        });
      });
  },

  makeRequest: function (url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith("https") ? https : http;
      const req = client.get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error("Failed to parse JSON response"));
          }
        });
      });
      req.on("error", reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
    });
  },

  parseWeatherData: function (props, config) {
    const cc = props.currentConditions || {};
    const lang = config.lang || "en";

    // Parse current conditions
    const current = {
      temperature: this.extractValue(cc.temperature, lang),
      temperatureUnit: this.extractUnit(cc.temperature, lang),
      condition: this.extractLangValue(cc.condition, lang),
      iconCode: cc.iconCode ? cc.iconCode.value : null,
      iconUrl: cc.iconCode ? cc.iconCode.url : null,
      windSpeed: this.extractValue(cc.wind && cc.wind.speed, lang),
      windUnit: this.extractUnit(cc.wind && cc.wind.speed, lang),
      windDirection: this.extractValue(cc.wind && cc.wind.direction, lang),
      windGust: cc.wind && cc.wind.gust ? this.extractValue(cc.wind.gust, lang) : null,
      humidity: this.extractValue(cc.relativeHumidity, lang),
      humidityUnit: this.extractUnit(cc.relativeHumidity, lang),
      windChill: cc.windChill ? this.extractValue(cc.windChill, lang) : null,
      humidex: cc.humidex ? this.extractValue(cc.humidex, lang) : null,
      pressure: this.extractValue(cc.pressure, lang),
      pressureUnit: this.extractUnit(cc.pressure, lang),
      dewpoint: this.extractValue(cc.dewpoint, lang),
      station: cc.station ? this.extractLangValue(cc.station.value, lang) : null,
      timestamp: cc.timestamp ? this.extractLangValue(cc.timestamp, lang) : null,
    };

    // Feels like: wind chill in winter, humidex in summer
    if (current.windChill !== null) {
      current.feelsLike = current.windChill;
      current.feelsLikeType = "windchill";
    } else if (current.humidex !== null) {
      current.feelsLike = current.humidex;
      current.feelsLikeType = "humidex";
    } else {
      current.feelsLike = current.temperature;
      current.feelsLikeType = "none";
    }

    // Parse forecasts
    const forecastGroup = props.forecastGroup || {};
    const rawForecasts = forecastGroup.forecasts || [];

    const forecasts = rawForecasts.map((f) => {
      const temps = f.temperatures && f.temperatures.temperature;
      let tempValue = null;
      let tempClass = null;

      if (Array.isArray(temps) && temps.length > 0) {
        tempValue = this.extractValue(temps[0], lang);
        tempClass = temps[0].class
          ? this.extractLangValue(temps[0].class, lang)
          : null;
      }

      return {
        period: this.extractLangValue(
          f.period && f.period.value,
          lang
        ),
        periodName: this.extractLangValue(
          f.period && f.period.textForecastName,
          lang
        ),
        temperature: tempValue,
        temperatureClass: tempClass, // "high" or "low"
        iconCode: f.abbreviatedForecast
          ? f.abbreviatedForecast.icon
            ? f.abbreviatedForecast.icon.value
            : null
          : null,
        iconUrl: f.abbreviatedForecast
          ? f.abbreviatedForecast.icon
            ? f.abbreviatedForecast.icon.url
            : null
          : null,
        condition:
          typeof f.cloudPrecip === "string"
            ? f.cloudPrecip
            : this.extractLangValue(f.cloudPrecip, lang),
        textSummary: this.extractLangValue(f.textSummary, lang),
        humidity: f.relativeHumidity
          ? this.extractValue(f.relativeHumidity, lang)
          : null,
      };
    });

    // Combine day/night forecasts into daily summaries
    const dailyForecasts = [];
    for (let i = 0; i < forecasts.length; i++) {
      const fc = forecasts[i];
      if (fc.temperatureClass === "high") {
        // This is a daytime forecast — look for the following night
        const night =
          i + 1 < forecasts.length &&
          forecasts[i + 1].temperatureClass === "low"
            ? forecasts[i + 1]
            : null;
        dailyForecasts.push({
          period: fc.period,
          high: fc.temperature,
          low: night ? night.temperature : null,
          iconCode: fc.iconCode,
          iconUrl: fc.iconUrl,
          condition: fc.condition,
          textSummary: fc.textSummary,
        });
      } else if (fc.temperatureClass === "low" && dailyForecasts.length === 0) {
        // First forecast is a night forecast (e.g., after 6 PM)
        dailyForecasts.push({
          period: fc.period.replace(" night", "").replace(" soir et nuit", ""),
          high: null,
          low: fc.temperature,
          iconCode: fc.iconCode,
          iconUrl: fc.iconUrl,
          condition: fc.condition,
          textSummary: fc.textSummary,
        });
      }
    }

    // Parse sunrise/sunset
    const riseSet = props.riseSet || {};
    const sun = {
      sunrise: riseSet.sunrise ? this.extractLangValue(riseSet.sunrise, lang) : null,
      sunset: riseSet.sunset ? this.extractLangValue(riseSet.sunset, lang) : null,
    };

    // Parse warnings
    const warnings = props.warnings || [];

    return {
      cityName: this.extractLangValue(props.name, lang),
      region: this.extractLangValue(props.region, lang),
      lastUpdated: props.lastUpdated,
      current: current,
      forecasts: dailyForecasts,
      allForecasts: forecasts,
      sun: sun,
      warnings: warnings,
    };
  },

  /**
   * Extract a value from EC's bilingual structure:
   *   { value: { en: 10, fr: 10 } }  or  { en: 10, fr: 10 }
   */
  extractValue: function (obj, lang) {
    if (!obj) return null;
    if (obj.value !== undefined) {
      if (typeof obj.value === "object" && obj.value[lang] !== undefined) {
        return obj.value[lang];
      }
      return obj.value;
    }
    if (obj[lang] !== undefined) return obj[lang];
    return null;
  },

  extractUnit: function (obj, lang) {
    if (!obj) return "";
    if (obj.units) {
      if (typeof obj.units === "object" && obj.units[lang]) {
        return obj.units[lang];
      }
      return obj.units;
    }
    return "";
  },

  extractLangValue: function (obj, lang) {
    if (!obj) return null;
    if (typeof obj === "string") return obj;
    if (obj[lang] !== undefined) return obj[lang];
    if (obj.value !== undefined) {
      if (typeof obj.value === "object" && obj.value[lang] !== undefined) {
        return obj.value[lang];
      }
      return obj.value;
    }
    return null;
  },
});
