import axios from 'axios';

const api = axios.create({
  baseURL: 'http://104.207.142.188:4500/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
