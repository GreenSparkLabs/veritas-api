# veritas-api

Veritas API Server (Flask + Open-Meteo)
A simple Flask web server that provides current and historical weather data using the free Open-Meteo API.

Features
Current Weather: Get real-time weather data for any location.

Historical Weather: Retrieve past weather data for any date range.

No API Key Required: Uses the free and open Open-Meteo API.

Requirements
Python 3.7+

Flask

Requests

Installation
Clone the repository:

text
git clone https://github.com/greensparklabs/weather-api-flask.git
cd weather-api-flask
Install dependencies:

text
pip install flask requests
Usage
Start the server:

text
python weather_app.py
Endpoints:

Current Weather

text
GET /current?lat=<latitude>&lon=<longitude>
Example:

text
http://localhost:8080/current?lat=52.52&lon=13.41
Historical Weather

text
GET /historical?lat=<latitude>&lon=<longitude>&start=<YYYY-MM-DD>&end=<YYYY-MM-DD>
Example:

text
http://localhost:8080/historical?lat=52.52&lon=13.41&start=2024-06-01&end=2024-06-05
Example Responses
Current Weather:

json
{
  "latitude": 52.52,
  "longitude": 13.41,
  "current_weather": {
    "temperature": 22.3,
    "windspeed": 10.2,
    "winddirection": 180
  }
}
Historical Weather:

json
{
  "latitude": 52.52,
  "longitude": 13.41,
  "hourly": {
    "time": ["2024-06-01T00:00", "2024-06-01T01:00", ...],
    "temperature_2m": [20.0, 19.5, ...],
    "relative_humidity_2m": [60, 62, ...],
    "wind_speed_10m": [5.0, 4.8, ...],
    "precipitation": [0.0, 0.1, ...]
  }
}
Notes
Hosting: The server is set to run on 0.0.0.0:8080 by default, making it accessible from other devices on your network.

Open-Meteo: See Open-Meteo API Documentation for more details and available parameters.

Enjoy your weather data! 🌦️