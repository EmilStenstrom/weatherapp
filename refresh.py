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
    url = f"https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/{lon}/lat/{lat}/data.json"

    check_existing_file(weather_path, debug=debug)

    os.makedirs(os.path.dirname(weather_path), exist_ok=True)

    print(f"Fetching new data from: {url}")
    response = requests.get(url, allow_redirects=False)
    check_status(response)
    data = response.json()

    # Also get sunrise and sunset data
    dates = [
        datetime.fromisoformat(data["referenceTime"]) + timedelta(days=i)
        for i in range(5)
    ]

    from sun import Sun
    data["sun"] = {}
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
        data["sun"][date_.date().isoformat()] = {
            "sunrise": sunrise.isoformat(),
            "sunset": sunset.isoformat(),
        }

    data_str = json.dumps(dict(sorted(data.items())), indent=4)
    if not data_str:
        raise Exception("Empty data returned")

    with open(weather_path, "w+") as f:
        f.write(data_str)


if __name__ == '__main__':
    main()
