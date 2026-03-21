import axios from 'axios';

export type ProvinceItem = {
  id?: number;
  name: string;
};

export type DistrictItem = {
  id?: number;
  name: string;
};

const locationClient = axios.create({
  baseURL: 'https://api.turkiyeapi.dev/v1',
  timeout: 10000,
});

const safeName = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const locationService = {
  getCities: async (): Promise<string[]> => {
    try {
      const response = await locationClient.get('/provinces');
      const items = Array.isArray(response.data?.data) ? response.data.data : [];

      return items
        .map((item: any) => safeName(item.name))
        .filter(Boolean)
        .sort((a: string, b: string) => a.localeCompare(b, 'tr'));
    } catch (error) {
      console.error('getCities error:', error);
      return [];
    }
  },

  getDistrictsByCityName: async (cityName: string): Promise<string[]> => {
    try {
      if (!cityName?.trim()) return [];

      const response = await locationClient.get('/provinces', {
        params: { name: cityName.trim() },
      });

      const provinces = Array.isArray(response.data?.data) ? response.data.data : [];
      const province = provinces.find(
        (item: any) => safeName(item.name).toLocaleLowerCase('tr') === cityName.trim().toLocaleLowerCase('tr')
      );

      const districts = Array.isArray(province?.districts) ? province.districts : [];

      return districts
        .map((item: any) => safeName(item.name))
        .filter(Boolean)
        .sort((a: string, b: string) => a.localeCompare(b, 'tr'));
    } catch (error) {
      console.error('getDistrictsByCityName error:', error);
      return [];
    }
  },
};