// js/hubnet.js - PROVEN WORKING VERSION (Based on pbmdatahub.pro)
class HubNetAPI {
    constructor() {
        this.apiKey = "gOXXy0YSNd5CXZa4v568wuwbB70E8czAnM9";
        this.baseURL = 'https://console.hubnet.app/live/api/context/business/transaction';
        this.balanceURL = 'https://console.hubnet.app/live/api/context/business/transaction/check_balance';
    }

    getVolumeFromBundle(bundleName) {
        const volumeMap = {
            '100MB': '100',
            '300MB': '300', 
            '500MB': '500',
            '1GB': '1024',
            '2GB': '2048', 
            '3GB': '3072',
            '4GB': '4096',
            '5GB': '5120',
            '10GB': '10240'
        };
        return volumeMap[bundleName] || '1024';
    }

    async placeDataOrder(mtnNumber, bundleName, reference) {
        try {
            console.log('🚀 Starting HubNet delivery...');
            
            // Clean and validate phone number (like pbmdatahub.pro)
            const cleanNumber = mtnNumber.toString().replace(/\s/g, '').replace('+233', '0');
            if (cleanNumber.length !== 10 || !cleanNumber.startsWith('0')) {
                throw new Error('Please enter a valid 10-digit MTN number starting with 0');
            }

            const volume = this.getVolumeFromBundle(bundleName);
            
            // Exact payload format that works
            const payload = {
                "phone": cleanNumber,
                "volume": volume,
                "reference": reference,
                "referrer": cleanNumber
            };

            console.log('📤 Sending to HubNet:', payload);

            const response = await fetch(`${this.baseURL}/mtn-new-transaction`, {
                method: 'POST',
                headers: {
                    'token': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            // Handle response like pbmdatahub.pro
            if (!response.ok) {
                throw new Error(`HubNet server error: ${response.status}`);
            }

            const result = await response.json();
            console.log('📥 HubNet response:', result);

            // Check success based on HubNet documentation
            if (result.status === true && result.code === "0000") {
                return {
                    success: true,
                    message: 'Data bundle delivered successfully',
                    transactionId: result.transaction_id,
                    reference: result.reference
                };
            } else {
                // User-friendly error messages like pbmdatahub.pro
                const errorMsg = this.getErrorMessage(result);
                return {
                    success: false,
                    error: errorMsg,
                    code: result.code
                };
            }

        } catch (error) {
            console.error('❌ Delivery error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getErrorMessage(result) {
        // User-friendly error messages like pbmdatahub.pro
        const errorMap = {
            "1001": "Invalid network selected",
            "1002": "Invalid data bundle size", 
            "1003": "Insufficient balance in your account",
            "1004": "Invalid phone number format",
            "1005": "Transaction failed - please try again",
            "9999": "Temporary service issue - please try again in 2 minutes"
        };
        
        return errorMap[result.code] || 
               result.reason || 
               result.message || 
               "Delivery failed - please try again";
    }

    async checkBalance() {
        try {
            const response = await fetch(this.balanceURL, {
                method: 'GET',
                headers: {
                    'token': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            
            // Extract balance from response (like pbmdatahub.pro)
            let balance = 0;
            if (result.data && result.data.wallet_balance !== undefined) {
                balance = result.data.wallet_balance;
            } else if (result.balance !== undefined) {
                balance = result.balance;
            } else if (result.available_balance !== undefined) {
                balance = result.available_balance;
            }

            return {
                success: true,
                available_balance: parseFloat(balance) || 0,
                currency: 'GHS'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                available_balance: 0
            };
        }
    }

    async testConnection() {
        const balance = await this.checkBalance();
        if (balance.success) {
            return {
                connected: true,
                message: `✅ HubNet Connected | Balance: GHS ${balance.available_balance}`,
                balance: balance.available_balance
            };
        } else {
            return {
                connected: false,
                message: `❌ Connection failed: ${balance.error}`
            };
        }
    }
}

// Global instance like pbmdatahub.pro
const hubnetAPI = new HubNetAPI();