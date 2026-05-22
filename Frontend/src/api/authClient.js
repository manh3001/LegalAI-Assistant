import axios from 'axios';

const backendBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export async function loginWithGoogle(idToken) {
  const response = await axios.post(`${backendBase}/auth/oauth/google`, {
    idToken
  });
  return response.data;
}
