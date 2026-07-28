import json
import unittest
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch
from zoneinfo import ZoneInfo

from refresh import (
    check_existing_file,
    get_forecast,
    get_uv_data,
    normalize_forecast,
    normalize_uv_forecast,
)


class NormalizeForecastTests(unittest.TestCase):
    def test_converts_snow1g_response_to_frontend_format(self):
        forecast = normalize_forecast({
            "createdTime": "2026-07-28T10:31:15Z",
            "referenceTime": "2026-07-28T10:15:00Z",
            "geometry": {
                "type": "Point",
                "coordinates": [17.985262, 59.287670],
            },
            "timeSeries": [{
                "time": "2026-07-28T11:00:00Z",
                "data": {
                    "air_temperature": 21.3,
                    "precipitation_amount_mean": 0.2,
                    "symbol_code": 8,
                    "wind_speed": 5.2,
                },
            }],
        })

        self.assertEqual(forecast["approvedTime"], "2026-07-28T10:31:15Z")
        self.assertEqual(
            forecast["timeSeries"][0],
            {
                "validTime": "2026-07-28T11:00:00Z",
                "parameters": [
                    {"name": "t", "values": [21.3]},
                    {"name": "pmean", "values": [0.2]},
                    {"name": "Wsymb2", "values": [8]},
                    {"name": "ws", "values": [5.2]},
                ],
            },
        )


class NormalizeUvForecastTests(unittest.TestCase):
    def test_converts_stockholm_local_hours_to_utc(self):
        forecast = normalize_uv_forecast(
            {
                "location": {
                    "date": [{
                        "date": "2026-07-28T00:00:00",
                        "hourlyUvIndex": [0.0, 0.1, 0.2],
                    }],
                },
            },
            ZoneInfo("Europe/Stockholm"),
        )

        self.assertEqual(
            forecast,
            {
                "2026-07-27T22:00:00+00:00": 0.0,
                "2026-07-27T23:00:00+00:00": 0.1,
                "2026-07-28T00:00:00+00:00": 0.2,
            },
        )

    @patch("refresh.requests.get")
    def test_fetches_the_ssm_location_once_with_summer_offset(self, get):
        get.return_value = Mock(
            status_code=200,
            json=lambda: {
                "response": {
                    "location": {
                        "date": [{
                            "date": "2026-07-28T00:00:00",
                            "hourlyUvIndex": [0.0],
                        }],
                    },
                },
            },
        )

        get_uv_data(datetime.fromisoformat("2026-07-28T10:00:00+00:00"))

        get.assert_called_once_with(
            "https://www.stralsakerhetsmyndigheten.se/api/uvindex/"
            "Sverige%20%28Stockholm%29",
            params={"offset": -2},
            allow_redirects=False,
        )


class RefreshCacheTests(unittest.TestCase):
    def test_skips_a_recent_forecast(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "weather.json"
            path.write_text(json.dumps({
                "approvedTime": datetime.now(ZoneInfo("UTC")).isoformat(),
            }))

            self.assertFalse(check_existing_file(path, debug=False))

    @patch("refresh.requests.get")
    def test_force_fetches_despite_a_recent_forecast(self, get):
        get.return_value = Mock(
            status_code=200,
            json=lambda: {
                "createdTime": "2026-07-28T10:31:15Z",
                "referenceTime": "2026-07-28T10:15:00Z",
                "geometry": {"type": "Point", "coordinates": [18.0, 59.2]},
                "timeSeries": [],
            },
        )

        with TemporaryDirectory() as directory:
            path = Path(directory) / "weather.json"
            path.write_text(json.dumps({
                "approvedTime": datetime.now(ZoneInfo("UTC")).isoformat(),
            }))
            result = get_forecast(
                str(path),
                "59.2",
                "18.0",
                force=True,
            )

        self.assertEqual(result["approvedTime"], "2026-07-28T10:31:15Z")
        get.assert_called_once()


if __name__ == "__main__":
    unittest.main()
