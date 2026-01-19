import axios from 'axios';

export class PayjaApiService {
  constructor(baseUrl = process.env.PAYJA_API_URL || 'http://155.138.227.26:3000') {
    this.baseUrl = baseUrl;
    this.apiKey = process.env.PAYJA_API_KEY;
  }

  async checkCustomerExists(phoneNumber) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/ussd/check-customer`, {
        params: { phoneNumber },
        headers: this.apiKey ? { 'x-api-key': this.apiKey } : {},
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return { exists: false };
      }
      throw error;
    }
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
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/ussd/customer-limit`,
        {
          params: { phoneNumber },
          headers: this.apiKey ? { 'x-api-key': this.apiKey } : {},
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao obter limite:', error.message);
      throw error;
    }
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
