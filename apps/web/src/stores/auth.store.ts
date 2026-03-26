import { create } from 'zustand';
import api from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  hasPassword?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  loadUser: () => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string, avatarFile?: File) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  updateProfile: (firstName: string, lastName: string, avatarFile?: File) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('askora_token'),
  isLoading: true,

  setAuth: (token, user) => {
    localStorage.setItem('askora_token', token);
    set({ token, user, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('askora_token');
    set({ token: null, user: null, isLoading: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('askora_token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, token, isLoading: false });
    } catch {
      localStorage.removeItem('askora_token');
      set({ token: null, user: null, isLoading: false });
    }
  },

  register: async (email, password, firstName, lastName, avatarFile) => {
    const form = new FormData();
    form.append('email', email);
    form.append('password', password);
    form.append('firstName', firstName);
    form.append('lastName', lastName);
    if (avatarFile) form.append('avatar', avatarFile, avatarFile.name);

    const { data } = await api.post('/auth/register', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    localStorage.setItem('askora_token', data.accessToken);
    set({ token: data.accessToken, user: data.user, isLoading: false });
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('askora_token', data.accessToken);
    set({ token: data.accessToken, user: data.user, isLoading: false });
  },

  updateProfile: async (firstName, lastName, avatarFile) => {
    const form = new FormData();
    form.append('firstName', firstName);
    form.append('lastName', lastName);
    if (avatarFile) form.append('avatar', avatarFile, avatarFile.name);
    const { data } = await api.patch('/auth/me', form);
    set({ user: data });
  },

  changePassword: async (currentPassword, newPassword) => {
    const { data } = await api.post('/auth/me/password', { currentPassword, newPassword });
    set({ user: data });
  },
}));
