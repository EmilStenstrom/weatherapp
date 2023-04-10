// GENERAL HELPERS
var $ = document.querySelector.bind(document);

function to_date(timestamp) {
    if (typeof timestamp != 'string') {
        throw new Error("timestamp: " + timestamp + " is a " + typeof timestamp + " not an string");
    }
    return new Date(timestamp);
}
function to_time_string(date) {
    if (typeof date.getHours != 'function') {
        throw new Error("date: " + date + " is a " + typeof date + " not a Date");
    }
    var hours = ("0" + date.getHours()).substr(-2);
    var minutes = ("0" + date.getMinutes()).substr(-2);
    return [hours, minutes];
}

var DAY_NAMES = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
var MONTHS = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];

function to_day(date) {
    if (typeof date.getHours != 'function') {
        throw new Error("date: " + date + " is a " + typeof date + " not a Date");
    }
    var day = (
        DAY_NAMES[date.getDay()] + ", " +
        date.getDate() + " " +
        MONTHS[date.getMonth()].toLowerCase()
    );
    return day;
}
function to_percent(decimal) {
    return (decimal * 100 + "").substr(0, 2) + "%";
}
function is_same_day(date1, date2) {
    if (typeof date1.getMonth !== 'function') {
        throw new Error("date1: " + date1 + " is not a Date");
    }
    if (typeof date2.getMonth !== 'function') {
        throw new Error("date2: " + date2 + " is not a Date");
    }
    return (
        date1.getFullYear() == date2.getFullYear() &&
        date1.getMonth() == date2.getMonth() &&
        date1.getDate() == date2.getDate()
    )
}
function is_same_hour(date1, date2) {
    return (
        is_same_day(date1, date2) &&
        date1.getHours() == date2.getHours()
    )
}
function is_daytime(current_hour, sun) {
    if (typeof current_hour.getMonth !== 'function') {
        throw new Error("current_hour: " + current_hour + " is not a Date");
    }
    if (typeof sun[current_hour.toISOString().substring(0, 10)] !== 'object') {
        throw new Error("sun: " + sun + " has the wrong format");
    }

    var today = current_hour.toISOString().substring(0, 10);
    var sunriseTime = new Date(sun[today]['sunrise']);
    var sunsetTime = new Date(sun[today]['sunset']);

    if (sunriseTime < current_hour && current_hour < sunsetTime) {
        return true;
    }
    return false;
}

// TEMPLATE HELPERS
function template_helpers() {
    return {
        "to_day": function() {
            return function(text, render) {
                var date = new Date(render(text));
                var day = to_day(date);
                return (
                    '<time class="time" datetime="' + date.toISOString() + '">' +
                        day +
                    '</time>'
                );
            }
        },
        "to_time": function() {
            return function(text, render) {
                var date_str = render(text);
                if (!date_str) {
                    throw new Error("to_time called with invalid date: " + date_str);
                }
                var date = new Date(date_str);
                var [hours, minutes] = to_time_string(date);
                var out = '<span class="hours">' + hours + '</span>:<span class="minutes">' + minutes + '</span>';
                return '<time class="time" datetime="' + date.toISOString() + '">' + out + "</time>";
            }
        },
        "to_percent": function() {
            return function(text, render) {
                return to_percent(render(text));
            }
        },
        "temp_style": function() {
            return function(text, render) {
                var [min, current, max] = render(text).split(",")

                var offset = Math.round(max - current) * 10;
                return (
                    "padding-top: " + offset + "px;" +
                    "padding-bottom: " + (100 - offset) + "px;"
                );
            }
        }
    }
}

// TRANSFORM RAW DATA
function transform_daily(daily) {
    daily = transform_sunrise_and_sunset(daily);
    return daily;
}
function transform_sunrise_and_sunset(daily) {
    if (typeof daily.sunriseTime != 'number') {
        throw new Error("daily.sunriseTime: " + daily.sunriseTime + " is a " + typeof daily.sunriseTime + " not an number");
    }
    if (typeof daily.sunsetTime != 'number') {
        throw new Error("daily.sunsetTime: " + daily.sunsetTime + " is a " + typeof daily.sunsetTime + " not an number");
    }
    daily.sunriseTime = to_date(daily.sunriseTime);
    daily.sunsetTime = to_date(daily.sunsetTime);
    return daily;
}


