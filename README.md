# A weather widget based the Dark Sky API

This repo generates the below widget from weather data. This type of widget is called a [meteogram](https://en.wikipedia.org/wiki/Meteogram).

![Weather widget](https://github.com/EmilStenstrom/weatherapp/blob/master/preview.png)

# How it works

1. Every hour `python refresh.py` makes request to the [Dark Sky's weather API](https://darksky.net/poweredby/). The results is saved to `weather/weather.json`
2. When the static `index.html` file is loaded, it makes a request using [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) to `weather.json`
3. The JSON file is passed through `transform_data` towards a format that can be used in a template
4. A [mustache](https://mustache.github.io/) template converts the transformed data to HTML
5. The index.html file reloads itself every hour to reflect the newly loaded `weather.json`

# Design choices

* index.html is a static file (easier to cache and deploy)
* A free account with Dark Sky is limited to 1000 requests per month. This means at most one request per hour.
