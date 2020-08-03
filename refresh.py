import json
import os
import re
import sys
from datetime import datetime, timedelta

import pytz
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

def check_existing_file(path, debug):
    if not os.path.isfile(path):
        log("Fetching new data, file ({path}) does not exist", debug)
        return

    if os.path.getsize(path) == 0:
        log("Fetching new data, file exists ({path}), but is empty", debug)
        return

    with open(path, "r") as f:
        data = json.load(f)

    # Get local time in UTC
    local_dt = datetime.now(pytz.utc)

    # Get localized date from response
    response_tz = pytz.timezone(data["timezone"])
    response_dt = datetime.fromtimestamp(
        data["currently"]["time"],
        tz=response_tz,
    )

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
    apikey = env_or_error("APIKEY", r"[a-f0-9]+")
    location = env_or_error("LOCATION", r"^\-?\d+\.\d+,\-?\d+\.\d+?$", default="59.3078312,18.0075784")
    lang = env_or_error("LANGAUGE", r"[a-z]{2}", default="sv")
    weather_path = env_or_error("WEATHER_PATH", r"[\w\\\/]+", default="weather/weather.json")

    check_existing_file(weather_path, debug=debug)

    with open(weather_path, "w") as f:
        url = f"https://api.darksky.net/forecast/{apikey}/{location}/?lang={lang}&units=si"
        print(f"Fetching new data from: {url}")
        weather = requests.get(url).json()
        f.write(json.dumps(weather, indent=4))

if __name__ == '__main__':
    main()
