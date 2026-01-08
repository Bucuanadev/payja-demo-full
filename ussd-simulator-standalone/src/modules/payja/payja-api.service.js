import axios from 'axios';

export class PayjaApiService {
  constructor(baseUrl = process.env.PAYJA_API_URL || 'http://155.138.228.89:3000') {
    this.baseUrl = baseUrl;
    this.apiKey = process.env.PAYJA_API_KEY;
  }

  async checkCustomerExists(phoneNumber) {
    // Prefer the PayJA integration endpoint used by the backend. Fall back to legacy endpoint if absent.
    const candidates = [
      `${this.baseUrl}/api/v1/integrations/ussd/customer-status/${encodeURIComponent(phoneNumber)}`,
      `${this.baseUrl}/api/v1/ussd/check-customer`,
    ];
    for (const url of candidates) {
      try {
        const resp = await axios.get(url, {
          params: url.endsWith('/check-customer') ? { phoneNumber } : {},
          headers: this.apiKey ? { 'x-api-key': this.apiKey } : {},
          timeout: 10000,
        });
        // If we called the integrations endpoint, normalize its shape to { exists, customer }
        if (url.includes('integrations/ussd/customer-status')) {
          const data = resp.data;
          if (data && data.success) {
            return { exists: true, customer: { name: data.name || '', creditLimit: data.creditLimit || 0, id: data.phoneNumber || '' } };
          }
          return { exists: false };
        }
        return resp.data;
      } catch (err) {
        if (err.response && err.response.status === 404) continue; // try next
        // network or other error — rethrow so caller can handle
        // but try next candidate first
      }
    }
    return { exists: false };
  }

  async registerCustomer(customerData) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/ussd/register`,
        customerData,
        {
          headers: this.apiKey ? { 'x-api-key': this.apiKey } : {},
          timeout: 30000,
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao registrar no PayJA:', error.message);
      throw error;
    }
  }

  async requestLoan(loanData) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/ussd/request-loan`,
        loanData,
        {
          headers: this.apiKey ? { 'x-api-key': this.apiKey } : {},
          timeout: 30000,
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao solicitar empréstimo:', error.message);
      throw error;
    }
  }

  async getCustomerLimit(phoneNumber) {
    // Reuse the integrations customer-status endpoint which returns creditLimit
    try {
      const resp = await axios.get(`${this.baseUrl}/api/v1/integrations/ussd/customer-status/${encodeURIComponent(phoneNumber)}`, { timeout: 10000 });
      if (resp.data && resp.data.success) return { success: true, creditLimit: resp.data.creditLimit || 0 };
    } catch (e) {
      // fallback to legacy endpoint if necessary
      try {
        const response = await axios.get(`${this.baseUrl}/api/v1/ussd/customer-limit`, { params: { phoneNumber }, timeout: 10000 });
        return response.data;
      } catch (err) {
        console.error('Erro ao obter limite:', err.message || err);
        throw err;
      }
    }
    return { success: false, creditLimit: 0 };
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/health`, {
        timeout: 5000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
