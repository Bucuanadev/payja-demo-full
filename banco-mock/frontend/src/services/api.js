import axios from 'axios';

const api = axios.create({
  baseURL: 'http://155.138.228.89:4500/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
