import React from 'react';
import styled from 'styled-components';
import { useQuery } from 'react-query';
import WeatherCard from './WeatherCard';
import ForecastCard from './ForecastCard';
import SearchBar from './SearchBar';
import { fetchWeatherData, fetchForecastData } from '../services/weatherService';
import { useLocation } from '../context/LocationContext';
import { WeatherData, ForecastData } from '../types/weatherTypes';

const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background-color: #f0f2f5;
  min-height: 100vh;
  box-sizing: border-box;
`;

const ContentWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  width: 100%;
  max-width: 1200px;
`;

const Title = styled.h1`
  font-size: 2.5em;
  color: #333;
  margin-bottom: 30px;
  text-align: center;
`;

const ErrorMessage = styled.p`
  font-size: 1.2em;
  color: #d32f2f;
  text-align: center;
  margin-top: 50px;
`;

const LoadingMessage = styled.p`
  font-size: 1.2em;
  color: #555;
  text-align: center;
  margin-top: 50px;
`;

const WeatherDashboard: React.FC<{}> = () => {
  const { currentLocation } = useLocation();

  const { data: weatherData, isLoading: isWeatherLoading, error: weatherError } = useQuery<WeatherData, Error>(
    ['weather', currentLocation],
    () => fetchWeatherData(currentLocation)
  );

  const { data: forecastData, isLoading: isForecastLoading, error: forecastError } = useQuery<ForecastData, Error>(
    ['forecast', currentLocation],
    () => fetchForecastData(currentLocation)
  );

  if (isWeatherLoading || isForecastLoading) {
    return <LoadingMessage>Loading weather data...</LoadingMessage>;
  }

  if (weatherError) {
    return <ErrorMessage>Error loading weather data: {weatherError.message}</ErrorMessage>;
  }

  if (forecastError) {
    return <ErrorMessage>Error loading forecast data: {forecastError.message}</ErrorMessage>;
  }

  if (!weatherData || !forecastData) {
    return <LoadingMessage>Please select a location to see weather information.</LoadingMessage>;
  }

  return (
    <DashboardContainer>
      <Title>Weather Dashboard</Title>
      <SearchBar />
      <ContentWrapper>
        <WeatherCard
          cityName={weatherData.name}
          country={weatherData.sys.country}
          temperature={weatherData.main.temp}
          feelsLike={weatherData.main.feels_like}
          description={weatherData.weather[0].description}
          icon={weatherData.weather[0].icon}
          humidity={weatherData.main.humidity}
          windSpeed={weatherData.wind.speed}
        />
        {forecastData.list.slice(0, 4).map((day) => (
          <ForecastCard
            key={day.dt}
            date={day.dt_txt}
            temperature={day.main.temp}
            description={day.weather[0].description}
            icon={day.weather[0].icon}
          />
        ))}
      </ContentWrapper>
    </DashboardContainer>
  );
};

export default WeatherDashboard;