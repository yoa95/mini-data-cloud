// Simplified API client for demonstration
export const simpleApiClient = {
  async get(url: string) {
    const response = await fetch(`http://localhost:8080${url}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  async post(url: string, data: any) {
    const response = await fetch(`http://localhost:8080${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
};