// GENERAL HELPERS
var $ = document.querySelector.bind(document);

function to_date(timestamp) {
    if (typeof timestamp != 'number') {
        throw new Error("timestamp: " + timestamp + " is a " + typeof timestamp + " not an number");
    }
    return new Date(timestamp * 1000);
}
function to_time(date) {
    var hours = ("0" + date.getHours()).substr(-2);
    var minutes = ("0" + date.getMinutes()).substr(-2);
    return [hours, minutes];
}

var DAY_NAMES = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
var MONTHS = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];

function to_day(date) {
    var [hours, minutes] = to_time(date);
    var time = hours + ":" + minutes;
    var day = (
        DAY_NAMES[date.getDay()] + ", " +
        date.getDate() + " " +
        MONTHS[date.getMonth()].toLowerCase()
    );
    return [time, day];
}
function to_percent(decimal) {
    return (decimal * 100 + "").substr(0, 2) + "%";
}
function is_same_day(date1, date2) {
    if (typeof date1.getMonth !== 'function') {
        throw new Error("date1: " + date1 + " is not an Date");
    }
    if (typeof date2.getMonth !== 'function') {
        throw new Error("date2: " + date2 + " is not an Date");
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
        throw new Error("current_hour: " + current_hour + " is not an Date");
    }
    if (typeof sunriseTime.getMonth !== 'function') {
        throw new Error("sunriseTime: " + sunriseTime + " is not an Date");
    }
    if (typeof sunsetTime.getMonth !== 'function') {
        throw new Error("sunsetTime: " + sunsetTime + " is not an Date");
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
            var today = weather.current_time;
            return function(text, render) {
                var date = new Date(render(text));
                var [time, day] = to_day(date);
                return (
                    '<time class="time" datetime="' + date.toISOString() + '">' +
                        '<span class="clock">' + time + '</span>' +
                        '<span class="day">' + day + '</span>' +
                    '</time>'
                );
            }
        },
        "to_time": function() {
            return function(text, render) {
                var date = new Date(render(text));
                var [hours, minutes] = to_time(date);
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

function transform_hourly(hourly, idx, len, daily, current_time) {
    hourly = round_temp(hourly);
    hourly = round_precip(hourly);
    hourly = add_image(hourly, daily, current_time);
    hourly = add_hour_marker(hourly, idx);
    hourly = add_first_hour_marker(hourly, idx, len);
    hourly = add_daytime_marker(hourly, daily);
    hourly = add_sunset_and_sunrise_marker(hourly, daily);
    return hourly;
}
function transform_time(hourly) {
    if (typeof hourly.time != 'number') {
        throw new Error("hourly.time: " + hourly.time + " is a " + typeof hourly.time + " not an number");
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
function add_image(hourly, daily, current_time) {
    var icon = hourly.icon;
    var summary = hourly.summary;
    var images = {
        "clear-day": "clear.svg",
        "clear-night": "clear.svg",
        "cloudy": "cloudy.svg",
        "fog": "fog.svg",
        "partly-cloudy-day": (hourly => (hourly.cloudCover > 0.5? "mostlycloudy.svg": "partlycloudy.svg")),
        "partly-cloudy-night": (hourly => (hourly.cloudCover > 0.5? "mostlycloudy.svg": "partlycloudy.svg")),
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

    hourly.image = (
        '<img ' +
            'class="icon icon-' + icon + '" ' +
            'src="icons/' + image + '?' + current_time.getTime() + '"' +
            'alt="' + summary + '"' +
        '>'
    );
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
    var weather = Object.assign({}, weather);
    var current_time = to_date(weather.currently.time);

    // Transform timestamp to Date first, to simplify code later
    var current_data = Object.assign({}, weather.currently);
    current_data = transform_time(current_data);
    var hourly_data = Array.from(weather.hourly.data);
    for (hourly of hourly_data) {
        hourly = transform_time(hourly);
    }
    var daily_data = Array.from(weather.daily.data);
    var today_daily = transform_daily(daily_data[0]);

    // Today
    var today_hourly = Array.from(hourly_data);
    today_hourly = today_hourly.filter(
        hourly => is_same_day(current_time, hourly.time)
    )
    var len = today_hourly.length;
    today_hourly = today_hourly.map(
        (hourly, idx) => transform_hourly(hourly, idx, len, today_daily, current_time)
    );

    // Tomorrow
    var tomorrow = new Date(current_time);
    tomorrow.setDate(tomorrow.getDate() + 1);

    var tomorrow_daily = transform_daily(daily_data[1]);
    var tomorrow_hourly = Array.from(hourly_data);
    tomorrow_hourly = tomorrow_hourly.filter(
        hourly => is_same_day(tomorrow, hourly.time)
    )
    var len = tomorrow_hourly.length;
    tomorrow_hourly = tomorrow_hourly.map(
        (hourly, idx) => transform_hourly(hourly, idx, len, tomorrow_daily, current_time)
    );

    hourly = today_hourly.concat(tomorrow_hourly);
    hourly = hourly.slice(0, 24);

    return {
        "currently": weather.currently,
        "cache_bust": current_time.getTime(),
        "current_time": current_time,
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
            cache_bust(weather.currently.time);
            show_weather(weather);
        })
        .then(() => load_graphs(urls))
        .catch(function(error) {
            show_error(error);
        });
}
function cache_bust(time) {
    var style = $("link#main");
    style.href += "?" + time;

    var script = $("script#main");
    script.src += "?" + time;
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
    load_graphs(['weather/weather.json'])
    reload_hourly();
}

window.onload = init;
