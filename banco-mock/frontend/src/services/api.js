import axios from 'axios';

const api = axios.create({
  baseURL: 'http://155.138.227.26:4500/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
