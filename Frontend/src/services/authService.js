import axios from 'axios';
import { API_URL } from '../config/api';

const backendBase = API_URL;

export async function loginWithGoogle(idToken) {
  if (!idToken) {
    throw new Error('Google ID token is required');
  }

  const response = await axios.post(`${backendBase}/auth/oauth/google`, {
    idToken
  });

  return response.data;
}

export function saveAuthSession(user, token) {
  if (!user || !token) return;

  localStorage.setItem('token', token);
  localStorage.setItem('accessToken', token);
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('isLoggedIn', 'true');

  if (user.role) {
    localStorage.setItem('userRole', user.role);
  }

  window.dispatchEvent(new Event('user:update'));
}
