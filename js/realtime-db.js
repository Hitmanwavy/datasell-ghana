// js/realtime-db.js - FIXED DATABASE SYSTEM
class RealtimeDB {
    constructor() {
        this.initializeDatabase();
    }

    initializeDatabase() {
        // Initialize database structure if it doesn't exist
        if (!localStorage.getItem('datasell_database')) {
            const initialDB = {
                users: {},
                orders: {},
                prices: {
                    '1GB': 5.70,
                    '2GB': 10.70,
                    '3GB': 15.70,
                    '4GB': 20.70,
                    '5GB': 25.70,
                    '10GB': 50.70
                },
                admin: {
                    stats: {
                        totalOrders: 0,
                        totalRevenue: 0,
                        pendingOrders: 0,
                        deliveredOrders: 0
                    }
                }
            };
            localStorage.setItem('datasell_database', JSON.stringify(initialDB));
        }
    }

    getDatabase() {
        return JSON.parse(localStorage.getItem('datasell_database')) || {};
    }

    saveDatabase(db) {
        localStorage.setItem('datasell_database', JSON.stringify(db));
    }

    // ========== ORDER MANAGEMENT ==========
    async saveOrder(orderData) {
        try {
            const db = this.getDatabase();
            
            if (!db.orders) db.orders = {};
            
            // Save order with timestamp as key for easy sorting
            const orderKey = `order_${orderData.timestamp || Date.now()}`;
            db.orders[orderKey] = orderData;
            
            // Update admin stats
            this.updateAdminStats(db, orderData);
            
            this.saveDatabase(db);
            
            // Also save to legacy system for compatibility
            this.saveToLegacySystem(orderData);
            
            console.log('✅ Order saved to database:', orderKey);
            return { success: true, orderId: orderKey };
            
        } catch (error) {
            console.error('❌ Error saving order:', error);
            return { success: false, error: error.message };
        }
    }

    async getOrders() {
        try {
            const db = this.getDatabase();
            const orders = db.orders ? Object.values(db.orders) : [];
            
            // Sort by timestamp (newest first)
            return orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
        } catch (error) {
            console.error('Error getting orders:', error);
            return [];
        }
    }

    async updateOrder(orderId, updates) {
        try {
            const db = this.getDatabase();
            
            // Find order by ID
            const orderKey = Object.keys(db.orders).find(key => 
                db.orders[key].id === orderId
            );
            
            if (orderKey) {
                db.orders[orderKey] = { ...db.orders[orderKey], ...updates };
                this.saveDatabase(db);
                
                // Also update legacy system
                this.updateLegacyOrder(orderId, updates);
                
                return { success: true };
            }
            
            return { success: false, error: 'Order not found' };
            
        } catch (error) {
            console.error('Error updating order:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== PRICE MANAGEMENT ==========
    async getPrices() {
        try {
            const db = this.getDatabase();
            return db.prices || {};
        } catch (error) {
            console.error('Error getting prices:', error);
            return {};
        }
    }

    async savePrices(prices) {
        try {
            const db = this.getDatabase();
            db.prices = prices;
            this.saveDatabase(db);
            
            // Also save to legacy system
            localStorage.setItem('bundlePrices', JSON.stringify(prices));
            
            return { success: true };
        } catch (error) {
            console.error('Error saving prices:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== ADMIN STATISTICS ==========
    updateAdminStats(db, orderData) {
        if (!db.admin) db.admin = {};
        if (!db.admin.stats) db.admin.stats = {};
        
        const stats = db.admin.stats;
        
        // Initialize stats if they don't exist
        stats.totalOrders = (stats.totalOrders || 0) + 1;
        stats.totalRevenue = (stats.totalRevenue || 0) + (orderData.price || 0);
        
        // Update status counts
        if (orderData.status === 'paid') {
            stats.pendingOrders = (stats.pendingOrders || 0) + 1;
        } else if (orderData.status === 'delivered') {
            stats.deliveredOrders = (stats.deliveredOrders || 0) + 1;
            stats.pendingOrders = Math.max(0, (stats.pendingOrders || 1) - 1);
        }
        
        db.admin.stats = stats;
    }

    async getAdminStats() {
        try {
            const db = this.getDatabase();
            return db.admin?.stats || {
                totalOrders: 0,
                totalRevenue: 0,
                pendingOrders: 0,
                deliveredOrders: 0
            };
        } catch (error) {
            console.error('Error getting admin stats:', error);
            return {
                totalOrders: 0,
                totalRevenue: 0,
                pendingOrders: 0,
                deliveredOrders: 0
            };
        }
    }

    // ========== LEGACY SYSTEM COMPATIBILITY ==========
    saveToLegacySystem(orderData) {
        try {
            // Save to user orders
            let userOrders = JSON.parse(localStorage.getItem('userOrders')) || [];
            userOrders = userOrders.filter(order => order.id !== orderData.id);
            userOrders.push(orderData);
            localStorage.setItem('userOrders', JSON.stringify(userOrders));
            
            // Save to admin orders
            let adminOrders = JSON.parse(localStorage.getItem('adminOrders')) || [];
            adminOrders = adminOrders.filter(order => order.id !== orderData.id);
            adminOrders.push(orderData);
            localStorage.setItem('adminOrders', JSON.stringify(adminOrders));
            
        } catch (error) {
            console.error('Error saving to legacy system:', error);
        }
    }

    updateLegacyOrder(orderId, updates) {
        try {
            // Update user orders
            let userOrders = JSON.parse(localStorage.getItem('userOrders')) || [];
            const userOrderIndex = userOrders.findIndex(order => order.id === orderId);
            if (userOrderIndex !== -1) {
                userOrders[userOrderIndex] = { ...userOrders[userOrderIndex], ...updates };
                localStorage.setItem('userOrders', JSON.stringify(userOrders));
            }
            
            // Update admin orders
            let adminOrders = JSON.parse(localStorage.getItem('adminOrders')) || [];
            const adminOrderIndex = adminOrders.findIndex(order => order.id === orderId);
            if (adminOrderIndex !== -1) {
                adminOrders[adminOrderIndex] = { ...adminOrders[adminOrderIndex], ...updates };
                localStorage.setItem('adminOrders', JSON.stringify(adminOrders));
            }
            
        } catch (error) {
            console.error('Error updating legacy order:', error);
        }
    }

    // ========== DATA MIGRATION ==========
    async migrateLegacyData() {
        try {
            const db = this.getDatabase();
            
            // Migrate existing orders
            const legacyOrders = JSON.parse(localStorage.getItem('adminOrders')) || [];
            legacyOrders.forEach(order => {
                const orderKey = `order_${order.timestamp || Date.now()}`;
                if (!db.orders) db.orders = {};
                db.orders[orderKey] = order;
            });
            
            this.saveDatabase(db);
            console.log('✅ Legacy data migrated successfully');
            return { success: true, migrated: legacyOrders.length };
            
        } catch (error) {
            console.error('Error migrating legacy data:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== DATA EXPORT ==========
    async exportData() {
        try {
            const db = this.getDatabase();
            return {
                success: true,
                data: db,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Create global instance
const realtimeDB = new RealtimeDB();

// Auto-migrate legacy data on load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        realtimeDB.migrateLegacyData();
    }, 1000);
});