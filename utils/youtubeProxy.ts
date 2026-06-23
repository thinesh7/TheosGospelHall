const API_KEY = process.env.EXPO_PUBLIC_YT_API_KEY || 'AIzaSyCDjHEyoBYP52F5OCE3l7N5NGg3HFd89YU';

export async function ytFetch(endpoint: string, params: Record<string, string>): Promise<any> {
  const searchParams = new URLSearchParams({ ...params, key: API_KEY });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${searchParams}`);
  return res.json();
}
