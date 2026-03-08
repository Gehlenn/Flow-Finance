/**
 * USAGE EXAMPLE - Flow Finance Clean Architecture
 *
 * Example of how to use the new Clean Architecture structure
 */

import { initializeApp, getAppContainer } from './src/config/appConfig';

// Initialize the application with local storage
const app = initializeApp({
  storageProvider: 'local',
});

// Get services for a specific user
const userId = 'user_123';

const userService = app.getUserService();
const transactionService = app.getTransactionService(userId);
const accountService = app.getAccountService(userId);
const goalService = app.getGoalService(userId);
const reportService = app.getReportService(userId);

// Example usage
async function exampleUsage() {
  try {
    // Create a user
    const user = await userService.createUser({
      email: 'user@example.com',
      name: 'John Doe',
      preferences: {
        currency: 'USD',
        language: 'en',
      },
    });

    console.log('User created:', user);

    // Create an account
    const account = await accountService.createAccount({
      name: 'Main Checking',
      type: 'checking',
      balance: 5000.00,
      currency: 'USD',
    });

    console.log('Account created:', account);

    // Create a transaction
    const transaction = await transactionService.createTransaction({
      accountId: account.id,
      amount: -50.00,
      description: 'Grocery shopping',
      category: 'Food',
      date: new Date(),
      type: 'expense',
    });

    console.log('Transaction created:', transaction);

    // Create a financial goal
    const goal = await goalService.createGoal({
      name: 'Emergency Fund',
      targetAmount: 10000.00,
      currentAmount: 2500.00,
      targetDate: new Date('2024-12-31'),
      category: 'Savings',
    });

    console.log('Goal created:', goal);

    // Generate a report
    const report = await reportService.generateMonthlyReport();
    console.log('Monthly report:', report);

    // Detect financial leaks
    const leaks = await reportService.detectLeaks();
    console.log('Detected leaks:', leaks);

  } catch (error) {
    console.error('Error:', error);
  }
}

// For API usage, initialize with API configuration
const apiApp = initializeApp({
  storageProvider: 'api',
  apiUrl: 'https://api.flowfinance.com',
  authToken: 'your-jwt-token',
});

// Export for use in components
export { app, apiApp, exampleUsage };