function round_temp(temp) {
    if (!temp) {
        throw new Error("temp: " + temp + " is not a number");
    }
    return Math.round(temp);
}
function round_precip(precip) {
    if (!precip) {
        throw new Error("precip: " + precip + " is not a number");
    }
    return Math.floor(precip * 10) / 10;
}

// Copied from https://opendata.smhi.se/apidocs/metfcst/parameters.html#parameter-wsymb
SMHI_SYMBOLS = {
    1: "Clear sky",
    2: "Nearly clear sky",
    3: "Variable cloudiness",
    4: "Halfclear sky",
    5: "Cloudy sky",
    6: "Overcast",
    7: "Fog",
    8: "Light rain showers",
    9: "Moderate rain showers",
    10: "Heavy rain showers",
    11: "Thunderstorm",
    12: "Light sleet showers",
    13: "Moderate sleet showers",
    14: "Heavy sleet showers",
    15: "Light snow showers",
    16: "Moderate snow showers",
    17: "Heavy snow showers",
    18: "Light rain",
    19: "Moderate rain",
    20: "Heavy rain",
    21: "Thunder",
    22: "Light sleet",
    23: "Moderate sleet",
    24: "Heavy sleet",
    25: "Light snowfall",
    26: "Moderate snowfall",
    27: "Heavy snowfall",
}
SMHI_TO_IMAGE = {
    "Clear sky":                "clear",
    "Nearly clear sky":         "mostlysunny",
    "Variable cloudiness":      "mostlysunny",
    "Halfclear sky":            "mostlycloudy",
    "Cloudy sky":               "cloudy",
    "Overcast":                 "cloudy",
    "Fog":                      "fog",
    "Light rain showers":       "chancerain",
    "Moderate rain showers":    "chancerain",
    "Heavy rain showers":       "rain",
    "Thunderstorm":             "tstorms",
    "Light sleet showers":      "chancesleet",
    "Moderate sleet showers":   "chancesleet",
    "Heavy sleet showers":      "sleet",
    "Light snow showers":       "chancesnow",
    "Moderate snow showers":    "chancesnow",
    "Heavy snow showers":       "snow",
    "Light rain":               "chancerain",
    "Moderate rain":            "rain",
    "Heavy rain":               "rain",
    "Thunder":                  "chancestorms",
    "Light sleet":              "chancesleet",
    "Moderate sleet":           "sleet",
    "Heavy sleet":              "sleet",
    "Light snowfall":           "chancesnow",
    "Moderate snowfall":        "snow",
    "Heavy snowfall":           "snow",
}

function pick_image(weather_symbol, wind, hour_is_daytime, current_time) {
    var image_name = "unknown"

    if (wind > 20) {
        image_name = "wind";
    }
    else if (weather_symbol in SMHI_SYMBOLS && SMHI_SYMBOLS[weather_symbol] in SMHI_TO_IMAGE) {
        image_name = SMHI_TO_IMAGE[SMHI_SYMBOLS[weather_symbol]];
    }

    image = (hour_is_daytime? "dy_": "nt_") + image_name + ".svg";

    return (
        '<img ' +
            'class="icon icon-' + image_name + '" ' +
            'src="icons/' + image + '?' + current_time.getTime() + '"' +
        '>'
    );
}

function get_parameter(data, name) {
    return data.filter(param => param.name == name).map(param => param.values[0]);
}

