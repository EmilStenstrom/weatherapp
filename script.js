// GENERAL HELPERS
function to_date(timestamp) {
    if (typeof timestamp != 'number') {
        throw new Error("timestamp: " + timestamp + " is not an number");
    }
    return new Date(timestamp * 1000)
}
function to_time(date) {
    var hours = ("0" + date.getHours()).substr(-2);
    var minutes = ("0" + date.getMinutes()).substr(-2);
    var out = hours + ':' + minutes;
    return '<time class="time" datetime="' + date.toISOString() + '">' + out + "</time>";
}
var DAY_NAMES = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
var MONTHS = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];

function to_day(date) {
    var out = (
        date.getDate() + " " +
        MONTHS[date.getMonth()].toLowerCase() +
        " (" + DAY_NAMES[date.getDay()].toLowerCase() + ")"
    );
    return '<time class="time" datetime="' + date.toISOString() + '">' + out + "</time>";
}
function to_percent(decimal) {
    return (decimal * 100 + "").substr(0, 2) + "%";
}
function is_same_day(date1, date2) {
    if (typeof date1.getMonth !== 'function') {
        throw "date1: " + date1 + " is not an Date";
    }
    if (typeof date2.getMonth !== 'function') {
        throw "date2: " + date2 + " is not an Date";
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
function is_daytime(current_hour, sunriseTime, sunsetTime) {
    if (typeof current_hour.getMonth !== 'function') {
        throw "current_hour: " + current_hour + " is not an Date";
    }
    if (typeof sunriseTime.getMonth !== 'function') {
        throw "sunriseTime: " + sunriseTime + " is not an Date";
    }
    if (typeof sunsetTime.getMonth !== 'function') {
        throw "sunsetTime: " + sunsetTime + " is not an Date";
    }

    var next_hour = new Date(current_hour);
    next_hour.setHours(next_hour.getHours() + 1);

    if (sunriseTime < current_hour && next_hour < sunsetTime) {
        return true;
    }
    return false;
}

// TEMPLATE HELPERS
function template_helpers(weather) {
    return {
        "to_day": function() {
            var today = weather.currently.time;
            return function(text, render) {
                var date = new Date(render(text));
                var day = to_day(date);
                if (is_same_day(date, today)) {
                    return "Idag " + day;
                }
                return "Imorgon " + day;
            }
        },
        "to_time": function() {
            return function(text, render) {
                var date = new Date(render(text));
                return to_time(date);
            }
        },
        "to_percent": function() {
            return function(text, render) {
                return to_percent(render(text));
            }
        },
        "temp_style": function() {
            var high = weather.future.temperatureHigh;
            var low = weather.future.temperatureLow;
            return function(text, render) {
                var current = render(text)
                var offset = Math.round(high - current) * 10;
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
    daily.sunriseTime = to_date(daily.sunriseTime);
    daily.sunsetTime = to_date(daily.sunsetTime);
    return daily;
}

function transform_hourly(hourly, idx, len, daily) {
    hourly = round_temp(hourly);
    hourly = round_precip(hourly);
    hourly = add_image(hourly, daily);
    hourly = add_hour_marker(hourly, idx);
    hourly = add_first_hour_marker(hourly, idx, len);
    hourly = add_daytime_marker(hourly, daily);
    hourly = add_sunset_and_sunrise_marker(hourly, daily);
    return hourly;
}
function transform_time(hourly) {
    if (typeof hourly.time != 'number') {
        throw new Error("hourly.time: " + hourly.time + " is not an number");
    }
    hourly.time = to_date(hourly.time);
    return hourly;
}
function round_temp(hourly) {
    hourly.temperature = Math.round(hourly.temperature);
    return hourly;
}
function round_precip(hourly) {
    hourly.precipIntensity = (
        Math.floor(
            hourly.precipIntensity * 10
        ) / 10
    );
    return hourly;
}
function add_image(hourly, daily) {
    var icon = hourly.icon;
    var images = {
        "clear-day": "clear.svg",
        "clear-night": "clear.svg",
        "cloudy": "cloudy.svg",
        "fog": "fog.svg",
        "partly-cloudy-day": (hourly => (hourly.cloudCover > 0.5? "mostlycloudy.svg": "partlycloudy.svg")),
        // NOTE: "treat partly-cloudy-night as an alias for clear-day"
        // https://darksky.net/dev/docs/faq#icon-selection
        "partly-cloudy-night": "clear.svg",
        "rain": (hourly => (hourly.precipProbability > 0.5? "rain.svg": "chancerain.svg")),
        "sleet": (hourly => (hourly.precipProbability > 0.5? "sleet.svg": "chancesleet.svg")),
        "snow": (hourly => (hourly.precipProbability > 0.5? "snow.svg": "chancesnow.svg")),
        "thunderstorm": "tstorms.svg",
        "wind": "wind.svg",
    };

    var image = "unknown.svg"
    if (icon in images) {
        image = (
            (typeof images[icon] === "function")?
            images[icon](hourly):
            images[icon]
        );
        if (!is_daytime(hourly.time, daily.sunriseTime, daily.sunsetTime)) {
            image = "nt_" + image;
        }
    }

    // Make large night icon slightly smaller
    if (image == "nt_clear.svg") {
        hourly.image = '<img class="icon icon-' + icon + '" src="icons/' + image + '" height="30" width="30" style="margin: 20px 10px 0">';
    }
    else {
        hourly.image = '<img class="icon" src="icons/' + image + '" height="50" width="50">';
    }
    return hourly;
}
function add_first_hour_marker(hourly, idx, len) {
    if (idx == 0) {
        hourly.hourMarker = (hourly.hourMarker || "") + " first-hour-of-day";
        hourly.first_hour_of_day = true;
        hourly.day_span = len;
    }
    return hourly;
}
function add_hour_marker(hourly, idx) {
    if (hourly.precipIntensity && hourly.precipProbability > 0.2) {
        hourly.hourMarker = (hourly.hourMarker || "") + " precip";
    }
    else if (hourly.cloudCover < 0.5) {
        hourly.hourMarker = (hourly.hourMarker || "") + " clear";
    }
    return hourly;
}
function add_daytime_marker(hourly, daily) {
    if (is_daytime(hourly.time, daily.sunriseTime, daily.sunsetTime)) {
        hourly.dayMarker = "day";
    }
    else {
        hourly.dayMarker = "night";
    }
    return hourly;
}
function add_sunset_and_sunrise_marker(hourly, daily) {
    if (is_same_hour(hourly.time, daily.sunriseTime)) {
        hourly.sunrise = daily.sunriseTime;
    }
    if (is_same_hour(hourly.time, daily.sunsetTime)) {
        hourly.sunset = daily.sunsetTime;
    }
    return hourly;
}

function transform_data(weather) {
    weather.currently.time = to_date(weather.currently.time);

    // Transform timestamp to Date to simplify code later
    var hourly_data = weather.hourly.data;
    for (hourly of hourly_data) {
        hourly = transform_time(hourly);
    }

    // Today
    var today_daily = transform_daily(weather.daily.data[0]);
    var today_hourly = Array.from(weather.hourly.data);
    today_hourly = today_hourly.filter(
        hourly => is_same_day(weather.currently.time, hourly.time)
    )
    var len = today_hourly.length;
    today_hourly = today_hourly.map(
        (hourly, idx) => transform_hourly(hourly, idx, len, today_daily)
    );

    // Tomorrow
    var tomorrow = new Date(weather.currently.time);
    tomorrow.setDate(tomorrow.getDate() + 1);

    var tomorrow_daily = transform_daily(weather.daily.data[1]);
    var tomorrow_hourly = Array.from(weather.hourly.data);
    tomorrow_hourly = tomorrow_hourly.filter(
        hourly => is_same_day(tomorrow, hourly.time)
    )
    var len = tomorrow_hourly.length;
    tomorrow_hourly = tomorrow_hourly.map(
        (hourly, idx) => transform_hourly(hourly, idx, len, tomorrow_daily)
    );

    hourly = today_hourly.concat(tomorrow_hourly);
    hourly = hourly.slice(0, 24);

    return {
        "currently": weather.currently,
        "future": {
            "temperatureHigh": Math.max(...hourly.map(
                hourly_data => hourly_data.temperature
            )),
            "temperatureLow": Math.min(...hourly.map(
                hourly_data => hourly_data.temperature
            )),
            "precipHigh": Math.max(...hourly.map(
                hourly_data => hourly_data.precipIntensity
            )),
            "precipLow": Math.min(...hourly.map(
                hourly_data => hourly_data.precipIntensity
            )),
            "hourly": hourly
        }
    };
}

// RENDER DATA USING TEMPLATE
function show_weather(weather) {
    var $ = document.querySelector.bind(document);
    var template = $('#template').innerHTML;
    var data = transform_data(weather);
    Mustache.parse(template);
    var rendered = Mustache.render(
        template,
        {...data, ...template_helpers(data)}
    );
    document.body.innerHTML += rendered;
}
function show_error(error) {
     document.body.innerHTML += error;
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
        .then(() => load_graphs(urls))
        .catch(function(error) {
            show_error(error);
        });
}

load_graphs(['weather/weather1.json'])
