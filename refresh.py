from textwrap import dedent, indent
import json
import os
import re
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests


def env_or_error(key, _format, default=None):
    if key not in os.environ:
        if default:
            return default

        raise Exception(f"Environment variable {key} was not set")

    value = os.environ[key]
    if not re.match(_format, value):
        raise Exception(f"Environment variable {key} has the wrong format, should be {_format}")

    return value

def check_status(response):
    if response.status_code != 200:
        headers_str = json.dumps(dict(response.headers), indent=4)
        headers_str = indent(headers_str, "    " * 3).lstrip()
        raise Exception(dedent(f"""
            Status: {response.status_code}

            Headers:
            {headers_str}

            Data:
            {response.raw.data}
        """))

def check_existing_file(path, debug):
    if not os.path.isfile(path):
        log("Fetching new data, file ({path}) does not exist", debug)
        return

    if os.path.getsize(path) == 0:
        log("Fetching new data, file exists ({path}), but is empty", debug)
        return

    with open(path, "r") as f:
        data = json.load(f)

    if "error" in data:
        log("Error in last fetched data, try again", debug)
        return

    # Get local time in UTC
    local_dt = datetime.now(ZoneInfo("UTC"))

    # Get localized date from response
    response_dt = datetime.fromisoformat(data["approvedTime"])

    # Was the data fetched less than one hour ago?
    if local_dt < response_dt + timedelta(minutes=59):
        print(f"Will not fetch, data is less than 1 hour old ({response_dt})")
        sys.exit()

    log(f"Fetching new data, data is old ({response_dt})", debug)

    return

def log(message, debug):
    if debug:
        print(message)

def main():
    debug = (env_or_error("DEBUG", r"true", default="false") == "true")
    weather_path = env_or_error("WEATHER_PATH", r"[\w\\\/]+", default="weather/weather.json")
    location = env_or_error("LOCATION", r"^\-?\d+\.\d+,\-?\d+\.\d+?$", default="59.283329,17.991245")
    lat, lon = location.split(",")

    data = get_forecast(weather_path, lat, lon, debug)
    reference_time = datetime.fromisoformat(data["referenceTime"])
    data["sun"] = get_sun_data(reference_time, lat, lon)
    data["uv"] = get_uv_data(reference_time, lat, lon)

    data = dict(sorted(data.items()))

    data_str = json.dumps(data, indent=4)
    if not data_str:
        raise Exception("Empty data returned")

    with open(weather_path, "w+") as f:
        f.write(data_str)

def get_forecast(weather_path, lat, lon, debug=False):
    url = f"https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/{lon}/lat/{lat}/data.json"
    check_existing_file(weather_path, debug=debug)
    os.makedirs(os.path.dirname(weather_path), exist_ok=True)
    print(f"Fetching weather data from: {url}")
    response = requests.get(url, allow_redirects=False)
    check_status(response)
    data = response.json()
    return data

# Sunrise and sunset data
def get_sun_data(reference_time, lat, lon):
    dates = [
        reference_time + timedelta(days=i)
        for i in range(3)
    ]

    from sun import Sun
    sun_data = {}
    for date_ in dates:
        sun = Sun(date_, float(lat), float(lon))
        sunrise_time = sun.sunrise()
        sunrise = date_.replace(
            hour=sunrise_time.hour,
            minute=sunrise_time.minute,
            second=sunrise_time.second,
        )
        sunset_time = sun.sunset()
        sunset = date_.replace(
            hour=sunset_time.hour,
            minute=sunset_time.minute,
            second=sunset_time.second,
        )
        sun_data[date_.date().isoformat()] = {
            "sunrise": sunrise.isoformat(),
            "sunset": sunset.isoformat(),
        }

    return sun_data

# UV data from a non-official API
def get_uv_data(reference_time, lat, lon):
    url = "https://www.stralsakerhetsmyndigheten.se/api/v1/suntime/calculate"
    uvindex_data = {}
    for i in range(36 + 1):
        date_ = reference_time + timedelta(hours=i)
        print(f"Fetching UV data from: {url}")
        response = requests.post(url, json={
            "dateStr": date_.date().isoformat(),
            "hour": str(date_.hour),
            "latitude": lat,
            "skintypeId": "4",  # Note: Not used for uvIndex value
        }, allow_redirects=False)
        check_status(response)
        uvindex_data[date_.isoformat()] = response.json()["result"]["uvIndex"]

    return uvindex_data

if __name__ == '__main__':
    main()