function transform_hourly(sun, uv) {
    function transform(hourly, idx) {
        var date = to_date(hourly.validTime)
        var date_str = date.toISOString().replace("Z", "+00:00").replace(".000", "");
        var hour_is_daytime = is_daytime(date, sun);
        var date_sunrise = new Date(sun[date.toISOString().substring(0, 10)].sunrise);
        var date_sunset = new Date(sun[date.toISOString().substring(0, 10)].sunset);
        data = {
            "time": date,
            "temperature": round_temp(get_parameter(hourly.parameters, "t")),
            "precipMean": round_precip(get_parameter(hourly.parameters, "pmean")),
            "weatherSymbol": get_parameter(hourly.parameters, "Wsymb2"),
            "windSpeed": get_parameter(hourly.parameters, "ws"),
            "sunrise": is_same_hour(date, date_sunrise)? date_sunrise: "",
            "sunset": is_same_hour(date, date_sunset)? date_sunset: "",
            "hourMarker": (idx == 0)? "first-hour-of-day": "",
            "dayMarker": hour_is_daytime? "day": "night",
            "uvIndex": uv[date_str],
        }
        data["image"] = pick_image(data["weatherSymbol"], data["windSpeed"], hour_is_daytime, date);
        return data;
    }
    return transform;
}

function transform_data(weather) {
    var weather = Object.assign({}, weather);
    var now = to_date(weather.approvedTime);
    var hours_all = weather.timeSeries.slice(0, 36).map(
        transform_hourly(weather.sun, weather.uv)
    );

    return {
        "cache_bust": now,
        "current": {
            "time": now,
            "temperature": hours_all[0].temperature,
            "image": pick_image(
                hours_all[0].weatherSymbol,
                hours_all[0].windSpeed,
                is_daytime(now, weather.sun),
                now,
            ),
        },
        "future": {
            "temperatureMax": Math.max(...hours_all.map(hourly => hourly.temperature)),
            "temperatureMin": Math.min(...hours_all.map(hourly => hourly.temperature)),
            "hasPrecip": Math.max(...hours_all.map(hourly => hourly.precipMean)),
            "hourly": hours_all,
        }
    };
}

// RENDER DATA USING TEMPLATE
function show_weather(weather) {
    var template = $('#template').innerHTML;
    var data = transform_data(weather);
    Mustache.parse(template);
    var rendered = Mustache.render(
        template,
        {...data, ...template_helpers()}
    );
    document.body.innerHTML += rendered;
}

// Harmoize stack trace between Firefox and Chrome
function show_error(error) {
    var error_str = error.stack;
    if (!error_str.startsWith(error)) {
        error_str = error + '\n' + error_str;
    }

    var out = "";
    for (line of error_str.split("\n")) {
        line = line.trim();
        if (!line) { continue; }

        if (!line.startsWith("at ")) {
            line = "at " + line;
        }
        out += '\t' + line + '\n';
    }
    out = out.trim().replace("at ", "", 1);

    document.body.innerHTML += (
        '<pre style="text-align: left; font-family: Lato">' +
            out +
        '</pre>'
    );
}

// GET WEATHER DATA FROM LOCAL FILE
function load_graphs(urls) {
    if (urls.length == 0) {
        return;
    }

    var url = urls.shift();
    fetch(url)
        .then(function(response) {
            return response.json();
        })
        .then(function(weather) {
            show_weather(weather);
        })
        .then(function(){
            init_clock();
        })
        .then(() => load_graphs(urls))
        .catch(function(error) {
            show_error(error);
            console.error(error);
        });
}
function init_clock() {
    function update_clock() {
        var clock = $(".current-clock");
        var date = new Date();
        var [hours, minutes] = to_time_string(date);
        var new_time_str = hours + ":" + minutes;
        var old_time_str = clock.innerHTML.trim();
        if (new_time_str != old_time_str) {
            clock.innerText = new_time_str;
        }
    }
    update_clock();
    setInterval(update_clock, 5000);
}
function reload_hourly() {
    // Refresh every whole hour
    var minutes = new Date().getMinutes();
    var next_refresh = (60 - minutes);
    // Add one minute to ensure server refresh is done, and add some
    // randomness to avoid thundering herd performance issues
    var extra_minutes = 1 + Math.floor(Math.random() * 1)
    setTimeout(
        function() { window.location.reload(); },
        (next_refresh + extra_minutes) * 60 * 1000
    );
}

function init() {
    load_graphs(['weather/weather.json?' + Math.random()])
    reload_hourly();
}

window.onload = init;
