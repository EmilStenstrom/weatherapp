import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime

import pytz


def httpget(url):
    f = urllib.request.urlopen(url)
    return f.read().decode('utf-8')

def env_or_error(key, _format, default=None):
    if key not in os.environ:
        if default:
            return default

        raise Exception(f"Environment variable {key} was not set")

    value = os.environ[key]
    if not re.match(_format, value):
        raise Exception(f"Environment variable {key} has the wrong format, should be {_format}")

    return value

def check_existing_file(path):
    if not os.path.isfile(path):
        return

    with open(path, "r") as f:
        data = json.load(f)

    # Get local time in UTC
    local_dt = datetime.now(pytz.utc)

    # Get localized date from response
    response_time = datetime.fromtimestamp(data["currently"]["time"])
    response_tz = pytz.timezone(data["timezone"])
    response_dt = response_tz.localize(response_time)

    # Was the data fetched less than one hour ago?
    hours_diff = (local_dt - response_dt).total_seconds() / (60*60)
    if hours_diff < 1:
        print("Will not fetch, data is less than 1 hour old")
        sys.exit()

    return

def main():
    apikey = env_or_error("APIKEY", r"[a-f0-9]+")
    location = env_or_error("LOCATION", r"^\-?\d+\.\d+,\-?\d+\.\d+?$", default="59.3078312,18.0075784")
    lang = env_or_error("LANGAUGE", r"[a-z]{2}", default="sv")

    weather_path = "weather/weather.json"
    check_existing_file(weather_path)

    with open(weather_path, "w") as f:
        url = f"https://api.darksky.net/forecast/{apikey}/{location}/?lang={lang}&units=si"
        weather = httpget(url)
        f.write(json.dumps(json.loads(weather), indent=4))

if __name__ == '__main__':
    main()
