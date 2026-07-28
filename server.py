import os
import subprocess
import sys
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler


REFRESH_INTERVAL_SECONDS = 60 * 60


def refresh():
    subprocess.run(
        [sys.executable, "refresh.py", "--force"],
        check=True,
    )


def refresh_hourly():
    while True:
        threading.Event().wait(REFRESH_INTERVAL_SECONDS)
        try:
            refresh()
        except subprocess.CalledProcessError as error:
            print(f"Weather refresh failed: {error}", file=sys.stderr)


def main():
    refresh()
    threading.Thread(target=refresh_hourly, daemon=True).start()

    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), SimpleHTTPRequestHandler)
    print(f"Serving Weatherapp on port {port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
