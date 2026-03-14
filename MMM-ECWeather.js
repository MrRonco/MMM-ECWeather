/**
 * MMM-ECWeather
 *
 * MagicMirror² module for Environment Canada weather data.
 * Uses the free, keyless api.weather.gc.ca API.
 *
 * Displays current conditions and/or multi-day forecast.
 * Supports both English and French via the EC API lang parameter.
 *
 * @author Franco Raso
 * @license MIT
 */

Module.register("MMM-ECWeather", {
  defaults: {
    cityId: "on-40",              // Environment Canada city identifier (default: Greater Sudbury)
    lang: "en",                   // Language: "en" or "fr"
    updateInterval: 10 * 60 * 1000, // Update every 10 minutes (no rate limits)
    animationSpeed: 1000,         // DOM update animation speed in ms
    mode: "full",                 // "full" = current + forecast, "current" = current only, "forecast" = forecast only
    showIcon: true,               // Show weather icon
    showCondition: true,          // Show condition text (e.g., "Partly Cloudy")
    showFeelsLike: true,          // Show feels like / wind chill
    showWind: true,               // Show wind speed and direction
    showHumidity: true,           // Show relative humidity
    showPressure: false,          // Show atmospheric pressure
    showForecastDays: 5,          // Number of forecast days to show (max 6)
    showForecastCondition: false, // Show condition text per forecast day
    tempUnit: "°",                // Temperature unit suffix
    iconStyle: "ec",              // "ec" = Environment Canada icons, "fa" = Font Awesome
  },

  weatherData: null,
  weatherError: null,
  updateTimer: null,

  getStyles: function () {
    return ["MMM-ECWeather.css", "font-awesome.css"];
  },

  start: function () {
    Log.info("[MMM-ECWeather] Starting module: " + this.name);
    this.weatherData = null;
    this.weatherError = null;
    this.fetchWeather();
  },

  fetchWeather: function () {
    this.sendSocketNotification("EC_WEATHER_FETCH", {
      cityId: this.config.cityId,
      lang: this.config.lang,
    });

    // Schedule next fetch
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      this.fetchWeather();
    }, this.config.updateInterval);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "EC_WEATHER_DATA") {
      this.weatherData = payload;
      this.weatherError = null;
      this.updateDom(this.config.animationSpeed);

      // Broadcast current weather for other modules (e.g., MMM-DynamicWeather)
      this.sendNotification("CURRENT_WEATHER", {
        temperature: payload.current.temperature,
        condition: payload.current.condition,
        iconCode: payload.current.iconCode,
        windSpeed: payload.current.windSpeed,
        humidity: payload.current.humidity,
      });
    }

    if (notification === "EC_WEATHER_ERROR") {
      this.weatherError = payload.error;
      this.updateDom(this.config.animationSpeed);
    }
  },

  getDom: function () {
    var wrapper = document.createElement("div");
    wrapper.className = "ecweather";

    if (this.weatherError) {
      wrapper.innerHTML =
        '<div class="ecw-error"><i class="fas fa-exclamation-triangle"></i> ' +
        this.weatherError +
        "</div>";
      return wrapper;
    }

    if (!this.weatherData) {
      wrapper.innerHTML =
        '<div class="ecw-loading">Loading weather data...</div>';
      return wrapper;
    }

    var data = this.weatherData;
    var config = this.config;

    // Current conditions
    if (config.mode === "full" || config.mode === "current") {
      var currentDiv = document.createElement("div");
      currentDiv.className = "ecw-current";

      // Weather icon
      if (config.showIcon && data.current.iconCode !== null) {
        var iconDiv = document.createElement("div");
        iconDiv.className = "ecw-icon";
        if (config.iconStyle === "ec") {
          var img = document.createElement("img");
          img.src =
            "https://weather.gc.ca/weathericons/" +
            (data.current.iconCode < 10
              ? "0" + data.current.iconCode
              : data.current.iconCode) +
            ".gif";
          img.alt = data.current.condition || "weather";
          img.className = "ecw-icon-img";
          iconDiv.appendChild(img);
        } else {
          var faIcon = this.getWeatherFAIcon(data.current.iconCode);
          iconDiv.innerHTML = '<i class="fas ' + faIcon + '"></i>';
        }
        currentDiv.appendChild(iconDiv);
      }

      // Temperature
      var tempDiv = document.createElement("div");
      tempDiv.className = "ecw-temp";
      tempDiv.textContent =
        Math.round(data.current.temperature) + config.tempUnit;
      currentDiv.appendChild(tempDiv);

      // Condition text
      if (config.showCondition && data.current.condition) {
        var condDiv = document.createElement("div");
        condDiv.className = "ecw-condition";
        condDiv.textContent = data.current.condition;
        currentDiv.appendChild(condDiv);
      }

      // Stats rows
      var statsDiv = document.createElement("div");
      statsDiv.className = "ecw-stats";

      // Feels like
      if (config.showFeelsLike && data.current.feelsLike !== null) {
        var feelsDiv = document.createElement("div");
        feelsDiv.className = "ecw-stat-row";
        var label =
          data.current.feelsLikeType === "humidex" ? "Humidex" : "Feels like";
        feelsDiv.innerHTML =
          '<span class="ecw-stat-label">' +
          label +
          '</span><span class="ecw-stat-value">' +
          Math.round(data.current.feelsLike) +
          config.tempUnit +
          "</span>";
        statsDiv.appendChild(feelsDiv);
      }

      // High / Low (from first forecast if available)
      if (data.forecasts && data.forecasts.length > 0) {
        var todayFc = data.forecasts[0];
        if (todayFc.high !== null || todayFc.low !== null) {
          var hlDiv = document.createElement("div");
          hlDiv.className = "ecw-stat-row";
          var hlText = "";
          if (todayFc.high !== null)
            hlText += "High " + Math.round(todayFc.high) + config.tempUnit;
          if (todayFc.high !== null && todayFc.low !== null) hlText += " / ";
          if (todayFc.low !== null)
            hlText += "Low " + Math.round(todayFc.low) + config.tempUnit;
          hlDiv.innerHTML =
            '<span class="ecw-stat-label">' +
            hlText +
            "</span>";
          statsDiv.appendChild(hlDiv);
        }
      }

      // Wind
      if (config.showWind && data.current.windSpeed !== null) {
        var windDiv = document.createElement("div");
        windDiv.className = "ecw-stat-row";
        var windText =
          data.current.windSpeed +
          " " +
          data.current.windUnit +
          " " +
          (data.current.windDirection || "");
        windDiv.innerHTML =
          '<span class="ecw-stat-label">Wind</span><span class="ecw-stat-value">' +
          windText.trim() +
          "</span>";
        statsDiv.appendChild(windDiv);
      }

      // Humidity
      if (config.showHumidity && data.current.humidity !== null) {
        var humDiv = document.createElement("div");
        humDiv.className = "ecw-stat-row";
        humDiv.innerHTML =
          '<span class="ecw-stat-label">Humidity</span><span class="ecw-stat-value">' +
          data.current.humidity +
          data.current.humidityUnit +
          "</span>";
        statsDiv.appendChild(humDiv);
      }

      // Pressure
      if (config.showPressure && data.current.pressure !== null) {
        var pressDiv = document.createElement("div");
        pressDiv.className = "ecw-stat-row";
        pressDiv.innerHTML =
          '<span class="ecw-stat-label">Pressure</span><span class="ecw-stat-value">' +
          data.current.pressure +
          " " +
          data.current.pressureUnit +
          "</span>";
        statsDiv.appendChild(pressDiv);
      }

      currentDiv.appendChild(statsDiv);
      wrapper.appendChild(currentDiv);
    }

    // Forecast
    if (
      (config.mode === "full" || config.mode === "forecast") &&
      data.forecasts &&
      data.forecasts.length > 0
    ) {
      var forecastDiv = document.createElement("div");
      forecastDiv.className = "ecw-forecast";

      var maxDays = Math.min(config.showForecastDays, data.forecasts.length);
      for (var i = 0; i < maxDays; i++) {
        var fc = data.forecasts[i];
        var dayDiv = document.createElement("div");
        dayDiv.className = "ecw-forecast-day";

        // Day name
        var nameSpan = document.createElement("span");
        nameSpan.className = "ecw-fc-name";
        // Extract short day name (e.g., "Sunday" → "Sun")
        var dayName = fc.period || "";
        if (dayName.length > 3) dayName = dayName.substring(0, 3);
        nameSpan.textContent = dayName;
        dayDiv.appendChild(nameSpan);

        // Forecast icon (optional)
        if (config.showIcon && fc.iconCode !== null) {
          var fcIconSpan = document.createElement("span");
          fcIconSpan.className = "ecw-fc-icon";
          if (config.iconStyle === "ec") {
            var fcImg = document.createElement("img");
            fcImg.src =
              "https://weather.gc.ca/weathericons/" +
              (fc.iconCode < 10
                ? "0" + fc.iconCode
                : fc.iconCode) +
              ".gif";
            fcImg.alt = fc.condition || "";
            fcImg.className = "ecw-fc-icon-img";
            fcIconSpan.appendChild(fcImg);
          } else {
            fcIconSpan.innerHTML =
              '<i class="fas ' + this.getWeatherFAIcon(fc.iconCode) + '"></i>';
          }
          dayDiv.appendChild(fcIconSpan);
        }

        // Temperatures
        var tempsSpan = document.createElement("span");
        tempsSpan.className = "ecw-fc-temps";

        if (fc.high !== null) {
          var highSpan = document.createElement("span");
          highSpan.className = "ecw-fc-high";
          highSpan.textContent = Math.round(fc.high) + config.tempUnit;
          tempsSpan.appendChild(highSpan);
        }

        if (fc.low !== null) {
          var lowSpan = document.createElement("span");
          lowSpan.className = "ecw-fc-low";
          lowSpan.textContent = Math.round(fc.low) + config.tempUnit;
          tempsSpan.appendChild(lowSpan);
        }

        dayDiv.appendChild(tempsSpan);

        // Condition text (optional)
        if (config.showForecastCondition && fc.condition) {
          var fcCondSpan = document.createElement("span");
          fcCondSpan.className = "ecw-fc-condition";
          fcCondSpan.textContent = fc.condition;
          dayDiv.appendChild(fcCondSpan);
        }

        forecastDiv.appendChild(dayDiv);
      }

      wrapper.appendChild(forecastDiv);
    }

    return wrapper;
  },

  /**
   * Map EC icon codes to Font Awesome icons.
   * EC icon codes: https://weather.gc.ca/weathericons/
   * 0=sunny, 1=mainly sunny, 2=partly cloudy, 3=mostly cloudy,
   * 6=showers, 7=snow, 10=cloudy, 12=rain, 14=freezing rain,
   * 15=ice crystals, 16=flurries, 17=snow, 18=heavy snow,
   * 19=thunderstorm, 23=haze, 24=fog, 25=drifting snow,
   * 26=ice crystals, 27=hail, 28=drizzle, 30-39=night versions
   */
  getWeatherFAIcon: function (code) {
    var iconMap = {
      0: "fa-sun",
      1: "fa-sun",
      2: "fa-cloud-sun",
      3: "fa-cloud",
      4: "fa-cloud",
      5: "fa-cloud-sun",
      6: "fa-cloud-showers-heavy",
      7: "fa-snowflake",
      8: "fa-snowflake",
      9: "fa-cloud-rain",
      10: "fa-cloud",
      11: "fa-cloud-rain",
      12: "fa-cloud-showers-heavy",
      13: "fa-cloud-rain",
      14: "fa-icicles",
      15: "fa-snowflake",
      16: "fa-snowflake",
      17: "fa-snowflake",
      18: "fa-snowflake",
      19: "fa-bolt",
      23: "fa-smog",
      24: "fa-smog",
      25: "fa-wind",
      26: "fa-snowflake",
      27: "fa-cloud-meatball",
      28: "fa-cloud-rain",
      // Night versions (30+)
      30: "fa-moon",
      31: "fa-moon",
      32: "fa-cloud-moon",
      33: "fa-cloud",
      34: "fa-cloud",
      35: "fa-cloud-moon",
      36: "fa-cloud-showers-heavy",
      37: "fa-snowflake",
      38: "fa-snowflake",
      39: "fa-cloud-moon-rain",
    };
    return iconMap[code] || "fa-cloud";
  },
});
