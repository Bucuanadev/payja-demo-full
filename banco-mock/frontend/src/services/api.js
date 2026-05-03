import axios from 'axios';

const api = axios.create({
  baseURL: 'http://216.128.152.177:4500/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
